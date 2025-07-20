/**
 * 性能监控系统
 * 收集和分析缓存系统的性能指标
 */

import type { QueryParams, UnknownData } from '../types/surreal';

// 性能指标接口
export interface PerformanceMetric {
  queryHash: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMPLEX';
  tables: string[];
  
  // 执行统计
  localStats: {
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
  };
  
  remoteStats: {
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
  };
  
  // 缓存统计
  cacheHitRate: number;
  cacheHitCount: number;
  cacheMissCount: number;
  
  // 时间戳
  firstSeen: number;
  lastUpdated: number;
  
  // 错误统计
  errorCount: number;
  lastError?: string;
}

// 系统性能报告
export interface PerformanceReport {
  // 总体统计
  totalQueries: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  
  // 缓存统计
  overallCacheHitRate: number;
  localQueryCount: number;
  remoteQueryCount: number;
  
  // 性能对比
  avgLocalTime: number;
  avgRemoteTime: number;
  performanceImprovement: number; // 性能提升百分比
  
  // 错误统计
  totalErrors: number;
  errorRate: number;
  
  // 热点查询
  topSlowQueries: Array<{
    queryHash: string;
    avgTime: number;
    count: number;
    tables: string[];
  }>;
  
  topFrequentQueries: Array<{
    queryHash: string;
    count: number;
    avgTime: number;
    cacheHitRate: number;
  }>;
  
  // 表级统计
  tableStats: Array<{
    table: string;
    queryCount: number;
    avgTime: number;
    cacheHitRate: number;
    errorCount: number;
  }>;
  
  // 时间范围
  reportPeriod: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  
  generatedAt: number;
}

// 性能趋势数据点
export interface PerformanceTrendPoint {
  timestamp: number;
  cacheHitRate: number;
  avgExecutionTime: number;
  queryCount: number;
  errorCount: number;
}

// 异常检测结果
export interface PerformanceAnomaly {
  type: 'slow_query' | 'high_error_rate' | 'cache_miss_spike' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedQueries: string[];
  detectedAt: number;
  threshold: number;
  actualValue: number;
  suggestion?: string;
}

/**
 * 性能监控器
 * 收集查询性能指标，生成报告和异常检测
 */
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();
  private trendData: PerformanceTrendPoint[] = [];
  private anomalies: PerformanceAnomaly[] = [];
  
  // 配置参数
  private readonly maxMetricsCount = 10000; // 最大指标数量
  private readonly trendDataRetention = 24 * 60 * 60 * 1000; // 趋势数据保留24小时
  private readonly anomalyRetention = 7 * 24 * 60 * 60 * 1000; // 异常记录保留7天
  
  // 异常检测阈值
  private readonly thresholds = {
    slowQueryTime: 5000, // 慢查询阈值：5秒
    highErrorRate: 0.1, // 高错误率阈值：10%
    cacheMissSpike: 0.3, // 缓存未命中激增阈值：30%
    performanceDegradation: 2.0 // 性能下降阈值：2倍
  };

  constructor() {
    // 启动定期数据收集和清理
    this.startPeriodicTasks();
  }

  /**
   * 记录查询性能
   */
  recordQueryPerformance(
    sql: string,
    params: QueryParams | undefined,
    source: 'local' | 'remote',
    executionTime: number,
    cacheHit: boolean,
    tables: string[],
    error?: string
  ): void {
    const queryHash = this.generateQueryHash(sql, params);
    const queryType = this.extractQueryType(sql);
    
    let metric = this.metrics.get(queryHash);
    
    if (!metric) {
      metric = {
        queryHash,
        queryType,
        tables: [...tables],
        localStats: {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0
        },
        remoteStats: {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0
        },
        cacheHitRate: 0,
        cacheHitCount: 0,
        cacheMissCount: 0,
        firstSeen: Date.now(),
        lastUpdated: Date.now(),
        errorCount: 0
      };
      
      this.metrics.set(queryHash, metric);
    }

    // 更新执行统计
    const stats = source === 'local' ? metric.localStats : metric.remoteStats;
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);

    // 更新缓存统计
    if (cacheHit) {
      metric.cacheHitCount++;
    } else {
      metric.cacheMissCount++;
    }
    
    const totalCacheQueries = metric.cacheHitCount + metric.cacheMissCount;
    metric.cacheHitRate = totalCacheQueries > 0 ? metric.cacheHitCount / totalCacheQueries : 0;

    // 更新错误统计
    if (error) {
      metric.errorCount++;
      metric.lastError = error;
    }

    metric.lastUpdated = Date.now();

    // 检测异常
    this.detectAnomalies(metric, executionTime, error);
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(startTime?: number, endTime?: number): PerformanceReport {
    const now = Date.now();
    const reportStartTime = startTime || (now - 24 * 60 * 60 * 1000); // 默认24小时
    const reportEndTime = endTime || now;
    
    // 过滤时间范围内的指标
    const relevantMetrics = Array.from(this.metrics.values()).filter(
      metric => metric.lastUpdated >= reportStartTime && metric.lastUpdated <= reportEndTime
    );

    if (relevantMetrics.length === 0) {
      return this.createEmptyReport(reportStartTime, reportEndTime);
    }

    // 计算总体统计
    let totalQueries = 0;
    let totalExecutionTime = 0;
    let totalLocalTime = 0;
    let totalRemoteTime = 0;
    let localQueryCount = 0;
    let remoteQueryCount = 0;
    let totalCacheHits = 0;
    let totalCacheQueries = 0;
    let totalErrors = 0;

    for (const metric of relevantMetrics) {
      const localCount = metric.localStats.count;
      const remoteCount = metric.remoteStats.count;
      
      totalQueries += localCount + remoteCount;
      totalExecutionTime += metric.localStats.totalTime + metric.remoteStats.totalTime;
      
      totalLocalTime += metric.localStats.totalTime;
      totalRemoteTime += metric.remoteStats.totalTime;
      localQueryCount += localCount;
      remoteQueryCount += remoteCount;
      
      totalCacheHits += metric.cacheHitCount;
      totalCacheQueries += metric.cacheHitCount + metric.cacheMissCount;
      totalErrors += metric.errorCount;
    }

    const avgExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
    const avgLocalTime = localQueryCount > 0 ? totalLocalTime / localQueryCount : 0;
    const avgRemoteTime = remoteQueryCount > 0 ? totalRemoteTime / remoteQueryCount : 0;
    const overallCacheHitRate = totalCacheQueries > 0 ? totalCacheHits / totalCacheQueries : 0;
    const errorRate = totalQueries > 0 ? totalErrors / totalQueries : 0;
    
    // 计算性能提升
    const performanceImprovement = avgRemoteTime > 0 && avgLocalTime > 0 
      ? ((avgRemoteTime - avgLocalTime) / avgRemoteTime) * 100 
      : 0;

    // 生成热点查询
    const topSlowQueries = relevantMetrics
      .map(metric => ({
        queryHash: metric.queryHash,
        avgTime: Math.max(metric.localStats.avgTime, metric.remoteStats.avgTime),
        count: metric.localStats.count + metric.remoteStats.count,
        tables: metric.tables
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const topFrequentQueries = relevantMetrics
      .map(metric => ({
        queryHash: metric.queryHash,
        count: metric.localStats.count + metric.remoteStats.count,
        avgTime: (metric.localStats.totalTime + metric.remoteStats.totalTime) / 
                (metric.localStats.count + metric.remoteStats.count),
        cacheHitRate: metric.cacheHitRate
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 生成表级统计
    const tableStatsMap = new Map<string, {
      queryCount: number;
      totalTime: number;
      cacheHits: number;
      cacheTotal: number;
      errorCount: number;
    }>();

    for (const metric of relevantMetrics) {
      for (const table of metric.tables) {
        const current = tableStatsMap.get(table) || {
          queryCount: 0,
          totalTime: 0,
          cacheHits: 0,
          cacheTotal: 0,
          errorCount: 0
        };
        
        current.queryCount += metric.localStats.count + metric.remoteStats.count;
        current.totalTime += metric.localStats.totalTime + metric.remoteStats.totalTime;
        current.cacheHits += metric.cacheHitCount;
        current.cacheTotal += metric.cacheHitCount + metric.cacheMissCount;
        current.errorCount += metric.errorCount;
        
        tableStatsMap.set(table, current);
      }
    }

    const tableStats = Array.from(tableStatsMap.entries()).map(([table, stats]) => ({
      table,
      queryCount: stats.queryCount,
      avgTime: stats.queryCount > 0 ? stats.totalTime / stats.queryCount : 0,
      cacheHitRate: stats.cacheTotal > 0 ? stats.cacheHits / stats.cacheTotal : 0,
      errorCount: stats.errorCount
    })).sort((a, b) => b.queryCount - a.queryCount);

    return {
      totalQueries,
      totalExecutionTime,
      avgExecutionTime,
      overallCacheHitRate,
      localQueryCount,
      remoteQueryCount,
      avgLocalTime,
      avgRemoteTime,
      performanceImprovement,
      totalErrors,
      errorRate,
      topSlowQueries,
      topFrequentQueries,
      tableStats,
      reportPeriod: {
        startTime: reportStartTime,
        endTime: reportEndTime,
        duration: reportEndTime - reportStartTime
      },
      generatedAt: now
    };
  }

  /**
   * 获取性能趋势数据
   */
  getPerformanceTrend(hours: number = 24): PerformanceTrendPoint[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.trendData.filter(point => point.timestamp >= cutoffTime);
  }

  /**
   * 获取异常检测结果
   */
  getAnomalies(hours: number = 24): PerformanceAnomaly[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.anomalies.filter(anomaly => anomaly.detectedAt >= cutoffTime);
  }

  /**
   * 获取实时性能统计
   */
  getRealTimeStats(): {
    currentCacheHitRate: number;
    avgResponseTime: number;
    queriesPerMinute: number;
    errorRate: number;
    activeQueries: number;
  } {
    const now = Date.now();
    const lastMinute = now - 60 * 1000;
    
    const recentMetrics = Array.from(this.metrics.values()).filter(
      metric => metric.lastUpdated >= lastMinute
    );

    let totalQueries = 0;
    let totalTime = 0;
    let totalCacheHits = 0;
    let totalCacheQueries = 0;
    let totalErrors = 0;

    for (const metric of recentMetrics) {
      const queries = metric.localStats.count + metric.remoteStats.count;
      totalQueries += queries;
      totalTime += metric.localStats.totalTime + metric.remoteStats.totalTime;
      totalCacheHits += metric.cacheHitCount;
      totalCacheQueries += metric.cacheHitCount + metric.cacheMissCount;
      totalErrors += metric.errorCount;
    }

    return {
      currentCacheHitRate: totalCacheQueries > 0 ? totalCacheHits / totalCacheQueries : 0,
      avgResponseTime: totalQueries > 0 ? totalTime / totalQueries : 0,
      queriesPerMinute: totalQueries,
      errorRate: totalQueries > 0 ? totalErrors / totalQueries : 0,
      activeQueries: recentMetrics.length
    };
  }

  /**
   * 导出性能数据
   */
  exportPerformanceData(format: 'json' | 'csv' = 'json'): string {
    const report = this.generatePerformanceReport();
    
    if (format === 'json') {
      return JSON.stringify({
        report,
        metrics: Array.from(this.metrics.values()),
        trendData: this.trendData,
        anomalies: this.anomalies
      }, null, 2);
    } else {
      // CSV格式导出
      const csvLines = ['Query Hash,Query Type,Tables,Total Queries,Avg Time,Cache Hit Rate,Error Count'];
      
      for (const metric of Array.from(this.metrics.values())) {
        const totalQueries = metric.localStats.count + metric.remoteStats.count;
        const avgTime = totalQueries > 0 
          ? (metric.localStats.totalTime + metric.remoteStats.totalTime) / totalQueries 
          : 0;
        
        csvLines.push([
          metric.queryHash,
          metric.queryType,
          metric.tables.join(';'),
          totalQueries.toString(),
          avgTime.toFixed(2),
          (metric.cacheHitRate * 100).toFixed(2) + '%',
          metric.errorCount.toString()
        ].join(','));
      }
      
      return csvLines.join('\n');
    }
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = Date.now();
    
    // 清理过期指标
    if (this.metrics.size > this.maxMetricsCount) {
      const sortedMetrics = Array.from(this.metrics.entries())
        .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated);
      
      const toDelete = sortedMetrics.slice(0, sortedMetrics.length - this.maxMetricsCount);
      for (const [hash] of toDelete) {
        this.metrics.delete(hash);
      }
    }

    // 清理过期趋势数据
    this.trendData = this.trendData.filter(
      point => now - point.timestamp <= this.trendDataRetention
    );

    // 清理过期异常记录
    this.anomalies = this.anomalies.filter(
      anomaly => now - anomaly.detectedAt <= this.anomalyRetention
    );
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.metrics.clear();
    this.trendData = [];
    this.anomalies = [];
  }

  // 私有方法

  private generateQueryHash(sql: string, params?: QueryParams): string {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${normalizedSql}::${paramsStr}`;
  }

  private extractQueryType(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMPLEX' {
    const normalizedSql = sql.toLowerCase().trim();
    
    if (normalizedSql.includes('select')) return 'SELECT';
    if (normalizedSql.includes('insert')) return 'INSERT';
    if (normalizedSql.includes('update')) return 'UPDATE';
    if (normalizedSql.includes('delete')) return 'DELETE';
    
    return 'COMPLEX';
  }

  private detectAnomalies(metric: PerformanceMetric, executionTime: number, error?: string): void {
    const now = Date.now();

    // 检测慢查询
    if (executionTime > this.thresholds.slowQueryTime) {
      this.anomalies.push({
        type: 'slow_query',
        severity: executionTime > this.thresholds.slowQueryTime * 2 ? 'high' : 'medium',
        description: `查询执行时间过长: ${executionTime}ms`,
        affectedQueries: [metric.queryHash],
        detectedAt: now,
        threshold: this.thresholds.slowQueryTime,
        actualValue: executionTime,
        suggestion: '考虑优化查询或增加索引'
      });
    }

    // 检测高错误率
    const totalQueries = metric.localStats.count + metric.remoteStats.count;
    const errorRate = totalQueries > 0 ? metric.errorCount / totalQueries : 0;
    
    if (errorRate > this.thresholds.highErrorRate && totalQueries >= 10) {
      this.anomalies.push({
        type: 'high_error_rate',
        severity: errorRate > this.thresholds.highErrorRate * 2 ? 'critical' : 'high',
        description: `查询错误率过高: ${(errorRate * 100).toFixed(1)}%`,
        affectedQueries: [metric.queryHash],
        detectedAt: now,
        threshold: this.thresholds.highErrorRate,
        actualValue: errorRate,
        suggestion: '检查查询语法和数据库连接状态'
      });
    }

    // 检测缓存未命中激增
    if (metric.cacheHitRate < (1 - this.thresholds.cacheMissSpike) && 
        (metric.cacheHitCount + metric.cacheMissCount) >= 10) {
      this.anomalies.push({
        type: 'cache_miss_spike',
        severity: 'medium',
        description: `缓存命中率过低: ${(metric.cacheHitRate * 100).toFixed(1)}%`,
        affectedQueries: [metric.queryHash],
        detectedAt: now,
        threshold: this.thresholds.cacheMissSpike,
        actualValue: 1 - metric.cacheHitRate,
        suggestion: '检查缓存策略配置和数据同步状态'
      });
    }
  }

  private createEmptyReport(startTime: number, endTime: number): PerformanceReport {
    return {
      totalQueries: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      overallCacheHitRate: 0,
      localQueryCount: 0,
      remoteQueryCount: 0,
      avgLocalTime: 0,
      avgRemoteTime: 0,
      performanceImprovement: 0,
      totalErrors: 0,
      errorRate: 0,
      topSlowQueries: [],
      topFrequentQueries: [],
      tableStats: [],
      reportPeriod: {
        startTime,
        endTime,
        duration: endTime - startTime
      },
      generatedAt: Date.now()
    };
  }

  private startPeriodicTasks(): void {
    // 每分钟收集趋势数据
    setInterval(() => {
      const stats = this.getRealTimeStats();
      this.trendData.push({
        timestamp: Date.now(),
        cacheHitRate: stats.currentCacheHitRate,
        avgExecutionTime: stats.avgResponseTime,
        queryCount: stats.queriesPerMinute,
        errorCount: Math.round(stats.queriesPerMinute * stats.errorRate)
      });
    }, 60 * 1000);

    // 每小时清理过期数据
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }
}