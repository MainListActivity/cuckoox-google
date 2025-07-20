import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheLogger, LogLevel, LogCategory, ErrorType } from '@/src/workers/cache-logger';

describe('CacheLogger', () => {
  let cacheLogger: CacheLogger;

  beforeEach(() => {
    cacheLogger = new CacheLogger('test-session');
  });

  it('should log messages at different levels', () => {
    // Set log level to DEBUG to capture all messages
    cacheLogger.setLogLevel(LogLevel.DEBUG);
    
    cacheLogger.debug(LogCategory.QUERY, 'Debug message');
    cacheLogger.info(LogCategory.CACHE, 'Info message');
    cacheLogger.warn(LogCategory.SYNC, 'Warning message');
    cacheLogger.error(LogCategory.SYSTEM, 'Error message', new Error('Test error'));

    const logs = cacheLogger.getLogs();
    expect(logs.length).toBe(5); // Including the setLogLevel log
    expect(logs[0].level).toBe(LogLevel.ERROR);
    expect(logs[1].level).toBe(LogLevel.WARN);
    expect(logs[2].level).toBe(LogLevel.INFO);
    expect(logs[3].level).toBe(LogLevel.DEBUG);
  });

  it('should filter logs by level', () => {
    cacheLogger.setLogLevel(LogLevel.WARN);
    
    cacheLogger.debug(LogCategory.QUERY, 'Debug message');
    cacheLogger.info(LogCategory.CACHE, 'Info message');
    cacheLogger.warn(LogCategory.SYNC, 'Warning message');
    cacheLogger.error(LogCategory.SYSTEM, 'Error message');

    const logs = cacheLogger.getLogs();
    expect(logs.length).toBe(2); // Only WARN and ERROR should be logged
  });

  it('should record query execution logs', () => {
    // Set log level to DEBUG to capture query logs
    cacheLogger.setLogLevel(LogLevel.DEBUG);
    
    const sql = 'SELECT * FROM user';
    const params = { limit: 10 };
    const duration = 150;
    const source = 'local';
    const cacheHit = true;
    const userId = 'user:123';

    cacheLogger.logQuery(sql, params, duration, source, cacheHit, userId);

    const logs = cacheLogger.getLogs();
    expect(logs.length).toBe(2); // Including the setLogLevel log
    expect(logs[0].category).toBe(LogCategory.QUERY);
    expect(logs[0].details?.source).toBe('local');
    expect(logs[0].details?.cacheHit).toBe(true);
  });

  it('should track performance with timers', () => {
    // Set log level to DEBUG to capture performance logs
    cacheLogger.setLogLevel(LogLevel.DEBUG);
    
    const operationId = 'test-operation';
    
    cacheLogger.startTimer(operationId);
    
    // Simulate some work
    const duration = cacheLogger.endTimer(
      operationId,
      LogCategory.PERFORMANCE,
      'Operation completed'
    );

    expect(duration).toBeGreaterThanOrEqual(0);
    
    const logs = cacheLogger.getLogs();
    expect(logs.length).toBe(2); // Including the setLogLevel log
    expect(logs[0].duration).toBe(duration);
  });

  it('should analyze logs and generate insights', () => {
    // Generate some test logs
    cacheLogger.error(LogCategory.QUERY, 'Query failed', new Error('Connection error'));
    cacheLogger.error(LogCategory.CACHE, 'Cache miss', new Error('Cache error'));
    cacheLogger.warn(LogCategory.SYNC, 'Sync delayed');
    cacheLogger.info(LogCategory.SYSTEM, 'System started');

    const analysis = cacheLogger.analyzeLogs();
    
    expect(analysis.totalLogs).toBe(4);
    expect(analysis.logsByLevel[LogLevel.ERROR]).toBe(2);
    expect(analysis.logsByLevel[LogLevel.WARN]).toBe(1);
    expect(analysis.logsByLevel[LogLevel.INFO]).toBe(1);
    expect(analysis.topErrors.length).toBeGreaterThan(0);
  });

  it('should export logs in different formats', () => {
    cacheLogger.info(LogCategory.SYSTEM, 'Test message', { key: 'value' });

    const jsonExport = cacheLogger.exportLogs('json');
    expect(jsonExport).toContain('exportTime');
    expect(jsonExport).toContain('Test message');

    const csvExport = cacheLogger.exportLogs('csv');
    expect(csvExport).toContain('Timestamp,Level,Category');
    expect(csvExport).toContain('Test message');
  });

  it('should track error statistics', () => {
    const error1 = new Error('Connection timeout');
    const error2 = new Error('Query syntax error');
    
    cacheLogger.error(LogCategory.NETWORK, 'Network error', error1);
    cacheLogger.error(LogCategory.QUERY, 'Query error', error2);
    cacheLogger.error(LogCategory.NETWORK, 'Another network error', error1);

    const errorStats = cacheLogger.getErrorStats();
    expect(errorStats.size).toBeGreaterThan(0);
    
    // Should have categorized the connection error
    const connectionErrors = Array.from(errorStats.values()).find(
      stat => stat.errorType === ErrorType.CONNECTION_ERROR
    );
    expect(connectionErrors).toBeDefined();
    expect(connectionErrors?.count).toBeGreaterThan(0);
  });

  it('should filter logs by criteria', () => {
    const userId = 'user:123';
    const caseId = 'case:456';
    
    cacheLogger.info(LogCategory.QUERY, 'User query', { userId, caseId });
    cacheLogger.info(LogCategory.CACHE, 'Cache hit', { userId: 'user:999' });
    cacheLogger.warn(LogCategory.SYNC, 'Sync warning');

    const userLogs = cacheLogger.getLogs({ userId });
    expect(userLogs.length).toBe(1);
    expect(userLogs[0].userId).toBe(userId);

    const queryLogs = cacheLogger.getLogs({ category: LogCategory.QUERY });
    expect(queryLogs.length).toBe(1);
    expect(queryLogs[0].category).toBe(LogCategory.QUERY);
  });

  it('should add and notify listeners', () => {
    const listener = vi.fn();
    cacheLogger.addListener(listener);

    cacheLogger.info(LogCategory.SYSTEM, 'Test message');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.INFO,
        category: LogCategory.SYSTEM,
        message: 'Test message'
      })
    );

    cacheLogger.removeListener(listener);
    cacheLogger.info(LogCategory.SYSTEM, 'Another message');
    
    expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
  });
});