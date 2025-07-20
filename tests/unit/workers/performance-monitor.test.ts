import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '@/src/workers/performance-monitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  it('should record query performance', () => {
    const sql = 'SELECT * FROM user';
    const params = { limit: 10 };
    const source = 'local';
    const executionTime = 150;
    const cacheHit = true;
    const tables = ['user'];

    performanceMonitor.recordQueryPerformance(
      sql,
      params,
      source,
      executionTime,
      cacheHit,
      tables
    );

    const realTimeStats = performanceMonitor.getRealTimeStats();
    expect(realTimeStats.currentCacheHitRate).toBe(1); // 100% cache hit
    expect(realTimeStats.avgResponseTime).toBe(150);
  });

  it('should generate performance report', () => {
    // Record some test data
    performanceMonitor.recordQueryPerformance(
      'SELECT * FROM user',
      {},
      'local',
      100,
      true,
      ['user']
    );
    
    performanceMonitor.recordQueryPerformance(
      'SELECT * FROM case',
      {},
      'remote',
      200,
      false,
      ['case']
    );

    const report = performanceMonitor.generatePerformanceReport();
    
    expect(report.totalQueries).toBe(2);
    expect(report.localQueryCount).toBe(1);
    expect(report.remoteQueryCount).toBe(1);
    expect(report.overallCacheHitRate).toBe(0.5); // 50% cache hit rate
  });

  it('should export performance data', () => {
    performanceMonitor.recordQueryPerformance(
      'SELECT * FROM user',
      {},
      'local',
      100,
      true,
      ['user']
    );

    const jsonData = performanceMonitor.exportPerformanceData('json');
    expect(jsonData).toContain('report');
    expect(jsonData).toContain('metrics');

    const csvData = performanceMonitor.exportPerformanceData('csv');
    expect(csvData).toContain('Query Hash,Query Type,Tables');
  });

  it('should detect performance anomalies', () => {
    // Record a slow query to trigger anomaly detection
    performanceMonitor.recordQueryPerformance(
      'SELECT * FROM slow_table',
      {},
      'remote',
      6000, // 6 seconds - should trigger slow query anomaly
      false,
      ['slow_table']
    );

    const anomalies = performanceMonitor.getAnomalies();
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].type).toBe('slow_query');
  });

  it('should get performance trend data', () => {
    const trendData = performanceMonitor.getPerformanceTrend(1); // Last 1 hour
    expect(Array.isArray(trendData)).toBe(true);
  });

  it('should reset statistics', () => {
    performanceMonitor.recordQueryPerformance(
      'SELECT * FROM user',
      {},
      'local',
      100,
      true,
      ['user']
    );

    let report = performanceMonitor.generatePerformanceReport();
    expect(report.totalQueries).toBe(1);

    performanceMonitor.reset();
    
    report = performanceMonitor.generatePerformanceReport();
    expect(report.totalQueries).toBe(0);
  });
});