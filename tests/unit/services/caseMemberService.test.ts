import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SurrealWorkerAPI interface
const mockClient = {
  query: vi.fn(),
  select: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  merge: vi.fn(),
  live: vi.fn(),
  kill: vi.fn(),
  connect: vi.fn(),
  authenticate: vi.fn(),
  invalidate: vi.fn(),
  setConfig: vi.fn(),
  close: vi.fn(),
  recoverTokens: vi.fn(),
  getConnectionState: vi.fn(),
  forceReconnect: vi.fn(),
  subscribeLive: vi.fn(),
  mutate: vi.fn()
};

// Mock RecordId class
vi.mock('surrealdb', () => ({
  RecordId: class MockRecordId {
    constructor(public table: string, public id: string) {}
    toString() {
      return `${this.table}:${this.id}`;
    }
  }
}));

// Import after mocks are set up
import { fetchCaseMembers } from '@/src/services/caseMemberService';
import { RecordId } from 'surrealdb';

describe('caseMemberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('fetchCaseMembers', () => {
    it('should query has_member table with correct parameters', async () => {
      // Arrange
      const testCaseId = new RecordId('case', 'test123');
      const mockResult = [
        // 认证结果 (第一个元素)
        { id: 'user:auth_user', name: 'Test User' },
        // 实际查询结果数组 (第二个元素)
        [
          {
            user: {
              id: new RecordId('user', '001'),
              name: 'Test User',
              email: 'test@example.com'
            },
            role_id: { 
              id: new RecordId('role', 'case_manager'), 
              name: 'case_manager', 
              description: '案件管理人' 
            }
          },
          {
            user: {
              id: new RecordId('user', '001'),
              name: 'Test User',
              email: 'test@example.com'
            },
            role_id: { 
              id: new RecordId('role', 'assistant_lawyer'), 
              name: 'assistant_lawyer', 
              description: '协办律师' 
            }
          }
        ]
      ];
      
      mockClient.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(mockClient, testCaseId);
      
      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM has_member'),
        { caseId: testCaseId }
      );
      
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        id: expect.objectContaining({ table: 'user', id: '001' }),
        userName: 'Test User',
        userEmail: 'test@example.com',
        roles: expect.arrayContaining([
          expect.objectContaining({ name: 'case_manager' }),
          expect.objectContaining({ name: 'assistant_lawyer' })
        ])
      });
    });

    it('should return complete role objects with id, name and description', async () => {
      // Arrange
      const testCaseId = new RecordId('case', 'test123');
      const mockResult = [
        // 认证结果 (第一个元素)
        { id: 'user:auth_user', name: 'Test User' },
        // 实际查询结果数组 (第二个元素)
        [
          {
            user: {
              id: new RecordId('user', '002'),
              name: 'Another User',
              email: 'another@example.com'
            },
            role_id: { 
              id: new RecordId('role', 'owner'), 
              name: 'owner', 
              description: '案件负责人' 
            }
          }
        ]
      ];
      
      mockClient.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(mockClient, testCaseId);
      
      // Assert
      expect(members[0].roles).toHaveLength(1);
      expect(members[0].roles[0]).toMatchObject({
        id: expect.objectContaining({ table: 'role', id: 'owner' }),
        name: 'owner',
        description: '案件负责人'
      });
    });
  });
});