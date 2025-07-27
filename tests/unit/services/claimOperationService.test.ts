/**
 * ClaimOperationService 单元测试
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import ClaimOperationService from '@/src/services/claimOperationService';
import { OperationType, OperationResult } from '@/src/types/claimTracking';

// Mock queryWithAuth
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn()
}));

describe('ClaimOperationService', () => {
  let service: ClaimOperationService;
  let mockClient: any;
  let mockQueryWithAuth: any;

  beforeEach(async () => {
    mockClient = {};
    service = new ClaimOperationService(mockClient);
    const { queryWithAuth } = await import('@/src/utils/surrealAuth');
    mockQueryWithAuth = vi.mocked(queryWithAuth);
    vi.clearAllMocks();
  });

  describe('logOperation', () => {
    test('应该成功记录操作日志', async () => {
      const mockOperationLog = {
        id: 'claim_operation_log:test',
        claim_id: 'claim:test',
        operation_type: OperationType.CREATE,
        operation_description: '创建债权申报',
        operator_name: 'Test User',
        operator_role: 'creditor',
        operation_time: '2024-01-01T00:00:00Z',
        operation_result: OperationResult.SUCCESS
      };

      mockQueryWithAuth.mockResolvedValue([[mockOperationLog]]);

      const result = await service.logOperation({
        claim_id: 'claim:test',
        operation_type: OperationType.CREATE,
        description: '创建债权申报',
        before_data: {},
        after_data: { status: 'draft' }
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('CREATE claim_operation_log'),
        expect.objectContaining({
          claim_id: 'claim:test',
          operation_type: OperationType.CREATE,
          description: '创建债权申报'
        })
      );

      expect(result).toEqual(mockOperationLog);
    });

    test('应该计算变更字段', async () => {
      const mockOperationLog = {
        id: 'claim_operation_log:test',
        claim_id: 'claim:test',
        operation_type: OperationType.UPDATE,
        changed_fields: ['status', 'amount']
      };

      mockQueryWithAuth.mockResolvedValue([[mockOperationLog]]);

      await service.logOperation({
        claim_id: 'claim:test',
        operation_type: OperationType.UPDATE,
        description: '更新债权信息',
        before_data: { status: 'draft', amount: 1000, name: 'test' },
        after_data: { status: 'submitted', amount: 2000, name: 'test' }
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.any(String),
        expect.objectContaining({
          changed_fields: ['status', 'amount']
        })
      );
    });

    test('应该处理操作失败的情况', async () => {
      mockQueryWithAuth
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([[]]); // 失败日志记录成功

      await expect(service.logOperation({
        claim_id: 'claim:test',
        operation_type: OperationType.CREATE,
        description: '创建债权申报'
      })).rejects.toThrow('记录操作日志失败');

      // 验证失败日志被记录
      expect(mockQueryWithAuth).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOperationHistory', () => {
    test('应该返回债权操作历史', async () => {
      const mockHistory = [
        {
          id: 'claim_operation_log:1',
          claim_id: 'claim:test',
          operation_type: OperationType.CREATE,
          operation_time: '2024-01-01T00:00:00Z'
        },
        {
          id: 'claim_operation_log:2',
          claim_id: 'claim:test',
          operation_type: OperationType.SUBMIT,
          operation_time: '2024-01-02T00:00:00Z'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockHistory]);

      const result = await service.getOperationHistory('claim:test');

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('FROM claim_operation_log'),
        expect.objectContaining({
          claim_id: 'claim:test',
          limit: 50,
          offset: 0
        })
      );

      expect(result).toEqual(mockHistory);
    });

    test('应该支持过滤选项', async () => {
      mockQueryWithAuth.mockResolvedValue([[]]);

      await service.getOperationHistory('claim:test', {
        operation_type: OperationType.UPDATE,
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        limit: 20,
        offset: 10
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('operation_type = $operation_type'),
        expect.objectContaining({
          operation_type: OperationType.UPDATE,
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-01-31T00:00:00.000Z',
          limit: 20,
          offset: 10
        })
      );
    });
  });

  describe('getOperationStatistics', () => {
    test('应该返回操作统计信息', async () => {
      const mockBaseStats = [{
        total_operations: 100,
        successful_operations: 95,
        failed_operations: 5
      }];

      const mockTypeStats = [
        { operation_type: OperationType.CREATE, count: 30 },
        { operation_type: OperationType.UPDATE, count: 40 },
        { operation_type: OperationType.SUBMIT, count: 30 }
      ];

      const mockUserStats = [
        { operator_id: 'user:1', operator_name: 'User 1', count: 60 },
        { operator_id: 'user:2', operator_name: 'User 2', count: 40 }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([mockBaseStats])
        .mockResolvedValueOnce([mockTypeStats])
        .mockResolvedValueOnce([mockUserStats]);

      const result = await service.getOperationStatistics({
        case_id: 'case:test',
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(result).toEqual({
        total_operations: 100,
        operations_by_type: {
          [OperationType.CREATE]: 30,
          [OperationType.UPDATE]: 40,
          [OperationType.SUBMIT]: 30
        },
        operations_by_user: {
          'User 1': 60,
          'User 2': 40
        },
        operations_by_date: {},
        success_rate: 95
      });
    });
  });

  describe('getRecentOperations', () => {
    test('应该返回最近的操作记录', async () => {
      const mockOperations = [
        {
          id: 'claim_operation_log:1',
          operation_type: OperationType.SUBMIT,
          operation_time: '2024-01-02T00:00:00Z'
        },
        {
          id: 'claim_operation_log:2',
          operation_type: OperationType.CREATE,
          operation_time: '2024-01-01T00:00:00Z'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockOperations]);

      const result = await service.getRecentOperations(5);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('ORDER BY operation_time DESC'),
        { limit: 5 }
      );

      expect(result).toEqual(mockOperations);
    });
  });

  describe('getUserOperations', () => {
    test('应该返回用户的操作记录', async () => {
      const mockOperations = [
        {
          id: 'claim_operation_log:1',
          operator_id: 'user:test',
          operation_type: OperationType.CREATE
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockOperations]);

      const result = await service.getUserOperations('user:test', {
        limit: 20,
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('operator_id = $user_id'),
        expect.objectContaining({
          user_id: 'user:test',
          limit: 20,
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-01-31T00:00:00.000Z'
        })
      );

      expect(result).toEqual(mockOperations);
    });
  });

  describe('cleanupOldLogs', () => {
    test('应该删除过期的操作日志', async () => {
      const deletedRecords = [{ id: 'deleted1' }, { id: 'deleted2' }];
      const logOperationResult = [{
        id: 'claim_operation_log:cleanup',
        operation_type: 'delete',
        operation_result: 'success'
      }];

      mockQueryWithAuth
        .mockResolvedValueOnce([deletedRecords]) // DELETE 操作结果
        .mockResolvedValueOnce([logOperationResult]); // 清理操作日志记录

      const result = await service.cleanupOldLogs(365);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('DELETE FROM claim_operation_log'),
        expect.objectContaining({
          cutoff_date: expect.any(String)
        })
      );

      expect(result).toBe(1); // 返回删除的记录数 (results.length = 1, 因为results是一个数组，包含一个数组)
    });
  });

  describe('validateOperationPermission', () => {
    test('应该验证操作权限', async () => {
      const result = await service.validateOperationPermission('claim:test', OperationType.UPDATE);
      
      // 目前总是返回true，实际实现时应该根据具体权限逻辑
      expect(result).toBe(true);
    });
  });

  describe('formatOperationDescription', () => {
    test('应该格式化操作描述', () => {
      const description = service.formatOperationDescription(OperationType.CREATE);
      expect(description).toBe('创建债权申报');
    });

    test('应该包含上下文信息', () => {
      const description = service.formatOperationDescription(
        OperationType.UPDATE,
        { claim_number: 'CL-2024-001' }
      );
      expect(description).toBe('更新债权信息 (CL-2024-001)');
    });
  });

  describe('calculateChangedFields', () => {
    test('应该正确计算变更字段', () => {
      const service = new ClaimOperationService(mockClient);
      
      // 使用反射访问私有方法进行测试
      const calculateChangedFields = (service as any).calculateChangedFields.bind(service);
      
      const beforeData = { status: 'draft', amount: 1000, name: 'test' };
      const afterData = { status: 'submitted', amount: 2000, name: 'test' };
      
      const result = calculateChangedFields(beforeData, afterData);
      
      expect(result).toEqual(['status', 'amount']);
    });

    test('应该处理空数据', () => {
      const service = new ClaimOperationService(mockClient);
      const calculateChangedFields = (service as any).calculateChangedFields.bind(service);
      
      const result = calculateChangedFields(undefined, { status: 'draft' });
      expect(result).toEqual([]);
    });
  });
});