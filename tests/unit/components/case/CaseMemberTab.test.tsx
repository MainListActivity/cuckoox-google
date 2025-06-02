import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CaseMemberTab from '@/src/components/case/CaseMemberTab';
import * as caseMemberService from '@/src/services/caseMemberService';
import { AuthContext, AppUser } from '@/src/contexts/AuthContext';
import { CaseMember } from '@/src/types/caseMember';
import { useSnackbar } from '@/src/contexts/SnackbarContext'; // Import useSnackbar
import { vi } from 'vitest';

// Mock services
vi.mock('@/src/services/caseMemberService');
const mockFetchCaseMembers = caseMemberService.fetchCaseMembers as vi.Mock;
const mockRemoveCaseMember = caseMemberService.removeCaseMember as vi.Mock;
const mockChangeCaseOwner = caseMemberService.changeCaseOwner as vi.Mock;

// Mock useSnackbar
vi.mock('@/src/contexts/SnackbarContext');
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

// Mock useTranslation - basic mock, extend if more specific translations are needed
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

// Helper to provide AuthContext
const renderWithAuth = (ui: React.ReactElement, authContextValue: Partial<AuthContextType>) => {
  // Provide default stubs for all required AuthContext properties
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
    hasRole: (roleName: string) => authContextValue.user?.github_id === 'ownergh' && roleName === 'case_manager', // Example role check
    refreshUserCasesAndRoles: vi.fn(),
    navMenuItems: [],
    isMenuLoading: false,
    ...authContextValue, // Spread provided values, overriding defaults
  };
  return render(
    <AuthContext.Provider value={fullAuthContextValue}>
      {ui}
    </AuthContext.Provider>
  );
};

// Define a minimal AuthContextType for partial mocking, actual type is in AuthContext.tsx
interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  oidcUser: any;
  setAuthState: (appUser: AppUser, oidcUserInstance?: any) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  selectedCaseId: string | null;
  userCases: any[];
  currentUserCaseRoles: any[];
  isCaseLoading: boolean;
  selectCase: (caseId: string) => Promise<void>;
  hasRole: (roleName: string) => boolean;
  refreshUserCasesAndRoles: () => Promise<void>;
  navMenuItems: any[] | null;
  isMenuLoading: boolean;
}


describe('CaseMemberTab', () => {
  let mockAuthContextValue: Partial<AuthContextType>;
  let currentMockMembers: CaseMember[];

  beforeEach(() => {
    vi.clearAllMocks();
    currentMockMembers = JSON.parse(JSON.stringify(initialMockMembers)); // Deep copy for mutable tests
    mockFetchCaseMembers.mockImplementation(async () => {
      return JSON.parse(JSON.stringify(currentMockMembers)); // Return deep copy
    });
    mockRemoveCaseMember.mockResolvedValue(undefined);
    mockChangeCaseOwner.mockResolvedValue(undefined);
    (useSnackbar as vi.Mock).mockReturnValue({ showSuccess: mockShowSuccess, showError: mockShowError });


    mockAuthContextValue = {
      user: { id: 'user:nonOwner', name: 'Non Owner User', github_id: 'nonownergh' } as AppUser,
    };
  });

  test('renders loading state initially', () => {
    mockFetchCaseMembers.mockImplementation(() => new Promise(() => {}));
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('fetches and displays a list of members', async () => {
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    await waitFor(() => expect(mockFetchCaseMembers).toHaveBeenCalledWith(mockCaseId));
    expect(screen.getByText('Owner User')).toBeInTheDocument();
    expect(screen.getByText('Member One')).toBeInTheDocument();
  });

  // --- Tests related to "Remove Member" (mostly existing, slightly adjusted) ---
  describe('as Owner (for remove actions)', () => {
    beforeEach(() => {
      mockAuthContextValue = {
        user: { id: 'user:owner1', name: 'Owner User', github_id: 'ownergh' } as AppUser,
      };
    });

    test('displays "Add Member" button', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.queryByText('Owner User')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Add Member/i })).toBeInTheDocument();
    });

    // Note: The "Remove" button is now inside the MoreVertIcon menu for non-owners
    // This test might need adjustment based on final UI of action menu vs direct delete button
    // For now, assuming direct delete button for simplicity of existing tests if it was there.
    // If remove is only in menu, then test for menu and then item.
    // Based on previous implementation, remove was a direct button. Let's keep that for these specific tests.
    // For "Make Owner", we will explicitly test the menu.

    test('opens AddCaseMemberDialog when "Add Member" is clicked', async () => {
        renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
        await waitFor(() => expect(screen.getByText('Owner User')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Add Member/i }));
        // Check for an element unique to AddCaseMemberDialog
        expect(await screen.findByLabelText(/Search users/i)).toBeInTheDocument();
    });
  });


  // --- NEW TESTS FOR "CHANGE CASE OWNER" ---
  describe('Change Case Owner functionality', () => {
    const ownerUser = { id: 'user:owner1', name: 'Owner User', github_id: 'ownergh' } as AppUser;
    const memberUser1 = initialMockMembers.find(m => m.id === 'user:member1')!;

    beforeEach(() => {
      mockAuthContextValue = { user: ownerUser };
    });

    test('Owner sees "More" menu for other members', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      expect(within(member1Item!).getByRole('button', { name: /actions/i })).toBeInTheDocument(); // MoreVertIcon
    });

    test('Owner sees "Make Case Owner" option in menu for non-owner members', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      fireEvent.click(within(member1Item!).getByRole('button', { name: /actions/i }));
      expect(await screen.findByText(/Make Case Owner/i)).toBeVisible();
    });

    test('"Make Case Owner" option is NOT in menu for self (owner)', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(ownerUser.name)).toBeInTheDocument());
      const ownerItem = screen.getByText(ownerUser.name).closest('li');
      // Owner should not have the "More" menu for themselves at all if only "Make Owner" is an option
      // or if they do, that option shouldn't be there.
      expect(within(ownerItem!).queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
    });

    test('Non-owner does not see "More" menu or "Make Case Owner" option', async () => {
      mockAuthContextValue = { user: { id: 'user:member1', name: 'Member One', github_id: 'member1gh' } as AppUser };
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      expect(within(member1Item!).queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
      const ownerItem = screen.getByText('Owner User').closest('li');
      expect(within(ownerItem!).queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
    });

    test('Clicking "Make Case Owner" opens confirmation dialog', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      fireEvent.click(within(member1Item!).getByRole('button', { name: /actions/i }));
      fireEvent.click(await screen.findByText(/Make Case Owner/i));
      expect(await screen.findByText(/Confirm Ownership Change/i)).toBeVisible();
      expect(screen.getByText(new RegExp(`Are you sure you want to make ${memberUser1.userName} the new case owner`))).toBeVisible();
    });

    test('Confirming "Make Case Owner" calls changeCaseOwner service and refreshes list', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      fireEvent.click(within(member1Item!).getByRole('button', { name: /actions/i }));
      fireEvent.click(await screen.findByText(/Make Case Owner/i));
      fireEvent.click(await screen.findByRole('button', { name: /Confirm Change/i }));

      await waitFor(() => {
        expect(mockChangeCaseOwner).toHaveBeenCalledWith(mockCaseId, memberUser1.id, ownerUser.id.toString());
      });
      await waitFor(() => {
        expect(mockFetchCaseMembers).toHaveBeenCalledTimes(2); // Initial + refresh
      });
      expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining(`Ownership transferred to ${memberUser1.userName}`));
    });

    test('UI updates roles and owner controls after ownership change', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());

      // Simulate the change
      mockChangeCaseOwner.mockImplementationOnce(async () => {
        // Update the mock members list that fetchCaseMembers will return on next call
        currentMockMembers = currentMockMembers.map(m => {
          if (m.id === ownerUser.id.toString()) return { ...m, roleInCase: 'member' };
          if (m.id === memberUser1.id) return { ...m, roleInCase: 'owner' };
          return m;
        });
      });

      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      fireEvent.click(within(member1Item!).getByRole('button', { name: /actions/i }));
      fireEvent.click(await screen.findByText(/Make Case Owner/i));
      fireEvent.click(await screen.findByRole('button', { name: /Confirm Change/i }));

      await waitFor(() => expect(mockFetchCaseMembers).toHaveBeenCalledTimes(2));

      // Verify original owner is now listed as "Member"
      // The text "Owner User" is still there, but their role chip should change
      const originalOwnerItem = screen.getByText(ownerUser.name).closest('li');
      expect(within(originalOwnerItem!).getByText(/Member/i)).toBeInTheDocument(); // Chip text
      expect(within(originalOwnerItem!).queryByText(/Owner/i)).not.toBeInTheDocument();


      // Verify new owner is listed as "Owner"
      const newOwnerItem = screen.getByText(memberUser1.userName).closest('li');
      expect(within(newOwnerItem!).getByText(/Owner/i)).toBeInTheDocument(); // Chip text

      // Verify original owner (now a member) does not see "Add Member" button
      expect(screen.queryByRole('button', { name: /Add Member/i })).not.toBeInTheDocument();
      // Verify original owner (now a member) does not see "More" menu on other members
      const member2Item = screen.getByText('Member Two').closest('li');
      expect(within(member2Item!).queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
    });

    test('Handles error from changeCaseOwner service call', async () => {
      mockChangeCaseOwner.mockRejectedValueOnce(new Error('Failed to change owner'));
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberUser1.userName)).toBeInTheDocument());
      const member1Item = screen.getByText(memberUser1.userName).closest('li');
      fireEvent.click(within(member1Item!).getByRole('button', { name: /actions/i }));
      fireEvent.click(await screen.findByText(/Make Case Owner/i));
      fireEvent.click(await screen.findByRole('button', { name: /Confirm Change/i }));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to change owner');
      });
      expect(mockFetchCaseMembers).toHaveBeenCalledTimes(1); // No refresh on error
    });
  });

  // Test for removing a member (from existing tests, ensure it's still valid with menu)
  describe('Remove Member via Menu (as Owner)', () => {
    const ownerUser = { id: 'user:owner1', name: 'Owner User', github_id: 'ownergh' } as AppUser;
    const memberToRemove = initialMockMembers.find(m => m.id === 'user:member1')!;

    beforeEach(() => {
      mockAuthContextValue = { user: ownerUser };
    });

    test('Owner sees "Remove Member" option in menu', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberToRemove.userName)).toBeInTheDocument());
      const memberItem = screen.getByText(memberToRemove.userName).closest('li');
      fireEvent.click(within(memberItem!).getByRole('button', { name: /actions/i }));
      expect(await screen.findByText(/Remove Member/i)).toBeVisible();
    });

    test('Clicking "Remove Member" opens confirmation, calls service, and refreshes', async () => {
      renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
      await waitFor(() => expect(screen.getByText(memberToRemove.userName)).toBeInTheDocument());
      const memberItem = screen.getByText(memberToRemove.userName).closest('li');
      fireEvent.click(within(memberItem!).getByRole('button', { name: /actions/i }));
      fireEvent.click(await screen.findByText(/Remove Member/i));

      expect(await screen.findByText(/Confirm Removal/i)).toBeVisible();
      expect(screen.getByText(new RegExp(`Are you sure you want to remove ${memberToRemove.userName}`))).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: /Remove/i })); // Confirm button in dialog

      await waitFor(() => {
        expect(mockRemoveCaseMember).toHaveBeenCalledWith(mockCaseId, memberToRemove.id);
      });
      await waitFor(() => {
        expect(mockFetchCaseMembers).toHaveBeenCalledTimes(2); // Initial + refresh
      });
      expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining(`${memberToRemove.userName} has been removed`));
    });
  });

  test('handles error when fetching members', async () => {
    mockFetchCaseMembers.mockRejectedValueOnce(new Error('Failed to fetch members'));
    renderWithAuth(<CaseMemberTab caseId={mockCaseId} />, mockAuthContextValue);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch members');
    });
    expect(mockShowError).toHaveBeenCalledWith('Failed to fetch members');
  });
});

import { within } from '@testing-library/react';
import { AuthContextType } from '@/src/contexts/AuthContext'; // Import the actual type
