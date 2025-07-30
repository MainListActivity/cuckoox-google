/**
 * SurrealDB 连接管理器 - 与 Service Worker 生命周期完全集成
 * 解决连接状态不一致、重启后连接丢失等问题
 */

import { Surreal, RecordId, ConnectionStatus } from 'surrealdb';
import { StringRecordId } from 'surrealdb';

// 类型定义
export interface ConnectionConfig {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: {
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  lastAuthCheck: number | null;
  authExpiry: number | null;
  cacheValidUntil: number | null;
}

export interface DatabaseInstanceState {
  instance: Surreal | null;
  status: ConnectionStatus;
  initialized: boolean;
  lastHealthCheck: number | null;
  errorCount: number;
  lastError: Error | null;
}

export interface UnifiedConnectionState {
  connection: {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
    config: ConnectionConfig | null;
    endpoint: string | null;
    lastConnectedAt: number | null;
    reconnectAttempts: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    latency: number | null;
    error: Error | null;
  };
  auth: AuthState;
  databases: {
    remote: DatabaseInstanceState;
    local: DatabaseInstanceState;
  };
  runtime: {
    isInitialized: boolean;
    version: string;
    startedAt: number;
    lastStateChange: number;
    activeComponents: string[];
    memoryUsage: number;
  };
}

// 事件类型
export type StateChangeListener = (event: {
  oldState: any;
  newState: any;
  timestamp: number;
}) => void;

export interface ConnectionError extends Error {
  code?: string;
  retryable?: boolean;
  timestamp: number;
}

/**
 * 状态持久化管理器
 */
class StatePersistenceManager {
  private localDb: Surreal | null = null;
  private storageKeys = {
    connection: 'sw_connection_state',
    auth: 'sw_auth_state',
    runtime: 'sw_runtime_state'
  };

  setLocalDb(localDb: Surreal): void {
    this.localDb = localDb;
  }

  async persistConnectionState(connectionState: any): Promise<void> {
    if (!connectionState.config || !this.localDb) return;
    
    try {
      await this.localDb.upsert(new StringRecordId(this.storageKeys.connection), {
        ...connectionState,
        // 不持久化敏感的认证信息
        config: {
          ...connectionState.config,
          auth: connectionState.config.auth ? {
            ...connectionState.config.auth,
            token: undefined, // 不持久化 token
            password: undefined // 不持久化密码
          } : undefined
        },
        persistedAt: Date.now(),
        version: '1.0.0'
      });
      console.log('ConnectionManager: Connection state persisted');
    } catch (error) {
      console.error('ConnectionManager: Failed to persist connection state:', error);
    }
  }

  async persistAuthState(authState: AuthState): Promise<void> {
    if (!this.localDb) return;
    
    try {
      // 只持久化非敏感信息
      const safeToPersist = {
        isAuthenticated: authState.isAuthenticated,
        userId: authState.userId,
        lastAuthCheck: authState.lastAuthCheck,
        authExpiry: authState.authExpiry,
        persistedAt: Date.now()
      };
      
      await this.localDb.upsert(new StringRecordId(this.storageKeys.auth), safeToPersist);
      console.log('ConnectionManager: Auth state persisted');
    } catch (error) {
      console.error('ConnectionManager: Failed to persist auth state:', error);
    }
  }

  async restoreState(): Promise<Partial<UnifiedConnectionState> | null> {
    if (!this.localDb) return null;
    
    try {
      const [connectionState, authState] = await Promise.all([
        this.localDb.select(new StringRecordId(this.storageKeys.connection)),
        this.localDb.select(new StringRecordId(this.storageKeys.auth))
      ]);
      
      const restored: Partial<UnifiedConnectionState> = {};
      
      if (connectionState && this.isValidConnectionState(connectionState)) {
        restored.connection = connectionState as any;
      }
      
      if (authState && this.isValidAuthState(authState)) {
        restored.auth = authState as AuthState;
      }
      
      return Object.keys(restored).length > 0 ? restored : null;
      
    } catch (error) {
      console.error('ConnectionManager: Failed to restore state:', error);
      return null;
    }
  }

  private isValidConnectionState(state: any): boolean {
    return state && 
           typeof state === 'object' && 
           state.config && 
           state.config.endpoint && 
           state.config.namespace && 
           state.config.database;
  }

  private isValidAuthState(state: any): boolean {
    return state && 
           typeof state === 'object' && 
           typeof state.isAuthenticated === 'boolean';
  }
}

/**
 * 重连管理器
 */
class ReconnectManager {
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = Infinity;
  private readonly reconnectDelayBase = 100;
  private readonly reconnectDelayMax = 5000;

  constructor(private connectionManager: SurrealDBConnectionManager) {}

  triggerReconnection(): void {
    if (this.isReconnecting) {
      console.log('ConnectionManager: Reconnection already in progress, skipping');
      return;
    }

    this.isReconnecting = true;
    this.connectionManager.updateConnectionState({ status: 'reconnecting' });

    const delay = this.reconnectAttempts === 0 ? this.reconnectDelayBase : this.calculateReconnectDelay();
    console.log(`ConnectionManager: Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      await this.performReconnection().finally(() => {
        this.isReconnecting = false;
      });
    }, delay);
  }

  private calculateReconnectDelay(): number {
    return Math.min(
      this.reconnectDelayBase * Math.pow(2, Math.min(this.reconnectAttempts, 6)),
      this.reconnectDelayMax
    );
  }

  private async performReconnection(): Promise<void> {
    const connectionConfig = this.connectionManager.getConnectionConfig();
    if (!connectionConfig) {
      console.error('ConnectionManager: Cannot reconnect - no connection config available');
      this.isReconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    console.log(`ConnectionManager: Attempting reconnection #${this.reconnectAttempts} to ${connectionConfig.endpoint}`);

    try {
      // 清理当前连接
      await this.connectionManager.closeRemoteConnection();

      // 尝试重新连接
      await this.connectionManager.connect(connectionConfig);

      // 重连成功
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      console.log('ConnectionManager: Reconnection successful');

    } catch (error) {
      console.error(`ConnectionManager: Reconnection attempt #${this.reconnectAttempts} failed:`, error);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.isReconnecting = false;
        this.triggerReconnection();
      } else {
        this.isReconnecting = false;
        console.error('ConnectionManager: Max reconnection attempts reached');
      }
    }
  }

  stopReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    console.log('ConnectionManager: Reconnection stopped');
  }

  isCurrentlyReconnecting(): boolean {
    return this.isReconnecting;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

/**
 * 健康检查管理器
 */
class HealthChecker {
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private readonly healthCheckInterval = 30000; // 30秒

  constructor(private connectionManager: SurrealDBConnectionManager) {}

  startHealthCheck(): void {
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckInterval);

    console.log('ConnectionManager: Health check started');
  }

  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('ConnectionManager: Health check stopped');
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const state = this.connectionManager.getState();
      
      if (state.connection.status !== 'connected') {
        console.log('ConnectionManager: Skipping health check - not connected');
        return;
      }

      const remoteDb = state.databases.remote.instance;
      if (!remoteDb) {
        console.warn('ConnectionManager: Health check - remote db instance not available');
        this.connectionManager.updateConnectionState({ status: 'error' });
        return;
      }

      // 执行简单的连接测试
      const startTime = Date.now();
      const testResult = await Promise.race([
        remoteDb.query('return 1;'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (testResult) {
        console.log('ConnectionManager: Health check passed, latency:', latency + 'ms');
        this.connectionManager.updateConnectionState({ 
          healthStatus: latency < 100 ? 'healthy' : latency < 1000 ? 'degraded' : 'unhealthy',
          latency 
        });
      }

    } catch (testError) {
      console.warn('ConnectionManager: Health check failed:', testError);
      this.connectionManager.updateConnectionState({ 
        status: 'error',
        healthStatus: 'unhealthy',
        error: testError as Error 
      });
      
      // 触发重连
      this.connectionManager.triggerReconnection();
    }
  }
}

/**
 * SurrealDB 连接管理器 - 单例模式
 */
export class SurrealDBConnectionManager {
  private static instance: SurrealDBConnectionManager | null = null;
  
  // 核心状态：统一管理，避免状态不同步
  private state: UnifiedConnectionState;
  private eventListeners = new Set<StateChangeListener>();
  
  // 管理器组件
  private persistenceManager: StatePersistenceManager;
  private reconnectManager: ReconnectManager;
  private healthChecker: HealthChecker;

  private constructor() {
    this.state = this.createInitialState();
    this.persistenceManager = new StatePersistenceManager();
    this.reconnectManager = new ReconnectManager(this);
    this.healthChecker = new HealthChecker(this);
  }

  // 单例模式
  static async getInstance(): Promise<SurrealDBConnectionManager> {
    if (!this.instance) {
      this.instance = new SurrealDBConnectionManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  static destroyInstance(): void {
    if (this.instance) {
      this.instance.cleanup();
      this.instance = null;
    }
  }

  // 初始化方法
  async initialize(): Promise<void> {
    console.log('ConnectionManager: Initializing...');
    
    try {
      // 初始化本地数据库
      await this.initializeLocalDb();
      
      // 设置持久化管理器
      this.persistenceManager.setLocalDb(this.state.databases.local.instance!);
      
      // 尝试恢复状态
      await this.restoreState();
      
      // 更新运行时状态
      this.updateRuntimeState({
        isInitialized: true,
        startedAt: Date.now(),
        version: '1.0.0'
      });
      
      console.log('ConnectionManager: Initialization completed');
    } catch (error) {
      console.error('ConnectionManager: Initialization failed:', error);
      throw error;
    }
  }

  // 预初始化（轻量级）
  async preInitialize(): Promise<void> {
    console.log('ConnectionManager: Pre-initializing...');
    await this.initializeLocalDb();
  }

  // 本地数据库初始化
  private async initializeLocalDb(): Promise<void> {
    if (this.state.databases.local.initialized) {
      return;
    }

    try {
      console.log('ConnectionManager: Initializing local SurrealDB...');
      
      // 获取 WASM 引擎
      const wasmEngines = await this.getWasmEngines();
      
      const localDb = new Surreal({
        engines: wasmEngines,
      });

      await localDb.connect('indxdb://cuckoox-storage');
      await localDb.use({ namespace: 'ck_go', database: 'local' });

      this.updateDatabaseState('local', {
        instance: localDb,
        status: ConnectionStatus.Connected,
        initialized: true,
        lastHealthCheck: Date.now(),
        errorCount: 0,
        lastError: null
      });

      console.log('ConnectionManager: Local SurrealDB initialized successfully');
    } catch (error) {
      console.error('ConnectionManager: Failed to initialize local SurrealDB:', error);
      this.updateDatabaseState('local', {
        initialized: true,
        lastError: error as Error,
        errorCount: this.state.databases.local.errorCount + 1
      });
      throw error;
    }
  }

  // 获取 WASM 引擎
  private async getWasmEngines(): Promise<any> {
    let retryCount = 0;
    const maxRetries = 50;

    while (!(globalThis as any).__surrealdbWasmEngines && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retryCount++;
    }

    if (!(globalThis as any).__surrealdbWasmEngines) {
      throw new Error('WASM engines not loaded after waiting');
    }

    return (globalThis as any).__surrealdbWasmEngines();
  }

  // 连接方法
  async connect(config: ConnectionConfig): Promise<void> {
    console.log(`ConnectionManager: Connecting to ${config.endpoint}...`);
    
    this.updateConnectionState({ 
      status: 'connecting',
      config,
      endpoint: config.endpoint 
    });

    try {
      // 创建远程数据库实例
      if (!this.state.databases.remote.instance) {
        this.updateDatabaseState('remote', {
          instance: new Surreal(),
          status: ConnectionStatus.Disconnected,
          initialized: false
        });
      }

      const remoteDb = this.state.databases.remote.instance!;
      
      // 连接到远程数据库
      await Promise.race([
        remoteDb.connect(config.endpoint),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      // 设置命名空间和数据库
      await remoteDb.use({ namespace: config.namespace, database: config.database });

      // 认证（如果提供）
      if (config.auth?.token) {
        await remoteDb.authenticate(config.auth.token);
        this.updateAuthState({
          isAuthenticated: true,
          lastAuthCheck: Date.now()
        });
      }

      // 更新状态
      this.updateDatabaseState('remote', {
        status: ConnectionStatus.Connected,
        initialized: true,
        lastHealthCheck: Date.now(),
        errorCount: 0,
        lastError: null
      });

      this.updateConnectionState({
        status: 'connected',
        lastConnectedAt: Date.now(),
        reconnectAttempts: 0,
        healthStatus: 'healthy',
        error: null
      });

      // 启动健康检查
      this.healthChecker.startHealthCheck();

      // 持久化连接状态
      await this.persistenceManager.persistConnectionState(this.state.connection);

      console.log('ConnectionManager: Connection established successfully');

    } catch (error) {
      console.error('ConnectionManager: Connection failed:', error);
      
      this.updateConnectionState({
        status: 'error',
        error: error as Error,
        healthStatus: 'unhealthy'
      });

      this.updateDatabaseState('remote', {
        lastError: error as Error,
        errorCount: this.state.databases.remote.errorCount + 1
      });

      throw error;
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    console.log('ConnectionManager: Disconnecting...');
    
    this.healthChecker.stopHealthCheck();
    this.reconnectManager.stopReconnection();
    
    await this.closeRemoteConnection();
    
    this.updateConnectionState({
      status: 'disconnected',
      lastConnectedAt: null,
      healthStatus: 'unhealthy'
    });
  }

  // 关闭远程连接
  async closeRemoteConnection(): Promise<void> {
    const remoteDb = this.state.databases.remote.instance;
    if (remoteDb) {
      try {
        await remoteDb.close();
        console.log('ConnectionManager: Remote connection closed');
      } catch (error) {
        console.warn('ConnectionManager: Error closing remote connection:', error);
      }
    }
    
    this.updateDatabaseState('remote', {
      status: ConnectionStatus.Disconnected,
      initialized: false
    });
  }

  // 触发重连
  triggerReconnection(): void {
    this.reconnectManager.triggerReconnection();
  }

  // 状态恢复
  async restoreState(): Promise<boolean> {
    try {
      const restoredState = await this.persistenceManager.restoreState();
      if (restoredState) {
        // 合并恢复的状态
        this.state = { ...this.state, ...restoredState };
        console.log('ConnectionManager: State restored successfully');
        
        // 如果有连接配置，尝试自动重连
        if (this.state.connection.config) {
          console.log('ConnectionManager: Attempting auto-reconnect after state restoration');
          try {
            await this.connect(this.state.connection.config);
          } catch (error) {
            console.warn('ConnectionManager: Auto-reconnect failed:', error);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('ConnectionManager: State restoration failed:', error);
      return false;
    }
  }

  // 持久化状态
  async persistState(): Promise<void> {
    await this.persistenceManager.persistConnectionState(this.state.connection);
    await this.persistenceManager.persistAuthState(this.state.auth);
  }

  // 优雅关闭
  async gracefulShutdown(): Promise<void> {
    console.log('ConnectionManager: Graceful shutdown initiated');
    
    try {
      // 保存状态
      await this.persistState();
      
      // 关闭连接
      await this.disconnect();
      
      // 清理资源
      this.cleanup();
      
      console.log('ConnectionManager: Graceful shutdown completed');
    } catch (error) {
      console.error('ConnectionManager: Graceful shutdown error:', error);
    }
  }

  // 清理资源
  private cleanup(): void {
    this.healthChecker.stopHealthCheck();
    this.reconnectManager.stopReconnection();
    this.eventListeners.clear();
  }

  // 状态访问方法
  getState(): Readonly<UnifiedConnectionState> {
    return Object.freeze({ ...this.state });
  }

  getConnectionConfig(): ConnectionConfig | null {
    return this.state.connection.config;
  }

  getConnectionStatus(): string {
    return this.state.connection.status;
  }

  isConnected(): boolean {
    return this.state.connection.status === 'connected';
  }

  isAuthenticated(): boolean {
    return this.state.auth.isAuthenticated;
  }

  getRemoteDb(): Surreal | null {
    return this.state.databases.remote.instance;
  }

  getLocalDb(): Surreal | null {
    return this.state.databases.local.instance;
  }

  getCurrentUserId(): string | null {
    return this.state.auth.userId;
  }

  // 状态更新方法
  updateConnectionState(updates: Partial<typeof this.state.connection>): void {
    const oldState = { ...this.state.connection };
    this.state.connection = { ...this.state.connection, ...updates };
    this.state.runtime.lastStateChange = Date.now();
    
    this.emitStateChange('connection:state-changed', oldState, this.state.connection);
  }

  updateAuthState(updates: Partial<AuthState>): void {
    const oldState = { ...this.state.auth };
    this.state.auth = { ...this.state.auth, ...updates };
    
    this.emitStateChange('auth:state-changed', oldState, this.state.auth);
    
    if (updates.isAuthenticated !== undefined) {
      this.persistenceManager.persistAuthState(this.state.auth);
    }
  }

  updateDatabaseState(type: 'remote' | 'local', updates: Partial<DatabaseInstanceState>): void {
    const oldState = { ...this.state.databases[type] };
    this.state.databases[type] = { ...this.state.databases[type], ...updates };
    
    this.emitStateChange(`database:${type}-state-changed`, oldState, this.state.databases[type]);
  }

  private updateRuntimeState(updates: Partial<typeof this.state.runtime>): void {
    this.state.runtime = { ...this.state.runtime, ...updates };
  }

  // 事件管理
  subscribe(listener: StateChangeListener): void {
    this.eventListeners.add(listener);
  }

  unsubscribe(listener: StateChangeListener): void {
    this.eventListeners.delete(listener);
  }

  private emitStateChange(eventType: string, oldState: any, newState: any): void {
    const event = {
      type: eventType,
      oldState,
      newState,
      timestamp: Date.now()
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('ConnectionManager: Event listener error:', error);
      }
    }
  }

  // 兼容性方法
  getCompatibilityState(): any {
    return {
      isConnected: this.isConnected(),
      hasDb: !!this.state.databases.remote.instance,
      hasLocalDb: !!this.state.databases.local.instance,
      configExists: !!this.state.connection.config
    };
  }

  // 创建初始状态
  private createInitialState(): UnifiedConnectionState {
    return {
      connection: {
        status: 'disconnected',
        config: null,
        endpoint: null,
        lastConnectedAt: null,
        reconnectAttempts: 0,
        healthStatus: 'unhealthy',
        latency: null,
        error: null
      },
      auth: {
        isAuthenticated: false,
        userId: null,
        lastAuthCheck: null,
        authExpiry: null,
        cacheValidUntil: null
      },
      databases: {
        remote: {
          instance: null,
          status: ConnectionStatus.Disconnected,
          initialized: false,
          lastHealthCheck: null,
          errorCount: 0,
          lastError: null
        },
        local: {
          instance: null,
          status: ConnectionStatus.Disconnected,
          initialized: false,
          lastHealthCheck: null,
          errorCount: 0,
          lastError: null
        }
      },
      runtime: {
        isInitialized: false,
        version: '1.0.0',
        startedAt: Date.now(),
        lastStateChange: Date.now(),
        activeComponents: [],
        memoryUsage: 0
      }
    };
  }
}