import { RecordId } from "surrealdb";

// WebRTC错误类型枚举
export enum WebRTCErrorType {
  // 连接相关错误
  CONNECTION_FAILED = "CONNECTION_FAILED",
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT",
  CONNECTION_LOST = "CONNECTION_LOST",
  ICE_CONNECTION_FAILED = "ICE_CONNECTION_FAILED",
  SIGNALING_ERROR = "SIGNALING_ERROR",

  // 媒体相关错误
  MEDIA_ACCESS_DENIED = "MEDIA_ACCESS_DENIED",
  MEDIA_DEVICE_NOT_FOUND = "MEDIA_DEVICE_NOT_FOUND",
  MEDIA_DEVICE_ERROR = "MEDIA_DEVICE_ERROR",
  AUDIO_CAPTURE_ERROR = "AUDIO_CAPTURE_ERROR",
  VIDEO_CAPTURE_ERROR = "VIDEO_CAPTURE_ERROR",
  SCREEN_SHARE_ERROR = "SCREEN_SHARE_ERROR",

  // 通话相关错误
  CALL_REJECTED = "CALL_REJECTED",
  CALL_TIMEOUT = "CALL_TIMEOUT",
  CALL_BUSY = "CALL_BUSY",
  CALL_NETWORK_ERROR = "CALL_NETWORK_ERROR",

  // 会议相关错误
  CONFERENCE_JOIN_FAILED = "CONFERENCE_JOIN_FAILED",
  CONFERENCE_FULL = "CONFERENCE_FULL",
  CONFERENCE_PERMISSION_DENIED = "CONFERENCE_PERMISSION_DENIED",
  CONFERENCE_ENDED = "CONFERENCE_ENDED",

  // 文件传输错误
  FILE_TRANSFER_FAILED = "FILE_TRANSFER_FAILED",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_TYPE_NOT_SUPPORTED = "FILE_TYPE_NOT_SUPPORTED",

  // 网络相关错误
  NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE",
  BANDWIDTH_INSUFFICIENT = "BANDWIDTH_INSUFFICIENT",
  NETWORK_QUALITY_POOR = "NETWORK_QUALITY_POOR",

  // 权限错误
  PERMISSION_DENIED = "PERMISSION_DENIED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",

  // 系统错误
  BROWSER_NOT_SUPPORTED = "BROWSER_NOT_SUPPORTED",
  WEBRTC_NOT_SUPPORTED = "WEBRTC_NOT_SUPPORTED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = "low", // 轻微错误，不影响核心功能
  MEDIUM = "medium", // 中等错误，影响部分功能
  HIGH = "high", // 严重错误，影响主要功能
  CRITICAL = "critical", // 关键错误，系统无法正常运行
}

// 错误恢复策略
export enum RecoveryStrategy {
  RETRY = "retry", // 重试操作
  FALLBACK = "fallback", // 使用备用方案
  USER_ACTION = "user_action", // 需要用户操作
  RELOAD_PAGE = "reload_page", // 重新加载页面
  CONTACT_SUPPORT = "contact_support", // 联系技术支持
  NONE = "none", // 无恢复策略
}

// WebRTC错误详细信息
export interface WebRTCErrorDetails {
  type: WebRTCErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string; // 用户友好的错误消息
  technicalDetails?: string; // 技术详细信息
  code?: string | number; // 错误代码
  timestamp: number;
  context?: {
    callId?: string;
    userId?: RecordId | string;
    sessionId?: string;
    deviceId?: string;
    component?: string;
    action?: string;
    [key: string]: any;
  };
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number; // 重试延迟(毫秒)
  suggestedActions?: string[]; // 建议的用户操作
}

// 错误统计信息
export interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Record<WebRTCErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: WebRTCErrorDetails[];
  lastError?: WebRTCErrorDetails;
  averageResolutionTime: number;
}

// 错误处理配置
export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableStatistics: boolean;
  maxErrorHistory: number;
  autoRetryEnabled: boolean;
  defaultRetryDelay: number;
  maxRetryAttempts: number;
  showTechnicalDetails: boolean;
  enableUserFeedback: boolean;
}

// 错误事件监听器
export interface ErrorEventListeners {
  onErrorOccurred?: (error: WebRTCErrorDetails) => void;
  onErrorResolved?: (error: WebRTCErrorDetails, resolution: string) => void;
  onRetryAttempt?: (error: WebRTCErrorDetails, attemptNumber: number) => void;
  onRecoveryFailed?: (error: WebRTCErrorDetails) => void;
  onUserActionRequired?: (error: WebRTCErrorDetails, actions: string[]) => void;
}

/**
 * WebRTCErrorHandler - WebRTC错误处理器
 * 提供统一的WebRTC错误处理、分类、恢复和用户提示功能
 */
class WebRTCErrorHandler {
  private config: ErrorHandlerConfig = {
    enableLogging: true,
    enableStatistics: true,
    maxErrorHistory: 100,
    autoRetryEnabled: true,
    defaultRetryDelay: 3000,
    maxRetryAttempts: 3,
    showTechnicalDetails: false,
    enableUserFeedback: true,
  };

  private listeners: ErrorEventListeners = {};
  private errorHistory: WebRTCErrorDetails[] = [];
  private errorStatistics: ErrorStatistics = {
    totalErrors: 0,
    errorsByType: {} as Record<WebRTCErrorType, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recentErrors: [],
    averageResolutionTime: 0,
  };

  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private resolutionStartTimes: Map<string, number> = new Map();

  constructor(config?: Partial<ErrorHandlerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initializeStatistics();
  }

  /**
   * 初始化错误统计
   */
  private initializeStatistics(): void {
    // 初始化错误类型统计
    Object.values(WebRTCErrorType).forEach((type) => {
      this.errorStatistics.errorsByType[type] = 0;
    });

    // 初始化严重程度统计
    Object.values(ErrorSeverity).forEach((severity) => {
      this.errorStatistics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * 设置错误事件监听器
   */
  setEventListeners(listeners: ErrorEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 处理WebRTC错误
   */
  handleError(
    error: Error | DOMException | RTCError | string | null | undefined,
    context?: WebRTCErrorDetails["context"],
  ): WebRTCErrorDetails {
    // 处理null/undefined错误
    if (error === null || error === undefined) {
      error = String(error);
    }

    const errorDetails = this.classifyError(error, context);

    // 记录错误
    this.recordError(errorDetails);

    // 触发错误事件
    this.listeners.onErrorOccurred?.(errorDetails);

    // 自动处理恢复
    if (this.config.autoRetryEnabled && errorDetails.retryable) {
      this.attemptRecovery(errorDetails);
    } else if (errorDetails.recoveryStrategy === RecoveryStrategy.USER_ACTION) {
      this.listeners.onUserActionRequired?.(
        errorDetails,
        errorDetails.suggestedActions || [],
      );
    }

    // 日志记录
    if (this.config.enableLogging) {
      this.logError(errorDetails);
    }

    return errorDetails;
  }

  /**
   * 错误分类和分析
   */
  private classifyError(
    error: Error | DOMException | RTCError | string,
    context?: WebRTCErrorDetails["context"],
  ): WebRTCErrorDetails {
    const timestamp = Date.now();
    const errorId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

    let errorType = WebRTCErrorType.UNKNOWN_ERROR;
    let severity = ErrorSeverity.MEDIUM;
    let userMessage = "发生了未知错误，请稍后重试";
    let technicalDetails = "";
    let recoveryStrategy = RecoveryStrategy.RETRY;
    let retryable = true;
    let suggestedActions: string[] = [];

    // 错误消息和代码
    const errorMessage =
      typeof error === "string" ? error : error.message || error.toString();
    const errorCode = (error as any).code || (error as any).name || "";

    // 根据错误消息和类型进行分类
    if (error instanceof DOMException) {
      const { type, details } = this.classifyDOMException(error);
      errorType = type;
      userMessage = details.userMessage;
      severity = details.severity;
      recoveryStrategy = details.recoveryStrategy;
      retryable = details.retryable;
      suggestedActions = details.suggestedActions;
    } else if ((error as any).name === "RTCError") {
      const { type, details } = this.classifyRTCError(error as RTCError);
      errorType = type;
      userMessage = details.userMessage;
      severity = details.severity;
      recoveryStrategy = details.recoveryStrategy;
      retryable = details.retryable;
      suggestedActions = details.suggestedActions;
    } else {
      // 通过错误消息进行分类
      const classification = this.classifyByMessage(errorMessage, errorCode);
      errorType = classification.type;
      userMessage = classification.userMessage;
      severity = classification.severity;
      recoveryStrategy = classification.recoveryStrategy;
      retryable = classification.retryable;
      suggestedActions = classification.suggestedActions;
    }

    // 添加技术详细信息
    technicalDetails = this.generateTechnicalDetails(error, context);

    return {
      type: errorType,
      severity,
      message: errorMessage,
      userMessage,
      technicalDetails,
      code: errorCode,
      timestamp,
      context: { ...context, errorId },
      recoveryStrategy,
      retryable,
      maxRetries: this.getMaxRetriesForError(errorType),
      retryDelay: this.getRetryDelayForError(errorType),
      suggestedActions,
    };
  }

  /**
   * 分类DOMException错误
   */
  private classifyDOMException(error: DOMException): {
    type: WebRTCErrorType;
    details: {
      userMessage: string;
      severity: ErrorSeverity;
      recoveryStrategy: RecoveryStrategy;
      retryable: boolean;
      suggestedActions: string[];
    };
  } {
    switch (error.name) {
      case "NotAllowedError":
        return {
          type: WebRTCErrorType.MEDIA_ACCESS_DENIED,
          details: {
            userMessage:
              "您拒绝了摄像头或麦克风访问权限，请在浏览器设置中允许访问",
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: RecoveryStrategy.USER_ACTION,
            retryable: false,
            suggestedActions: [
              "点击地址栏的摄像头/麦克风图标",
              '选择"始终允许"',
              "刷新页面重试",
            ],
          },
        };

      case "NotFoundError":
        return {
          type: WebRTCErrorType.MEDIA_DEVICE_NOT_FOUND,
          details: {
            userMessage: "未检测到摄像头或麦克风设备，请检查设备连接",
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: RecoveryStrategy.USER_ACTION,
            retryable: true,
            suggestedActions: [
              "检查摄像头和麦克风是否正确连接",
              "确保设备驱动程序已安装",
              "重新连接设备后重试",
            ],
          },
        };

      case "NotReadableError":
        return {
          type: WebRTCErrorType.MEDIA_DEVICE_ERROR,
          details: {
            userMessage:
              "摄像头或麦克风设备被其他应用程序占用，请关闭其他应用后重试",
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: RecoveryStrategy.RETRY,
            retryable: true,
            suggestedActions: [
              "关闭其他使用摄像头/麦克风的应用程序",
              "重新启动浏览器",
              "重试操作",
            ],
          },
        };

      case "OverconstrainedError":
        return {
          type: WebRTCErrorType.MEDIA_DEVICE_ERROR,
          details: {
            userMessage: "设备不支持请求的媒体格式，正在尝试使用默认设置",
            severity: ErrorSeverity.LOW,
            recoveryStrategy: RecoveryStrategy.FALLBACK,
            retryable: true,
            suggestedActions: [
              "系统将自动调整媒体设置",
              "如问题持续，请更新设备驱动程序",
            ],
          },
        };

      case "SecurityError":
        return {
          type: WebRTCErrorType.PERMISSION_DENIED,
          details: {
            userMessage: "由于安全限制无法访问媒体设备，请使用HTTPS连接",
            severity: ErrorSeverity.CRITICAL,
            recoveryStrategy: RecoveryStrategy.USER_ACTION,
            retryable: false,
            suggestedActions: [
              "确保使用HTTPS连接",
              "检查浏览器安全设置",
              "联系管理员解决安全限制",
            ],
          },
        };

      default:
        return {
          type: WebRTCErrorType.UNKNOWN_ERROR,
          details: {
            userMessage: "发生了媒体设备相关错误，请重试",
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: RecoveryStrategy.RETRY,
            retryable: true,
            suggestedActions: ["重试操作", "检查设备连接", "刷新页面"],
          },
        };
    }
  }

  /**
   * 分类RTCError错误
   */
  private classifyRTCError(error: RTCError): {
    type: WebRTCErrorType;
    details: {
      userMessage: string;
      severity: ErrorSeverity;
      recoveryStrategy: RecoveryStrategy;
      retryable: boolean;
      suggestedActions: string[];
    };
  } {
    switch ((error as any).errorDetail) {
      case "dtls-failure":
        return {
          type: WebRTCErrorType.CONNECTION_FAILED,
          details: {
            userMessage: "网络连接建立失败，请检查网络连接",
            severity: ErrorSeverity.HIGH,
            recoveryStrategy: RecoveryStrategy.RETRY,
            retryable: true,
            suggestedActions: [
              "检查网络连接",
              "尝试重新连接",
              "检查防火墙设置",
            ],
          },
        };

      case "fingerprint-failure":
        return {
          type: WebRTCErrorType.CONNECTION_FAILED,
          details: {
            userMessage: "连接安全验证失败，请重试",
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: RecoveryStrategy.RETRY,
            retryable: true,
            suggestedActions: ["重试连接", "清除浏览器缓存", "刷新页面"],
          },
        };

      default:
        return {
          type: WebRTCErrorType.CONNECTION_FAILED,
          details: {
            userMessage: "网络连接出现问题，正在重试",
            severity: ErrorSeverity.MEDIUM,
            recoveryStrategy: RecoveryStrategy.RETRY,
            retryable: true,
            suggestedActions: [
              "检查网络连接",
              "重试操作",
              "如问题持续请联系技术支持",
            ],
          },
        };
    }
  }

  /**
   * 通过错误消息进行分类
   */
  private classifyByMessage(
    message: string,
    code: string | number,
  ): {
    type: WebRTCErrorType;
    userMessage: string;
    severity: ErrorSeverity;
    recoveryStrategy: RecoveryStrategy;
    retryable: boolean;
    suggestedActions: string[];
  } {
    const lowerMessage = message.toLowerCase();

    // 网络相关错误
    if (
      lowerMessage.includes("network") ||
      lowerMessage.includes("connection")
    ) {
      if (lowerMessage.includes("timeout")) {
        return {
          type: WebRTCErrorType.CONNECTION_TIMEOUT,
          userMessage: "连接超时，请检查网络连接并重试",
          severity: ErrorSeverity.MEDIUM,
          recoveryStrategy: RecoveryStrategy.RETRY,
          retryable: true,
          suggestedActions: ["检查网络连接", "重试操作", "联系网络管理员"],
        };
      }

      return {
        type: WebRTCErrorType.NETWORK_UNAVAILABLE,
        userMessage: "网络连接不可用，请检查网络设置",
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.RETRY,
        retryable: true,
        suggestedActions: ["检查网络连接", "重启路由器", "联系网络服务商"],
      };
    }

    // ICE连接错误
    if (lowerMessage.includes("ice") || lowerMessage.includes("candidate")) {
      return {
        type: WebRTCErrorType.ICE_CONNECTION_FAILED,
        userMessage: "网络连接建立失败，可能是防火墙或网络配置问题",
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.RETRY,
        retryable: true,
        suggestedActions: [
          "检查防火墙设置",
          "尝试使用不同网络",
          "联系网络管理员",
        ],
      };
    }

    // 媒体相关错误
    if (
      lowerMessage.includes("getUserMedia") ||
      lowerMessage.includes("media")
    ) {
      return {
        type: WebRTCErrorType.MEDIA_ACCESS_DENIED,
        userMessage: "无法访问摄像头或麦克风，请检查设备权限",
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.USER_ACTION,
        retryable: false,
        suggestedActions: [
          "允许浏览器访问摄像头和麦克风",
          "检查设备是否被其他应用占用",
          "重新启动浏览器",
        ],
      };
    }

    // 浏览器支持错误
    if (
      lowerMessage.includes("not supported") ||
      lowerMessage.includes("unsupported")
    ) {
      return {
        type: WebRTCErrorType.BROWSER_NOT_SUPPORTED,
        userMessage:
          "您的浏览器不支持此功能，请使用最新版本的Chrome、Firefox或Safari",
        severity: ErrorSeverity.CRITICAL,
        recoveryStrategy: RecoveryStrategy.USER_ACTION,
        retryable: false,
        suggestedActions: [
          "更新浏览器到最新版本",
          "使用支持WebRTC的现代浏览器",
          "启用浏览器的WebRTC功能",
        ],
      };
    }

    // 权限错误
    if (
      lowerMessage.includes("permission") ||
      lowerMessage.includes("denied")
    ) {
      return {
        type: WebRTCErrorType.PERMISSION_DENIED,
        userMessage: "权限不足，请联系管理员",
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.USER_ACTION,
        retryable: false,
        suggestedActions: [
          "联系系统管理员获取权限",
          "检查账户权限设置",
          "确认具有相应的操作权限",
        ],
      };
    }

    // 默认错误处理
    return {
      type: WebRTCErrorType.UNKNOWN_ERROR,
      userMessage: "发生了未知错误，请稍后重试",
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      suggestedActions: ["重试操作", "刷新页面", "如问题持续请联系技术支持"],
    };
  }

  /**
   * 生成技术详细信息
   */
  private generateTechnicalDetails(
    error: Error | DOMException | RTCError | string,
    context?: WebRTCErrorDetails["context"],
  ): string {
    const details: string[] = [];

    // 错误基本信息
    if (typeof error === "object" && error !== null) {
      details.push(`Error Type: ${error.constructor.name}`);
      details.push(`Error Name: ${(error as any).name || "Unknown"}`);
      details.push(`Error Message: ${error.message || error.toString()}`);

      if ((error as any).code) {
        details.push(`Error Code: ${(error as any).code}`);
      }

      if ((error as any).stack) {
        details.push(`Stack Trace: ${(error as any).stack}`);
      }
    } else {
      details.push(`Error Message: ${error}`);
    }

    // 上下文信息 - 处理循环引用
    if (context) {
      try {
        const contextString = JSON.stringify(
          context,
          (key, value) => {
            // 处理循环引用
            if (typeof value === "object" && value !== null) {
              if (this.hasCircularReference(value)) {
                return "[Circular Reference]";
              }
            }
            return value;
          },
          2,
        );
        details.push(`Context: ${contextString}`);
      } catch (error) {
        details.push(
          `Context: [Unable to serialize - ${(error as Error).message}]`,
        );
      }
    }

    // 浏览器信息
    details.push(`User Agent: ${navigator.userAgent}`);
    details.push(`Platform: ${navigator.platform}`);
    details.push(`Language: ${navigator.language}`);

    // WebRTC支持信息
    details.push(`WebRTC Supported: ${!!window.RTCPeerConnection}`);
    details.push(
      `getUserMedia Supported: ${!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)}`,
    );
    details.push(
      `getDisplayMedia Supported: ${!!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)}`,
    );

    return details.join("\n");
  }

  /**
   * 检查对象是否有循环引用
   */
  private hasCircularReference(obj: any, seen = new WeakSet()): boolean {
    if (obj === null || typeof obj !== "object") {
      return false;
    }

    if (seen.has(obj)) {
      return true;
    }

    seen.add(obj);

    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        this.hasCircularReference(obj[key], seen)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取错误类型的最大重试次数
   */
  private getMaxRetriesForError(errorType: WebRTCErrorType): number {
    const retryConfig: Record<WebRTCErrorType, number> = {
      [WebRTCErrorType.CONNECTION_FAILED]: 3,
      [WebRTCErrorType.CONNECTION_TIMEOUT]: 3,
      [WebRTCErrorType.CONNECTION_LOST]: 5,
      [WebRTCErrorType.ICE_CONNECTION_FAILED]: 3,
      [WebRTCErrorType.SIGNALING_ERROR]: 2,
      [WebRTCErrorType.MEDIA_DEVICE_ERROR]: 2,
      [WebRTCErrorType.AUDIO_CAPTURE_ERROR]: 2,
      [WebRTCErrorType.VIDEO_CAPTURE_ERROR]: 2,
      [WebRTCErrorType.SCREEN_SHARE_ERROR]: 2,
      [WebRTCErrorType.CALL_NETWORK_ERROR]: 3,
      [WebRTCErrorType.FILE_TRANSFER_FAILED]: 3,
      [WebRTCErrorType.NETWORK_UNAVAILABLE]: 5,
      [WebRTCErrorType.BANDWIDTH_INSUFFICIENT]: 2,
      [WebRTCErrorType.NETWORK_QUALITY_POOR]: 2,
      [WebRTCErrorType.UNKNOWN_ERROR]: 2,
      // 不可重试的错误
      [WebRTCErrorType.MEDIA_ACCESS_DENIED]: 0,
      [WebRTCErrorType.MEDIA_DEVICE_NOT_FOUND]: 0,
      [WebRTCErrorType.CALL_REJECTED]: 0,
      [WebRTCErrorType.CALL_BUSY]: 0,
      [WebRTCErrorType.CONFERENCE_FULL]: 0,
      [WebRTCErrorType.CONFERENCE_PERMISSION_DENIED]: 0,
      [WebRTCErrorType.FILE_TOO_LARGE]: 0,
      [WebRTCErrorType.FILE_TYPE_NOT_SUPPORTED]: 0,
      [WebRTCErrorType.PERMISSION_DENIED]: 0,
      [WebRTCErrorType.AUTHENTICATION_FAILED]: 0,
      [WebRTCErrorType.BROWSER_NOT_SUPPORTED]: 0,
      [WebRTCErrorType.WEBRTC_NOT_SUPPORTED]: 0,
      [WebRTCErrorType.CALL_TIMEOUT]: 1,
      [WebRTCErrorType.CONFERENCE_JOIN_FAILED]: 2,
      [WebRTCErrorType.CONFERENCE_ENDED]: 0,
    };

    const errorTypeRetries =
      retryConfig[errorType] !== undefined
        ? retryConfig[errorType]
        : this.config.maxRetryAttempts;

    // 只有当全局配置被明确设置为0时（表示完全禁用重试），才强制覆盖错误类型特定的配置
    if (this.config.maxRetryAttempts === 0) {
      return 0;
    }

    // 否则使用错误类型特定的重试次数
    return errorTypeRetries;
  }

  /**
   * 获取错误类型的重试延迟
   */
  private getRetryDelayForError(errorType: WebRTCErrorType): number {
    const delayConfig: Record<WebRTCErrorType, number> = {
      [WebRTCErrorType.CONNECTION_FAILED]: 5000,
      [WebRTCErrorType.CONNECTION_TIMEOUT]: 3000,
      [WebRTCErrorType.CONNECTION_LOST]: 2000,
      [WebRTCErrorType.ICE_CONNECTION_FAILED]: 5000,
      [WebRTCErrorType.SIGNALING_ERROR]: 3000,
      [WebRTCErrorType.MEDIA_DEVICE_ERROR]: 2000,
      [WebRTCErrorType.NETWORK_UNAVAILABLE]: 10000,
      [WebRTCErrorType.NETWORK_QUALITY_POOR]: 5000,
      [WebRTCErrorType.FILE_TRANSFER_FAILED]: 3000,
      [WebRTCErrorType.CONFERENCE_JOIN_FAILED]: 5000,
      [WebRTCErrorType.UNKNOWN_ERROR]: 3000,
    };

    return delayConfig[errorType] || this.config.defaultRetryDelay;
  }

  /**
   * 记录错误
   */
  private recordError(error: WebRTCErrorDetails): void {
    // 添加到历史记录
    this.errorHistory.push(error);

    // 限制历史记录长度
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory.shift();
    }

    // 更新统计信息
    if (this.config.enableStatistics) {
      this.updateStatistics(error);
    }

    // 记录解决开始时间
    if (error.context?.errorId) {
      this.resolutionStartTimes.set(error.context.errorId, Date.now());
    }
  }

  /**
   * 更新错误统计
   */
  private updateStatistics(error: WebRTCErrorDetails): void {
    this.errorStatistics.totalErrors++;
    this.errorStatistics.errorsByType[error.type]++;
    this.errorStatistics.errorsBySeverity[error.severity]++;
    this.errorStatistics.lastError = error;

    // 更新最近错误列表
    this.errorStatistics.recentErrors.push(error);
    if (this.errorStatistics.recentErrors.length > 10) {
      this.errorStatistics.recentErrors.shift();
    }
  }

  /**
   * 尝试错误恢复
   */
  private attemptRecovery(error: WebRTCErrorDetails): void {
    const maxRetries =
      error.maxRetries || this.getMaxRetriesForError(error.type);
    const currentAttempt = (error.context?.retryAttempt || 0) + 1;

    if (currentAttempt > maxRetries) {
      this.listeners.onRecoveryFailed?.(error);
      return;
    }

    const retryDelay =
      error.retryDelay || this.getRetryDelayForError(error.type);
    const errorId = error.context?.errorId || "unknown";

    // 设置重试定时器
    try {
      const timer = setTimeout(() => {
        this.retryTimers.delete(errorId);

        // 更新重试次数
        const updatedContext = {
          ...error.context,
          retryAttempt: currentAttempt,
        };

        // 触发重试事件
        this.listeners.onRetryAttempt?.(
          { ...error, context: updatedContext },
          currentAttempt,
        );

        // 这里应该触发实际的重试逻辑
        // 由于这是一个通用的错误处理器，具体的重试逻辑应该由调用方实现
      }, retryDelay);

      this.retryTimers.set(errorId, timer);
    } catch (timerError) {
      // 如果设置定时器失败，直接触发恢复失败
      console.error("Failed to setup retry timer:", timerError);
      this.listeners.onRecoveryFailed?.(error);
    }
  }

  /**
   * 标记错误已解决
   */
  markErrorResolved(
    errorId: string,
    resolution: string = "manual_resolution",
  ): void {
    const startTime = this.resolutionStartTimes.get(errorId);
    if (startTime) {
      const resolutionTime = Date.now() - startTime;

      // 更新平均解决时间
      const totalTime =
        this.errorStatistics.averageResolutionTime *
        (this.errorStatistics.totalErrors - 1);
      this.errorStatistics.averageResolutionTime =
        (totalTime + resolutionTime) / this.errorStatistics.totalErrors;

      this.resolutionStartTimes.delete(errorId);
    }

    // 查找对应的错误并触发解决事件
    const error = this.errorHistory.find(
      (err) => err.context?.errorId === errorId,
    );
    if (error) {
      this.listeners.onErrorResolved?.(error, resolution);
    }

    // 清理重试定时器
    const timer = this.retryTimers.get(errorId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(errorId);
    }
  }

  /**
   * 取消错误重试
   */
  cancelRetry(errorId: string): void {
    const timer = this.retryTimers.get(errorId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(errorId);
    }
  }

  /**
   * 获取错误统计信息
   */
  getStatistics(): ErrorStatistics {
    return { ...this.errorStatistics };
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(): WebRTCErrorDetails[] {
    return [...this.errorHistory];
  }

  /**
   * 清理错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory.length = 0;
    this.resolutionStartTimes.clear();

    // 重新初始化统计信息
    this.errorStatistics = {
      totalErrors: 0,
      errorsByType: {} as Record<WebRTCErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recentErrors: [],
      averageResolutionTime: 0,
    };

    this.initializeStatistics();
  }

  /**
   * 记录错误日志
   */
  private logError(error: WebRTCErrorDetails): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[WebRTC Error] ${error.type}: ${error.message}`;

    switch (logLevel) {
      case "error":
        console.error(logMessage, error);
        break;
      case "warn":
        console.warn(logMessage, error);
        break;
      case "info":
        console.info(logMessage, error);
        break;
      default:
        console.log(logMessage, error);
    }
  }

  /**
   * 获取日志级别
   */
  private getLogLevel(
    severity: ErrorSeverity,
  ): "error" | "warn" | "info" | "log" {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return "error";
      case ErrorSeverity.MEDIUM:
        return "warn";
      case ErrorSeverity.LOW:
        return "info";
      default:
        return "log";
    }
  }

  /**
   * 销毁错误处理器
   */
  destroy(): void {
    console.log("WebRTCErrorHandler: 开始销毁...");

    // 清理所有定时器
    this.retryTimers.forEach((timer) => clearTimeout(timer));
    this.retryTimers.clear();

    // 清理数据
    this.errorHistory.length = 0;
    this.resolutionStartTimes.clear();
    this.listeners = {};

    // 重置统计信息
    this.errorStatistics = {
      totalErrors: 0,
      errorsByType: {} as Record<WebRTCErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recentErrors: [],
      averageResolutionTime: 0,
    };

    this.initializeStatistics();

    console.log("WebRTCErrorHandler: 销毁完成");
  }
}

// 创建单例实例
const webrtcErrorHandler = new WebRTCErrorHandler();

// 导出错误处理器实例和相关类型
export default webrtcErrorHandler;
export {
  WebRTCErrorHandler,
  type WebRTCErrorDetails,
  type ErrorStatistics,
  type ErrorHandlerConfig,
  type ErrorEventListeners,
};
