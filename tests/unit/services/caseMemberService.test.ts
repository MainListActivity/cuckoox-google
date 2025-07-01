import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCaseMembers } from '@/src/services/caseMemberService';
import Surreal, { RecordId } from 'surrealdb';

// Mock SurrealDB
vi.mock('surrealdb', () => {
  const mockQuery = vi.fn();
  const mockConnect = vi.fn();
  const mockUse = vi.fn();
  const mockSignin = vi.fn();
  const mockClose = vi.fn();
  
  // Mock RecordId class
  class MockRecordId {
    constructor(public table: string, public id: string) {}
    toString() {
      return `${this.table}:${this.id}`;
    }
  }
  
  return {
    default: vi.fn(() => ({
      connect: mockConnect,
      use: mockUse,
      signin: mockSignin,
      query: mockQuery,
      close: mockClose,
      status: 'connected'
    })),
    RecordId: MockRecordId
  };
});

describe('caseMemberService', () => {
  let mockClient: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new Surreal();
  });
  
  describe('fetchCaseMembers', () => {
    it('should query has_member table with correct parameters', async () => {
      // Arrange
      const testCaseId = new RecordId('case', 'test123');
      const mockResult = [[
        {
          userId: new RecordId('user', '001'),
          userName: 'Test User',
          userEmail: 'test@example.com',
          roles: [
            { 
              id: new RecordId('role', 'case_manager'), 
              name: 'case_manager', 
              description: '案件管理人' 
            },
            { 
              id: new RecordId('role', 'assistant_lawyer'), 
              name: 'assistant_lawyer', 
              description: '协办律师' 
            }
          ]
        }
      ]];
      
      mockClient.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(mockClient, testCaseId);
      
      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM has_member'),
        { caseId: testCaseId }
      );
      
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE in = $caseId'),
        { caseId: testCaseId }
      );
      
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        id: new RecordId('user', '001'),
        userName: 'Test User',
        userEmail: 'test@example.com',
        roles: [
          { 
            id: new RecordId('role', 'case_manager'), 
            name: 'case_manager', 
            description: '案件管理人' 
          },
          { 
            id: new RecordId('role', 'assistant_lawyer'), 
            name: 'assistant_lawyer', 
            description: '协办律师' 
          }
        ],
        caseId: testCaseId
      });
    });

    it('should return complete role objects with id, name and description', async () => {
      // Arrange
      const testCaseId = new RecordId('case', 'test123');
      const mockResult = [[
        {
          userId: new RecordId('user', '002'),
          userName: 'Manager User',
          userEmail: 'manager@example.com',
          roles: [
            { 
              id: new RecordId('role', 'case_manager'), 
              name: 'case_manager', 
              description: '案件管理人，负责案件的全面管理',
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        }
      ]];
      
      mockClient.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(mockClient, testCaseId);
      
      // Assert
      expect(members).toHaveLength(1);
      expect(members[0].roles).toHaveLength(1);
      expect(members[0].roles[0]).toHaveProperty('id');
      expect(members[0].roles[0]).toHaveProperty('name', 'case_manager');
      expect(members[0].roles[0]).toHaveProperty('description', '案件管理人，负责案件的全面管理');
      expect(members[0].roles[0]).toHaveProperty('created_at');
    });
  });
});
