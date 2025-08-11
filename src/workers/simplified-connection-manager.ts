/**
 * 🔧 简化的连接状态管理器
 *
 * 解决原有连接管理逻辑过于复杂导致的状态不一致问题
 * 采用单一职责原则，专注于连接状态管理
 */

import { Surreal, ConnectionStatus } from "surrealdb";
import {
  WebSocketConnectionDetector,
  WebSocketState,
  ConnectionDetectionResult,
} from "./websocket-connection-detector";

// 连接配置
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

// 连接状态
export interface ConnectionState {
  status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "error";
  isConnected: boolean;
  isAuthenticated: boolean;
  hasDb: boolean;
  config: ConnectionConfig | null;
  error: string | null;
  lastConnectedAt: number | null;
  reconnectAttempts: number;
  latency: number | null;
}

// 事件类型
export type ConnectionEventType =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error"
  | "authenticated"
  | "health-check";

export interface ConnectionEvent {
  type: ConnectionEventType;
  state: ConnectionState;
  timestamp: number;
  error?: Error;
}

export type ConnectionEventListener = (event: ConnectionEvent) => void;

/**
 * 简化的连接管理器
 *
 * 设计原则：
 * 1. 单一职责：专注连接状态管理
 * 2. 状态一致性：统一的状态管理
 * 3. 主动检测：集成WebSocket检测器
 * 4. 简单可靠：减少复杂逻辑
 */
export class SimplifiedConnectionManager {
  private db: Surreal | null = null;
  private config: ConnectionConfig | null = null;
  private state: ConnectionState;

  // WebSocket检测器
  private detector: WebSocketConnectionDetector;

  // 重连管理
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayBase = 1000; // 1秒
  private readonly reconnectDelayMax = 30000; // 30秒

  // 事件监听器
  private eventListeners = new Set<ConnectionEventListener>();

  // 标记
  private isConnecting = false;
  private isReconnecting = false;
  private disposed = false;

  constructor() {
    // 初始化状态
    this.state = this.createInitialState();

    // 创建WebSocket检测器
    this.detector = new WebSocketConnectionDetector({
      heartbeatInterval: 10000, // 10秒
      timeoutMs: 5000, // 5秒超时
      maxErrors: 3, // 最大3次错误
      fastMode: false,
    });

    // 设置检测器回调
    this.detector.onConnectionStateChange((result) => {
      this.handleDetectionResult(result);
    });

    this.detector.onConnectionError((error, result) => {
      this.handleDetectionError(error, result);
    });

    console.log("SimplifiedConnectionManager: Initialized");
  }

  /**
   * 连接到数据库
   */
  async connect(config: ConnectionConfig): Promise<void> {
    if (this.disposed) {
      throw new Error("Connection manager has been disposed");
    }

    if (this.isConnecting) {
      console.log(
        "SimplifiedConnectionManager: Connection already in progress",
      );
      return;
    }

    console.log(
      `SimplifiedConnectionManager: Connecting to ${config.endpoint}`,
    );

    this.isConnecting = true;
    this.config = config;

    this.updateState({
      status: "connecting",
      config,
      error: null,
      reconnectAttempts: 0,
    });

    try {
      // 创建Surreal实例
      if (!this.db) {
        this.db = new Surreal();
      }

      // 连接数据库 - 🔧 缩短超时时间并添加更好的错误处理
      await Promise.race([
        this.db.connect(config.endpoint),
        new Promise(
          (_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), 5000), // 🔧 缩短到5秒
        ),
      ]);

      // 设置命名空间和数据库 - 🔧 添加超时保护
      await Promise.race([
        this.db.use({
          namespace: config.namespace,
          database: config.database,
        }),
        new Promise(
          (_, reject) =>
            setTimeout(() => reject(new Error("Database setup timeout")), 3000), // 3秒超时
        ),
      ]);

      // 认证（如果提供）- 🔧 添加超时保护
      if (config.auth?.token) {
        await Promise.race([
          this.db.authenticate(config.auth.token),
          new Promise(
            (_, reject) =>
              setTimeout(
                () => reject(new Error("Authentication timeout")),
                3000,
              ), // 3秒超时
          ),
        ]);
        this.updateState({
          isAuthenticated: true,
        });
      }

      // 连接成功，更新状态
      this.updateState({
        status: "connected",
        isConnected: true,
        hasDb: true,
        error: null,
        lastConnectedAt: Date.now(),
        reconnectAttempts: 0,
      });

      // 设置检测器数据库实例并开始检测
      this.detector.setDatabase(this.db);
      this.detector.startDetection();

      // 触发连接成功事件
      this.emitEvent("connected");

      console.log(
        "SimplifiedConnectionManager: Connection established successfully",
      );
    } catch (error) {
      console.error("SimplifiedConnectionManager: Connection failed:", error);

      this.updateState({
        status: "error",
        isConnected: false,
        hasDb: !!this.db,
        error: (error as Error).message,
      });

      this.emitEvent("error", error as Error);

      // 🔧 连接失败时不立即抛出错误，而是设置为降级状态
      console.warn(
        "🔧 Connection failed, setting degraded state instead of throwing",
      );

      // 自动开始重连
      this.scheduleReconnection();

      // 🔧 不抛出错误，让调用者知道连接失败但继续运行
      // throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log("SimplifiedConnectionManager: Disconnecting...");

    // 停止检测和重连
    this.detector.stopDetection();
    this.clearReconnectionTimer();

    // 关闭数据库连接
    if (this.db) {
      try {
        await this.db.close();
      } catch (error) {
        console.warn(
          "SimplifiedConnectionManager: Error closing database:",
          error,
        );
      }
      this.db = null;
    }

    // 更新状态
    this.updateState({
      status: "disconnected",
      isConnected: false,
      isAuthenticated: false,
      hasDb: false,
      error: null,
      reconnectAttempts: 0,
    });

    this.emitEvent("disconnected");

    console.log("SimplifiedConnectionManager: Disconnected");
  }

  /**
   * 强制重连
   */
  async forceReconnect(): Promise<void> {
    if (!this.config) {
      throw new Error("No connection configuration available for reconnection");
    }

    console.log("SimplifiedConnectionManager: Force reconnection requested");

    // 停止当前连接
    await this.disconnect();

    // 重新连接
    try {
      await this.connect(this.config);
    } catch (error) {
      console.error(
        "SimplifiedConnectionManager: Force reconnection failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * 处理检测结果
   */
  private handleDetectionResult(result: ConnectionDetectionResult): void {
    const wasConnected = this.state.isConnected;
    const isNowHealthy =
      result.isHealthy && result.state === WebSocketState.CONNECTED;

    // 更新延迟信息
    this.updateState({
      latency: result.latency,
    });

    // 检查连接状态变化
    if (wasConnected && !isNowHealthy) {
      console.warn(
        "SimplifiedConnectionManager: Connection lost detected by WebSocket detector",
      );

      this.updateState({
        status: "error",
        isConnected: false,
        error: result.errorMessage || "Connection lost",
      });

      this.emitEvent("disconnected");

      // 自动重连
      if (!this.isReconnecting) {
        this.scheduleReconnection();
      }
    } else if (!wasConnected && isNowHealthy) {
      console.log(
        "SimplifiedConnectionManager: Connection restored detected by WebSocket detector",
      );

      this.updateState({
        status: "connected",
        isConnected: true,
        error: null,
      });

      this.emitEvent("connected");
    }

    // 触发健康检查事件
    this.emitEvent("health-check");
  }

  /**
   * 处理检测错误
   */
  private handleDetectionError(
    error: Error,
    result: ConnectionDetectionResult,
  ): void {
    console.error("SimplifiedConnectionManager: Detection error:", error);

    if (result.errorCount >= 3 && this.state.isConnected) {
      console.warn(
        "SimplifiedConnectionManager: Multiple detection errors, treating as connection lost",
      );

      this.updateState({
        status: "error",
        isConnected: false,
        error: error.message,
      });

      this.emitEvent("error", error);

      // 自动重连
      if (!this.isReconnecting) {
        this.scheduleReconnection();
      }
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnection(): void {
    if (!this.config || this.isReconnecting || this.disposed) {
      return;
    }

    if (this.state.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "SimplifiedConnectionManager: Maximum reconnection attempts reached",
      );

      this.updateState({
        status: "error",
        error: "Maximum reconnection attempts reached",
      });

      return;
    }

    const delay = this.calculateReconnectDelay();
    console.log(
      `SimplifiedConnectionManager: Scheduling reconnection in ${delay}ms (attempt ${this.state.reconnectAttempts + 1})`,
    );

    this.isReconnecting = true;

    this.updateState({
      status: "reconnecting",
      reconnectAttempts: this.state.reconnectAttempts + 1,
    });

    this.emitEvent("reconnecting");

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.performReconnection();
      } catch (error) {
        console.error(
          "SimplifiedConnectionManager: Reconnection failed:",
          error,
        );

        // 继续尝试重连
        this.isReconnecting = false;
        this.scheduleReconnection();
      }
    }, delay);
  }

  /**
   * 执行重连
   */
  private async performReconnection(): Promise<void> {
    if (!this.config) {
      throw new Error("No configuration available for reconnection");
    }

    console.log(
      `SimplifiedConnectionManager: Performing reconnection attempt #${this.state.reconnectAttempts}`,
    );

    try {
      // 关闭现有连接
      if (this.db) {
        try {
          await this.db.close();
        } catch (error) {
          // 忽略关闭错误
        }
        this.db = null;
      }

      // 重新连接
      await this.connect(this.config);

      // 重连成功
      this.isReconnecting = false;
      this.clearReconnectionTimer();

      console.log("SimplifiedConnectionManager: Reconnection successful");
    } catch (error) {
      console.error(
        "SimplifiedConnectionManager: Reconnection attempt failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * 计算重连延迟
   */
  private calculateReconnectDelay(): number {
    return Math.min(
      this.reconnectDelayBase *
        Math.pow(2, Math.min(this.state.reconnectAttempts, 6)),
      this.reconnectDelayMax,
    );
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectionTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 更新状态
   */
  private updateState(updates: Partial<ConnectionState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // 记录状态变化
    if (
      oldState.status !== this.state.status ||
      oldState.isConnected !== this.state.isConnected
    ) {
      console.log("SimplifiedConnectionManager: State changed:", {
        from: { status: oldState.status, isConnected: oldState.isConnected },
        to: { status: this.state.status, isConnected: this.state.isConnected },
      });
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(type: ConnectionEventType, error?: Error): void {
    const event: ConnectionEvent = {
      type,
      state: { ...this.state },
      timestamp: Date.now(),
      error,
    };

    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error(
          "SimplifiedConnectionManager: Event listener error:",
          err,
        );
      }
    });
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): ConnectionState {
    return {
      status: "disconnected",
      isConnected: false,
      isAuthenticated: false,
      hasDb: false,
      config: null,
      error: null,
      lastConnectedAt: null,
      reconnectAttempts: 0,
      latency: null,
    };
  }

  // === 公共API ===

  /**
   * 获取当前状态
   */
  getState(): Readonly<ConnectionState> {
    return { ...this.state };
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): Surreal | null {
    return this.db;
  }

  /**
   * 检查是否连接
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * 检查是否认证
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: ConnectionEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: ConnectionEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * 启用快速检测模式（用于登录等关键操作）
   */
  enableFastMode(): void {
    this.detector.enableFastMode();
  }

  /**
   * 禁用快速检测模式
   */
  disableFastMode(): void {
    this.detector.disableFastMode();
  }

  /**
   * 获取最后的检测结果
   */
  getLastDetectionResult(): ConnectionDetectionResult | null {
    return this.detector.getLastDetectionResult();
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    console.log("SimplifiedConnectionManager: Disposing");

    this.disposed = true;

    // 停止检测和重连
    this.detector.stopDetection();
    this.clearReconnectionTimer();

    // 关闭连接
    await this.disconnect();

    // 清理资源
    this.detector.dispose();
    this.eventListeners.clear();

    console.log("SimplifiedConnectionManager: Disposed");
  }
}
