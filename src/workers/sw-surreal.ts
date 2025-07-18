/// <reference lib="WebWorker" />
// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope;

// Service Worker 版本号
const SW_VERSION = 'v1.0.1';
const SW_CACHE_NAME = `cuckoox-sw-${SW_VERSION}`;

// --- 立即注册事件监听器（确保在任何异步代码之前注册） ---
console.log(`Service Worker script executing - ${SW_VERSION}`);

const eventHandlers = {
  install: (event: ExtendableEvent) => {
    console.log(`Service Worker installing - ${SW_VERSION}`);
    event.waitUntil(
      Promise.all([
        self.skipWaiting(),
        // 延迟加载 precacheSurrealDBWasm 以避免循环依赖
        new Promise(resolve => {
          setTimeout(async () => {
            try {
              await precacheSurrealDBWasm();
            } catch (e) {
              console.warn("Failed to precache WASM:", e);
            }
            resolve(void 0);
          }, 0);
        })
      ])
    );
  },

  activate: (event: ExtendableEvent) => {
    console.log(`Service Worker activating - ${SW_VERSION}`);
    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        // 清理旧版本的缓存
        cleanupOldCaches()
      ]).then(async () => {
        try {
          // 初始化本地 SurrealDB
          await initializeLocalSurrealDB();
          // 初始化 TokenManager
          await initializeTokenManager();
          // 初始化 DataCacheManager
          await initializeDataCacheManager();

          // 尝试恢复连接配置
          const restoredConfig = await restoreConnectionConfig();
          if (restoredConfig) {
            connectionConfig = restoredConfig;
            console.log('ServiceWorker: Connection config restored during activation');

            // 尝试自动重连
            try {
              const connectionState = await ensureConnection();
              if (connectionState.isConnected) {
                console.log('ServiceWorker: Auto-reconnection successful after activation');
              } else {
                console.warn('ServiceWorker: Auto-reconnection failed after activation:', connectionState.error);
              }
            } catch (reconnectError) {
              console.warn('ServiceWorker: Auto-reconnection failed after activation:', reconnectError);
            }
          }

          // Service Worker 激活后，主动同步 localStorage 中的 token
          await syncTokensFromLocalStorage();
        } catch (e) {
          console.error("Failed during activation:", e);
        }
      })
    );
  },

  beforeunload: async () => {
    try {
      stopReconnection();
      stopConnectionHealthCheck();
      stopAuthStateRefresh();
      clearAuthStateCache();
      notifyConnectionStateChange();

      // 关闭 TokenManager
      if (tokenManager) {
        await tokenManager.close();
        tokenManager = null;
      }


      // 关闭 DataCacheManager
      if (dataCacheManager) {
        await dataCacheManager.close();
        dataCacheManager = null;
      }

      // 关闭本地数据库
      if (localDb) {
        await localDb.close();
        localDb = null;
      }
    } catch (e) {
      console.error("Failed during cleanup:", e);
    }
  },

  message: async (event: ExtendableMessageEvent) => {
    if (!event.data || !event.data.type) {
      return;
    }

    // 递归处理payload.data中可能被序列化的RecordId对象
    const { type, payload, messageId } = deserializeRecordIds(event.data);
    const clientId = (event.source as any)?.id;

    if (!clientId) return;

    const respond = (responsePayload: unknown) => postMessageToClient(clientId, {
      type: `${type}_response`,
      messageId,
      payload: responsePayload
    });

    const respondError = (error: Error) => postMessageToClient(clientId, {
      type: `${type}_error`,
      messageId,
      payload: { message: error.message, stack: error.stack }
    });

    try {
      switch (type) {
        case 'connect': {
          // Sync token information from localStorage if provided
          if (payload.sync_tokens) {
            await ensureTokenManager();
            const tokenInfo: Partial<TokenInfo> = {
              access_token: payload.sync_tokens.access_token,
              refresh_token: payload.sync_tokens.refresh_token,
              token_expires_at: payload.sync_tokens.token_expires_at,
              tenant_code: payload.sync_tokens.tenant_code,
            };
            await tokenManager!.storeToken(tokenInfo);
          }
          const connectionState = await ensureConnection(payload);

          // 如果连接成功，保存连接配置
          if (connectionState.isConnected && connectionConfig) {
            await saveConnectionConfig(connectionConfig);
          }

          respond({
            status: connectionState.isConnected ? 'connected' : 'disconnected',
            state: connectionState.state,
            isAuthenticated: connectionState.isAuthenticated,
            hasDb: connectionState.hasDb,
            error: connectionState.error
          });
          break;
        }

        case 'authenticate': {
          await ensureTokenManager();
          const tokenInfo: Partial<TokenInfo> = {
            access_token: payload.token,
            refresh_token: payload.refresh_token,
            token_expires_at: payload.expires_in ? Date.now() + (payload.expires_in * 1000) : undefined,
            tenant_code: payload.tenant_code,
          };
          await tokenManager!.storeToken(tokenInfo);

          const connectionState = await ensureConnection();
          if (connectionState.isConnected && connectionState.hasDb) {
            await db!.authenticate(payload.token);

            // 认证成功后，立即刷新认证状态缓存
            try {
              await refreshAuthStateCache();
              // 启动认证状态定期刷新
              startAuthStateRefresh();
            } catch (cacheError) {
              console.warn('ServiceWorker: Failed to refresh auth cache after authentication:', cacheError);
            }

            // 登录成功后，自动同步所有自动同步表
            try {
              await ensureDataCacheManager();
              const userId = await getCurrentUserId();
              if (userId) {
                console.log('ServiceWorker: Starting auto sync after authentication');
                await dataCacheManager!.autoSyncTables(userId, payload.case_id);
                console.log('ServiceWorker: Auto sync completed after authentication');
              }
            } catch (syncError) {
              console.warn('ServiceWorker: Auto sync failed after authentication:', syncError);
            }

            // Token refresh is now handled automatically by TokenManager
            respond({ success: true });
          } else {
            throw new Error("Connection not established.");
          }
          break;
        }

        case 'invalidate': {
          await ensureTokenManager();
          await tokenManager!.clearToken();
          // 清除认证状态缓存
          clearAuthStateCache();
          stopAuthStateRefresh();
          // Token refresh clearing is now handled by TokenManager
          const invalidateConnectionState = await ensureConnection();
          if (invalidateConnectionState.isConnected && invalidateConnectionState.hasDb) await db!.invalidate();
          respond({ success: true });
          break;
        }

        case 'query':
        case 'mutate': {
          const queryStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");

          // 检查连接状态，如果我们认为未连接，先尝试重新连接
          if (!connectionState.isConnected) {
            console.log('ServiceWorker: Query/mutate requested but not connected, attempting reconnection');
            const reconnectionState = await ensureConnection();
            if (!reconnectionState.isConnected) {
              throw new Error("Database connection not available");
            }
          }

          // 提取查询中的表名
          const tableNames = extractTableNamesFromQuery(payload.sql);
          const userId = await getCurrentUserId();

          // 对于SELECT查询，检查是否可以从缓存返回
          if (type === 'query') {
            // 检查是否所有涉及的表都是自动同步表
            const autoSyncTables = tableNames.filter(table => isAutoSyncTable(table));
            if (autoSyncTables.length > 0) {
              await ensureDataCacheManager();

              // 对于单表查询，优先尝试缓存
              if (tableNames.length === 1) {
                const table = tableNames[0];
                console.log(`ServiceWorker: Checking cache for auto-sync table: ${table}`);

                // 检查是否包含认证检查
                const hasAuthCheck = payload.sql.includes('return $auth;');
                
                // 尝试从缓存获取数据
                const cachedData = await dataCacheManager!.queryCache(table, payload.sql, payload.vars, userId);

                if (cachedData && cachedData.length > 0) {
                  const queryEndTime = performance.now();
                  const responseTime = Math.round((queryEndTime - queryStartTime) * 100) / 100;
                  console.log(`ServiceWorker: 查询完成 [缓存] 表: ${table}, 响应时间: ${responseTime}ms, 数据源: LocalDB, 记录数: ${cachedData.length}`);
                  
                  // 如果包含认证检查，需要先执行认证检查
                  if (hasAuthCheck) {
                    try {
                      const authResult = await db!.query('return $auth;');
                      // 构造符合queryWithAuth期望的结果格式
                      const resultWithAuth = [authResult[0], deserializeRecordIds(cachedData)];
                      respond(resultWithAuth);
                    } catch {
                      console.warn('ServiceWorker: Auth check failed for cached query, falling back to remote');
                      // 认证失败，回退到远程查询
                    }
                  } else {
                    respond(deserializeRecordIds(cachedData));
                  }
                  break;
                }

                // 缓存中没有数据，检查并自动同步
                const synced = await dataCacheManager!.checkAndAutoCache(table, userId);
                if (synced) {
                  // 重新尝试从缓存获取
                  const syncedData = await dataCacheManager!.queryCache(table, payload.sql, payload.vars, userId);
                  if (syncedData && syncedData.length > 0) {
                    const queryEndTime = performance.now();
                    const responseTime = Math.round((queryEndTime - queryStartTime) * 100) / 100;
                    console.log(`ServiceWorker: 查询完成 [自动同步] 表: ${table}, 响应时间: ${responseTime}ms, 数据源: LocalDB, 记录数: ${syncedData.length}`);
                    
                    // 如果包含认证检查，需要先执行认证检查
                    if (hasAuthCheck) {
                      try {
                        const authResult = await db!.query('return $auth;');
                        // 构造符合queryWithAuth期望的结果格式
                        const resultWithAuth = [authResult[0], deserializeRecordIds(syncedData)];
                        respond(resultWithAuth);
                      } catch {
                        console.warn('ServiceWorker: Auth check failed for synced query, falling back to remote');
                        // 认证失败，回退到远程查询
                      }
                    } else {
                      respond(deserializeRecordIds(syncedData));
                    }
                    break;
                  }
                }
              } else {
                // 对于多表查询，确保所有涉及的自动同步表都已缓存
                let allTablesCached = true;
                for (const table of autoSyncTables) {
                  const synced = await dataCacheManager!.checkAndAutoCache(table, userId);
                  if (!synced) {
                    allTablesCached = false;
                    break;
                  }
                }
                
                if (allTablesCached) {
                  console.log(`ServiceWorker: All auto-sync tables cached for multi-table query: ${autoSyncTables.join(', ')}`);
                }
              }
            }
          }

          // 执行远程查询
          const remoteQueryStartTime = performance.now();
          const results = await db!.query(payload.sql, payload.vars);
          const remoteQueryEndTime = performance.now();
          const remoteResponseTime = Math.round((remoteQueryEndTime - remoteQueryStartTime) * 100) / 100;

          // 检查是否为个人数据查询，如果是则自动缓存
          if (type === 'query' && isPersonalDataQuery(payload.sql, tableNames)) {
            console.log('ServiceWorker: Detected personal data query, attempting to cache');

            try {
              await ensureDataCacheManager();

              // 提取个人数据组件
              const personalDataComponent = extractPersonalDataComponent(payload.sql, results);

              if (personalDataComponent && userId) {
                console.log(`ServiceWorker: Caching personal data component: ${personalDataComponent.type}`);

                // 获取或创建用户个人数据缓存
                let existingPersonalData = await dataCacheManager!.getPersonalData(userId, payload.vars?.case_id);

                if (!existingPersonalData) {
                  existingPersonalData = {
                    permissions: { operations: [] },
                    roles: { global: [], case: {} },
                    menus: [],
                    syncTimestamp: Date.now()
                  };
                }

                // 更新对应的数据组件
                if (personalDataComponent.type === 'operations') {
                  existingPersonalData.permissions.operations = personalDataComponent.data.map((item: any) => ({
                    operation_id: item.operation_id,
                    case_id: item.case_id,
                    can_execute: item.can_execute,
                    conditions: item.conditions
                  }));
                } else if (personalDataComponent.type === 'menus') {
                  existingPersonalData.menus = personalDataComponent.data.map((item: any) => ({
                    id: item.id,
                    path: item.path,
                    labelKey: item.labelKey,
                    iconName: item.iconName,
                    parent_id: item.parent_id,
                    order_index: item.order_index,
                    is_active: item.is_active,
                    required_permissions: item.required_permissions
                  }));
                } else if (personalDataComponent.type === 'globalRoles') {
                  existingPersonalData.roles.global = personalDataComponent.data.map((item: any) => item.role_name);
                } else if (personalDataComponent.type === 'caseRoles') {
                  const caseRoleMap: Record<string, string[]> = {};
                  personalDataComponent.data.forEach((item: any) => {
                    const caseId = String(item.case_id);
                    if (!caseRoleMap[caseId]) {
                      caseRoleMap[caseId] = [];
                    }
                    caseRoleMap[caseId].push(item.role_name);
                  });
                  existingPersonalData.roles.case = { ...existingPersonalData.roles.case, ...caseRoleMap };
                }

                // 更新同步时间戳
                existingPersonalData.syncTimestamp = Date.now();

                // 缓存更新后的个人数据
                await dataCacheManager!.cachePersonalData(userId, payload.vars?.case_id, existingPersonalData);

                console.log('ServiceWorker: Successfully cached personal data component');
              }
            } catch (cacheError) {
              console.warn('ServiceWorker: Failed to cache personal data, but query succeeded:', cacheError);
            }
          }

          // 对于自动同步表的查询结果，自动缓存
          if (type === 'query' && tableNames.length === 1) {
            const table = tableNames[0];
            if (isAutoSyncTable(table) && results && results.length > 0) {
              await ensureDataCacheManager();

              try {
                // 缓存查询结果
                await dataCacheManager!.cacheData(table, results, 'persistent', userId);
                console.log(`ServiceWorker: Cached query results for auto-sync table: ${table}`);
              } catch (cacheError) {
                console.warn(`ServiceWorker: Failed to cache results for table: ${table}`, cacheError);
              }
            }
          }

          // 记录远程查询日志
          const totalQueryTime = performance.now() - queryStartTime;
          const totalResponseTime = Math.round(totalQueryTime * 100) / 100;
          const resultCount = Array.isArray(results) ? results.length : (results ? 1 : 0);
          
          if (type === 'query') {
            console.log(`ServiceWorker: 查询完成 [远程] 表: ${tableNames.join(', ')}, 总响应时间: ${totalResponseTime}ms, 远程查询时间: ${remoteResponseTime}ms, 数据源: RemoteDB, 记录数: ${resultCount}`);
          } else {
            console.log(`ServiceWorker: 变更完成 [远程] 表: ${tableNames.join(', ')}, 总响应时间: ${totalResponseTime}ms, 远程执行时间: ${remoteResponseTime}ms, 数据源: RemoteDB`);
          }
          
          respond(results);
          break;
        }

        case 'create': {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          
          const createResult = await db!.create(payload.thing, payload.data);
          
          const operationEndTime = performance.now();
          const responseTime = Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(`ServiceWorker: 创建完成 [远程] 表: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`);
          
          respond(createResult);
          break;
        }

        case 'select': {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          
          const selectResult = await db!.select(payload.thing as string | RecordId);
          
          const operationEndTime = performance.now();
          const responseTime = Math.round((operationEndTime - operationStartTime) * 100) / 100;
          const resultCount = Array.isArray(selectResult) ? selectResult.length : (selectResult ? 1 : 0);
          console.log(`ServiceWorker: 查询完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB, 记录数: ${resultCount}`);
          
          respond(selectResult);
          break;
        }

        case 'update': {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          
          const updateResult = await db!.update(payload.thing as string | RecordId, payload.data);
          
          const operationEndTime = performance.now();
          const responseTime = Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(`ServiceWorker: 更新完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`);
          
          respond(updateResult);
          break;
        }

        case 'merge': {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          
          const mergeResult = await db!.merge(payload.thing as string | RecordId, payload.data);
          
          const operationEndTime = performance.now();
          const responseTime = Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(`ServiceWorker: 合并完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`);
          
          respond(mergeResult);
          break;
        }

        case 'delete': {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          
          const deleteResult = await db!.delete(payload.thing as string | RecordId);
          
          const operationEndTime = performance.now();
          const responseTime = Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(`ServiceWorker: 删除完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`);
          
          respond(deleteResult);
          break;
        }

        case 'live': {
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb) throw new Error("Database not initialized");
          const { query, vars } = payload;

          // For SurrealDB live queries, we need to run a query with variables, not use the live() method directly
          const queryWithVars = vars ? query : query;
          const uuid = await db!.live(queryWithVars, (action, result) => {
            const sub = liveQuerySubscriptions.get(String(uuid));
            if (sub) {
              broadcastToClients({
                type: 'live_update',
                payload: { uuid: String(uuid), action, result }
              }, sub.clients);
            }
          });

          const uuidStr = String(uuid);
          if (!liveQuerySubscriptions.has(uuidStr)) {
            liveQuerySubscriptions.set(uuidStr, { query, vars, clients: new Set() });
          }
          liveQuerySubscriptions.get(uuidStr)!.clients.add(clientId);

          respond({ uuid: uuidStr });
          break;
        }

        case 'kill': {
          const { uuid: killUuid } = payload;
          const subscription = liveQuerySubscriptions.get(killUuid);
          if (subscription) {
            subscription.clients.delete(clientId);
            if (subscription.clients.size === 0 && db) {
              await db.kill(killUuid);
              liveQuerySubscriptions.delete(killUuid);
              console.log(`ServiceWorker: Killed live query ${killUuid} as no clients are listening.`);
            }
          }
          respond({ success: true });
          break;
        }

        case 'setup_token_refresh': {
          // Token refresh is now handled automatically by TokenManager
          respond({ success: true });
          break;
        }

        case 'clear_token_refresh': {
          // Token refresh clearing is now handled by TokenManager
          respond({ success: true });
          break;
        }

        case 'refresh_token': {
          // Token refresh is now handled internally by TokenManager
          respond({ success: false, message: 'Token refresh is handled automatically' });
          break;
        }

        case 'check_tenant_code': {
          const valid = await checkTenantCode();
          respond({ valid });
          break;
        }

        case 'recover_tokens': {
          await ensureTokenManager();
          const token = await tokenManager!.getToken();
          respond({ success: !!token });
          break;
        }

        case 'get_connection_state': {
          // 使用整合后的 ensureConnection 检查连接状态
          const connectionState = await ensureConnection();
          respond({
            state: connectionState.state,
            isConnected: connectionState.isConnected,
            isAuthenticated: connectionState.isAuthenticated,
            hasDb: connectionState.hasDb,
            isReconnecting: isReconnecting,
            reconnectAttempts: reconnectAttempts,
            endpoint: connectionConfig?.endpoint,
            error: connectionState.error
          });
          break;
        }

        case 'force_reconnect': {
          console.log('ServiceWorker: Force reconnection requested by client');
          stopConnectionHealthCheck();
          if (db) {
            try {
              await db.close();
              console.log('ServiceWorker: Closed connection for force reconnect');
            } catch (e) {
              console.warn('ServiceWorker: Error closing connection during force reconnect:', e);
            }
          }
          isConnected = false;
          console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 强制重连', {
            timestamp: new Date().toISOString(),
            previousState: true,
            newState: false,
            reason: '强制重连',
            dbStatus: db?.status,
            reconnectAttempts: reconnectAttempts,
            stackTrace: new Error().stack
          });
          stopReconnection();
          triggerReconnection();
          respond({ success: true });
          break;
        }

        case 'SKIP_WAITING': {
          console.log('ServiceWorker: 收到 SKIP_WAITING 消息，跳过等待');
          self.skipWaiting();
          respond({ success: true });
          break;
        }


        // 自动同步相关消息
        case 'trigger_auto_sync': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          try {
            console.log('ServiceWorker: Manual auto sync triggered for user:', userId);
            await dataCacheManager!.autoSyncTables(userId, caseId);
            respond({ success: true, message: 'Auto sync completed successfully' });
          } catch (error) {
            console.error('ServiceWorker: Manual auto sync failed:', error);
            respond({ success: false, message: (error as Error).message });
          }
          break;
        }

        // 用户个人数据管理相关消息
        case 'sync_user_personal_data': {
          try {
            await ensureDataCacheManager();
            const { userId, caseId, personalData } = payload;

            // 先直接缓存个人数据
            await dataCacheManager!.cachePersonalData(userId, caseId, personalData);

            // 然后尝试设置订阅（如果失败也不影响核心功能）
            try {
              await dataCacheManager!.subscribePersistent(
                ['user_personal_data'],
                userId,
                caseId,
                {
                  enableLiveQuery: true,
                  enableIncrementalSync: true,
                  syncInterval: 5 * 60 * 1000, // 5分钟
                  expirationMs: 24 * 60 * 60 * 1000 // 24小时
                }
              );
            } catch (subscriptionError) {
              console.warn('ServiceWorker: Failed to setup subscription for user personal data, but data was cached successfully:', subscriptionError);
            }

            respond({ success: true });
          } catch (error) {
            console.error('ServiceWorker: Error in sync_user_personal_data:', error);
            respond({ success: false, error: (error as Error).message });
          }
          break;
        }


        case 'get_user_personal_data': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          const personalData = await dataCacheManager!.getPersonalData(userId, caseId);
          respond({ personalData });
          break;
        }

        case 'clear_user_personal_data': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          await dataCacheManager!.clearPersonalData(userId, caseId);
          respond({ success: true });
          break;
        }

        // 页面数据缓存管理相关消息
        case 'subscribe_page_data': {
          await ensureDataCacheManager();
          const { tables, userId, caseId, config } = payload;

          // 使用临时缓存策略订阅页面数据
          await dataCacheManager!.subscribeTemporary(tables, userId, caseId, config);

          respond({ success: true });
          break;
        }

        case 'unsubscribe_page_data': {
          await ensureDataCacheManager();
          const { tables, userId, caseId } = payload;

          // 取消临时缓存订阅
          await dataCacheManager!.unsubscribe(tables, 'temporary', userId, caseId);

          respond({ success: true });
          break;
        }

        case 'query_cached_data': {
          await ensureDataCacheManager();
          const { table, query, params, userId, caseId } = payload;

          const data = await dataCacheManager!.queryCache(table, query, params, userId, caseId);
          respond({ data });
          break;
        }

        case 'update_cached_data': {
          await ensureDataCacheManager();
          const { table, recordId, data, userId, caseId } = payload;

          const result = await dataCacheManager!.updateData(table, recordId, data, userId, caseId);
          respond({ result });
          break;
        }

        case 'clear_table_cache': {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          await dataCacheManager!.clearTableCache(table, userId, caseId);
          respond({ success: true });
          break;
        }

        case 'clear_all_cache': {
          await ensureDataCacheManager();
          await dataCacheManager!.clearAllCache();
          respond({ success: true });
          break;
        }

        case 'cache_query_result': {
          await ensureDataCacheManager();
          const { table, result, userId, caseId } = payload;

          // 直接缓存查询结果
          await dataCacheManager!.cacheData(table, result, 'temporary', userId, caseId);

          respond({ success: true });
          break;
        }

        // 单个记录缓存相关消息（通用方法）
        case 'cache_record': {
          await ensureDataCacheManager();
          const { table, recordId, record, cacheType, userId, caseId } = payload;
          await dataCacheManager!.cacheRecord(table, recordId, record, cacheType || 'persistent', userId, caseId);
          respond({ success: true });
          break;
        }

        case 'get_cached_record': {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          const record = await dataCacheManager!.getCachedRecord(table, recordId, userId, caseId);
          respond({ record });
          break;
        }

        case 'clear_cached_record': {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          await dataCacheManager!.clearCachedRecord(table, recordId, userId, caseId);
          respond({ success: true });
          break;
        }

        // 增量同步相关消息
        case 'process_incremental_update': {
          await ensureDataCacheManager();
          const { update, conflictResolution } = payload;

          // 处理增量更新
          await processIncrementalUpdate(update, conflictResolution);

          respond({ success: true });
          break;
        }

        case 'create_sync_record': {
          await ensureDataCacheManager();
          const { syncRecord } = payload;

          // 创建同步记录
          await createSyncRecord(syncRecord);

          respond({ success: true });
          break;
        }

        case 'get_sync_record': {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          // 获取同步记录
          const syncRecord = await getSyncRecord(table, userId, caseId);

          respond({ syncRecord });
          break;
        }

        case 'update_sync_record': {
          await ensureDataCacheManager();
          const { syncRecordId, lastSyncTimestamp, lastSyncId, status } = payload;

          // 更新同步记录
          await updateSyncRecord(syncRecordId, lastSyncTimestamp, lastSyncId, status);

          respond({ success: true });
          break;
        }

        case 'update_sync_status': {
          await ensureDataCacheManager();
          const { syncRecordId, status, lastSyncTimestamp, errorMessage } = payload;

          // 更新同步状态
          await updateSyncStatus(syncRecordId, status, lastSyncTimestamp, errorMessage);

          respond({ success: true });
          break;
        }

        case 'clear_sync_records': {
          await ensureDataCacheManager();
          const { tables, userId, caseId } = payload;

          // 清除同步记录
          await clearSyncRecords(tables, userId, caseId);

          respond({ success: true });
          break;
        }

        // 双向同步相关消息
        case 'persist_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey, queue } = payload;

          // 持久化离线队列
          await persistOfflineQueue(syncKey, queue);

          respond({ success: true });
          break;
        }

        case 'restore_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 恢复离线队列
          const queue = await restoreOfflineQueue(syncKey);

          respond({ queue });
          break;
        }

        case 'clear_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 清除离线队列
          await clearOfflineQueue(syncKey);

          respond({ success: true });
          break;
        }

        default:
          console.warn(`ServiceWorker: Unknown message type received: ${type}`);
          respondError(new Error(`Unknown message type: ${type}`));
      }
    } catch (e: any) {
      console.error(`ServiceWorker: Error processing message type ${type}:`, e);
      respondError(e);
    }
  }
};

// 立即注册事件监听器
self.addEventListener('install', eventHandlers.install);
self.addEventListener('activate', eventHandlers.activate);
self.addEventListener('beforeunload', eventHandlers.beforeunload);
self.addEventListener('message', eventHandlers.message);

console.log("Service Worker event listeners registered");

import { Surreal, RecordId, ConnectionStatus, StringRecordId } from 'surrealdb';
import { TokenManager, TokenInfo } from './token-manager';
import { DataCacheManager, isAutoSyncTable } from './data-cache-manager';

// 获取WASM引擎的函数
async function getWasmEngines() {
  // 等待__surrealdbWasmEngines 加载
  let retryCount = 0;
  const maxRetries = 50; // 最多等待 5 秒（50 * 100ms）

  while (!(self as any).__surrealdbWasmEngines && retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retryCount++;
  }

  if (!(self as any).__surrealdbWasmEngines) {
    throw new Error('WASM engines not loaded after waiting');
  }

  return (self as any).__surrealdbWasmEngines();
}



// SurrealDB WASM 相关常量（现在已通过 ES 模块导入，无需外部 URL）


// Define AnyAuth type based on SurrealDB
export type AnyAuth = {
  username: string;
  password: string;
} | {
  token: string;
} | {
  namespace: string;
  database: string;
  scope: string;
  [key: string]: unknown;
};

// --- Global State ---
// 远程 SurrealDB 实例 (单例)
let db: Surreal | null = null;
// 本地 SurrealDB WASM 实例 (单例)
let localDb: Surreal | null = null;
let tokenManager: TokenManager | null = null;
let dataCacheManager: DataCacheManager | null = null;
let isConnected = false;
let isLocalDbInitialized = false;
let connectionConfig: {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: AnyAuth;
} | null = null;

// --- 认证状态缓存管理 ---
interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  lastUpdated: number;
  expiresAt: number;
}

let authStateCache: AuthState | null = null;
let authStateTimer: NodeJS.Timeout | null = null;
const AUTH_CACHE_DURATION = 30000; // 30秒缓存有效期
const AUTH_REFRESH_INTERVAL = 25000; // 25秒刷新间隔


// Live query management
const liveQuerySubscriptions = new Map<string, {
  query: string;
  vars?: Record<string, unknown>;
  clients: Set<string>; // Set of client IDs
}>();

// Token refresh is now handled by TokenManager

// Connection management and auto-reconnect
let reconnectTimer: NodeJS.Timeout | null = null;
let connectionHealthCheck: NodeJS.Timeout | null = null;
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = Infinity; // 无限重连
const RECONNECT_DELAY_BASE = 100; // 基础重连延迟 100ms
const RECONNECT_DELAY_MAX = 5000; // 最大重连延迟 5秒
const CONNECTION_TIMEOUT = 10000; // 10秒连接超时

// 使用SurrealDB官方的ConnectionStatus枚举，无需自定义状态

// --- 认证状态缓存管理函数 ---

/**
 * 启动认证状态定期刷新
 */
function startAuthStateRefresh() {
  stopAuthStateRefresh(); // 先停止现有的定时器
  
  authStateTimer = setInterval(async () => {
    try {
      if (isConnected && db) {
        await refreshAuthStateCache();
      }
    } catch (error) {
      console.warn('ServiceWorker: Auth state refresh failed:', error);
    }
  }, AUTH_REFRESH_INTERVAL);
  
  console.log('ServiceWorker: Auth state refresh timer started');
}

/**
 * 停止认证状态定期刷新
 */
function stopAuthStateRefresh() {
  if (authStateTimer) {
    clearInterval(authStateTimer);
    authStateTimer = null;
    console.log('ServiceWorker: Auth state refresh timer stopped');
  }
}

/**
 * 刷新认证状态缓存
 */
async function refreshAuthStateCache(): Promise<void> {
  try {
    if (!db || !isConnected) {
      clearAuthStateCache();
      return;
    }

    const result = await Promise.race([
      db.query('RETURN $auth;'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth refresh timeout')), 3000)
      )
    ]);

    let authResult = null;
    if (Array.isArray(result) && result.length > 0) {
      authResult = result[0];
    } else {
      authResult = result;
    }

    const isAuthenticated = authResult && typeof authResult === 'object' && authResult !== null;
    const userId = isAuthenticated ? String((authResult as any).id || null) : null;
    
    const now = Date.now();
    authStateCache = {
      userId,
      isAuthenticated,
      lastUpdated: now,
      expiresAt: now + AUTH_CACHE_DURATION
    };

    console.log('ServiceWorker: Auth state cache refreshed', {
      userId: userId ? `${userId.substring(0, 10)}...` : null,
      isAuthenticated
    });

  } catch (error) {
    console.warn('ServiceWorker: Failed to refresh auth state cache:', error);
    // 在刷新失败时，保持现有缓存但标记为过期
    if (authStateCache) {
      authStateCache.expiresAt = Date.now() - 1; // 标记为过期
    }
  }
}

/**
 * 清除认证状态缓存
 */
function clearAuthStateCache(): void {
  authStateCache = null;
  console.log('ServiceWorker: Auth state cache cleared');
}

/**
 * 获取缓存的认证状态
 */
function getCachedAuthState(): AuthState | null {
  if (!authStateCache) {
    return null;
  }
  
  // 检查缓存是否过期
  if (Date.now() > authStateCache.expiresAt) {
    console.log('ServiceWorker: Auth state cache expired');
    return null;
  }
  
  return authStateCache;
}

/**
 * 强制更新认证状态缓存
 */
async function updateAuthStateCache(userId: string | null, isAuthenticated: boolean): Promise<void> {
  const now = Date.now();
  authStateCache = {
    userId,
    isAuthenticated,
    lastUpdated: now,
    expiresAt: now + AUTH_CACHE_DURATION
  };
  
  console.log('ServiceWorker: Auth state cache updated', {
    userId: userId ? `${userId.substring(0, 10)}...` : null,
    isAuthenticated
  });
}

// --- Helper Functions for Event Handlers ---

/**
 * 检查是否为用户个人数据查询
 */
function isPersonalDataQuery(sql: string, tableNames: string[]): boolean {
  // 检查是否包含认证检查
  const hasAuthCheck = sql.includes('return $auth');
  if (!hasAuthCheck) return false;

  // 检查是否涉及个人数据相关的表或关系
  const personalDataPatterns = [
    'operation_metadata',  // 操作权限
    'menu_metadata',       // 菜单权限
    'has_role',           // 用户角色关系
    'has_case_role'       // 用户案件角色关系
  ];

  // 检查SQL中是否包含个人数据相关的表名或关系
  const sqlLower = sql.toLowerCase();
  return personalDataPatterns.some(pattern =>
    sqlLower.includes(pattern) || tableNames.includes(pattern)
  );
}

/**
 * 从查询结果中提取个人数据组件
 */
function extractPersonalDataComponent(sql: string, result: any): { type: string; data: any } | null {
  const sqlLower = sql.toLowerCase();

  // 检查认证状态（第一个结果应该是认证检查）
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const authResult = result[0];
  if (!authResult || authResult.length === 0) {
    console.warn('ServiceWorker: Authentication failed for personal data query');
    return null;
  }

  // 获取实际查询结果（从索引1开始）
  const actualResult = result.slice(1);
  if (!actualResult || actualResult.length === 0) {
    return null;
  }

  // 根据查询类型识别数据组件
  if (sqlLower.includes('operation_metadata')) {
    return {
      type: 'operations',
      data: actualResult[0] || []
    };
  } else if (sqlLower.includes('menu_metadata')) {
    return {
      type: 'menus',
      data: actualResult[0] || []
    };
  } else if (sqlLower.includes('has_role') && !sqlLower.includes('has_case_role')) {
    return {
      type: 'globalRoles',
      data: actualResult[0] || []
    };
  } else if (sqlLower.includes('has_case_role')) {
    return {
      type: 'caseRoles',
      data: actualResult[0] || []
    };
  }

  return null;
}

/**
 * 通知客户端连接状态变化
 */
function notifyConnectionStateChange(error?: Error) {
  // 优先使用我们维护的连接状态，而不是 db.status
  const currentState = isConnected ? 'connected' : 'disconnected';
  const dbStatus = db?.status || ConnectionStatus.Disconnected;

  console.log(`ServiceWorker: Connection state is ${currentState} (isConnected=${isConnected}, db.status=${dbStatus})`);

  // 通知所有客户端连接状态变化
  broadcastToAllClients({
    type: 'connection_state_changed',
    payload: {
      state: currentState,
      isConnected: isConnected,
      dbStatus: dbStatus,
      error: error?.message,
      timestamp: Date.now()
    }
  });
}

/**
 * 停止连接健康检查
 */
function stopConnectionHealthCheck() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
    connectionHealthCheck = null;
    console.log('ServiceWorker: Connection health check stopped');
  }
}

/**
 * 开始连接健康检查
 */
function startConnectionHealthCheck() {
  stopConnectionHealthCheck(); // 先停止现有的检查

  connectionHealthCheck = setInterval(async () => {
    try {
      // 只有在我们认为已连接时才进行健康检查
      if (!isConnected) {
        console.log('ServiceWorker: Skipping health check - isConnected is false');
        return;
      }

      // 使用更轻量的连接测试
      if (!db) {
        console.warn('ServiceWorker: Health check - db instance not available');
        const previousState = isConnected;
        isConnected = false;
        console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查中db实例不可用', {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: '健康检查中db实例不可用',
          reconnectAttempts: reconnectAttempts,
          stackTrace: new Error().stack
        });
        notifyConnectionStateChange();
        triggerReconnection();
        return;
      }

      // 执行简单的连接测试
      try {
        const testResult = await Promise.race([
          db.query('return 1;'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);

        if (testResult) {
          // 连接正常，保持现有状态
          console.log('ServiceWorker: Health check passed - connection is healthy');
        }
      } catch (testError) {
        console.warn('ServiceWorker: Health check failed - connection appears broken:', testError);

        // 健康检查失败，更新连接状态
        const previousState = isConnected;
        isConnected = false;
        console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查失败', {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: '健康检查失败',
          error: testError,
          dbStatus: db?.status,
          reconnectAttempts: reconnectAttempts,
          stackTrace: new Error().stack
        });
        notifyConnectionStateChange();

        // 触发重连
        if (!isReconnecting) {
          triggerReconnection();
        }
      }
    } catch (error) {
      console.error('ServiceWorker: Health check error:', error);
      // 健康检查本身出错，认为连接有问题
      const previousState = isConnected;
      isConnected = false;
      console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查异常', {
        timestamp: new Date().toISOString(),
        previousState: previousState,
        newState: false,
        reason: '健康检查异常',
        error: error,
        dbStatus: db?.status,
        reconnectAttempts: reconnectAttempts,
        stackTrace: new Error().stack
      });
      notifyConnectionStateChange();

      if (!isReconnecting) {
        triggerReconnection();
      }
    }
  }, 30000); // 每30秒检查一次

  console.log('ServiceWorker: Connection health check started');
}

/**
 * 计算重连延迟（指数退避，但有最大值限制）
 */
function calculateReconnectDelay(): number {
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttempts, 6)), // 最多 64 倍基础延迟
    RECONNECT_DELAY_MAX
  );
  return delay;
}

/**
 * 触发重连
 */
function triggerReconnection() {
  if (isReconnecting) {
    console.log('ServiceWorker: Reconnection already in progress, skipping');
    return;
  }

  isReconnecting = true;
  notifyConnectionStateChange();

  // 立即尝试重连（第一次重连延迟很小）
  const delay = reconnectAttempts === 0 ? RECONNECT_DELAY_BASE : calculateReconnectDelay();

  console.log(`ServiceWorker: Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    await performReconnection().finally(() => isReconnecting = false)
  }, delay);
}

/**
 * 执行重连
 */
async function performReconnection() {
  if (!connectionConfig) {
    console.error('ServiceWorker: Cannot reconnect - no connection config available');
    isReconnecting = false;
    notifyConnectionStateChange();
    return;
  }

  // 如果我们认为连接正常，但实际上需要重连，则跳过状态检查
  if (isConnected && db?.status === ConnectionStatus.Connected) {
    console.log('ServiceWorker: Skipping reconnection - connection appears healthy');
    return;
  }

  reconnectAttempts++;
  console.log(`ServiceWorker: Attempting reconnection #${reconnectAttempts} to ${connectionConfig.endpoint}`);

  try {
    // 清理当前连接
    if (db) {
      try {
        await db.close();
        console.log('ServiceWorker: Closed existing connection for reconnection');
      } catch (e) {
        console.warn('ServiceWorker: Error closing connection during reconnection:', e);
      }
    }

    // 明确设置为断开状态
    const previousState = isConnected;
    isConnected = false;
    console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 重连前状态重置', {
      timestamp: new Date().toISOString(),
      previousState: previousState,
      newState: false,
      reason: '重连前状态重置',
      reconnectAttempts: reconnectAttempts,
      dbStatus: db?.status,
      stackTrace: new Error().stack
    });

    // 确保数据库实例存在（使用单例模式）
    await initializeSurreal();

    // 设置连接超时（连接成功时，connectWithTimeout内部会设置isConnected=true）
    const connectPromise = connectWithTimeout();
    await connectPromise;

    // 重连成功 - isConnected已经在connectWithTimeout中设置为true了
    reconnectAttempts = 0;
    isReconnecting = false;

    console.log('ServiceWorker: Reconnection successful, isConnected state:', isConnected);
    notifyConnectionStateChange();
    startConnectionHealthCheck();

    // 重新订阅所有 Live Query
    await resubscribeAllLiveQueries();

  } catch (error) {
    console.error(`ServiceWorker: Reconnection attempt #${reconnectAttempts} failed:`, error);

    // 如果还需要继续重连
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      isReconnecting = false;

      // 立即触发下一次重连
      triggerReconnection();
    } else {
      // 达到最大重连次数
      isReconnecting = false;
      notifyConnectionStateChange(error as Error);
      console.error('ServiceWorker: Max reconnection attempts reached');
    }
  }
}

/**
 * 带超时的连接函数
 */
async function connectWithTimeout(): Promise<void> {
  if (!connectionConfig) {
    throw new Error('No connection config available');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, CONNECTION_TIMEOUT);

    const doConnect = async () => {
      try {
        const conn = await db!.connect(connectionConfig!.endpoint);
        console.log('ServiceWorker: connect resp:', conn)

        // 连接成功，更新状态
        isConnected = true;
        console.log('ServiceWorker: Connection established, isConnected set to true');

        // 设置连接事件监听器
        setupConnectionEventListeners();

        await db!.use({ namespace: connectionConfig!.namespace, database: connectionConfig!.database });

        // 重新认证
        await ensureTokenManager();
        const token = await tokenManager!.getToken();

        if (token && token.access_token) {
          await db!.authenticate(token.access_token);
          console.log('ServiceWorker: Re-authenticated successfully during reconnection');

          // 认证成功后，立即刷新认证状态缓存
          try {
            await refreshAuthStateCache();
          } catch (cacheError) {
            console.warn('ServiceWorker: Failed to refresh auth cache after re-authentication:', cacheError);
          }

          // Token refresh is now handled automatically by TokenManager
        }

        clearTimeout(timeout);
        resolve();
      } catch (error) {
        // 连接失败，确保状态正确
        const previousState = isConnected;
        isConnected = false;
        console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接失败', {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: '连接失败',
          error: error,
          connectionConfig: connectionConfig,
          stackTrace: new Error().stack
        });
        clearTimeout(timeout);
        reject(error);
      }
    };

    doConnect();
  });
}

/**
 * 设置连接事件监听器
 */
function setupConnectionEventListeners() {
  if (!db || !db.emitter) {
    console.warn('ServiceWorker: Cannot setup connection event listeners - db or emitter not available');
    return;
  }

  // 监听连接状态变化
  db.emitter.subscribe('disconnected', () => {
    console.warn('ServiceWorker: Database connection lost (disconnected event)');
    const wasConnected = isConnected;
    isConnected = false;
    console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库断开连接事件', {
      timestamp: new Date().toISOString(),
      previousState: wasConnected,
      newState: false,
      reason: '数据库断开连接事件',
      dbStatus: db?.status,
      reconnectAttempts: reconnectAttempts,
      stackTrace: new Error().stack
    });

    if (wasConnected) {
      console.log('ServiceWorker: Connection state changed from connected to disconnected');
      notifyConnectionStateChange();
    }

    stopConnectionHealthCheck();
    // 连接断开时清除认证状态缓存
    clearAuthStateCache();
    stopAuthStateRefresh();

    // 立即触发重连
    if (!isReconnecting) {
      triggerReconnection();
    }
  });

  db.emitter.subscribe('error', (error: Error) => {
    console.error('ServiceWorker: Database connection error:', error);
    const wasConnected = isConnected;
    isConnected = false;
    console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库错误事件', {
      timestamp: new Date().toISOString(),
      previousState: wasConnected,
      newState: false,
      reason: '数据库错误事件',
      error: error,
      dbStatus: db?.status,
      reconnectAttempts: reconnectAttempts,
      stackTrace: new Error().stack
    });

    if (wasConnected) {
      console.log('ServiceWorker: Connection state changed to disconnected due to error');
    }

    notifyConnectionStateChange(error);
    stopConnectionHealthCheck();
    // 连接错误时清除认证状态缓存
    clearAuthStateCache();
    stopAuthStateRefresh();

    // 立即触发重连
    if (!isReconnecting) {
      triggerReconnection();
    }
  });

  // 监听连接成功事件
  db.emitter.subscribe('connected', () => {
    console.log('ServiceWorker: Database connection established (connected event)');
    const wasDisconnected = !isConnected;
    isConnected = true;
    isReconnecting = false;
    reconnectAttempts = 0;

    if (wasDisconnected) {
      console.log('ServiceWorker: Connection state changed from disconnected to connected');
    }

    notifyConnectionStateChange();
    startConnectionHealthCheck();
    
    // 连接成功后，尝试刷新认证状态缓存
    if (db) {
      refreshAuthStateCache().catch(error => {
        console.warn('ServiceWorker: Failed to refresh auth cache after connection:', error);
      });
    }
  });

  // 监听重连事件
  db.emitter.subscribe('reconnecting', () => {
    console.log('ServiceWorker: Database reconnecting... (reconnecting event)');
    // 注意：reconnecting 时不要修改 isConnected 状态，
    // 因为这只是表示正在重连，实际连接状态要等 connected 或 disconnected 事件
    isReconnecting = true;
    notifyConnectionStateChange();
  });

  console.log('ServiceWorker: Connection event listeners set up successfully');
}

/**
 * 停止重连
 */
function stopReconnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isReconnecting = false;
  reconnectAttempts = 0;
  console.log('ServiceWorker: Reconnection stopped');
}


/**
 * 从客户端的 localStorage 同步 token 到 Service Worker
 */
async function syncTokensFromLocalStorage() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // 向第一个客户端请求同步 token
      clients[0].postMessage({
        type: 'request_token_sync',
        payload: {}
      });
    }
  } catch (error) {
    console.error('ServiceWorker: Failed to sync tokens from localStorage:', error);
  }
}

/**
 * 保存连接配置到持久化存储
 */
async function saveConnectionConfig(config: typeof connectionConfig): Promise<void> {
  try {
    if (!config) {
      console.warn('ServiceWorker: Cannot save null connection config');
      return;
    }

    await ensureDataCacheManager();

    // 使用本地数据库存储连接配置
    if (localDb) {
      const updated = await localDb.upsert(new StringRecordId('sw_connection_config:current'), {
        endpoint: config.endpoint,
        namespace: config.namespace,
        database: config.database,
        auth: config.auth,
        saved_at: Date.now()
      });

      console.log('ServiceWorker: Connection config saved to persistent storage', updated, config);
    }
  } catch (error) {
    console.error('ServiceWorker: Failed to save connection config:', error);
  }
}

/**
 * 从持久化存储恢复连接配置
 */
async function restoreConnectionConfig(): Promise<typeof connectionConfig> {
  try {
    await ensureDataCacheManager();

    if (localDb) {
      const storedConfig = await localDb.select(new StringRecordId('sw_connection_config:current'));
      console.log('ServiceWorker: Connection config restored from persistent storage', storedConfig);
      if (storedConfig && typeof storedConfig === 'object') {
        const config = storedConfig as any;

        // 验证配置有效性
        if (config.endpoint && config.namespace && config.database) {

          return {
            endpoint: config.endpoint,
            namespace: config.namespace,
            database: config.database,
            auth: config.auth
          };
        }
      }
    }

    console.log('ServiceWorker: No valid connection config found in persistent storage');
    return null;
  } catch (error) {
    console.error('ServiceWorker: Failed to restore connection config:', error);
    return null;
  }
}



// --- Cache and Storage Functions ---

/**
 * 清理旧版本的缓存
 */
async function cleanupOldCaches(): Promise<void> {
  try {
    console.log('ServiceWorker: Cleaning up old caches...');
    const cacheNames = await caches.keys();
    const oldCacheNames = cacheNames.filter(name =>
      name.startsWith('cuckoox-sw-') && name !== SW_CACHE_NAME
    );

    await Promise.all(
      oldCacheNames.map(cacheName => {
        console.log(`ServiceWorker: Deleting old cache: ${cacheName}`);
        return caches.delete(cacheName);
      })
    );

    console.log('ServiceWorker: Old caches cleaned up successfully');
  } catch (error) {
    console.warn('ServiceWorker: Failed to cleanup old caches:', error);
  }
}

/**
 * 预缓存 SurrealDB WASM 文件
 */
async function precacheSurrealDBWasm(): Promise<void> {
  try {
    console.log('ServiceWorker: Precaching WASM files...');

    // 预加载WASM和JS文件
    const [wasmResponse] = await Promise.all([
      fetch('https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/index_bg.wasm'),
    ]);

    if (wasmResponse.ok) {
      console.log('ServiceWorker: WASM files precached successfully');
    } else {
      console.warn('ServiceWorker: Failed to precache some WASM files');
    }
  } catch (error) {
    console.warn('ServiceWorker: WASM precaching failed, continuing without cache:', error);
  }
}

/**
 * 初始化本地 SurrealDB WASM 实例
 */
async function initializeLocalSurrealDB(): Promise<void> {
  if (isLocalDbInitialized && localDb) {
    // console.log('ServiceWorker: Local SurrealDB already initialized, reusing singleton instance');
    return;
  }

  try {
    console.log('ServiceWorker: Initializing local SurrealDB singleton...');

    // 创建使用 WASM 引擎的 Surreal 实例 (单例)
    localDb = new Surreal({
      engines: await getWasmEngines(),
    });

    await localDb.connect('indxdb://cuckoox-storage');
    await localDb.use({ namespace: 'ck_go', database: 'local' });

    isLocalDbInitialized = true;
    console.log('ServiceWorker: Local SurrealDB singleton initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize local SurrealDB:', error);
    // 即使初始化失败，也标记为已尝试
    isLocalDbInitialized = true;
    throw error;
  }
}

/**
 * 初始化 TokenManager
 */
async function initializeTokenManager(): Promise<void> {
  if (tokenManager) return;

  try {
    console.log('ServiceWorker: Initializing TokenManager...');

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 TokenManager 并传入 localDb
    tokenManager = new TokenManager({
      apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8082',
      broadcastToAllClients: broadcastToAllClients,
    });

    await tokenManager.initialize(localDb);
    console.log('ServiceWorker: TokenManager initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize TokenManager:', error);
    throw error;
  }
}

/**
 * 确保 TokenManager 已初始化
 */
async function ensureTokenManager(): Promise<void> {
  if (!tokenManager) {
    await initializeTokenManager();
  }
}


/**
 * 初始化 DataCacheManager
 */
async function initializeDataCacheManager(): Promise<void> {
  if (dataCacheManager) return;

  try {
    console.log('ServiceWorker: Initializing DataCacheManager...');

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 DataCacheManager 实例
    dataCacheManager = new DataCacheManager({
      localDb: localDb!,
      remoteDb: db || undefined,
      broadcastToAllClients: broadcastToAllClients,
      defaultExpirationMs: 60 * 60 * 1000 // 1小时
    });

    await dataCacheManager.initialize();
    console.log('ServiceWorker: DataCacheManager initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize DataCacheManager:', error);
    throw error;
  }
}

/**
 * 确保 DataCacheManager 已初始化
 */
async function ensureDataCacheManager(): Promise<void> {
  if (!dataCacheManager) {
    await initializeDataCacheManager();
  }
}




// --- Helper Functions ---

/**
 * 从SQL查询中提取表名
 * 支持基本的SELECT、INSERT、UPDATE、DELETE语句
 */
function extractTableNamesFromQuery(sql: string): string[] {
  const tables: string[] = [];

  // 移除多余的空格和换行符
  const cleanSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  // SELECT 语句：SELECT ... FROM table
  const selectMatches = cleanSql.matchAll(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of selectMatches) {
    tables.push(match[1]);
  }

  // INSERT 语句：INSERT INTO table
  const insertMatches = cleanSql.matchAll(/insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of insertMatches) {
    tables.push(match[1]);
  }

  // UPDATE 语句：UPDATE table
  const updateMatches = cleanSql.matchAll(/update\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of updateMatches) {
    tables.push(match[1]);
  }

  // DELETE 语句：DELETE FROM table
  const deleteMatches = cleanSql.matchAll(/delete\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of deleteMatches) {
    tables.push(match[1]);
  }

  // 去重并返回
  return [...new Set(tables)];
}


/**
 * 获取当前用户ID（优先从缓存中获取）
 */
async function getCurrentUserId(): Promise<string | undefined> {
  try {
    // 优先从缓存获取
    const cachedAuth = getCachedAuthState();
    if (cachedAuth && cachedAuth.isAuthenticated && cachedAuth.userId) {
      console.log('ServiceWorker: Current user ID from cache:', cachedAuth.userId);
      return cachedAuth.userId;
    }

    // 缓存不可用时，检查连接状态
    const connectionState = await ensureConnection();
    if (!connectionState.hasDb || !connectionState.isConnected) {
      console.warn('ServiceWorker: Cannot get user ID - no database connection');
      return undefined;
    }

    // 执行查询并更新缓存
    const authResult = await db!.query('RETURN $auth;');

    if (authResult && authResult.length > 0 && authResult[0]) {
      const auth = authResult[0] as any;
      // 从认证信息中提取用户ID
      if (auth.id) {
        const userId = String(auth.id);
        console.log('ServiceWorker: Current user ID from query:', userId);
        
        // 更新缓存
        await updateAuthStateCache(userId, true);
        
        return userId;
      }
    }

    // 未认证状态，更新缓存
    await updateAuthStateCache(null, false);
    return undefined;
  } catch (error) {
    console.warn('ServiceWorker: Failed to get current user ID:', error);
    return undefined;
  }
}

/**
 * 递归检查并重构被序列化的RecordId对象
 * 当RecordId对象通过ServiceWorker传递时，会丢失其原型，变成普通对象
 * 这个函数会检测这种情况并重新构造RecordId
 */
function deserializeRecordIds(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 检查是否是被序列化的RecordId对象（具有id和tb属性）
  if (typeof obj === 'object' && 'id' in obj && 'tb' in obj) {
    // 这很可能是一个被序列化的RecordId，重新构造它
    return new RecordId(obj.tb, obj.id);
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map(item => deserializeRecordIds(item));
  }

  // 如果是对象，递归处理每个属性
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeRecordIds(value);
    }
    if (Object.entries(result).length !== 0) {
      return result;
    }
  }

  // 其他类型直接返回
  return obj;
}


async function postMessageToClient(clientId: string, message: Record<string, unknown>) {
  const client = await self.clients.get(clientId);
  if (client) {
    client.postMessage(message);
  } else {
    console.warn(`ServiceWorker: Client with ID ${clientId} not found.`);
  }
}

async function broadcastToClients(message: Record<string, unknown>, clientIds: Set<string>) {
  for (const clientId of clientIds) {
    await postMessageToClient(clientId, message);
  }
}

// --- Token Refresh Logic ---

/**
 * 检查租户代码是否存在
 */
async function checkTenantCode(): Promise<boolean> {
  await ensureTokenManager();

  const hasTenantCode = await tokenManager!.hasTenantCode();

  if (!hasTenantCode) {
    // 清除认证状态
    await tokenManager!.clearToken();

    // 广播租户代码丢失事件给所有客户端
    broadcastToAllClients({
      type: 'tenant_code_missing',
      payload: { message: 'Tenant code is missing, user needs to login again' }
    });

    return false;
  }

  return true;
}

/**
 * 广播消息给所有客户端
 */
async function broadcastToAllClients(message: Record<string, unknown>) {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage(message);
  }
}


// --- SurrealDB Logic ---

async function initializeSurreal(): Promise<void> {
  if (db) {
    // console.log("ServiceWorker: SurrealDB already initialized, reusing singleton instance");
    return;
  }

  try {
    // Create a new SurrealDB instance (singleton)
    db = new Surreal();
    console.log("ServiceWorker: SurrealDB singleton initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize SurrealDB:", error);
    throw error;
  }
}

// 连接状态结果接口
interface ConnectionState {
  state: 'connected' | 'disconnected' | 'connecting' | 'error';
  isConnected: boolean;
  isAuthenticated: boolean;
  hasDb: boolean;
  error?: string;
}

let connecting = false;

async function ensureConnection(newConfig?: typeof connectionConfig): Promise<ConnectionState> {
  if (connecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 如果正在连接，等待完成后继续检查连接状态
  }

  connecting = true;

  try {
    // 1. 确保数据库实例存在
    await initializeSurreal();

    if (!db) {
      console.error("ServiceWorker: Failed to initialize database instance");
      const previousState = isConnected;
      isConnected = false;
      console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库实例初始化失败', {
        timestamp: new Date().toISOString(),
        previousState: previousState,
        newState: false,
        reason: '数据库实例初始化失败',
        stackTrace: new Error().stack
      });
      return {
        state: 'error',
        isConnected: false,
        isAuthenticated: false,
        hasDb: false,
        error: 'Database initialization failed'
      };
    }

    // 2. 处理配置变化或设置新配置
    await handleConfigurationChanges(newConfig);

    // 3. 检查是否有配置
    if (!connectionConfig) {
      console.log("ServiceWorker: Connection config not set, attempting to restore from storage");

      const restoredConfig = await restoreConnectionConfig();
      if (restoredConfig) {
        connectionConfig = restoredConfig;
        console.log("ServiceWorker: Connection config restored from storage");
      } else {
        console.error("ServiceWorker: No connection config available and cannot restore from storage");
        notifyConnectionStateChange();
        return {
          state: 'disconnected',
          isConnected: false,
          isAuthenticated: false,
          hasDb: true,
          error: 'No connection configuration available'
        };
      }
    }

    // 4. 检查当前连接状态和建立连接（融合 checkActualConnectionState 逻辑）
    console.log('ServiceWorker: Current isConnected state:', isConnected);

    // 如果我们认为已经断开连接，先检查 db.status 是否有变化
    if (!isConnected) {
      const dbStatus = db.status;
      console.log('ServiceWorker: db.status when isConnected=false:', dbStatus);

      // 如果 db.status 也显示未连接，尝试重新连接
      if (dbStatus !== ConnectionStatus.Connected) {
        try {
          notifyConnectionStateChange();
          console.log(`ServiceWorker: Connecting to ${connectionConfig.endpoint}...`);

          // 使用带超时的连接
          await connectWithTimeout();

          isConnected = true;
          notifyConnectionStateChange();
          startConnectionHealthCheck();
          console.log("ServiceWorker: Connection established.");

          // 保存连接配置
          await saveConnectionConfig(connectionConfig);

          // 重置重连计数
          reconnectAttempts = 0;

          // Resubscribe to all live queries
          await resubscribeAllLiveQueries();

        } catch (e) {
          console.error("ServiceWorker: Connection failed.", e);
          const previousState = isConnected;
          isConnected = false;
          console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接建立失败', {
            timestamp: new Date().toISOString(),
            previousState: previousState,
            newState: false,
            reason: '连接建立失败',
            error: e,
            connectionConfig: connectionConfig,
            reconnectAttempts: reconnectAttempts,
            stackTrace: new Error().stack
          });
          notifyConnectionStateChange(e as Error);

          // 触发自动重连
          triggerReconnection();

          return {
            state: 'error',
            isConnected: false,
            isAuthenticated: false,
            hasDb: true,
            error: (e as Error).message
          };
        }
      } else {
        // db.status 显示已连接，但我们的状态是断开，需要同步状态
        console.log('ServiceWorker: db.status shows connected but isConnected=false, syncing state...');
        
        // 通过执行简单查询来验证连接是否真正可用
        try {
          await Promise.race([
            db.query('return 1;'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Connection sync test timeout')), 3000)
            )
          ]);
          
          // 查询成功，同步状态
          isConnected = true;
          console.log('ServiceWorker: Connection state synced - db is actually connected');
          notifyConnectionStateChange();
        } catch (syncError) {
          console.warn('ServiceWorker: Connection sync test failed, forcing reconnection:', syncError);
          // 强制重连
          try {
            await connectWithTimeout();
            isConnected = true;
            notifyConnectionStateChange();
          } catch (reconnectError) {
            console.error('ServiceWorker: Forced reconnection failed:', reconnectError);
          }
        }
      }
    }

    // 5. 检查认证状态（优先使用缓存）
    try {
      let isAuthenticated = false;
      
      // 优先从缓存获取认证状态
      const cachedAuth = getCachedAuthState();
      if (cachedAuth && cachedAuth.isAuthenticated) {
        isAuthenticated = true;
        console.log('ServiceWorker: Authentication status from cache: authenticated');
      } else {
        // 缓存不可用时，使用简单的查询测试连接和认证状态
        const result = await Promise.race([
          db.query('return $auth;'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection test timeout')), 8000)
          )
        ]);

        // 查询成功，连接正常
        if (!isConnected) {
          isConnected = true;
          console.log('ServiceWorker: Connection state corrected to connected after test');
        }

        // 检查认证状态
        let authResult = null;
        if (Array.isArray(result) && result.length > 0) {
          authResult = result[0];
        } else {
          authResult = result;
        }

        isAuthenticated = authResult &&
          typeof authResult === 'object' &&
          authResult !== null;

        console.log('ServiceWorker: Authentication status from query:', isAuthenticated ? 'authenticated' : 'not authenticated');

        // 更新认证状态缓存
        const userId = isAuthenticated ? String((authResult as any).id || null) : null;
        await updateAuthStateCache(userId, isAuthenticated);
      }

      // 如果未认证，广播认证状态变化
      if (!isAuthenticated) {
        console.log('ServiceWorker: User not authenticated, broadcasting auth state change');
        broadcastToAllClients({
          type: 'auth_state_changed',
          payload: {
            isAuthenticated: false,
            reason: 'connection_check',
            timestamp: Date.now()
          }
        });
      }

      return {
        state: 'connected',
        isConnected: true,
        isAuthenticated: isAuthenticated,
        hasDb: true
      };

    } catch (queryError) {
      // 查询失败，连接有问题，需要重新连接
      console.warn('ServiceWorker: Connection test query failed:', queryError);

      // 更新我们维护的连接状态
      const wasConnected = isConnected;
      isConnected = false;
      console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接测试查询失败', {
        timestamp: new Date().toISOString(),
        previousState: wasConnected,
        newState: false,
        reason: '连接测试查询失败',
        error: queryError,
        dbStatus: db?.status,
        reconnectAttempts: reconnectAttempts,
        stackTrace: new Error().stack
      });

      // 尝试重新连接
      try {
        console.log('ServiceWorker: Attempting to reconnect due to query failure...');
        notifyConnectionStateChange();

        // 使用带超时的连接
        await connectWithTimeout();

        isConnected = true;
        notifyConnectionStateChange();
        startConnectionHealthCheck();
        console.log("ServiceWorker: Reconnection successful after query failure.");

        // 保存连接配置
        await saveConnectionConfig(connectionConfig);

        // 重置重连计数
        reconnectAttempts = 0;

        // Resubscribe to all live queries
        await resubscribeAllLiveQueries();

        // 重新测试认证状态
        try {
          const retestResult = await db.query<RecordId[]>('return $auth;');
          let retestAuthResult = null;
          if (Array.isArray(retestResult) && retestResult.length > 0) {
            retestAuthResult = retestResult[0];
          } else {
            retestAuthResult = retestResult;
          }

          const retestIsAuthenticated = retestAuthResult &&
            typeof retestAuthResult === 'object' &&
            retestAuthResult !== null;

          // 更新认证状态缓存
          const userId = retestIsAuthenticated ? String((retestAuthResult as any).id || null) : null;
          await updateAuthStateCache(userId, retestIsAuthenticated);

          return {
            state: 'connected',
            isConnected: true,
            isAuthenticated: retestIsAuthenticated,
            hasDb: true
          };
        } catch {
          // 重新连接后认证测试失败，但连接是成功的
          await updateAuthStateCache(null, false);
          return {
            state: 'connected',
            isConnected: true,
            isAuthenticated: false,
            hasDb: true
          };
        }

      } catch (reconnectError) {
        console.error('ServiceWorker: Reconnection failed after query failure:', reconnectError);

        // 触发重连机制
        if (!isReconnecting) {
          triggerReconnection();
        }

        return {
          state: 'disconnected',
          isConnected: false,
          isAuthenticated: false,
          hasDb: true,
          error: (reconnectError as Error).message
        };
      }
    }

  } catch (error) {
    console.error('ServiceWorker: Error in ensureConnection:', error);
    const previousState = isConnected;
    isConnected = false;
    console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: ensureConnection异常', {
      timestamp: new Date().toISOString(),
      previousState: previousState,
      newState: false,
      reason: 'ensureConnection异常',
      error: error,
      dbStatus: db?.status,
      stackTrace: new Error().stack
    });

    return {
      state: 'error',
      isConnected: false,
      isAuthenticated: false,
      hasDb: !!db,
      error: (error as Error).message
    };
  } finally {
    connecting = false;
  }
}

/**
 * 处理配置变化
 */
async function handleConfigurationChanges(newConfig?: typeof connectionConfig): Promise<void> {
  if (newConfig && connectionConfig) {
    // 检查配置变化的具体部分
    const endpointChanged = connectionConfig.endpoint !== newConfig.endpoint;
    const namespaceChanged = connectionConfig.namespace !== newConfig.namespace;
    const databaseChanged = connectionConfig.database !== newConfig.database;
    const authChanged = JSON.stringify(connectionConfig.auth) !== JSON.stringify(newConfig.auth);

    if (endpointChanged) {
      // endpoint 变化需要重新建立连接
      console.log("ServiceWorker: Endpoint changed, reconnecting...", connectionConfig.endpoint, '->', newConfig.endpoint);
      stopConnectionHealthCheck();

      if (isConnected && db) {
        try {
          await db.close();
          console.log("ServiceWorker: Closed existing connection for endpoint change");
        } catch (e) {
          console.warn("ServiceWorker: Error closing connection:", e);
        }
      }
      const previousState = isConnected;
      isConnected = false;
      console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 端点变更', {
        timestamp: new Date().toISOString(),
        previousState: previousState,
        newState: false,
        reason: '端点变更',
        oldEndpoint: connectionConfig.endpoint,
        newEndpoint: newConfig.endpoint,
        dbStatus: db?.status,
        stackTrace: new Error().stack
      });
      notifyConnectionStateChange();
      connectionConfig = newConfig;
    } else if (namespaceChanged || databaseChanged) {
      // namespace 或 database 变化只需要重新执行 use 和 authenticate
      console.log("ServiceWorker: Namespace/Database changed, switching...",
        { namespace: connectionConfig.namespace, database: connectionConfig.database },
        '->',
        { namespace: newConfig.namespace, database: newConfig.database });

      if (isConnected && db) {
        try {
          await db.use({ namespace: newConfig.namespace, database: newConfig.database });

          // 重新认证
          await ensureTokenManager();
          const token = await tokenManager!.getToken();

          if (token && token.access_token) {
            await db.authenticate(token.access_token);
            console.log("ServiceWorker: Re-authenticated after namespace/database change.");
          }
        } catch (e) {
          console.error("ServiceWorker: Failed to switch namespace/database:", e);
          const previousState = isConnected;
          isConnected = false;
          console.log('ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 命名空间/数据库切换失败', {
            timestamp: new Date().toISOString(),
            previousState: previousState,
            newState: false,
            reason: '命名空间/数据库切换失败',
            error: e,
            oldConfig: { namespace: connectionConfig.namespace, database: connectionConfig.database },
            newConfig: { namespace: newConfig.namespace, database: newConfig.database },
            dbStatus: db?.status,
            stackTrace: new Error().stack
          });
          notifyConnectionStateChange(e as Error);
          triggerReconnection();
        }
      }
      connectionConfig = newConfig;
    } else if (authChanged) {
      // 只有认证信息变化，只需要重新认证
      console.log("ServiceWorker: Auth changed, re-authenticating...");

      if (!db) {
        throw new Error("Database instance not available for re-authentication");
      }
      if (db.status === ConnectionStatus.Disconnected || db.status === ConnectionStatus.Error) {
        await connectWithTimeout();
      }
      try {
        await ensureTokenManager();
        const token = await tokenManager!.getToken();

        if (token && token.access_token) {
          await db.authenticate(token.access_token);
          console.log("ServiceWorker: Re-authenticated with new auth info.");
        }
      } catch (e) {
        console.error("ServiceWorker: Re-authentication failed:", e);
        notifyConnectionStateChange(e as Error);
        triggerReconnection();
      }
      connectionConfig = newConfig;
    } else {
      // 没有变化，直接更新配置引用
      connectionConfig = newConfig;
    }
  } else if (newConfig) {
    // 第一次设置配置
    connectionConfig = newConfig;
  }
}

async function resubscribeAllLiveQueries() {
  console.log("ServiceWorker: Resubscribing to all live queries...");
  const subscriptionPromises: Promise<void>[] = [];

  for (const [uuid, sub] of liveQuerySubscriptions.entries()) {
    const subscriptionPromise = (async () => {
      try {
        if (!db) throw new Error("Database not initialized");

        // 重新创建 live query，使用原始的 uuid 作为标识
        const newUuid = await db.live(sub.query, (action, result) => {
          broadcastToClients({
            type: 'live_update',
            payload: { uuid, action, result }
          }, sub.clients);
        });

        // 如果新的 UUID 与原来的不同，需要更新映射
        if (String(newUuid) !== uuid) {
          console.log(`ServiceWorker: Live query UUID changed from ${uuid} to ${newUuid}`);
          // 创建新的订阅记录
          liveQuerySubscriptions.set(String(newUuid), {
            query: sub.query,
            vars: sub.vars,
            clients: sub.clients
          });
          // 删除旧的记录
          liveQuerySubscriptions.delete(uuid);

          // 通知客户端 UUID 变化
          broadcastToClients({
            type: 'live_query_uuid_changed',
            payload: { oldUuid: uuid, newUuid: String(newUuid) }
          }, sub.clients);
        }

        console.log(`ServiceWorker: Successfully resubscribed to live query ${uuid}`);
      } catch (e) {
        console.error(`ServiceWorker: Failed to resubscribe to live query ${uuid}`, e);

        // 通知客户端重订阅失败
        broadcastToClients({
          type: 'live_query_resubscribe_failed',
          payload: { uuid, error: (e as Error).message }
        }, sub.clients);
      }
    })();

    subscriptionPromises.push(subscriptionPromise);
  }

  // 等待所有重订阅完成
  await Promise.allSettled(subscriptionPromises);
  console.log("ServiceWorker: Live queries resubscription completed");
}

// --- 增量同步辅助函数 ---

/**
 * 处理增量更新
 */
async function processIncrementalUpdate(
  update: any,
  conflictResolution: 'local' | 'remote' | 'timestamp'
): Promise<void> {
  try {
    console.log('ServiceWorker: Processing incremental update:', update);

    // 获取本地数据
    const localData = await dataCacheManager!.queryCache(
      update.table_name,
      `SELECT * FROM ${update.table_name} WHERE id = $id`,
      { id: update.id }
    );

    const hasLocalData = localData && localData.length > 0;

    // 处理不同的操作类型
    switch (update.operation) {
      case 'insert':
        if (!hasLocalData) {
          // 直接插入新数据
          await dataCacheManager!.cacheData(
            update.table_name,
            [update.data],
            'temporary'
          );
        } else {
          // 存在冲突，根据策略处理
          await handleConflict(update, localData[0], conflictResolution);
        }
        break;

      case 'update':
        if (hasLocalData) {
          // 检查版本冲突
          const localVersion = localData[0].version || 0;
          const remoteVersion = update.version || 0;

          if (remoteVersion > localVersion) {
            // 远程版本更新，直接更新
            await dataCacheManager!.updateData(
              update.table_name,
              update.id,
              update.data
            );
          } else if (remoteVersion < localVersion) {
            // 本地版本更新，根据策略处理
            await handleConflict(update, localData[0], conflictResolution);
          }
          // 版本相同，不需要更新
        } else {
          // 本地没有数据，直接插入
          await dataCacheManager!.cacheData(
            update.table_name,
            [update.data],
            'temporary'
          );
        }
        break;

      case 'delete':
        if (hasLocalData) {
          // 删除本地数据
          await dataCacheManager!.clearTableCache(
            update.table_name,
            update.data.user_id,
            update.data.case_id
          );
        }
        break;
    }

    // 广播更新事件
    await broadcastToAllClients({
      type: 'incremental_update_processed',
      payload: {
        table: update.table_name,
        operation: update.operation,
        recordId: update.id,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('ServiceWorker: Error processing incremental update:', error);
    throw error;
  }
}

/**
 * 处理冲突
 */
async function handleConflict(
  remoteUpdate: any,
  localData: any,
  conflictResolution: 'local' | 'remote' | 'timestamp'
): Promise<void> {
  console.log('ServiceWorker: Handling conflict with strategy:', conflictResolution);

  switch (conflictResolution) {
    case 'local':
      // 保留本地数据，忽略远程更新
      console.log('ServiceWorker: Keeping local data, ignoring remote update');
      break;

    case 'remote':
      // 使用远程数据覆盖本地数据
      console.log('ServiceWorker: Using remote data, overwriting local');
      await dataCacheManager!.updateData(
        remoteUpdate.table_name,
        remoteUpdate.id,
        remoteUpdate.data
      );
      break;

    case 'timestamp': {
      // 根据时间戳决定使用哪个版本
      const localTimestamp = new Date(localData.updated_at).getTime();
      const remoteTimestamp = new Date(remoteUpdate.updated_at).getTime();

      if (remoteTimestamp > localTimestamp) {
        console.log('ServiceWorker: Remote data is newer, using remote');
        await dataCacheManager!.updateData(
          remoteUpdate.table_name,
          remoteUpdate.id,
          remoteUpdate.data
        );
      } else {
        console.log('ServiceWorker: Local data is newer, keeping local');
      }
      break;
    }
  }
}

/**
 * 创建同步记录
 */
async function createSyncRecord(syncRecord: any): Promise<void> {
  try {
    await localDb!.create('sync_record', syncRecord);
    console.log('ServiceWorker: Created sync record:', syncRecord.id);
  } catch (error) {
    console.error('ServiceWorker: Error creating sync record:', error);
    throw error;
  }
}

/**
 * 获取同步记录
 */
async function getSyncRecord(
  table: string,
  userId: string,
  caseId?: string
): Promise<any> {
  try {
    const recordId = `sync_record:${table}_${userId}_${caseId || 'global'}`;
    const result = await localDb!.select(recordId);
    return result || null;
  } catch (error) {
    console.error('ServiceWorker: Error getting sync record:', error);
    return null;
  }
}

/**
 * 更新同步记录
 */
async function updateSyncRecord(
  syncRecordId: any,
  lastSyncTimestamp: number,
  lastSyncId?: string,
  status?: string
): Promise<void> {
  try {
    const updateData: any = {
      last_sync_timestamp: lastSyncTimestamp,
      updated_at: new Date()
    };

    if (lastSyncId) {
      updateData.last_sync_id = lastSyncId;
    }

    if (status) {
      updateData.sync_status = status;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log('ServiceWorker: Updated sync record:', syncRecordId);
  } catch (error) {
    console.error('ServiceWorker: Error updating sync record:', error);
    throw error;
  }
}

/**
 * 更新同步状态
 */
async function updateSyncStatus(
  syncRecordId: any,
  status: string,
  lastSyncTimestamp?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: any = {
      sync_status: status,
      updated_at: new Date()
    };

    if (lastSyncTimestamp) {
      updateData.last_sync_timestamp = lastSyncTimestamp;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    // 如果状态是失败，增加重试次数
    if (status === 'failed') {
      const currentRecord = await localDb!.select(syncRecordId);
      updateData.retry_count = ((currentRecord as any)?.retry_count || 0) + 1;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log('ServiceWorker: Updated sync status:', syncRecordId, status);
  } catch (error) {
    console.error('ServiceWorker: Error updating sync status:', error);
    throw error;
  }
}

/**
 * 清除同步记录
 */
async function clearSyncRecords(
  tables: string[],
  userId: string,
  caseId?: string
): Promise<void> {
  try {
    for (const table of tables) {
      const recordId = `sync_record:${table}_${userId}_${caseId || 'global'}`;
      await localDb!.delete(recordId);
    }
    console.log('ServiceWorker: Cleared sync records for tables:', tables);
  } catch (error) {
    console.error('ServiceWorker: Error clearing sync records:', error);
    throw error;
  }
}

// --- 双向同步辅助函数 ---

/**
 * 持久化离线队列
 */
async function persistOfflineQueue(syncKey: string, queue: any[]): Promise<void> {
  try {
    const queueRecord = {
      id: new RecordId('offline_queue', syncKey),
      sync_key: syncKey,
      queue_data: queue,
      created_at: new Date(),
      updated_at: new Date()
    };

    await localDb!.create('offline_queue', queueRecord);
    console.log('ServiceWorker: Persisted offline queue for sync key:', syncKey);
  } catch {
    // 如果创建失败，尝试更新
    try {
      const queueRecord = {
        queue_data: queue,
        updated_at: new Date()
      };

      await localDb!.update(new RecordId('offline_queue', syncKey), queueRecord);
      console.log('ServiceWorker: Updated offline queue for sync key:', syncKey);
    } catch (updateError) {
      console.error('ServiceWorker: Error persisting offline queue:', updateError);
      throw updateError;
    }
  }
}

/**
 * 恢复离线队列
 */
async function restoreOfflineQueue(syncKey: string): Promise<any[]> {
  try {
    const recordId = new RecordId('offline_queue', syncKey);
    const result = await localDb!.select(recordId);

    if (result && (result as any).queue_data) {
      console.log('ServiceWorker: Restored offline queue for sync key:', syncKey);
      return (result as any).queue_data;
    }

    return [];
  } catch (error) {
    console.error('ServiceWorker: Error restoring offline queue:', error);
    return [];
  }
}

/**
 * 清除离线队列
 */
async function clearOfflineQueue(syncKey: string): Promise<void> {
  try {
    const recordId = new RecordId('offline_queue', syncKey);
    await localDb!.delete(recordId);
    console.log('ServiceWorker: Cleared offline queue for sync key:', syncKey);
  } catch (error) {
    console.error('ServiceWorker: Error clearing offline queue:', error);
    throw error;
  }
}