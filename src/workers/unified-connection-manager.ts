import { Surreal } from 'surrealdb';

/**
 * 连接配置接口
 */
export interface ConnectionConfig {
  localDb: {
    namespace: string;
    database: string;
  };
  remoteDb?: {
    url: string;
    namespace: string;
    database: string;
  };
}

/**
 * 认证凭据接口
 */
export interface AuthCredentials {
  github_id: string;
  token?: string;
  tenant_code?: string;
}

/**
 * 认证状态接口
 */
export interface AuthState {
  id: string;
  tenant_code: string;
  permissions: {
    operations: any[];
  };
  roles: {
    global: string[];
    case: Record<string, string[]>;
  };
  menus: any[];
  syncTimestamp: number;
}

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}
// 获取 WASM 引擎
const getWasmEngines = async (): Promise<any> => {
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

/**
 * 统一连接管理器
 * 提供统一、可靠的SurrealDB连接管理，支持多租户数据库隔离和自动重连机制
 */
export class UnifiedConnectionManager {
  private localDb?: Surreal;
  private remoteDb?: Surreal;
  private config?: ConnectionConfig;
  private currentTenant?: string;
  private authState?: AuthState;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // 1秒基础延迟

  constructor() {

    // 获取 WASM 引擎
    getWasmEngines().then((engines) => {
      console.log('WASM engines loaded:', engines);
      this.localDb = new Surreal({
        engines: engines
      });
      console.log('UnifiedConnectionManager: 初始化连接管理器');
    });
  }

  /**
   * 连接到数据库
   */
  async connect(config: ConnectionConfig): Promise<void> {
    console.log('UnifiedConnectionManager: 开始连接数据库');
    this.config = config;
    this.connectionState = ConnectionState.CONNECTING;

    try {
      // 1. 连接本地数据库（内存数据库）
      await this.localDb?.connect('indxdb://cuckoox-storage');
      await this.localDb?.use({
        namespace: config.localDb.namespace,
        database: config.localDb.database
      });
      console.log('UnifiedConnectionManager: 本地数据库连接成功');

      // 2. 连接远程数据库（如果配置了）
      if (config.remoteDb) {
        this.remoteDb = new Surreal();
        await this.remoteDb.connect(config.remoteDb.url, { reconnect: true });
        await this.remoteDb.use({
          namespace: config.remoteDb.namespace,
          database: config.remoteDb.database
        });
        console.log('UnifiedConnectionManager: 远程数据库连接成功');

        // 设置断线监听
        this.setupDisconnectionHandler();
      }

      this.connectionState = ConnectionState.CONNECTED;
      this.reconnectAttempts = 0;

      console.log('UnifiedConnectionManager: 所有数据库连接已建立');
    } catch (error) {
      console.error('UnifiedConnectionManager: 数据库连接失败', error);
      this.connectionState = ConnectionState.ERROR;
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    console.log('UnifiedConnectionManager: 开始断开连接');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    try {
      if (this.localDb) {
        await this.localDb.close();
      }
      if (this.remoteDb) {
        await this.remoteDb.close();
      }

      this.connectionState = ConnectionState.DISCONNECTED;
      this.authState = undefined;
      this.currentTenant = undefined;

      console.log('UnifiedConnectionManager: 连接已断开');
    } catch (error) {
      console.error('UnifiedConnectionManager: 断开连接时发生错误', error);
    }
  }

  /**
   * 切换租户数据库
   */
  async switchTenant(tenantCode: string): Promise<void> {
    if (!this.config) {
      throw new Error('连接管理器未初始化');
    }

    console.log(`UnifiedConnectionManager: 切换到租户 ${tenantCode}`);

    try {
      // 构建租户数据库名称
      const tenantDatabase = `${this.config.localDb.database}_${tenantCode}`;

      // 切换本地数据库
      await this.localDb?.use({
        namespace: this.config.localDb.namespace,
        database: tenantDatabase
      });

      // 切换远程数据库（如果存在）
      if (this.remoteDb && this.config.remoteDb) {
        const remoteTenantDatabase = `${this.config.remoteDb.database}_${tenantCode}`;
        await this.remoteDb.use({
          namespace: this.config.remoteDb.namespace,
          database: remoteTenantDatabase
        });
      }

      this.currentTenant = tenantCode;
      console.log(`UnifiedConnectionManager: 成功切换到租户 ${tenantCode}`);
    } catch (error) {
      console.error(`UnifiedConnectionManager: 切换租户失败`, error);
      throw error;
    }
  }

  /**
   * 用户认证
   */
  async authenticate(credentials: AuthCredentials): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('数据库未连接');
    }

    console.log(`UnifiedConnectionManager: 开始用户认证 ${credentials.github_id}`);

    try {
      // 如果有租户代码，先切换租户
      if (credentials.tenant_code) {
        await this.switchTenant(credentials.tenant_code);
      }

      // 远程数据库认证
      if (this.remoteDb) {
        const authResult = await this.remoteDb.signin({
          username: credentials.github_id,
          password: credentials.token || 'default'
        });
        console.log('UnifiedConnectionManager: 远程认证成功');
      }

      // 构建认证状态（从缓存或远程获取）
      this.authState = {
        id: credentials.github_id,
        tenant_code: credentials.tenant_code || 'default',
        permissions: { operations: [] },
        roles: { global: [], case: {} },
        menus: [],
        syncTimestamp: Date.now()
      };

      this.connectionState = ConnectionState.AUTHENTICATED;
      console.log('UnifiedConnectionManager: 用户认证完成');
    } catch (error) {
      console.error('UnifiedConnectionManager: 用户认证失败', error);
      throw error;
    }
  }

  /**
   * 设置断线监听器
   */
  private setupDisconnectionHandler(): void {
    if (!this.remoteDb) return;
    // TODO: 实现WebSocket断线监听
    console.log('UnifiedConnectionManager: 设置断线监听器');
  }

  /**
   * 处理连接断开
   */
  private async handleDisconnection(): Promise<void> {
    console.log('UnifiedConnectionManager: 检测到连接断开，开始处理');

    this.connectionState = ConnectionState.ERROR;

    // 启动自动重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.reconnect();
    } else {
      console.error('UnifiedConnectionManager: 重连次数已达上限，停止重连');
    }
  }

  /**
   * 自动重连
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

    console.log(`UnifiedConnectionManager: 第${this.reconnectAttempts}次重连尝试，延迟${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.config) {
          await this.connect(this.config);

          // 恢复认证状态
          if (this.authState) {
            await this.authenticate({
              github_id: this.authState.id,
              tenant_code: this.authState.tenant_code
            });
          }

          console.log('UnifiedConnectionManager: 重连成功');
        }
      } catch (error) {
        console.error(`UnifiedConnectionManager: 重连失败 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, error);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.reconnect();
        }
      }
    }, delay);
  }

  /**
   * 获取本地数据库实例
   */
  getLocalDb(): Surreal {
    return this.localDb!;
  }

  /**
   * 获取远程数据库实例
   */
  getRemoteDb(): Surreal | undefined {
    return this.remoteDb;
  }

  /**
   * 获取当前租户
   */
  getCurrentTenant(): string | undefined {
    return this.currentTenant;
  }

  /**
   * 获取认证状态
   */
  getAuthState(): AuthState | undefined {
    return this.authState;
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED ||
      this.connectionState === ConnectionState.AUTHENTICATED;
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.connectionState === ConnectionState.AUTHENTICATED && !!this.authState;
  }
}