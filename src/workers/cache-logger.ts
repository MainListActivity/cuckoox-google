/**
 * 缓存系统结构化日志记录和错误跟踪
 * 提供统一的日志记录、错误分类和问题诊断功能
 */

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

// 日志类别
export enum LogCategory {
  QUERY = 'QUERY',
  CACHE = 'CACHE',
  SYNC = 'SYNC',
  SUBSCRIPTION = 'SUBSCRIPTION',
  PERFORMANCE = 'PERFORMANCE',
  SYSTEM = 'SYSTEM',
  AUTH = 'AUTH',
  NETWORK = 'NETWORK'
}

// 错误类型
export enum ErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  QUERY_ERROR = 'QUERY_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 日志条目接口
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, any>;
  userId?: string;
  caseId?: string;
  sessionId?: string;
  source: string; // 日志来源组件
  stack?: string; // 错误堆栈（如果是错误日志）
  duration?: number; // 操作持续时间（毫秒）
  tags?: string[]; // 标签用于分类和搜索
}

// 错误统计信息
export interface ErrorStats {
  errorType: ErrorType;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  affectedUsers: Set<string>;
  affectedTables: Set<string>;
  errorRate: number; // 错误率（相对于总操作数）
  avgFrequency: number; // 平均发生频率（次/小时）
  severity: 'low' | 'medium' | 'high' | 'critical';
  sampleErrors: LogEntry[]; // 样本错误（最多5个）
}

// 日志分析结果
export interface LogAnalysis {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByCategory: Record<LogCategory, number>;
  errorStats: Map<ErrorType, ErrorStats>;
  topErrors: Array<{
    type: ErrorType;
    count: number;
    message: string;
    lastOccurrence: number;
  }>;
  performanceIssues: Array<{
    operation: string;
    avgDuration: number;
    maxDuration: number;
    count: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  timeRange: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  recommendations: string[];
}

// 日志过滤器
export interface LogFilter {
  level?: LogLevel;
  category?: LogCategory;
  errorType?: ErrorType;
  userId?: string;
  caseId?: string;
  source?: string;
  startTime?: number;
  endTime?: number;
  tags?: string[];
  searchText?: string;
}

/**
 * 缓存系统日志记录器
 * 提供结构化日志记录、错误跟踪和分析功能
 */
export class CacheLogger {
  private logs: LogEntry[] = [];
  private errorStats = new Map<ErrorType, ErrorStats>();
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private maxLogEntries = 50000; // 最大日志条目数
  private sessionId: string;
  
  // 性能跟踪
  private operationTimers = new Map<string, number>();
  
  // 日志监听器
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor(sessionId?: string) {
    this.sessionId = sessionId || this.generateSessionId();
    this.startPeriodicCleanup();
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info(LogCategory.SYSTEM, 'Log level changed', { newLevel: LogLevel[level] });
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * 记录调试日志
   */
  debug(category: LogCategory, message: string, details?: Record<string, any>, source = 'CacheSystem'): void {
    this.log(LogLevel.DEBUG, category, message, details, source);
  }

  /**
   * 记录信息日志
   */
  info(category: LogCategory, message: string, details?: Record<string, any>, source = 'CacheSystem'): void {
    this.log(LogLevel.INFO, category, message, details, source);
  }

  /**
   * 记录警告日志
   */
  warn(category: LogCategory, message: string, details?: Record<string, any>, source = 'CacheSystem'): void {
    this.log(LogLevel.WARN, category, message, details, source);
  }

  /**
   * 记录错误日志
   */
  error(category: LogCategory, message: string, error?: Error, details?: Record<string, any>, source = 'CacheSystem'): void {
    const logDetails = {
      ...details,
      errorName: error?.name,
      errorMessage: error?.message
    };
    
    this.log(LogLevel.ERROR, category, message, logDetails, source, error?.stack);
    
    // 更新错误统计
    this.updateErrorStats(error, category, details);
  }

  /**
   * 记录关键错误日志
   */
  critical(category: LogCategory, message: string, error?: Error, details?: Record<string, any>, source = 'CacheSystem'): void {
    const logDetails = {
      ...details,
      errorName: error?.name,
      errorMessage: error?.message
    };
    
    this.log(LogLevel.CRITICAL, category, message, logDetails, source, error?.stack);
    
    // 更新错误统计
    this.updateErrorStats(error, category, details, 'critical');
  }

  /**
   * 开始性能计时
   */
  startTimer(operationId: string): void {
    this.operationTimers.set(operationId, Date.now());
  }

  /**
   * 结束性能计时并记录日志
   */
  endTimer(operationId: string, category: LogCategory, message: string, details?: Record<string, any>, source = 'CacheSystem'): number {
    const startTime = this.operationTimers.get(operationId);
    if (!startTime) {
      this.warn(LogCategory.SYSTEM, `Timer not found for operation: ${operationId}`, { operationId }, source);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.operationTimers.delete(operationId);

    const logDetails = {
      ...details,
      operationId,
      duration: `${duration}ms`
    };

    // 根据持续时间选择日志级别
    let level = LogLevel.DEBUG;
    if (duration > 5000) { // 超过5秒
      level = LogLevel.WARN;
    } else if (duration > 1000) { // 超过1秒
      level = LogLevel.INFO;
    }

    this.log(level, category, message, logDetails, source, undefined, duration);
    
    return duration;
  }

  /**
   * 记录查询执行
   */
  logQuery(sql: string, params: any, duration: number, source: 'local' | 'remote', cacheHit: boolean, userId?: string, caseId?: string, error?: Error): void {
    const category = LogCategory.QUERY;
    const details = {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      params,
      source,
      cacheHit,
      duration: `${duration}ms`,
      userId,
      caseId
    };

    if (error) {
      this.error(category, 'Query execution failed', error, details, 'QueryExecutor');
    } else {
      const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
      this.log(level, category, 'Query executed', details, 'QueryExecutor', undefined, duration);
    }
  }

  /**
   * 记录缓存操作
   */
  logCacheOperation(operation: 'hit' | 'miss' | 'update' | 'invalidate', table: string, details?: Record<string, any>, userId?: string, caseId?: string): void {
    const logDetails = {
      operation,
      table,
      userId,
      caseId,
      ...details
    };

    const level = operation === 'miss' ? LogLevel.DEBUG : LogLevel.DEBUG;
    this.log(level, LogCategory.CACHE, `Cache ${operation}`, logDetails, 'CacheManager');
  }

  /**
   * 记录同步操作
   */
  logSyncOperation(operation: 'start' | 'complete' | 'failed', table: string, recordCount?: number, duration?: number, error?: Error, userId?: string, caseId?: string): void {
    const details = {
      operation,
      table,
      recordCount,
      duration: duration ? `${duration}ms` : undefined,
      userId,
      caseId
    };

    if (error) {
      this.error(LogCategory.SYNC, `Sync ${operation}`, error, details, 'SyncManager');
    } else {
      const level = operation === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
      this.log(level, LogCategory.SYNC, `Sync ${operation}`, details, 'SyncManager', undefined, duration);
    }
  }

  /**
   * 记录订阅操作
   */
  logSubscription(operation: 'create' | 'update' | 'close' | 'error', subscriptionId: string, table: string, details?: Record<string, any>, error?: Error): void {
    const logDetails = {
      operation,
      subscriptionId,
      table,
      ...details
    };

    if (error) {
      this.error(LogCategory.SUBSCRIPTION, `Subscription ${operation}`, error, logDetails, 'SubscriptionManager');
    } else {
      this.info(LogCategory.SUBSCRIPTION, `Subscription ${operation}`, logDetails, 'SubscriptionManager');
    }
  }

  /**
   * 获取日志条目
   */
  getLogs(filter?: LogFilter, limit = 1000): LogEntry[] {
    let filteredLogs = this.logs;

    if (filter) {
      filteredLogs = this.logs.filter(log => this.matchesFilter(log, filter));
    }

    return filteredLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 分析日志
   */
  analyzeLogs(startTime?: number, endTime?: number): LogAnalysis {
    const now = Date.now();
    const analysisStartTime = startTime || (now - 24 * 60 * 60 * 1000); // 默认24小时
    const analysisEndTime = endTime || now;

    const relevantLogs = this.logs.filter(
      log => log.timestamp >= analysisStartTime && log.timestamp <= analysisEndTime
    );

    const analysis: LogAnalysis = {
      totalLogs: relevantLogs.length,
      logsByLevel: {} as Record<LogLevel, number>,
      logsByCategory: {} as Record<LogCategory, number>,
      errorStats: new Map(),
      topErrors: [],
      performanceIssues: [],
      timeRange: {
        startTime: analysisStartTime,
        endTime: analysisEndTime,
        duration: analysisEndTime - analysisStartTime
      },
      recommendations: []
    };

    // 初始化计数器
    Object.values(LogLevel).forEach(level => {
      if (typeof level === 'number') {
        analysis.logsByLevel[level] = 0;
      }
    });
    Object.values(LogCategory).forEach(category => {
      analysis.logsByCategory[category] = 0;
    });

    // 统计日志
    const errorCounts = new Map<string, number>();
    const performanceData = new Map<string, { durations: number[]; count: number }>();

    for (const log of relevantLogs) {
      analysis.logsByLevel[log.level]++;
      analysis.logsByCategory[log.category]++;

      // 错误统计
      if (log.level >= LogLevel.ERROR) {
        const errorKey = `${log.category}:${log.message}`;
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1);
      }

      // 性能统计
      if (log.duration && log.duration > 100) { // 只统计超过100ms的操作
        const operation = `${log.category}:${log.source}`;
        const perfData = performanceData.get(operation) || { durations: [], count: 0 };
        perfData.durations.push(log.duration);
        perfData.count++;
        performanceData.set(operation, perfData);
      }
    }

    // 生成错误排行
    analysis.topErrors = Array.from(errorCounts.entries())
      .map(([key, count]) => {
        const [category, message] = key.split(':');
        const lastError = relevantLogs
          .filter(log => log.category === category && log.message === message)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        
        return {
          type: this.categorizeError(message) || ErrorType.UNKNOWN_ERROR,
          count,
          message,
          lastOccurrence: lastError?.timestamp || 0
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 生成性能问题
    analysis.performanceIssues = Array.from(performanceData.entries())
      .map(([operation, data]) => {
        const avgDuration = data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length;
        const maxDuration = Math.max(...data.durations);
        
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (avgDuration > 5000) severity = 'high';
        else if (avgDuration > 1000) severity = 'medium';

        return {
          operation,
          avgDuration,
          maxDuration,
          count: data.count,
          severity
        };
      })
      .filter(issue => issue.severity !== 'low')
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    // 生成建议
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * 导出日志
   */
  exportLogs(format: 'json' | 'csv' = 'json', filter?: LogFilter): string {
    const logs = this.getLogs(filter);

    if (format === 'json') {
      return JSON.stringify({
        exportTime: Date.now(),
        sessionId: this.sessionId,
        totalLogs: logs.length,
        logs
      }, null, 2);
    } else {
      // CSV格式
      const csvLines = [
        'Timestamp,Level,Category,Source,Message,Duration,UserId,CaseId,Details'
      ];

      for (const log of logs) {
        const timestamp = new Date(log.timestamp).toISOString();
        const level = LogLevel[log.level];
        const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
        
        csvLines.push([
          timestamp,
          level,
          log.category,
          log.source,
          `"${log.message.replace(/"/g, '""')}"`,
          log.duration?.toString() || '',
          log.userId || '',
          log.caseId || '',
          `"${details}"`
        ].join(','));
      }

      return csvLines.join('\n');
    }
  }

  /**
   * 清理过期日志
   */
  cleanup(maxAge = 7 * 24 * 60 * 60 * 1000): void { // 默认保留7天
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoffTime);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxLogEntries);
    }

    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.info(LogCategory.SYSTEM, `Cleaned up ${removedCount} old log entries`, { 
        initialCount, 
        finalCount: this.logs.length 
      });
    }
  }

  /**
   * 添加日志监听器
   */
  addListener(listener: (entry: LogEntry) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除日志监听器
   */
  removeListener(listener: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): Map<ErrorType, ErrorStats> {
    return new Map(this.errorStats);
  }

  // 私有方法

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: Record<string, any>,
    source = 'CacheSystem',
    stack?: string,
    duration?: number
  ): void {
    if (level < this.currentLogLevel) {
      return; // 日志级别过低，不记录
    }

    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
      source,
      stack,
      duration,
      sessionId: this.sessionId,
      userId: details?.userId,
      caseId: details?.caseId,
      tags: this.generateTags(category, level, details)
    };

    this.logs.push(entry);

    // 通知监听器
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        console.error('CacheLogger: Error in log listener:', error);
      }
    });

    // 控制台输出（开发环境）
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      this.outputToConsole(entry);
    }
  }

  private updateErrorStats(error?: Error, category?: LogCategory, details?: Record<string, any>, severity?: string): void {
    if (!error) return;

    const errorType = this.categorizeError(error.message) || ErrorType.UNKNOWN_ERROR;
    let stats = this.errorStats.get(errorType);

    if (!stats) {
      stats = {
        errorType,
        count: 0,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        affectedUsers: new Set(),
        affectedTables: new Set(),
        errorRate: 0,
        avgFrequency: 0,
        severity: 'low',
        sampleErrors: []
      };
      this.errorStats.set(errorType, stats);
    }

    stats.count++;
    stats.lastOccurrence = Date.now();
    
    if (details?.userId) {
      stats.affectedUsers.add(details.userId);
    }
    if (details?.table) {
      stats.affectedTables.add(details.table);
    }

    // 更新严重程度
    if (severity === 'critical' || stats.count > 100) {
      stats.severity = 'critical';
    } else if (stats.count > 50) {
      stats.severity = 'high';
    } else if (stats.count > 10) {
      stats.severity = 'medium';
    }

    // 计算频率
    const timeSpan = stats.lastOccurrence - stats.firstOccurrence;
    stats.avgFrequency = timeSpan > 0 ? (stats.count / timeSpan) * (60 * 60 * 1000) : 0; // 次/小时
  }

  private categorizeError(message: string): ErrorType | null {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
      return ErrorType.CONNECTION_ERROR;
    }
    if (lowerMessage.includes('query') || lowerMessage.includes('sql')) {
      return ErrorType.QUERY_ERROR;
    }
    if (lowerMessage.includes('cache')) {
      return ErrorType.CACHE_ERROR;
    }
    if (lowerMessage.includes('sync')) {
      return ErrorType.SYNC_ERROR;
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized')) {
      return ErrorType.PERMISSION_ERROR;
    }
    if (lowerMessage.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    
    return null;
  }

  private matchesFilter(log: LogEntry, filter: LogFilter): boolean {
    if (filter.level !== undefined && log.level < filter.level) return false;
    if (filter.category && log.category !== filter.category) return false;
    if (filter.userId && log.userId !== filter.userId) return false;
    if (filter.caseId && log.caseId !== filter.caseId) return false;
    if (filter.source && log.source !== filter.source) return false;
    if (filter.startTime && log.timestamp < filter.startTime) return false;
    if (filter.endTime && log.timestamp > filter.endTime) return false;
    if (filter.searchText && !log.message.toLowerCase().includes(filter.searchText.toLowerCase())) return false;
    if (filter.tags && !filter.tags.some(tag => log.tags?.includes(tag))) return false;
    
    return true;
  }

  private generateTags(category: LogCategory, level: LogLevel, details?: Record<string, any>): string[] {
    const tags: string[] = [category.toLowerCase()];
    
    if (level >= LogLevel.ERROR) {
      tags.push('error');
    }
    if (level >= LogLevel.CRITICAL) {
      tags.push('critical');
    }
    
    if (details?.table) {
      tags.push(`table:${details.table}`);
    }
    if (details?.source) {
      tags.push(`source:${details.source}`);
    }
    
    return tags;
  }

  private generateRecommendations(analysis: LogAnalysis): string[] {
    const recommendations: string[] = [];
    
    // 错误率建议
    const errorRate = (analysis.logsByLevel[LogLevel.ERROR] + analysis.logsByLevel[LogLevel.CRITICAL]) / analysis.totalLogs;
    if (errorRate > 0.1) {
      recommendations.push('错误率过高（>10%），建议检查系统稳定性');
    }
    
    // 性能建议
    if (analysis.performanceIssues.length > 0) {
      recommendations.push(`发现 ${analysis.performanceIssues.length} 个性能问题，建议优化慢查询`);
    }
    
    // 缓存建议
    const cacheMissLogs = analysis.logsByCategory[LogCategory.CACHE] || 0;
    if (cacheMissLogs > analysis.totalLogs * 0.3) {
      recommendations.push('缓存未命中率较高，建议检查缓存策略配置');
    }
    
    // 同步建议
    const syncErrors = analysis.topErrors.filter(e => e.type === ErrorType.SYNC_ERROR).length;
    if (syncErrors > 0) {
      recommendations.push('发现数据同步错误，建议检查网络连接和数据一致性');
    }
    
    return recommendations;
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelStr = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelStr}] [${entry.category}] [${entry.source}]`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.details);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.details);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.details);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(prefix, entry.message, entry.details, entry.stack);
        break;
    }
  }

  private startPeriodicCleanup(): void {
    // 每小时清理一次过期日志
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}