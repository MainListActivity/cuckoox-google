import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateCasePage from '../../src/pages/cases/create';
import { SurrealProvider } from '../../src/contexts/SurrealProvider';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SnackbarProvider } from '../../src/contexts/SnackbarContext';
import { RecordId } from 'surrealdb';
import Surreal from 'surrealdb';

// Mock the Surreal client
const mockSurreal = {
  connect: vi.fn().mockResolvedValue(true),
  use: vi.fn().mockResolvedValue(true),
  create: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  merge: vi.fn(),
  query: vi.fn(),
  subscribeLive: vi.fn(),
  kill: vi.fn(),
  close: vi.fn(),
  status: 'connected' as const,
};

// Mock user
const mockUser = {
  id: new RecordId('user', 'testuser'),
  github_id: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  created_at: new Date(),
  updated_at: new Date(),
};

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock authService
vi.mock('../../src/services/authService', () => ({
  default: {
    getUser: vi.fn().mockResolvedValue(null),
    loginRedirect: vi.fn(),
    loginRedirectCallback: vi.fn(),
    logoutRedirect: vi.fn(),
  },
}));

describe('Case Creation with SurrealDB Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup authentication state through SurrealDB instead of localStorage
    // Mock SurrealDB to return authenticated user state
    mockSurreal.query.mockResolvedValue([[mockUser]]);
    
    // Mock document creation
    mockSurreal.create.mockImplementation((table, data) => {
      if (table === 'document') {
        return Promise.resolve([{
          id: new RecordId('document', 'testdocid'),
          content: JSON.stringify({ ops: [] }),
          created_by: mockUser.id,
          last_edited_by: mockUser.id,
          created_at: new Date(),
          updated_at: new Date(),
        }]);
      }
      if (table === 'case') {
        return Promise.resolve([{
          id: new RecordId('case', 'testcaseid'),
          ...data,
        }]);
      }
      return Promise.resolve([]);
    });

    // Mock live query
    mockSurreal.query.mockResolvedValue([{ result: 'lq:testlivequeryid' }]);
  });

  it('should create a case with proper date formatting for SurrealDB using authenticated state', async () => {
    const { container } = render(
      <BrowserRouter>
        <SurrealProvider 
          client={mockSurreal as any}
          endpoint="memory"
          namespace="test"
          database="test"
        >
          <AuthProvider>
            <SnackbarProvider>
              <CreateCasePage />
            </SnackbarProvider>
          </AuthProvider>
        </SurrealProvider>
      </BrowserRouter>
    );

    // Wait for document to be created
    await waitFor(() => {
      expect(mockSurreal.create).toHaveBeenCalledWith('document', expect.objectContaining({
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }));
    });

    // Fill in the form
    const caseNameInput = screen.getByLabelText(/案件名称/i);
    const caseLeadInput = screen.getByLabelText(/案件负责人/i);
    const acceptanceDateInput = screen.getByLabelText(/受理时间/i);

    fireEvent.change(caseNameInput, { target: { value: '测试案件' } });
    fireEvent.change(caseLeadInput, { target: { value: '张三' } });
    fireEvent.change(acceptanceDateInput, { target: { value: '2024-01-15' } });

    // Wait for auto-calculated dates
    await waitFor(() => {
      const announcementDateInput = screen.getByLabelText(/公告时间/i) as HTMLInputElement;
      expect(announcementDateInput.value).toBe('2024-02-09'); // 25 days after
    });

    // Click save button
    const saveButton = screen.getByRole('button', { name: /创建案件/i });
    fireEvent.click(saveButton);

    // Verify case creation was called with Date objects
    await waitFor(() => {
      expect(mockSurreal.create).toHaveBeenCalledWith('case', expect.objectContaining({
        name: '测试案件',
        case_manager_name: '张三',
        case_procedure: '破产清算',
        acceptance_date: expect.any(Date),
        announcement_date: expect.any(Date),
        claim_submission_start_date: expect.any(Date),
        claim_submission_end_date: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      }));
    });

    // Verify the dates are Date objects, not strings
    const caseCreateCall = mockSurreal.create.mock.calls.find(call => call[0] === 'case');
    expect(caseCreateCall).toBeDefined();
    const caseData = caseCreateCall![1];
    
    expect(caseData.acceptance_date).toBeInstanceOf(Date);
    expect(caseData.announcement_date).toBeInstanceOf(Date);
    expect(caseData.claim_submission_start_date).toBeInstanceOf(Date);
    expect(caseData.claim_submission_end_date).toBeInstanceOf(Date);
    expect(caseData.created_at).toBeInstanceOf(Date);
    expect(caseData.updated_at).toBeInstanceOf(Date);
    
    // Verify the dates have correct values
    expect(caseData.acceptance_date.toISOString()).toContain('2024-01-15');
    expect(caseData.announcement_date.toISOString()).toContain('2024-02-09');
    expect(caseData.claim_submission_start_date.toISOString()).toContain('2024-03-10'); // 30 days after announcement
    expect(caseData.claim_submission_end_date.toISOString()).toContain('2024-05-09'); // 3 months after announcement
  });
});
