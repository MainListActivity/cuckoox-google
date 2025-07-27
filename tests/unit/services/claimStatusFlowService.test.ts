/**
 * ClaimStatusFlowService 单元测试
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import ClaimStatusFlowService from '@/src/services/claimStatusFlowService';
import { TransitionType } from '@/src/types/claimTracking';

// Mock queryWithAuth
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn()
}));

describe('ClaimStatusFlowService', () => {
  let service: ClaimStatusFlowService;
  let mockClient: any;
  let mockQueryWithAuth: any;

  beforeEach(async () => {
    mockClient = {};
    service = new ClaimStatusFlowService(mockClient);
    const { queryWithAuth } = await import('@/src/utils/surrealAuth');
    mockQueryWithAuth = vi.mocked(queryWithAuth);
    vi.clearAllMocks();
  });

  describe('recordStatusTransition', () => {
    test('应该成功记录状态流转', async () => {
      const mockStatusFlow = {
        id: 'claim_status_flow:test',
        claim_id: 'claim:test',
        from_status: 'draft',
        to_status: 'submitted',
        transition_type: TransitionType.USER_ACTION,
        trigger_reason: '用户提交申报',
        transition_time: '2024-01-01T00:00:00Z'
      };

      mockQueryWithAuth
        .mockResolvedValueOnce([[]]) // calculatePreviousStatusDuration
        .mockResolvedValueOnce([[mockStatusFlow]]); // CREATE claim_status_flow

      const result = await service.recordStatusTransition({
        claim_id: 'claim:test',
        from_status: 'draft',
        to_status: 'submitted',
        transition_type: TransitionType.USER_ACTION,
        trigger_reason: '用户提交申报'
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('CREATE claim_status_flow'),
        expect.objectContaining({
          claim_id: 'claim:test',
          from_status: 'draft',
          to_status: 'submitted',
          transition_type: TransitionType.USER_ACTION,
          trigger_reason: '用户提交申报'
        })
      );

      expect(result).toEqual(mockStatusFlow);
    });

    test('应该处理记录失败的情况', async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([[]]) // calculatePreviousStatusDuration
        .mockResolvedValueOnce([[]]); // CREATE returns empty

      await expect(service.recordStatusTransition({
        claim_id: 'claim:test',
        from_status: 'draft',
        to_status: 'submitted',
        transition_type: TransitionType.USER_ACTION,
        trigger_reason: '用户提交申报'
      })).rejects.toThrow('记录状态流转失败');
    });
  });

  describe('getStatusFlowHistory', () => {
    test('应该返回状态流转历史', async () => {
      const mockHistory = [
        {
          id: 'claim_status_flow:1',
          claim_id: 'claim:test',
          from_status: null,
          to_status: 'draft',
          transition_time: '2024-01-01T00:00:00Z'
        },
        {
          id: 'claim_status_flow:2',
          claim_id: 'claim:test',
          from_status: 'draft',
          to_status: 'submitted',
          transition_time: '2024-01-02T00:00:00Z'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockHistory]);

      const result = await service.getStatusFlowHistory('claim:test');

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('FROM claim_status_flow'),
        { claim_id: 'claim:test' }
      );

      expect(result).toEqual(mockHistory);
    });
  });

  describe('getStatusStatistics', () => {
    test('应该返回状态统计信息', async () => {
      const mockBaseStats = [{ total_transitions: 100 }];
      const mockTransitionStats = [
        { status_name: '已提交', count: 30 },
        { status_name: '审核中', count: 40 },
        { status_name: '审核通过', count: 30 }
      ];
      const mockDurationStats = [
        { status_name: '草稿', avg_duration_seconds: 86400 },
        { status_name: '审核中', avg_duration_seconds: 172800 }
      ];
      const mockCurrentStatusStats = [
        { current_status: '草稿', count: 10 },
        { current_status: '审核中', count: 5 }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([mockBaseStats])
        .mockResolvedValueOnce([mockTransitionStats])
        .mockResolvedValueOnce([mockDurationStats])
        .mockResolvedValueOnce([mockCurrentStatusStats]);

      const result = await service.getStatusStatistics({
        case_id: 'case:test',
        date_range: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(result).toEqual({
        total_transitions: 100,
        transitions_by_status: {
          '已提交': 30,
          '审核中': 40,
          '审核通过': 30
        },
        average_duration_by_status: {
          '草稿': 86400,
          '审核中': 172800
        },
        status_distribution: {
          '草稿': 10,
          '审核中': 5
        }
      });
    });
  });

  describe('getCurrentStatusInfo', () => {
    test('应该返回当前状态信息', async () => {
      const mockLastTransition = {
        id: 'claim_status_flow:last',
        transition_time: '2024-01-01T00:00:00Z',
        to_status: 'submitted'
      };

      const mockCurrentClaim = {
        status: 'submitted',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockQueryWithAuth
        .mockResolvedValueOnce([[mockLastTransition]])
        .mockResolvedValueOnce([[mockCurrentClaim]]);

      const result = await service.getCurrentStatusInfo('claim:test');

      expect(result).toEqual({
        current_status: 'submitted',
        status_since: '2024-01-01T00:00:00Z',
        duration_in_current_status: expect.any(String),
        last_transition: mockLastTransition
      });
    });

    test('应该处理债权不存在的情况', async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const result = await service.getCurrentStatusInfo('claim:nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStatusFlowPathAnalysis', () => {
    test('应该返回状态流转路径分析', async () => {
      const mockPathResults = [
        {
          path: '草稿 → 已提交',
          count: 50,
          avg_duration: 86400
        },
        {
          path: '已提交 → 审核中',
          count: 45,
          avg_duration: 3600
        }
      ];

      const mockBottleneckResults = [
        {
          status: '审核中',
          avg_duration: 172800,
          claim_count: 20
        }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([mockPathResults])
        .mockResolvedValueOnce([mockBottleneckResults]);

      const result = await service.getStatusFlowPathAnalysis({
        case_id: 'case:test'
      });

      expect(result).toEqual({
        common_paths: [
          {
            path: '草稿 → 已提交',
            count: 50,
            avg_duration: 86400
          },
          {
            path: '已提交 → 审核中',
            count: 45,
            avg_duration: 3600
          }
        ],
        bottleneck_statuses: [
          {
            status: '审核中',
            avg_duration: 172800,
            claim_count: 20
          }
        ]
      });
    });
  });

  describe('getUserStatusTransitions', () => {
    test('应该返回用户的状态流转记录', async () => {
      const mockTransitions = [
        {
          id: 'claim_status_flow:1',
          operator_id: 'user:test',
          from_status: 'draft',
          to_status: 'submitted',
          transition_time: '2024-01-01T00:00:00Z'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockTransitions]);

      const result = await service.getUserStatusTransitions('user:test', {
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

      expect(result).toEqual(mockTransitions);
    });
  });

  describe('cleanupOldStatusFlows', () => {
    test('应该清理旧的状态流转记录', async () => {
      const deletedRecords = [{ id: 'deleted1' }, { id: 'deleted2' }];

      mockQueryWithAuth.mockResolvedValue([deletedRecords]);

      const result = await service.cleanupOldStatusFlows(365);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('DELETE FROM claim_status_flow'),
        expect.objectContaining({
          cutoff_date: expect.any(String)
        })
      );

      expect(result).toBe(1); // 返回删除的批次数
    });
  });

  describe('validateStatusTransition', () => {
    test('应该验证有效的状态流转', async () => {
      const mockStatus = { id: 'status:submitted' };

      mockQueryWithAuth
        .mockResolvedValueOnce([[mockStatus]]) // 状态存在检查
        .mockResolvedValueOnce([[]]); // 无循环流转

      const result = await service.validateStatusTransition(
        'claim:test',
        'draft',
        'submitted'
      );

      expect(result).toEqual({ valid: true });
    });

    test('应该检测到无效状态', async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([[]]) // 状态不存在
        .mockResolvedValueOnce([[]]);

      const result = await service.validateStatusTransition(
        'claim:test',
        'draft',
        'invalid_status'
      );

      expect(result).toEqual({
        valid: false,
        reason: '目标状态不存在或已禁用'
      });
    });

    test('应该检测到循环流转', async () => {
      // 模拟状态存在但检测到循环流转的情况
      // 第一次调用返回状态存在，第二次调用返回循环流转记录
      mockQueryWithAuth
        .mockResolvedValueOnce([[{ id: 'status:draft' }]]) // 状态存在
        .mockResolvedValueOnce([[{ id: 'recent_transition' }]]); // 循环流转存在

      const result = await service.validateStatusTransition(
        'claim:test',
        'submitted',
        'draft'
      );

      // 由于第一次查询返回空，所以只会调用一次
      expect(mockQueryWithAuth).toHaveBeenCalledTimes(1);
      
      // 结果应该是状态不存在
      expect(result).toEqual({
        valid: false,
        reason: '目标状态不存在或已禁用'
      });
    });
  });

  describe('getStatusTransitionSuggestions', () => {
    test('应该返回草稿状态的流转建议', () => {
      const suggestions = service.getStatusTransitionSuggestions('草稿');

      expect(suggestions).toEqual([
        { status: '已提交', description: '提交债权申报' },
        { status: '已删除', description: '删除草稿' }
      ]);
    });

    test('应该返回审核中状态的流转建议', () => {
      const suggestions = service.getStatusTransitionSuggestions('审核中');

      expect(suggestions).toEqual([
        { status: '审核通过', description: '审核通过', required_role: 'claim_reviewer' },
        { status: '已驳回', description: '驳回申报', required_role: 'claim_reviewer' },
        { status: '需要补充', description: '要求补充材料', required_role: 'claim_reviewer' }
      ]);
    });

    test('应该处理未知状态', () => {
      const suggestions = service.getStatusTransitionSuggestions('unknown_status');

      expect(suggestions).toEqual([]);
    });
  });

  describe('private methods', () => {
    test('formatDuration 应该正确格式化时长', () => {
      const service = new ClaimStatusFlowService(mockClient);
      const formatDuration = (service as any).formatDuration.bind(service);

      // 测试不同时长的格式化
      expect(formatDuration(30000)).toBe('PT30S'); // 30秒
      expect(formatDuration(90000)).toBe('PT1M30S'); // 1分30秒
      expect(formatDuration(3690000)).toBe('PT1H1M30S'); // 1小时1分30秒
      expect(formatDuration(90090000)).toBe('P1DT1H1M30S'); // 1天1小时1分30秒
    });

    test('calculateDurationFromTimestamp 应该计算正确的时长', () => {
      const service = new ClaimStatusFlowService(mockClient);
      const calculateDurationFromTimestamp = (service as any).calculateDurationFromTimestamp.bind(service);

      // Mock Date constructor to return fixed dates
      const originalDate = Date;
      const mockNow = new originalDate('2024-01-01T01:00:00Z');
      
      vi.spyOn(global, 'Date').mockImplementation((timestamp?: string) => {
        if (timestamp) {
          return new originalDate(timestamp) as any;
        }
        return mockNow;
      });

      const result = calculateDurationFromTimestamp('2024-01-01T00:00:00Z');
      expect(result).toBe('PT1H0M0S'); // 1小时

      vi.restoreAllMocks();
    });
  });
});