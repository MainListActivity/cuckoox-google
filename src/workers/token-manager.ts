import { RecordId, Surreal } from 'surrealdb';

const currentToken = new RecordId('tokens', 'current');
/**
 * Token 信息接口
 */
export interface TokenInfo {
  [x: string]: unknown,
  id?: RecordId<string>,
  access_token: string;
  refresh_token?: string;
  token_expires_at?: number;
  tenant_code?: string;
  /** 创建时间戳 */
  created_at: number;
  /** 最后更新时间戳 */
  updated_at: number;
}

/**
 * Token 管理器配置
 */
export interface TokenManagerConfig {
  /** API 基础 URL */
  apiUrl: string;
  /** 刷新检查间隔（毫秒），默认 5 分钟 */
  refreshCheckInterval?: number;
  /** 在过期前多久刷新（毫秒），默认 10 分钟 */
  refreshBeforeExpiry?: number;
  /** 广播函数，用于向客户端发送消息 */
  broadcastToAllClients?: (message: Record<string, unknown>) => Promise<void>;
}

/**
 * 独立的 Token 管理器
 * 负责 token 的存储、获取、刷新和清理
 */
export class TokenManager {
  private localDb: Surreal | null = null;
  private isInitialized = false;
  private config: TokenManagerConfig;

  // Token 刷新相关
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_CHECK_INTERVAL: number;
  private readonly REFRESH_BEFORE_EXPIRY: number;

  constructor(config: TokenManagerConfig) {
    this.config = config;
    this.REFRESH_CHECK_INTERVAL = config.refreshCheckInterval || 5 * 60 * 1000; // 5 分钟
    this.REFRESH_BEFORE_EXPIRY = config.refreshBeforeExpiry || 10 * 60 * 1000; // 10 分钟
  }

  /**
   * 初始化 Token 管理器
   * @param localDb 已初始化的本地数据库实例
   */
  async initialize(localDb: Surreal | null): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('TokenManager: Initializing...');

      // 使用传入的 localDb 实例
      this.localDb = localDb;

      // 创建 token 表结构
      await this.createTokenTable();

      this.isInitialized = true;

      // 自动启动 token 刷新定时器
      this.setupTokenRefresh();

      console.log('TokenManager: Initialized successfully');
    } catch (error) {
      console.error('TokenManager: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * 创建 token 表结构
   */
  private async createTokenTable(): Promise<void> {
    if (!this.localDb) return;

    try {
      // 创建 token 表的结构定义
      await this.localDb.query(`
        DEFINE TABLE IF NOT EXISTS tokens SCHEMALESS;
        DEFINE FIELD IF NOT EXISTS access_token ON tokens TYPE string;
        DEFINE FIELD IF NOT EXISTS refresh_token ON tokens TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS token_expires_at ON tokens TYPE option<number>;
        DEFINE FIELD IF NOT EXISTS tenant_code ON tokens TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS created_at ON tokens TYPE number;
        DEFINE FIELD IF NOT EXISTS updated_at ON tokens TYPE number;
        DEFINE INDEX IF NOT EXISTS idx_tokens_tenant ON tokens FIELDS tenant_code;
      `);

      console.log('TokenManager: Token table structure created');
    } catch (error) {
      console.error('TokenManager: Failed to create token table:', error);
    }
  }

  /**
   * 存储 token 信息
   */
  async storeToken(tokenInfo: Partial<TokenInfo>): Promise<void> {
    if (!tokenInfo.access_token || !tokenInfo.refresh_token) {
      return;
    }
    await this.ensureInitialized();
    const now = Date.now();
    const completeTokenInfo: TokenInfo = {
      access_token: tokenInfo.access_token || '',
      refresh_token: tokenInfo.refresh_token,
      token_expires_at: tokenInfo.token_expires_at,
      tenant_code: tokenInfo.tenant_code,
      created_at: tokenInfo.created_at || now,
      updated_at: now,
    };

    try {
      // 存储到本地数据库
      if (this.localDb) {
        await this.localDb.upsert(currentToken, completeTokenInfo);
      }

      console.log('TokenManager: Token stored successfully');
    } catch (error) {
      console.error('TokenManager: Failed to store token:', error);
      throw error;
    }
  }

  /**
   * 获取 token 信息
   */
  async getToken(): Promise<TokenInfo | null> {
    await this.ensureInitialized();

    try {
      // 从本地数据库获取
      if (this.localDb) {
        const result = await this.localDb.select<TokenInfo>(currentToken);
        if (result) {
          return result;
        }
      }

      return null;
    } catch (error) {
      console.error('TokenManager: Failed to get token:', error);
      return null;
    }
  }

  /**
   * 更新 token 字段
   */
  async updateTokenField(field: keyof TokenInfo, value: string | number | null): Promise<void> {
    const currentToken = await this.getToken();
    if (!currentToken) {
      // 如果不存在 token，创建一个新的
      const newToken: Partial<TokenInfo> = {
        [field]: value,
      };
      await this.storeToken(newToken);
      return;
    }

    // 更新现有 token
    const updatedToken: TokenInfo = {
      ...currentToken,
      [field]: value,
      updated_at: Date.now(),
    };

    await this.storeToken(updatedToken);
  }

  /**
   * 清除 token 信息
   */
  async clearToken(): Promise<void> {
    await this.ensureInitialized();

    try {
      // 从本地数据库删除
      if (this.localDb) {
        await this.localDb.delete(currentToken);
      }

    } catch (error) {
      console.error('TokenManager: Failed to clear token:', error);
      throw error;
    }
  }

  /**
   * 检查 token 是否过期
   */
  async isTokenExpired(): Promise<boolean> {
    const token = await this.getToken();
    if (!token || !token.token_expires_at) return true;

    return Date.now() >= token.token_expires_at;
  }

  /**
   * 检查 token 是否即将过期
   */
  async isTokenExpiringsoon(beforeExpiry: number = 10 * 60 * 1000): Promise<boolean> {
    const token = await this.getToken();
    if (!token || !token.token_expires_at) return true;

    const timeUntilExpiry = token.token_expires_at - Date.now();
    return timeUntilExpiry <= beforeExpiry && timeUntilExpiry > 0;
  }

  /**
   * 检查租户代码是否存在
   */
  async hasTenantCode(): Promise<boolean> {
    return !!(await this.getToken())?.tenant_code
  }

  /**
   * 获取所有 token 信息（用于调试）
   */
  async getAllTokens(): Promise<TokenInfo[]> {
    await this.ensureInitialized();

    try {
      if (!this.localDb) return [];

      const result = await this.localDb.select<TokenInfo>('tokens');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('TokenManager: Failed to get all tokens:', error);
      return [];
    }
  }

  /**
   * 关闭 token 管理器
   */
  async close(): Promise<void> {
    try {
      // 不关闭 localDb，因为它是外部传入的
      this.localDb = null;

      this.isInitialized = false;

      console.log('TokenManager: Closed successfully');
    } catch (error) {
      console.error('TokenManager: Failed to close:', error);
    }
  }

  /**
   * 确保管理器已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('TokenManager not initialized');
    }
  }

  // ==================== Token 刷新相关方法 ====================

  /**
   * 设置令牌刷新定时器
   */
  private setupTokenRefresh(): void {
    // 清除现有定时器
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // 设置新的定时器，每5分钟检查一次
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshToken().catch(error => {
        console.error('TokenManager: Error during token refresh check:', error);
      });
    }, this.REFRESH_CHECK_INTERVAL);

    // 立即检查一次，但延迟1秒以避免阻塞
    setTimeout(() => {
      this.checkAndRefreshToken().catch(error => {
        console.error('TokenManager: Error during initial token refresh check:', error);
      });
    }, 1000);

    console.log('TokenManager: Token refresh timer set up');
  }

  /**
   * 检查并刷新令牌
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      // 首先检查租户代码是否存在
      if (!(await this.hasTenantCode())) {
        await this.clearAuthState();
        return;
      }

      // 检查 token 是否即将过期
      const isExpiringSoon = await this.isTokenExpiringsoon(this.REFRESH_BEFORE_EXPIRY);
      const isExpired = await this.isTokenExpired();

      if (isExpired) {
        console.log('TokenManager: Token expired, clearing auth state');
        await this.clearAuthState();
        return;
      }

      // Refresh token if it expires within configured time
      if (isExpiringSoon) {
        console.log('TokenManager: Token expiring soon, attempting refresh...');
        const success = await this.refreshAccessToken();
        if (!success) {
          console.error('TokenManager: Failed to refresh token, clearing auth state');
          await this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('TokenManager: Error in checkAndRefreshToken:', error);
    }
  }

  /**
   * 刷新访问令牌
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = (await this.getToken())?.refresh_token;

      if (!refreshToken) {
        console.error('TokenManager: No refresh token available');
        return false;
      }

      const response = await fetch(`${this.config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      // Handle the current backend response which returns 501 Not Implemented
      if (response.status === 501) {
        console.warn('TokenManager: Token refresh not yet implemented on backend:', data.message);
        await this.clearAuthState();
        return false;
      }

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      if (data.access_token) {
        // Store the new tokens
        const newTokenInfo: Partial<TokenInfo> = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expires_at: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        };

        // Preserve tenant_code
        const currentTenantCode = await this.getToken();
        if (currentTenantCode && currentTenantCode.tenant_code) {
          newTokenInfo.tenant_code = currentTenantCode.tenant_code;
        }

        await this.storeToken(newTokenInfo);

        console.log('TokenManager: Access token refreshed successfully');

        // Broadcast success to all clients
        if (this.config.broadcastToAllClients) {
          await this.config.broadcastToAllClients({
            type: 'token_refreshed',
            payload: { success: true }
          });
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('TokenManager: Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * 清除认证状态
   */
  private async clearAuthState(): Promise<void> {
    await this.clearToken();

    // Broadcast auth state cleared to all clients
    if (this.config.broadcastToAllClients) {
      await this.config.broadcastToAllClients({
        type: 'auth_state_cleared',
        payload: { message: 'Authentication state cleared due to token refresh failure' }
      });
    }

    // Broadcast tenant code missing event if applicable
    if (!(await this.hasTenantCode())) {
      if (this.config.broadcastToAllClients) {
        await this.config.broadcastToAllClients({
          type: 'tenant_code_missing',
          payload: { message: 'Tenant code is missing, user needs to login again' }
        });
      }
    }
  }

}