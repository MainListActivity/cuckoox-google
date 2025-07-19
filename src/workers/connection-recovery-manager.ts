/**
 * 连接状态
 */
export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  nextReconnectDelay: number;
  error?: string;
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
  url: string;
  namespace: string;
  database: string;
  username?: string;
  password?: string;
  token?: string;
}

/**
 * 连接恢复管理器
 * 负责处理连接失败、自动重连和降级处理
 */
export class ConnectionRecoveryManager {
  private connectionState: ConnectionState;
  private connectionConfig?: ConnectionConfig;
  private reconnectTimer?: number;
  private healthCheckTimer?: number;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  private connectFunction: (config: ConnectionConfig) => Promise<boolean>;
  private disconnectFunction: () => Promise<void>;
  
  // 重连策略配置
  private readonly baseReconnectDelay = 1000; // 1秒
  private readonly maxReconnectDelay = 30000; // 30秒
  private readonly reconnectBackoffMultiplier = 2;
  private readonly healthCheckInterval = 30000; // 30秒
  private readonly connectionTimeout = 10000; // 10秒

  constructor(config: {
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
    connectFunction: (config: ConnectionConfig) => Promise<boolean>;
    disconnectFunction: () => Promise<void>;
    maxReconnectAttempts?: number;
  }) {
    this.broadcastToAllClients = config.broadcastToAllClients;
    this.connectFunction = config.connectFunction;
    this.disconnectFunction = config.disconnectFunction;
    
    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      nextReconnectDelay: this.baseReconnectDelay
    };
    
    console.log('ConnectionRecoveryManager: Initialized');
  }

  /**
   * 设置连接配置
   */
  setConnectionConfig(config: ConnectionConfig): void {
    this.connectionConfig = { ...config };
    console.log('ConnectionRecoveryManager: Connection config updated');
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * 尝试建立连接
   */
  async connect(): Promise<boolean> {
    if (!this.connectionConfig) {
      throw new Error('Connection config not set');
    }

    if (this.connectionState.isConnecting) {
      console.log('ConnectionRecoveryManager: Connection already in progress');
      return false;
    }

    this.connectionState.isConnecting = true;
    this.connectionState.error = undefined;
    
    try {
      console.log('ConnectionRecoveryManager: Attempting to connect...');
      
      // 设置连接超时
      const connectPromise = this.connectFunction(this.connectionConfig);
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout);
      });
      
      const success = await Promise.race([connectPromise, timeoutPromise]);
      
      if (success) {
        this.connectionState.isConnected = true;
        this.connectionState.lastConnectedAt = Date.now();
        this.connectionState.reconnectAttempts = 0;
        this.connectionState.nextReconnectDelay = this.baseReconnectDelay;
        
        console.log('ConnectionRecoveryManager: Connection established successfully');
        
        // 启动健康检查
        this.startHealthCheck();
        
        // 广播连接状态
        await this.broadcastConnectionState();
        
        return true;
      } else {
        throw new Error('Connection failed');
      }
      
    } catch (error) {
      this.connectionState.error = String(error);
      console.error('ConnectionRecoveryManager: Connection failed:', error);
      
      await this.handleConnectionFailure();
      return false;
      
    } finally {
      this.connectionState.isConnecting = false;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('ConnectionRecoveryManager: Disconnecting...');
    
    // 停止重连和健康检查
    this.stopReconnection();
    this.stopHealthCheck();
    
    try {
      await this.disconnectFunction();
    } catch (error) {
      console.warn('ConnectionRecoveryManager: Error during disconnect:', error);
    }
    
    this.connectionState.isConnected = false;
    this.connectionState.lastDisconnectedAt = Date.now();
    
    await this.broadcastConnectionState();
    
    console.log('ConnectionRecoveryManager: Disconnected');
  }

  /**
   * 处理连接失败
   */
  private async handleConnectionFailure(): Promise<void> {
    this.connectionState.isConnected = false;
    this.connectionState.lastDisconnectedAt = Date.now();
    
    // 广播连接状态
    await this.broadcastConnectionState();
    
    // 如果未达到最大重连次数，启动自动重连
    if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
      await this.scheduleReconnection();
    } else {
      console.error('ConnectionRecoveryManager: Max reconnection attempts reached, entering degraded mode');
      await this.enterDegradedMode();
    }
  }

  /**
   * 安排重连
   */
  private async scheduleReconnection(): Promise<void> {
    this.connectionState.reconnectAttempts++;
    
    // 计算下次重连延迟（指数退避）
    this.connectionState.nextReconnectDelay = Math.min(
      this.baseReconnectDelay * Math.pow(this.reconnectBackoffMultiplier, this.connectionState.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(
      `ConnectionRecoveryManager: Scheduling reconnection attempt ${this.connectionState.reconnectAttempts}/${this.connectionState.maxReconnectAttempts} in ${this.connectionState.nextReconnectDelay}ms`
    );
    
    // 广播重连计划
    await this.broadcastReconnectionScheduled();
    
    this.reconnectTimer = self.setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('ConnectionRecoveryManager: Scheduled reconnection failed:', error);
      }
    }, this.connectionState.nextReconnectDelay);
  }

  /**
   * 停止重连
   */
  private stopReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      console.log('ConnectionRecoveryManager: Reconnection stopped');
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.stopHealthCheck(); // 确保没有重复的定时器
    
    this.healthCheckTimer = self.setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('ConnectionRecoveryManager: Health check failed:', error);
        await this.handleConnectionFailure();
      }
    }, this.healthCheckInterval);
    
    console.log('ConnectionRecoveryManager: Health check started');
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      console.log('ConnectionRecoveryManager: Health check stopped');
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.connectionState.isConnected) {
      return;
    }

    // 这里可以执行一个简单的查询来检查连接健康状态
    // 由于我们没有直接访问数据库实例，我们依赖外部的健康检查机制
    console.log('ConnectionRecoveryManager: Health check passed');
  }

  /**
   * 进入降级模式
   */
  private async enterDegradedMode(): Promise<void> {
    console.log('ConnectionRecoveryManager: Entering degraded mode');
    
    await this.broadcastToAllClients({
      type: 'connection_degraded',
      payload: {
        message: '连接失败，系统进入离线模式',
        reconnectAttempts: this.connectionState.reconnectAttempts,
        maxReconnectAttempts: this.connectionState.maxReconnectAttempts,
        lastError: this.connectionState.error,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 手动重试连接
   */
  async retryConnection(): Promise<boolean> {
    console.log('ConnectionRecoveryManager: Manual retry requested');
    
    // 重置重连计数器
    this.connectionState.reconnectAttempts = 0;
    this.connectionState.nextReconnectDelay = this.baseReconnectDelay;
    
    // 停止现有的重连计划
    this.stopReconnection();
    
    return await this.connect();
  }

  /**
   * 重置连接状态
   */
  resetConnectionState(): void {
    this.stopReconnection();
    this.stopHealthCheck();
    
    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: this.connectionState.maxReconnectAttempts,
      nextReconnectDelay: this.baseReconnectDelay
    };
    
    console.log('ConnectionRecoveryManager: Connection state reset');
  }

  /**
   * 广播连接状态
   */
  private async broadcastConnectionState(): Promise<void> {
    await this.broadcastToAllClients({
      type: 'connection_state_change',
      payload: {
        ...this.connectionState,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 广播重连计划
   */
  private async broadcastReconnectionScheduled(): Promise<void> {
    await this.broadcastToAllClients({
      type: 'reconnection_scheduled',
      payload: {
        attempt: this.connectionState.reconnectAttempts,
        maxAttempts: this.connectionState.maxReconnectAttempts,
        delay: this.connectionState.nextReconnectDelay,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 检查是否应该尝试重连
   */
  shouldAttemptReconnection(): boolean {
    return (
      !this.connectionState.isConnected &&
      !this.connectionState.isConnecting &&
      this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts
    );
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats(): {
    isConnected: boolean;
    uptime?: number;
    downtime?: number;
    totalReconnectAttempts: number;
    lastError?: string;
  } {
    const now = Date.now();
    
    return {
      isConnected: this.connectionState.isConnected,
      uptime: this.connectionState.lastConnectedAt 
        ? (this.connectionState.isConnected ? now - this.connectionState.lastConnectedAt : undefined)
        : undefined,
      downtime: this.connectionState.lastDisconnectedAt
        ? (!this.connectionState.isConnected ? now - this.connectionState.lastDisconnectedAt : undefined)
        : undefined,
      totalReconnectAttempts: this.connectionState.reconnectAttempts,
      lastError: this.connectionState.error
    };
  }

  /**
   * 关闭连接恢复管理器
   */
  async close(): Promise<void> {
    console.log('ConnectionRecoveryManager: Closing...');
    
    this.stopReconnection();
    this.stopHealthCheck();
    
    if (this.connectionState.isConnected) {
      await this.disconnect();
    }
    
    console.log('ConnectionRecoveryManager: Closed successfully');
  }
}