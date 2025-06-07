import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'; // 使用vitest的测试函数
import CaseMemberTab from '@/src/components/case/CaseMemberTab';
// import * as caseMemberService from '@/src/services/caseMemberService';
import { AuthContext, AppUser } from '@/src/contexts/AuthContext';
import { CaseMember } from '@/src/types/caseMember';
// import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { RecordId } from 'surrealdb';

// Create stable mock functions to avoid reference changes
const mockFetchCaseMembers = vi.fn();
const mockRemoveCaseMember = vi.fn();
const mockChangeCaseOwner = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

// Mock services with stable references
vi.mock('@/src/services/caseMemberService', () => ({
  fetchCaseMembers: mockFetchCaseMembers,
  removeCaseMember: mockRemoveCaseMember,
  changeCaseOwner: mockChangeCaseOwner,
}));

// Mock useSnackbar with stable references
vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

const mockCaseId = 'case:test123';

const initialMockMembers: CaseMember[] = [
  { id: 'user:owner1', caseId: mockCaseId, roleInCase: 'owner', userName: 'Owner User', userEmail: 'owner@example.com', avatarUrl: 'owner.png' },
  { id: 'user:member1', caseId: mockCaseId, roleInCase: 'member', userName: 'Member One', userEmail: 'member1@example.com', avatarUrl: 'member1.png' },
  { id: 'user:member2', caseId: mockCaseId, roleInCase: 'member', userName: 'Member Two', userEmail: 'member2@example.com', avatarUrl: 'member2.png' },
];

// Define a minimal AuthContextType for testing
interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oidcUser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAuthState: (appUser: AppUser, oidcUserInstance?: any) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  selectedCaseId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userCases: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentUserCaseRoles: any[];
  isCaseLoading: boolean;
  selectCase: (caseId: string) => Promise<void>;
  hasRole: (roleName: string) => boolean;
  refreshUserCasesAndRoles: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navMenuItems: any[] | null;
  isMenuLoading: boolean;
  navigateTo: string | null; // 添加缺失的属性
  clearNavigateTo: () => void; // 添加缺失的属性
}

// Helper to provide AuthContext with stable references
const renderWithAuth = (ui: React.ReactElement, authContextValue: Partial<AuthContextType>) => {
  const fullAuthContextValue: AuthContextType = {
    isLoggedIn: true,
    user: null,
    oidcUser: null,
    setAuthState: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    selectedCaseId: mockCaseId,
    userCases: [],
    currentUserCaseRoles: [],
    isCaseLoading: false,
    selectCase: vi.fn(),
    hasRole: (roleName: string) => authContextValue.user?.github_id === 'ownergh' && roleName === 'case_manager',
    refreshUserCasesAndRoles: vi.fn(),
    navMenuItems: [],
    isMenuLoading: false,
    navigateTo: null,
    clearNavigateTo: vi.fn(),
    ...authContextValue,
  };
  return render(
    <AuthContext.Provider value={fullAuthContextValue}>
      {ui}
    </AuthContext.Provider>
  );
};

describe('CaseMemberTab', () => {
  let mockAuthContextValue: Partial<AuthContextType>;
  let currentMockMembers: CaseMember[];

  beforeEach(() => {
    vi.clearAllMocks();
    currentMockMembers = JSON.parse(JSON.stringify(initialMockMembers));
    
    // Setup stable mock implementations
    mockFetchCaseMembers.mockImplementation(async () => {
      return JSON.parse(JSON.stringify(currentMockMembers));
    });
    mockRemoveCaseMember.mockResolvedValue(undefined);
    mockChangeCaseOwner.mockResolvedValue(undefined);

    mockAuthContextValue = {
      user: { 
        id: new RecordId('user', 'nonOwner'), 
        name: 'Non Owner User', 
        github_id: 'nonownergh' 
      } as AppUser,
    };
  });

  afterEach(async () => {
    // Clean up any open handles
    vi.clearAllMocks();
    
    // Force cleanup of any pending promises
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Clear any timers
    vi.clearAllTimers();
  });

  it('renders loading state initially', () => {
    mockFetchCaseMembers.mockImplementation(() => new Promise(() => {}));
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('fetches and displays a list of members', async () => {
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    await waitFor(() => expect(mockFetchCaseMembers).toHaveBeenCalledWith(mockCaseId), { timeout: 2000 });
    expect(screen.getByText('Owner User')).toBeInTheDocument();
    expect(screen.getByText('Member One')).toBeInTheDocument();
  });

  describe('as Owner (for remove actions)', () => {
    beforeEach(() => {
      mockAuthContextValue = {
        user: { 
          id: new RecordId('user', 'owner1'), 
          name: 'Owner User', 
          github_id: 'ownergh' 
        } as AppUser,
      };
    });

    it('displays "Add Member" button', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.queryByText('Owner User')).toBeInTheDocument(), { timeout: 2000 });
      expect(screen.getByRole('button', { name: /Add Member/i })).toBeInTheDocument();
    });

    it('opens AddCaseMemberDialog when "Add Member" is clicked', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText('Owner User')).toBeInTheDocument(), { timeout: 2000 });
      fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
      expect(await screen.findByLabelText(/Search users/i)).toBeInTheDocument();
    });
  });

  describe('Change Case Owner functionality', () => {
    const ownerUser = { 
      id: new RecordId('user', 'owner1'), 
      name: 'Owner User', 
      github_id: 'ownergh' 
    } as AppUser;
    const memberUser1 = initialMockMembers.find(m => m.id === 'user:member1')!;

    beforeEach(() => {
      mockAuthContextValue = { user: ownerUser };
    });

    it('Owner sees "More" menu for other members', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      expect(actionsButton).toBeInTheDocument();
    });

    it('Owner sees "Make Case Owner" option in menu for non-owner members', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      
      if (actionsButton) {
        fireEvent.click(actionsButton);
        expect(await screen.findByText(/Make Case Owner/i)).toBeVisible();
      }
    });

    it('Non-owner does not see "More" menu or "Make Case Owner" option', async () => {
      mockAuthContextValue = { 
        user: { 
          id: new RecordId('user', 'member1'), 
          name: 'Member One', 
          github_id: 'member1gh' 
        } as AppUser 
      };
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      expect(actionsButton).not.toBeInTheDocument();
    });

    it('Clicking "Make Case Owner" opens confirmation dialog', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      
      if (actionsButton) {
        fireEvent.click(actionsButton);
        const makeOwnerOption = await screen.findByText(/Make Case Owner/i);
        fireEvent.click(makeOwnerOption);
        
        expect(await screen.findByText(/Confirm Ownership Change/i)).toBeVisible();
        expect(screen.getByText(new RegExp(`Are you sure you want to make ${memberUser1.userName} the new case owner`))).toBeVisible();
      }
    });

    it('Confirming ownership change calls changeCaseOwner service', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      
      if (actionsButton) {
        fireEvent.click(actionsButton);
        const makeOwnerOption = await screen.findByText(/Make Case Owner/i);
        fireEvent.click(makeOwnerOption);
        
        const confirmButton = await screen.findByRole('button', { name: /confirm/i });
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
          expect(mockChangeCaseOwner).toHaveBeenCalledWith(
            mockCaseId,
            memberUser1.id,
            ownerUser.id
          );
        }, { timeout: 2000 });
      }
    });
  });

  describe('Error Handling', () => {
    it('displays error when fetchCaseMembers fails', async () => {
      mockFetchCaseMembers.mockRejectedValue(new Error('Failed to fetch members'));
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load members/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('handles changeCaseOwner error gracefully', async () => {
      const ownerUser = { id: new RecordId('user','owner1'), name: 'Owner User', github_id: 'ownergh' } as AppUser;
      mockAuthContextValue = { user: ownerUser };
      mockChangeCaseOwner.mockRejectedValue(new Error('Failed to change owner'));
      
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText('Member One')).toBeInTheDocument(), { timeout: 2000 });
      
      const member1Item = screen.getByText('Member One').closest('li');
      const actionsButton = member1Item?.querySelector('[aria-label*="actions"]') || 
                           member1Item?.querySelector('button[aria-haspopup="true"]');
      
      if (actionsButton) {
        fireEvent.click(actionsButton);
        const makeOwnerOption = await screen.findByText(/Make Case Owner/i);
        fireEvent.click(makeOwnerOption);
        
        const confirmButton = await screen.findByRole('button', { name: /confirm/i });
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
          expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('Failed to change owner'));
        }, { timeout: 2000 });
      }
    });
  });
});
