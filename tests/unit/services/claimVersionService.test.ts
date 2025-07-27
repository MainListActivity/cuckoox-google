/**
 * ClaimVersionService 单元测试
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import ClaimVersionService from '@/src/services/claimVersionService';
import { VersionType } from '@/src/types/claimTracking';

// Mock queryWithAuth
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn()
}));

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mock-checksum')
    }))
  },
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-checksum')
  }))
}));

describe('ClaimVersionService', () => {
  let service: ClaimVersionService;
  let mockClient: any;
  let mockQueryWithAuth: any;

  beforeEach(async () => {
    mockClient = {};
    service = new ClaimVersionService(mockClient);
    const { queryWithAuth } = await import('@/src/utils/surrealAuth');
    mockQueryWithAuth = vi.mocked(queryWithAuth);
    vi.clearAllMocks();
  });

  describe('createVersionSnapshot', () => {
    test('应该成功创建版本快照', async () => {
      const mockClaimData = {
        id: 'claim:test',
        claim_number: 'CL-2024-001',
        status: 'draft',
        asserted_claim_details: {
          principal: 10000,
          interest: 1000
        }
      };

      const mockVersionHistory = {
        id: 'claim_version_history:test',
        claim_id: 'claim:test',
        version_number: 1,
        version_type: VersionType.INITIAL,
        snapshot_data: mockClaimData,
        checksum: 'mock-checksum',
        created_at: '2024-01-01T00:00:00Z'
      };

      mockQueryWithAuth
        .mockResolvedValueOnce([[mockClaimData]]) // getCurrentClaimData
        .mockResolvedValueOnce([[{ max_version: 0 }]]) // getNextVersionNumber
        .mockResolvedValueOnce([[mockVersionHistory]]) // CREATE claim_version_history
        .mockResolvedValueOnce([[]]); // updateClaimCurrentVersion

      const result = await service.createVersionSnapshot({
        claim_id: 'claim:test',
        version_type: VersionType.INITIAL,
        change_summary: '初始版本',
        change_reason: '创建债权'
      });

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('CREATE claim_version_history'),
        expect.objectContaining({
          claim_id: 'claim:test',
          version_number: 1,
          version_type: VersionType.INITIAL,
          snapshot_data: mockClaimData,
          checksum: 'mock-checksum'
        })
      );

      expect(result).toEqual(mockVersionHistory);
    });

    test('应该处理债权数据不存在的情况', async () => {
      mockQueryWithAuth.mockResolvedValueOnce([[]]); // getCurrentClaimData returns empty

      await expect(service.createVersionSnapshot({
        claim_id: 'claim:nonexistent',
        version_type: VersionType.INITIAL
      })).rejects.toThrow('创建版本快照失败');
    });
  });

  describe('getVersionHistory', () => {
    test('应该返回版本历史列表', async () => {
      const mockVersions = [
        {
          id: 'claim_version_history:2',
          claim_id: 'claim:test',
          version_number: 2,
          version_type: VersionType.SUBMISSION,
          created_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 'claim_version_history:1',
          claim_id: 'claim:test',
          version_number: 1,
          version_type: VersionType.INITIAL,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockQueryWithAuth.mockResolvedValue([mockVersions]);

      const result = await service.getVersionHistory('claim:test');

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('FROM claim_version_history'),
        { claim_id: 'claim:test' }
      );

      expect(result).toEqual(mockVersions);
    });
  });

  describe('getVersionData', () => {
    test('应该返回指定版本的数据', async () => {
      const mockVersion = {
        id: 'claim_version_history:1',
        claim_id: 'claim:test',
        version_number: 1,
        snapshot_data: { status: 'draft' }
      };

      mockQueryWithAuth.mockResolvedValue([[mockVersion]]);

      const result = await service.getVersionData('claim:test', 1);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining('version_number = $version_number'),
        {
          claim_id: 'claim:test',
          version_number: 1
        }
      );

      expect(result).toEqual(mockVersion);
    });

    test('应该处理版本不存在的情况', async () => {
      mockQueryWithAuth.mockResolvedValue([[]]);

      const result = await service.getVersionData('claim:test', 999);

      expect(result).toBeNull();
    });
  });

  describe('compareVersions', () => {
    test('应该正确对比两个版本', async () => {
      const fromVersionData = {
        id: 'claim_version_history:1',
        version_number: 1,
        snapshot_data: {
          status: 'draft',
          amount: 1000,
          description: 'old description'
        }
      };

      const toVersionData = {
        id: 'claim_version_history:2',
        version_number: 2,
        snapshot_data: {
          status: 'submitted',
          amount: 2000,
          description: 'old description'
        }
      };

      mockQueryWithAuth
        .mockResolvedValueOnce([[fromVersionData]])
        .mockResolvedValueOnce([[toVersionData]]);

      const result = await service.compareVersions({
        claimId: 'claim:test',
        fromVersion: 1,
        toVersion: 2
      });

      expect(result.claim_id).toBe('claim:test');
      expect(result.from_version).toBe(1);
      expect(result.to_version).toBe(2);
      expect(result.changes).toHaveLength(2); // status and amount changed
      expect(result.changes.some(c => c.field_path === 'status')).toBe(true);
      expect(result.changes.some(c => c.field_path === 'amount')).toBe(true);
    });

    test('应该处理版本数据不存在的情况', async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      await expect(service.compareVersions({
        claimId: 'claim:test',
        fromVersion: 1,
        toVersion: 2
      })).rejects.toThrow('版本对比失败');
    });
  });

  describe('revertToVersion', () => {
    test('应该成功恢复到指定版本', async () => {
      const targetVersionData = {
        id: 'claim_version_history:1',
        version_number: 1,
        snapshot_data: {
          status: 'draft',
          amount: 1000
        }
      };

      const newVersionData = {
        id: 'claim_version_history:3',
        version_number: 3,
        version_type: VersionType.REVIEW_UPDATE
      };

      mockQueryWithAuth
        .mockResolvedValueOnce([[targetVersionData]]) // getVersionData
        .mockResolvedValueOnce([[]]) // updateClaimData
        .mockResolvedValueOnce([[targetVersionData]]) // getCurrentClaimData for createVersionSnapshot
        .mockResolvedValueOnce([[{ max_version: 2 }]]) // getNextVersionNumber
        .mockResolvedValueOnce([[newVersionData]]) // CREATE claim_version_history
        .mockResolvedValueOnce([[]]); // updateClaimCurrentVersion

      const result = await service.revertToVersion({
        claimId: 'claim:test',
        targetVersion: 1,
        reason: '恢复到初始状态'
      });

      expect(result).toEqual(newVersionData);
    });

    test('应该处理目标版本不存在的情况', async () => {
      mockQueryWithAuth.mockResolvedValueOnce([[]]);

      await expect(service.revertToVersion({
        claimId: 'claim:test',
        targetVersion: 999,
        reason: '恢复测试'
      })).rejects.toThrow('版本恢复失败');
    });
  });

  describe('validateVersionIntegrity', () => {
    test('应该验证版本完整性', async () => {
      const versionData = {
        snapshot_data: { status: 'draft' },
        checksum: 'mock-checksum'
      };

      mockQueryWithAuth.mockResolvedValue([[versionData]]);

      const result = await service.validateVersionIntegrity('claim:test', 1);

      expect(result).toBe(true);
    });

    test('应该检测到数据损坏', async () => {
      const versionData = {
        snapshot_data: { status: 'draft' },
        checksum: 'different-checksum'
      };

      mockQueryWithAuth.mockResolvedValue([[versionData]]);

      const result = await service.validateVersionIntegrity('claim:test', 1);

      expect(result).toBe(false);
    });

    test('应该处理版本不存在的情况', async () => {
      mockQueryWithAuth.mockResolvedValue([[]]);

      const result = await service.validateVersionIntegrity('claim:test', 999);

      expect(result).toBe(false);
    });
  });

  describe('cleanupOldVersions', () => {
    test('应该清理旧版本', async () => {
      const versions = Array.from({ length: 15 }, (_, i) => ({
        id: `claim_version_history:${i + 1}`,
        version_number: i + 1
      }));

      const deletedVersions = versions.slice(10); // 删除前5个版本

      mockQueryWithAuth
        .mockResolvedValueOnce([versions]) // getVersionHistory
        .mockResolvedValueOnce([deletedVersions]); // DELETE

      const result = await service.cleanupOldVersions('claim:test', 10);

      expect(result).toBe(1); // 返回删除的批次数
    });

    test('应该处理不需要清理的情况', async () => {
      const versions = Array.from({ length: 5 }, (_, i) => ({
        id: `claim_version_history:${i + 1}`,
        version_number: i + 1
      }));

      mockQueryWithAuth.mockResolvedValueOnce([versions]);

      const result = await service.cleanupOldVersions('claim:test', 10);

      expect(result).toBe(0);
    });
  });

  describe('getVersionStatistics', () => {
    test('应该返回版本统计信息', async () => {
      const baseStats = [{
        total_versions: 5,
        latest_version: 5,
        first_created: '2024-01-01T00:00:00Z',
        last_updated: '2024-01-05T00:00:00Z'
      }];

      const typeStats = [
        { version_type: VersionType.INITIAL, count: 1 },
        { version_type: VersionType.DRAFT_UPDATE, count: 2 },
        { version_type: VersionType.SUBMISSION, count: 2 }
      ];

      mockQueryWithAuth
        .mockResolvedValueOnce([baseStats])
        .mockResolvedValueOnce([typeStats]);

      const result = await service.getVersionStatistics('claim:test');

      expect(result).toEqual({
        total_versions: 5,
        versions_by_type: {
          [VersionType.INITIAL]: 1,
          [VersionType.DRAFT_UPDATE]: 2,
          [VersionType.SUBMISSION]: 2
        },
        latest_version: 5,
        first_created: '2024-01-01T00:00:00Z',
        last_updated: '2024-01-05T00:00:00Z'
      });
    });
  });

  describe('private methods', () => {
    test('calculateFieldChanges 应该正确计算字段变更', () => {
      const service = new ClaimVersionService(mockClient);
      const calculateFieldChanges = (service as any).calculateFieldChanges.bind(service);

      const oldData = { status: 'draft', amount: 1000, name: 'test' };
      const newData = { status: 'submitted', amount: 1000, description: 'new field' };

      const changes = calculateFieldChanges(oldData, newData);

      expect(changes).toHaveLength(3);
      expect(changes.some(c => c.field_path === 'status' && c.change_type === 'modified')).toBe(true);
      expect(changes.some(c => c.field_path === 'name' && c.change_type === 'removed')).toBe(true);
      expect(changes.some(c => c.field_path === 'description' && c.change_type === 'added')).toBe(true);
    });

    test('generateChangeSummary 应该生成正确的变更摘要', () => {
      const service = new ClaimVersionService(mockClient);
      const generateChangeSummary = (service as any).generateChangeSummary.bind(service);

      const changes = [
        { field_name: '状态', change_type: 'modified' },
        { field_name: '金额', change_type: 'modified' },
        { field_name: '描述', change_type: 'added' }
      ];

      const summary = generateChangeSummary(changes);

      expect(summary).toContain('新增字段: 描述');
      expect(summary).toContain('修改字段: 状态, 金额');
    });

    test('generateChangeSummary 应该处理无变更的情况', () => {
      const service = new ClaimVersionService(mockClient);
      const generateChangeSummary = (service as any).generateChangeSummary.bind(service);

      const summary = generateChangeSummary([]);

      expect(summary).toBe('无变更');
    });
  });
});