/**
 * 🔧 WebSocket 连接状态检测器 - 主动检测WebSocket断开
 * 
 * 解决浏览器无声断开WebSocket连接但Service Worker无法感知的问题
 * 通过多层检测机制确保连接状态的准确性
 */

import { Surreal, ConnectionStatus } from 'surrealdb';

// 连接状态枚举
export enum WebSocketState {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// 检测结果接口
export interface ConnectionDetectionResult {
  state: WebSocketState;
  isHealthy: boolean;
  latency: number | null;
  lastCheckTime: number;
  errorCount: number;
  errorMessage: string | null;
  surrealStatus: ConnectionStatus;
  webSocketReadyState: number | null;
}

// WebSocket 连接检测器配置
export interface WebSocketDetectorConfig {
  // 心跳检测间隔（毫秒）
  heartbeatInterval: number;
  // 超时时间（毫秒）
  timeoutMs: number;
  // 最大错误次数
  maxErrors: number;
  // 快速检测模式（用于登录等关键时刻）
  fastMode: boolean;
}

// 默认配置
const DEFAULT_CONFIG: WebSocketDetectorConfig = {
  heartbeatInterval: 10000,  // 10秒检测一次
  timeoutMs: 3000,          // 3秒超时
  maxErrors: 3,             // 最大3次错误
  fastMode: false           // 默认非快速模式
};

/**
 * WebSocket 连接状态检测器
 * 
 * 功能：
 * 1. 主动探测WebSocket连接状态
 * 2. 检测SurrealDB内部状态
 * 3. 验证数据库查询响应
 * 4. 监控连接延迟和错误
 */
export class WebSocketConnectionDetector {
  private db: Surreal | null = null;
  private config: WebSocketDetectorConfig;
  private detectionTimer: NodeJS.Timeout | null = null;
  private lastDetectionResult: ConnectionDetectionResult | null = null;
  private errorCount = 0;
  private isDetecting = false;
  
  // 回调函数
  private onStateChange?: (result: ConnectionDetectionResult) => void;
  private onError?: (error: Error, result: ConnectionDetectionResult) => void;

  constructor(config: Partial<WebSocketDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('WebSocketDetector: Initialized with config:', this.config);
  }

  /**
   * 设置要检测的数据库实例
   */
  setDatabase(db: Surreal | null): void {
    this.db = db;
    console.log('WebSocketDetector: Database instance set:', !!db);
  }

  /**
   * 设置状态变化回调
   */
  onConnectionStateChange(callback: (result: ConnectionDetectionResult) => void): void {
    this.onStateChange = callback;
  }

  /**
   * 设置错误回调
   */
  onConnectionError(callback: (error: Error, result: ConnectionDetectionResult) => void): void {
    this.onError = callback;
  }

  /**
   * 开始连接检测
   */
  startDetection(): void {
    if (this.detectionTimer) {
      console.log('WebSocketDetector: Detection already running, stopping previous timer');
      this.stopDetection();
    }

    const interval = this.config.fastMode ? 
      Math.min(this.config.heartbeatInterval / 3, 3000) : 
      this.config.heartbeatInterval;

    console.log(`WebSocketDetector: Starting detection with ${interval}ms interval (fastMode: ${this.config.fastMode})`);
    
    // 立即执行一次检测
    this.performDetection().catch(error => {
      console.error('WebSocketDetector: Initial detection failed:', error);
    });

    // 设置定时检测
    this.detectionTimer = setInterval(async () => {
      try {
        await this.performDetection();
      } catch (error) {
        console.error('WebSocketDetector: Scheduled detection failed:', error);
      }
    }, interval);
  }

  /**
   * 停止连接检测
   */
  stopDetection(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
      console.log('WebSocketDetector: Detection stopped');
    }
  }

  /**
   * 执行单次连接检测
   */
  async performDetection(): Promise<ConnectionDetectionResult> {
    if (this.isDetecting) {
      console.log('WebSocketDetector: Detection already in progress, skipping');
      return this.lastDetectionResult || this.createErrorResult('Detection in progress');
    }

    this.isDetecting = true;
    const startTime = Date.now();

    try {
      const result = await this.detectConnectionState();
      const endTime = Date.now();
      
      result.latency = endTime - startTime;
      result.lastCheckTime = Date.now();
      
      // 如果状态发生变化，调用回调
      if (this.hasStateChanged(result)) {
        console.log('WebSocketDetector: Connection state changed:', result);
        this.onStateChange?.(result);
      }
      
      this.lastDetectionResult = result;
      return result;

    } catch (error) {
      console.error('WebSocketDetector: Detection failed:', error);
      
      const errorResult = this.createErrorResult((error as Error).message);
      this.onError?.(error as Error, errorResult);
      this.lastDetectionResult = errorResult;
      
      return errorResult;
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * 核心连接状态检测逻辑
   */
  private async detectConnectionState(): Promise<ConnectionDetectionResult> {
    const result: ConnectionDetectionResult = {
      state: WebSocketState.DISCONNECTED,
      isHealthy: false,
      latency: null,
      lastCheckTime: Date.now(),
      errorCount: this.errorCount,
      errorMessage: null,
      surrealStatus: ConnectionStatus.Disconnected,
      webSocketReadyState: null
    };

    // 1️⃣ 检查数据库实例是否存在
    if (!this.db) {
      result.errorMessage = 'Database instance not available';
      result.state = WebSocketState.ERROR;
      this.incrementErrorCount();
      return result;
    }

    // 2️⃣ 检查SurrealDB内部连接状态
    result.surrealStatus = this.db.status;
    
    if (this.db.status !== ConnectionStatus.Connected) {
      result.errorMessage = `SurrealDB status: ${this.db.status}`;
      result.state = this.getStateFromSurrealStatus(this.db.status);
      this.incrementErrorCount();
      return result;
    }

    // 3️⃣ 尝试获取WebSocket状态（如果可用）
    try {
      // 通过反射获取内部WebSocket状态
      const wsState = this.getInternalWebSocketState();
      result.webSocketReadyState = wsState;
      
      if (wsState !== null && wsState !== WebSocket.OPEN) {
        result.errorMessage = `WebSocket ReadyState: ${wsState}`;
        result.state = WebSocketState.DISCONNECTED;
        this.incrementErrorCount();
        return result;
      }
    } catch (error) {
      // WebSocket状态检查失败，继续其他检测
      console.warn('WebSocketDetector: Could not check WebSocket state:', error);
    }

    // 4️⃣ 执行心跳查询测试
    try {
      const heartbeatResult = await this.performHeartbeatQuery();
      
      if (heartbeatResult.success) {
        // 连接健康
        result.state = WebSocketState.CONNECTED;
        result.isHealthy = true;
        result.latency = heartbeatResult.latency;
        this.resetErrorCount();
        return result;
      } else {
        // 心跳查询失败
        result.errorMessage = heartbeatResult.error;
        result.state = WebSocketState.ERROR;
        this.incrementErrorCount();
        return result;
      }
    } catch (error) {
      result.errorMessage = `Heartbeat query failed: ${(error as Error).message}`;
      result.state = WebSocketState.ERROR;
      this.incrementErrorCount();
      return result;
    }
  }

  /**
   * 尝试获取内部WebSocket状态
   */
  private getInternalWebSocketState(): number | null {
    try {
      // 尝试通过反射获取SurrealDB内部的WebSocket实例
      const dbAny = this.db as any;
      
      // 检查常见的WebSocket属性名
      const possibleWsPaths = [
        'ws', 'websocket', 'connection', 
        '_ws', '_websocket', '_connection',
        'socket', '_socket'
      ];
      
      for (const path of possibleWsPaths) {
        const ws = dbAny[path];
        if (ws && typeof ws.readyState === 'number') {
          return ws.readyState;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 执行心跳查询
   */
  private async performHeartbeatQuery(): Promise<{success: boolean; latency: number; error?: string}> {
    const startTime = Date.now();
    
    try {
      // 使用简单的查询作为心跳检测
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Heartbeat query timeout')), this.config.timeoutMs);
      });
      
      const queryPromise = this.db!.query('SELECT 1 as heartbeat;');
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const endTime = Date.now();
      
      if (result) {
        return {
          success: true,
          latency: endTime - startTime
        };
      } else {
        return {
          success: false,
          latency: endTime - startTime,
          error: 'Empty heartbeat response'
        };
      }
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        latency: endTime - startTime,
        error: (error as Error).message
      };
    }
  }

  /**
   * 从SurrealDB状态映射到WebSocket状态
   */
  private getStateFromSurrealStatus(status: ConnectionStatus): WebSocketState {
    switch (status) {
      case ConnectionStatus.Connected:
        return WebSocketState.CONNECTED;
      case ConnectionStatus.Connecting:
        return WebSocketState.CONNECTING;
      case ConnectionStatus.Disconnected:
        return WebSocketState.DISCONNECTED;
      case ConnectionStatus.Error:
        return WebSocketState.ERROR;
      default:
        return WebSocketState.DISCONNECTED;
    }
  }

  /**
   * 检查状态是否发生变化
   */
  private hasStateChanged(newResult: ConnectionDetectionResult): boolean {
    if (!this.lastDetectionResult) return true;
    
    return (
      this.lastDetectionResult.state !== newResult.state ||
      this.lastDetectionResult.isHealthy !== newResult.isHealthy ||
      this.lastDetectionResult.surrealStatus !== newResult.surrealStatus
    );
  }

  /**
   * 增加错误计数
   */
  private incrementErrorCount(): void {
    this.errorCount++;
    
    if (this.errorCount >= this.config.maxErrors) {
      console.warn(`WebSocketDetector: Error count reached maximum (${this.config.maxErrors})`);
    }
  }

  /**
   * 重置错误计数
   */
  private resetErrorCount(): void {
    if (this.errorCount > 0) {
      console.log(`WebSocketDetector: Resetting error count from ${this.errorCount} to 0`);
      this.errorCount = 0;
    }
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(errorMessage: string): ConnectionDetectionResult {
    return {
      state: WebSocketState.ERROR,
      isHealthy: false,
      latency: null,
      lastCheckTime: Date.now(),
      errorCount: this.errorCount,
      errorMessage,
      surrealStatus: this.db?.status || ConnectionStatus.Disconnected,
      webSocketReadyState: null
    };
  }

  /**
   * 获取当前检测结果
   */
  getLastDetectionResult(): ConnectionDetectionResult | null {
    return this.lastDetectionResult;
  }

  /**
   * 切换到快速模式（用于关键操作）
   */
  enableFastMode(): void {
    if (!this.config.fastMode) {
      console.log('WebSocketDetector: Enabling fast mode');
      this.config.fastMode = true;
      
      // 重新启动检测以使用新的间隔
      if (this.detectionTimer) {
        this.stopDetection();
        this.startDetection();
      }
    }
  }

  /**
   * 切换回正常模式
   */
  disableFastMode(): void {
    if (this.config.fastMode) {
      console.log('WebSocketDetector: Disabling fast mode');
      this.config.fastMode = false;
      
      // 重新启动检测以使用新的间隔
      if (this.detectionTimer) {
        this.stopDetection();
        this.startDetection();
      }
    }
  }

  /**
   * 是否处于错误状态
   */
  isInErrorState(): boolean {
    return this.errorCount >= this.config.maxErrors;
  }

  /**
   * 获取配置
   */
  getConfig(): WebSocketDetectorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<WebSocketDetectorConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    console.log('WebSocketDetector: Config updated:', {
      old: oldConfig,
      new: this.config
    });
    
    // 如果检测间隔发生变化，重新启动检测
    if (oldConfig.heartbeatInterval !== this.config.heartbeatInterval && this.detectionTimer) {
      this.stopDetection();
      this.startDetection();
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    console.log('WebSocketDetector: Disposing');
    this.stopDetection();
    this.db = null;
    this.lastDetectionResult = null;
    this.onStateChange = undefined;
    this.onError = undefined;
  }
}