import { toast } from 'react-hot-toast';

// 错误类型定义
export type ErrorType = 'network' | 'permission' | 'validation' | 'server' | 'client' | 'unknown';

// 错误级别
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// 错误信息接口
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string | number;
  details?: any;
  timestamp: Date;
  context?: string;
  stack?: string;
  userAgent?: string;
  url?: string;
}

// 错误处理配置
interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableReporting: boolean;
  enableUserNotification: boolean;
  reportingEndpoint?: string;
  maxRetries: number;
  retryDelay: number;
}

// 默认配置
const defaultConfig: ErrorHandlerConfig = {
  enableLogging: true,
  enableReporting: process.env.NODE_ENV === 'production',
  enableUserNotification: true,
  maxRetries: 3,
  retryDelay: 1000,
};

// 全局错误处理器类
class GlobalErrorHandler {
  private config: ErrorHandlerConfig;
  private errorQueue: ErrorInfo[] = [];
  private retryQueue: Map<string, { count: number; lastAttempt: Date }> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupGlobalHandlers();
  }

  // 设置全局错误处理器
  private setupGlobalHandlers() {
    // 捕获未处理的Promise错误
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'client',
        severity: 'high',
        message: `未处理的Promise错误: ${event.reason}`,
        details: event.reason,
        timestamp: new Date(),
        context: 'unhandledrejection',
      });
    });

    // 捕获JavaScript运行时错误
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'client',
        severity: 'high',
        message: event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        },
        timestamp: new Date(),
        context: 'javascript_error',
        stack: event.error?.stack,
      });
    });
  }

  // 主要错误处理方法
  public handleError(error: Error | ErrorInfo | string, context?: string): void {
    const errorInfo = this.normalizeError(error, context);
    
    // 记录错误
    if (this.config.enableLogging) {
      this.logError(errorInfo);
    }

    // 添加到错误队列
    this.errorQueue.push(errorInfo);
    
    // 限制队列大小
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }

    // 显示用户通知
    if (this.config.enableUserNotification) {
      this.showUserNotification(errorInfo);
    }

    // 发送错误报告
    if (this.config.enableReporting) {
      this.reportError(errorInfo);
    }
  }

  // 标准化错误对象
  private normalizeError(error: Error | ErrorInfo | string, context?: string): ErrorInfo {
    if (typeof error === 'string') {
      return {
        type: 'unknown',
        severity: 'medium',
        message: error,
        timestamp: new Date(),
        context,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
    }

    if (error instanceof Error) {
      return {
        type: this.determineErrorType(error),
        severity: this.determineSeverity(error),
        message: error.message,
        timestamp: new Date(),
        context,
        stack: error.stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
    }

    return {
      ...error,
      userAgent: error.userAgent || navigator.userAgent,
      url: error.url || window.location.href,
    };
  }

  // 确定错误类型
  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }

    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }

    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return 'validation';
    }

    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }

    return 'client';
  }

  // 确定错误严重性
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal') || message.includes('system')) {
      return 'critical';
    }

    if (message.includes('network') || message.includes('server') || message.includes('permission')) {
      return 'high';
    }

    if (message.includes('validation') || message.includes('warning')) {
      return 'medium';
    }

    return 'low';
  }

  // 记录错误
  private logError(errorInfo: ErrorInfo): void {
    const logMethod = errorInfo.severity === 'critical' ? 'error' : 
                     errorInfo.severity === 'high' ? 'error' :
                     errorInfo.severity === 'medium' ? 'warn' : 'info';

    console[logMethod]('PDF Parser Error:', {
      ...errorInfo,
      timestamp: errorInfo.timestamp.toISOString(),
    });
  }

  // 显示用户通知
  private showUserNotification(errorInfo: ErrorInfo): void {
    const userMessage = this.getUserFriendlyMessage(errorInfo);

    switch (errorInfo.severity) {
      case 'critical':
        toast.error(userMessage, { duration: 8000 });
        break;
      case 'high':
        toast.error(userMessage, { duration: 6000 });
        break;
      case 'medium':
        toast.error(userMessage, { duration: 4000 });
        break;
      case 'low':
        toast(userMessage, { duration: 3000 });
        break;
    }
  }

  // 获取用户友好的错误消息
  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    switch (errorInfo.type) {
      case 'network':
        return '网络连接出现问题，请检查您的网络连接';
      case 'permission':
        return '您没有执行此操作的权限，请联系管理员';
      case 'validation':
        return '输入的数据格式不正确，请检查后重试';
      case 'server':
        return '服务器出现问题，请稍后重试';
      default:
        return errorInfo.message || '出现未知错误，请刷新页面重试';
    }
  }

  // 发送错误报告
  private async reportError(errorInfo: ErrorInfo): Promise<void> {
    const reportKey = `${errorInfo.type}_${errorInfo.message}`;
    const retryInfo = this.retryQueue.get(reportKey);

    // 检查重试限制
    if (retryInfo && retryInfo.count >= this.config.maxRetries) {
      return;
    }

    try {
      const reportData = {
        ...errorInfo,
        timestamp: errorInfo.timestamp.toISOString(),
        sessionId: this.getSessionId(),
        userId: this.getCurrentUserId(),
      };

      if (this.config.reportingEndpoint) {
        await fetch(this.config.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reportData),
        });
      }

      // 清除重试记录
      this.retryQueue.delete(reportKey);
    } catch (reportError) {
      console.warn('Failed to report error:', reportError);
      
      // 记录重试信息
      const currentRetry = retryInfo || { count: 0, lastAttempt: new Date() };
      this.retryQueue.set(reportKey, {
        count: currentRetry.count + 1,
        lastAttempt: new Date(),
      });

      // 延迟重试
      if (currentRetry.count < this.config.maxRetries) {
        setTimeout(() => {
          this.reportError(errorInfo);
        }, this.config.retryDelay * Math.pow(2, currentRetry.count));
      }
    }
  }

  // 获取会话ID
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('pdf-parser-session-id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('pdf-parser-session-id', sessionId);
    }
    return sessionId;
  }

  // 获取当前用户ID
  private getCurrentUserId(): string | null {
    // 这里应该从认证上下文或localStorage获取用户ID
    return localStorage.getItem('user-id') || 'anonymous';
  }

  // 获取错误统计
  public getErrorStatistics(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: ErrorInfo[];
  } {
    const byType: Record<ErrorType, number> = {
      network: 0, permission: 0, validation: 0, server: 0, client: 0, unknown: 0
    };
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0, medium: 0, high: 0, critical: 0
    };

    this.errorQueue.forEach(error => {
      byType[error.type]++;
      bySeverity[error.severity]++;
    });

    return {
      total: this.errorQueue.length,
      byType,
      bySeverity,
      recent: this.errorQueue.slice(-10),
    };
  }

  // 清除错误历史
  public clearErrorHistory(): void {
    this.errorQueue = [];
    this.retryQueue.clear();
  }

  // 更新配置
  public updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建全局实例
export const globalErrorHandler = new GlobalErrorHandler();

// 便捷方法
export const handleError = (error: Error | ErrorInfo | string, context?: string) => {
  globalErrorHandler.handleError(error, context);
};

export const getErrorStatistics = () => {
  return globalErrorHandler.getErrorStatistics();
};

export const clearErrorHistory = () => {
  globalErrorHandler.clearErrorHistory();
};

// 特定类型的错误处理函数
export const handleNetworkError = (error: Error, operation: string) => {
  handleError({
    type: 'network',
    severity: 'high',
    message: `网络操作失败: ${operation}`,
    details: error,
    timestamp: new Date(),
    context: `network_${operation}`,
  });
};

export const handlePermissionError = (operation: string, requiredPermission: string) => {
  handleError({
    type: 'permission',
    severity: 'medium',
    message: `权限不足: 无法执行 ${operation}`,
    details: { requiredPermission },
    timestamp: new Date(),
    context: `permission_${operation}`,
  });
};

export const handleValidationError = (field: string, value: any, rules: string[]) => {
  handleError({
    type: 'validation',
    severity: 'low',
    message: `验证失败: ${field}`,
    details: { field, value, rules },
    timestamp: new Date(),
    context: `validation_${field}`,
  });
};

export default globalErrorHandler;