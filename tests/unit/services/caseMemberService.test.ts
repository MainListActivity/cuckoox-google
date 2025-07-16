import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dataService interface
const mockDataService = {
  query: vi.fn(),
  select: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  queryWithAuth: vi.fn()
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
import { fetchCaseMembers, caseMemberService } from '@/src/services/caseMemberService';
import { RecordId } from 'surrealdb';

describe('caseMemberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    caseMemberService.setDataService(mockDataService);
  });
  
  describe('fetchCaseMembers', () => {
    it('should query has_member table with correct parameters', async () => {
      // Arrange
      const testCaseId = new RecordId('case', 'test123') as any;
      const mockResult = [
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
      ];
      
      mockDataService.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(testCaseId);
      
      // Assert
      expect(mockDataService.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM has_member'),
        { caseId: testCaseId }
      );
      
      expect(mockDataService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE in = $caseId'),
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
      const testCaseId = new RecordId('case', 'test123') as any;
      const mockResult = [
        {
          userId: new RecordId('user', '002'),
          userName: 'Another User',
          userEmail: 'another@example.com',
          roles: [
            { 
              id: new RecordId('role', 'owner'), 
              name: 'owner', 
              description: '案件负责人' 
            }
          ]
        }
      ];
      
      mockDataService.query.mockResolvedValue(mockResult);
      
      // Act
      const members = await fetchCaseMembers(testCaseId);
      
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