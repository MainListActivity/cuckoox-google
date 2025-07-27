/**
 * ClaimAuditService 单元测试
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import ClaimAuditService from '@/src/services/claimAuditService';
import { AccessType, AccessResult } from '@/src/types/claimTracking';

// Mock queryWithAuth
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn()
}));

describe('ClaimAuditService', () => {
  let service: ClaimAuditService;
  let mockClient: any;
  let mockQueryWithAuth: any;

  beforeEach(async () => {
    mockClient = {};
    service = new ClaimAuditService(mockClient);
    const { queryWithAuth } = await import('@/src/utils/surrealAuth');
    mockQueryWithAuth = vi.mocked(queryWithAuth);
    vi.clearAllMocks();
  });

  describe('logAccess', () => {
    test('应该成功记录访问日志', async () => {
      const mockAccessLog = {
        id: 'claim_access_log:test',
        claim_id: 'claim:test',
        access_type: AccessType.VIEW,
        accessor_name: 'Test User',
        accessor_role: 'creditor',
        access_time: '2024-01-01T00:00:00Z',
        access_result: AccessResult.SUCCESS
      };

      mockQueryWithAuth.mockResolvedValue([[mockAccessLog]]);

      const result = await service.logAccess({
        claim_id: 'claim:test',
        access_type: AccessType.VIEW,
        accessed_fields: ['claim_number', 'amount'],
        access_duration: 30000
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('CREATE claim_access_log'),
        expect.objectContaining({
          claim_id: 'claim:test',
          access_type: AccessType.VIEW,
          accessed_fields: ['claim_number', 'amount'],
          access_result: AccessResult.SUCCESS
        })
      );

      expect(result).toEqual(mockAccessLog);
    });

    test('应该处理记录失败的情况', async () => {
      mockQueryWithAuth
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([[]]); // 失败日志记录成功

      await expect(service.logAccess({
        claim_id: 'claim:test',
        access_type: AccessType.VIEW
      })).rejects.toThrow('记录访问日志失败');

      // 验证失败日志被记录
      expect(mockQueryWithAuth).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAuditLog', () => {
    test('应该返回审计日志', async () => {
      const mockAuditLog = [
        {
          id: 'claim_access_log:1',
          claim_id: 'claim:test',
          access_type: AccessType.VIEW,
          access_time: '2024-01-01T00:00:00Z',
          claim_number: 'CL-2024-001'
        },
        {
          id: 'claim_access_log:2',
          claim_id: 'claim:test',
          access_type: AccessType.DOWNLOAD,
          access_time: '2024-01-02T00:00:00Z',
          claim_number: 'CL-2024-001'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockAuditLog]);

      const result = await service.getAuditLog({
        claim_id: 'claim:test',
        limit: 20
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('FROM claim_access_log'),
        expect.objectContaining({
          claim_id: 'claim:test',
          limit: 20,
          offset: 0
        })
      );

      expect(result).toEqual(mockAuditLog);
    });

    test('应该支持过滤选项', async () => {
      mockQueryWithAuth.mockResolvedValue([[]]);

      await service.getAuditLog({
        user_id: 'user:test',
        access_type: AccessType.EXPORT,
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        limit: 10,
        offset: 20
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('accessor_id = $user_id'),
        expect.objectContaining({
          user_id: 'user:test',
          access_type: AccessType.EXPORT,
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-01-31T00:00:00.000Z',
          limit: 10,
          offset: 20
        })
      );
    });
  });

  describe('getUserAccessStatistics', () => {
    test('应该返回用户访问统计', async () => {
      const mockBaseStats = [{
        total_accesses: 100,
        unique_claims_accessed: 25,
        avg_access_duration_seconds: 120
      }];

      const mockTypeStats = [
        { access_type: AccessType.VIEW, count: 70 },
        { access_type: AccessType.DOWNLOAD, count: 20 },
        { access_type: AccessType.EXPORT, count: 10 }
      ];

      const mockResultStats = [
        { access_result: AccessResult.SUCCESS, count: 95 },
        { access_result: AccessResult.DENIED, count: 5 }
      ];

      const mockMostAccessed = [
        {
          claim_id: 'claim:1',
          claim_number: 'CL-2024-001',
          access_count: 15
        },
        {
          claim_id: 'claim:2',
          claim_number: 'CL-2024-002',
          access_count: 10
        }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([mockBaseStats])
        .mockResolvedValueOnce([mockTypeStats])
        .mockResolvedValueOnce([mockResultStats])
        .mockResolvedValueOnce([mockMostAccessed]);

      const result = await service.getUserAccessStatistics({
        user_id: 'user:test',
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(result).toEqual({
        total_accesses: 100,
        accesses_by_type: {
          [AccessType.VIEW]: 70,
          [AccessType.DOWNLOAD]: 20,
          [AccessType.EXPORT]: 10
        },
        accesses_by_result: {
          [AccessResult.SUCCESS]: 95,
          [AccessResult.DENIED]: 5
        },
        unique_claims_accessed: 25,
        average_access_duration: 120,
        most_accessed_claims: [
          {
            claim_id: 'claim:1',
            claim_number: 'CL-2024-001',
            access_count: 15
          },
          {
            claim_id: 'claim:2',
            claim_number: 'CL-2024-002',
            access_count: 10
          }
        ]
      });
    });
  });

  describe('exportAuditReport', () => {
    test('应该导出Excel报告', async () => {
      const mockAuditData = [
        {
          id: 'claim_access_log:1',
          claim_id: 'claim:test',
          access_type: AccessType.VIEW
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockAuditData]);

      const result = await service.exportAuditReport({
        format: 'excel',
        filters: {
          claim_ids: ['claim:test'],
          date_range: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        }
      });

      expect(result).toMatch(/\/exports\/audit-report-.*\.xlsx/);
    });

    test('应该导出PDF报告', async () => {
      const mockAuditData = [
        {
          id: 'claim_access_log:1',
          claim_id: 'claim:test',
          access_type: AccessType.VIEW
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockAuditData]);

      const result = await service.exportAuditReport({
        format: 'pdf',
        filters: {
          access_types: [AccessType.VIEW, AccessType.DOWNLOAD]
        }
      });

      expect(result).toMatch(/\/exports\/audit-report-.*\.pdf/);
    });
  });

  describe('detectAnomalousAccess', () => {
    test('应该检测异常访问模式', async () => {
      const mockRecentAccess = [
        {
          accessor_id: 'user:suspicious',
          accessor_name: 'Suspicious User',
          recent_access_count: 150,
          unique_claims: 25,
          denied_count: 5,
          access_types: [AccessType.VIEW, AccessType.EXPORT]
        },
        {
          accessor_id: 'user:normal',
          accessor_name: 'Normal User',
          recent_access_count: 10,
          unique_claims: 3,
          denied_count: 0,
          access_types: [AccessType.VIEW]
        }
      ];

      const mockHistoricalAverage = [
        {
          accessor_id: 'user:suspicious',
          avg_daily_access: 20
        },
        {
          accessor_id: 'user:normal',
          avg_daily_access: 12
        }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([mockRecentAccess])
        .mockResolvedValueOnce([mockHistoricalAverage]);

      const result = await service.detectAnomalousAccess({
        time_window_hours: 24,
        threshold_multiplier: 3
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        user_id: 'user:suspicious',
        user_name: 'Suspicious User',
        access_count: 150,
        normal_average: 20,
        anomaly_score: 7.5, // 150 / 20
        suspicious_activities: [
          '5次访问被拒绝',
          '访问了25个不同债权',
          '执行了数据导出或下载操作'
        ]
      });
    });
  });

  describe('cleanupOldAccessLogs', () => {
    test('应该清理旧的访问日志', async () => {
      const deletedRecords = [{ id: 'deleted1' }, { id: 'deleted2' }];

      mockQueryWithAuth.mockResolvedValue([deletedRecords]);

      const result = await service.cleanupOldAccessLogs(365);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('DELETE FROM claim_access_log'),
        expect.objectContaining({
          cutoff_date: expect.any(String)
        })
      );

      expect(result).toBe(1); // 返回删除的批次数
    });
  });

  describe('validateAccessPermission', () => {
    test('应该验证访问权限', async () => {
      const result = await service.validateAccessPermission('claim:test', AccessType.VIEW);
      
      // 目前总是返回允许，实际实现时应该根据具体权限逻辑
      expect(result).toEqual({ allowed: true });
    });
  });

  describe('private methods', () => {
    test('formatDuration 应该正确格式化时长', () => {
      const service = new ClaimAuditService(mockClient);
      const formatDuration = (service as any).formatDuration.bind(service);

      // 测试不同时长的格式化
      expect(formatDuration(30000)).toBe('PT30S'); // 30秒
      expect(formatDuration(90000)).toBe('PT1M30S'); // 1分30秒
      expect(formatDuration(3690000)).toBe('PT1H1M30S'); // 1小时1分30秒
    });

    test('getClientInfo 应该返回客户端信息', () => {
      const service = new ClaimAuditService(mockClient);
      const getClientInfo = (service as any).getClientInfo.bind(service);

      const result = getClientInfo();

      expect(result).toEqual({
        user_agent: expect.any(String),
        ip_address: undefined
      });
    });
  });

  describe('getFilteredAuditData', () => {
    test('应该处理多个债权ID的过滤', async () => {
      const service = new ClaimAuditService(mockClient);
      const getFilteredAuditData = (service as any).getFilteredAuditData.bind(service);

      const mockData = [
        { id: 'log:1', claim_id: 'claim:1' },
        { id: 'log:2', claim_id: 'claim:2' }
      ];

      mockQueryWithAuth.mockResolvedValue([mockData]);

      const result = await getFilteredAuditData({
        claim_ids: ['claim:1', 'claim:2'],
        access_types: [AccessType.VIEW],
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('claim_id IN $claim_ids'),
        expect.objectContaining({
          claim_ids: ['claim:1', 'claim:2'],
          access_types: [AccessType.VIEW],
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-01-31T00:00:00.000Z'
        })
      );

      expect(result).toEqual(mockData);
    });
  });
});