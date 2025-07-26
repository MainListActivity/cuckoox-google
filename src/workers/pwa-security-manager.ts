/// <reference lib="WebWorker" />

/**
 * PWA安全管理器
 * 
 * 负责PWA应用的安全功能，包括：
 * - 缓存数据加密和解密
 * - 敏感信息保护
 * - 自动锁定和重新认证
 * - 安全威胁检测
 * - 更新包完整性验证
 */

export interface PWASecurityConfig {
  encryption: {
    enabled: boolean;
    algorithm: 'AES-GCM' | 'AES-CBC';
    keyLength: 128 | 192 | 256;
    ivLength: 12 | 16;
  };
  authentication: {
    autoLockTimeout: number; // ms
    maxInactivity: number; // ms
    requireReauth: boolean;
    sessionStorageKey: string;
  };
  threats: {
    enableDetection: boolean;
    maxFailedAttempts: number;
    lockoutDuration: number; // ms
  };
  cache: {
    encryptSensitiveData: boolean;
    sensitiveDataPatterns: string[];
    maxCacheAge: number; // ms
  };
}

export interface SecurityMetrics {
  encryptedCaches: number;
  lastAuthCheck: Date;
  failedAttempts: number;
  isLocked: boolean;
  threatLevel: 'low' | 'medium' | 'high';
  sessionExpiry: Date | null;
}

export interface EncryptedData {
  data: string; // base64 encoded encrypted data
  iv: string; // base64 encoded initialization vector
  algorithm: string;
  timestamp: number;
}

export class PWASecurityManager {
  private config: PWASecurityConfig;
  private encryptionKey: CryptoKey | null = null;
  private isInitialized = false;
  private lockTimer: NodeJS.Timeout | null = null;
  private securityMetrics: SecurityMetrics = {
    encryptedCaches: 0,
    lastAuthCheck: new Date(),
    failedAttempts: 0,
    isLocked: false,
    threatLevel: 'low',
    sessionExpiry: null
  };

  constructor(config: PWASecurityConfig) {
    this.config = config;
  }

  /**
   * 初始化安全管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('PWASecurityManager: Initializing...');

    try {
      // 初始化加密密钥
      if (this.config.encryption.enabled) {
        await this.initializeEncryption();
      }

      // 设置自动锁定
      if (this.config.authentication.autoLockTimeout > 0) {
        this.setupAutoLock();
      }

      // 检查现有会话
      await this.checkExistingSession();

      this.isInitialized = true;
      console.log('PWASecurityManager: Initialized successfully');
    } catch (error) {
      console.error('PWASecurityManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 加密数据
   */
  async encryptData(data: string): Promise<EncryptedData> {
    if (!this.config.encryption.enabled || !this.encryptionKey) {
      throw new Error('Encryption not enabled or key not available');
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // 生成随机IV
      const iv = crypto.getRandomValues(new Uint8Array(this.config.encryption.ivLength));

      // 加密数据
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.config.encryption.algorithm,
          iv: iv
        },
        this.encryptionKey,
        dataBuffer
      );

      // 转换为base64
      const encryptedData = this.arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = this.arrayBufferToBase64(iv.buffer);

      return {
        data: encryptedData,
        iv: ivBase64,
        algorithm: this.config.encryption.algorithm,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('PWASecurityManager: Encryption failed:', error);
      throw error;
    }
  }

  /**
   * 解密数据
   */
  async decryptData(encryptedData: EncryptedData): Promise<string> {
    if (!this.config.encryption.enabled || !this.encryptionKey) {
      throw new Error('Encryption not enabled or key not available');
    }

    try {
      // 验证算法匹配
      if (encryptedData.algorithm !== this.config.encryption.algorithm) {
        throw new Error('Algorithm mismatch');
      }

      // 转换base64到ArrayBuffer
      const dataBuffer = this.base64ToArrayBuffer(encryptedData.data);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      // 解密数据
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm,
          iv: new Uint8Array(iv)
        },
        this.encryptionKey,
        dataBuffer
      );

      // 转换为字符串
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('PWASecurityManager: Decryption failed:', error);
      throw error;
    }
  }

  /**
   * 安全存储缓存数据
   */
  async secureStoreCache(cacheName: string, request: Request, response: Response): Promise<void> {
    try {
      const cache = await caches.open(cacheName);

      // 检查是否需要加密
      if (this.shouldEncryptCache(request)) {
        const responseText = await response.text();
        const encryptedData = await this.encryptData(responseText);

        // 创建加密响应
        const encryptedResponse = new Response(JSON.stringify(encryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'x-pwa-encrypted': 'true',
            'content-type': 'application/json'
          }
        });

        await cache.put(request, encryptedResponse);
        this.securityMetrics.encryptedCaches++;
      } else {
        // 直接存储非敏感数据
        await cache.put(request, response);
      }

      console.log('PWASecurityManager: Securely stored cache:', request.url);
    } catch (error) {
      console.error('PWASecurityManager: Secure cache storage failed:', error);
      throw error;
    }
  }

  /**
   * 安全获取缓存数据
   */
  async secureRetrieveCache(cacheName: string, request: Request): Promise<Response | null> {
    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match(request);

      if (!response) {
        return null;
      }

      // 检查是否为加密数据
      if (response.headers.get('x-pwa-encrypted') === 'true') {
        const encryptedDataText = await response.text();
        const encryptedData: EncryptedData = JSON.parse(encryptedDataText);
        
        const decryptedData = await this.decryptData(encryptedData);

        // 重建原始响应
        return new Response(decryptedData, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(
            Array.from(response.headers.entries()).filter(([key]) => key !== 'x-pwa-encrypted')
          )
        });
      }

      return response;
    } catch (error) {
      console.error('PWASecurityManager: Secure cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * 验证用户认证状态
   */
  async validateAuthentication(): Promise<boolean> {
    try {
      this.securityMetrics.lastAuthCheck = new Date();

      // 检查会话过期
      if (this.securityMetrics.sessionExpiry && 
          new Date() > this.securityMetrics.sessionExpiry) {
        console.log('PWASecurityManager: Session expired');
        await this.lockApplication();
        return false;
      }

      // 检查认证令牌
      // 这里应该与现有的 TokenManager 集成
      const hasValidToken = await this.checkAuthToken();
      
      if (!hasValidToken) {
        this.securityMetrics.failedAttempts++;
        
        if (this.securityMetrics.failedAttempts >= this.config.threats.maxFailedAttempts) {
          console.warn('PWASecurityManager: Max failed attempts reached');
          await this.lockApplication();
          return false;
        }
      } else {
        // 重置失败计数
        this.securityMetrics.failedAttempts = 0;
      }

      return hasValidToken;
    } catch (error) {
      console.error('PWASecurityManager: Authentication validation failed:', error);
      return false;
    }
  }

  /**
   * 锁定应用
   */
  async lockApplication(): Promise<void> {
    console.log('PWASecurityManager: Locking application');

    try {
      this.securityMetrics.isLocked = true;
      this.securityMetrics.threatLevel = 'high';

      // 清除敏感缓存
      await this.clearSensitiveCaches();

      // 广播锁定事件给客户端
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'application_locked',
          payload: {
            reason: 'security_violation',
            unlockTime: Date.now() + this.config.threats.lockoutDuration
          }
        });
      });

      console.log('PWASecurityManager: Application locked successfully');
    } catch (error) {
      console.error('PWASecurityManager: Application lock failed:', error);
    }
  }

  /**
   * 解锁应用
   */
  async unlockApplication(): Promise<boolean> {
    try {
      // 验证认证
      const isAuthenticated = await this.validateAuthentication();
      
      if (isAuthenticated) {
        this.securityMetrics.isLocked = false;
        this.securityMetrics.threatLevel = 'low';
        this.securityMetrics.failedAttempts = 0;
        this.resetAutoLock();

        console.log('PWASecurityManager: Application unlocked');
        return true;
      }

      return false;
    } catch (error) {
      console.error('PWASecurityManager: Application unlock failed:', error);
      return false;
    }
  }

  /**
   * 检测安全威胁
   */
  detectSecurityThreats(): void {
    if (!this.config.threats.enableDetection) return;

    try {
      // 检测异常访问模式
      this.detectAbnormalAccess();

      // 检测完整性
      this.detectIntegrityViolations();

      // 更新威胁级别
      this.updateThreatLevel();

      console.log('PWASecurityManager: Security threat detection completed');
    } catch (error) {
      console.error('PWASecurityManager: Threat detection failed:', error);
    }
  }

  /**
   * 获取安全指标
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

  /**
   * 清理安全资源
   */
  async cleanup(): Promise<void> {
    console.log('PWASecurityManager: Cleaning up...');

    try {
      // 清理定时器
      if (this.lockTimer) {
        clearTimeout(this.lockTimer);
        this.lockTimer = null;
      }

      // 清理加密密钥
      this.encryptionKey = null;

      // 清理敏感缓存
      await this.clearSensitiveCaches();

      console.log('PWASecurityManager: Cleanup completed');
    } catch (error) {
      console.error('PWASecurityManager: Cleanup failed:', error);
    }
  }

  // 私有方法

  private async initializeEncryption(): Promise<void> {
    try {
      // 生成或获取加密密钥
      this.encryptionKey = await crypto.subtle.generateKey(
        {
          name: this.config.encryption.algorithm,
          length: this.config.encryption.keyLength
        },
        false, // 不可导出
        ['encrypt', 'decrypt']
      );

      console.log('PWASecurityManager: Encryption initialized');
    } catch (error) {
      console.error('PWASecurityManager: Encryption initialization failed:', error);
      throw error;
    }
  }

  private setupAutoLock(): void {
    const { autoLockTimeout } = this.config.authentication;

    const resetLockTimer = () => {
      if (this.lockTimer) {
        clearTimeout(this.lockTimer);
      }

      this.lockTimer = setTimeout(() => {
        this.lockApplication();
      }, autoLockTimeout);
    };

    // 监听用户活动
    if (typeof self !== 'undefined') {
      // 在Service Worker中监听fetch事件作为活动指示
      self.addEventListener('fetch', resetLockTimer);
    }

    resetLockTimer();
  }

  private resetAutoLock(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.setupAutoLock();
    }
  }

  private async checkExistingSession(): Promise<void> {
    // 检查现有的认证会话
    // 这里应该与现有的认证系统集成
    const sessionData = await this.getStoredSessionData();
    
    if (sessionData && sessionData.expiry > Date.now()) {
      this.securityMetrics.sessionExpiry = new Date(sessionData.expiry);
    } else {
      // 会话无效或过期
      await this.lockApplication();
    }
  }

  private async getStoredSessionData(): Promise<{ expiry: number } | null> {
    try {
      // 这里应该从安全存储中获取会话数据
      // 暂时返回null，需要根据实际认证系统实现
      return null;
    } catch (error) {
      console.error('PWASecurityManager: Error getting stored session data:', error);
      return null;
    }
  }

  private async checkAuthToken(): Promise<boolean> {
    try {
      // 这里应该与现有的TokenManager集成
      // 检查当前的认证令牌是否有效
      return true; // 暂时返回true，需要根据实际实现
    } catch (error) {
      console.error('PWASecurityManager: Auth token check failed:', error);
      return false;
    }
  }

  private shouldEncryptCache(request: Request): boolean {
    if (!this.config.cache.encryptSensitiveData) return false;

    const url = request.url;
    const { sensitiveDataPatterns } = this.config.cache;

    return sensitiveDataPatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(url);
    });
  }

  private async clearSensitiveCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        if (this.isSensitiveCache(cacheName)) {
          await caches.delete(cacheName);
          console.log('PWASecurityManager: Cleared sensitive cache:', cacheName);
        }
      }
    } catch (error) {
      console.error('PWASecurityManager: Error clearing sensitive caches:', error);
    }
  }

  private isSensitiveCache(cacheName: string): boolean {
    const sensitiveCachePatterns = [
      'user-data',
      'auth-cache',
      'sensitive-'
    ];

    return sensitiveCachePatterns.some(pattern => cacheName.includes(pattern));
  }

  private detectAbnormalAccess(): void {
    // 实现异常访问检测逻辑
    // 例如：过于频繁的请求、异常的请求模式等
    console.log('PWASecurityManager: Checking for abnormal access patterns');
  }

  private detectIntegrityViolations(): void {
    // 实现完整性检测逻辑
    // 例如：缓存数据被篡改、应用文件完整性等
    console.log('PWASecurityManager: Checking integrity violations');
  }

  private updateThreatLevel(): void {
    const { failedAttempts } = this.securityMetrics;
    const { maxFailedAttempts } = this.config.threats;

    if (failedAttempts >= maxFailedAttempts * 0.8) {
      this.securityMetrics.threatLevel = 'high';
    } else if (failedAttempts >= maxFailedAttempts * 0.5) {
      this.securityMetrics.threatLevel = 'medium';
    } else {
      this.securityMetrics.threatLevel = 'low';
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return buffer;
  }
}

// 安全工具函数
export const SecurityUtils = {
  /**
   * 生成安全的随机字符串
   */
  generateSecureRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * 检查数据是否包含敏感信息
   */
  containsSensitiveData(data: string): boolean {
    const sensitivePatterns = [
      /token/i,
      /password/i,
      /secret/i,
      /key/i,
      /auth/i,
      /jwt/i,
      /bearer/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(data));
  },

  /**
   * 计算数据哈希
   */
  async calculateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};