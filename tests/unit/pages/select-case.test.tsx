// tests/unit/pages/select-case.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CaseSelectionPage from '@/src/pages/select-case';
import { AuthContext, AuthContextType, AppUser, Case } from '@/src/contexts/AuthContext';
import { SurrealContext, SurrealContextType } from '@/src/contexts/SurrealProvider';
import { SnackbarContext, SnackbarContextType } from '@/src/contexts/SnackbarContext';
import { RecordId } from 'surrealdb';

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'case_selection_welcome') return `Welcome, ${options.name}`;
      if (key === 'copyright_platform') return `Copyright ${options.year}`;
      if (key === 'case_selection_title') return 'Select a Case';
      if (key === 'case_selection_subtitle') return 'Please choose a case to continue.';
      if (key === 'loading_cases') return 'Loading cases...';
      if (key === 'case_selection_no_cases') return 'You have not been assigned to any cases.';
      if (key === 'error_loading_cases') return 'Failed to load case list.';
      if (key === 'error_selecting_case') return 'Failed to select case.';
      if (key === 'case_card_case_number_label') return 'Case Number:';
      if (key === 'case_card_procedure_label') return 'Procedure:';
      if (key === 'case_card_phase_label') return 'Phase:';
      if (key === 'case_card_manager_label') return 'Manager:';
      if (key === 'case_card_acceptance_date_label') return 'Acceptance Date:';
      if (key === 'button_select_case') return 'Select This Case';
      return key;
    },
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null, pathname: '/select-case' }),
}));

const mockUser: AppUser = {
  id: 'user:testUser' as unknown as RecordId, // Casting for simplicity
  name: 'Test User',
  github_id: 'testUser123',
};

const mockCases: Case[] = [
  {
    id: 'case:case1' as unknown as RecordId,
    name: 'Case Alpha',
    case_number: 'C-001',
    // @ts-ignore // Mocking additional properties for test completeness
    case_procedure: '破产清算',
    procedure_phase: '立案',
    acceptance_date: '2023-01-01',
    case_manager_name: 'Manager A'
  },
  {
    id: 'case:case2' as unknown as RecordId,
    name: 'Case Beta',
    case_number: 'C-002',
    // @ts-ignore
    case_procedure: '破产重整',
    procedure_phase: '债权申报',
    acceptance_date: '2023-02-01',
    case_manager_name: 'Manager B'
  },
];

// Default mock context values
let mockAuthContextValue: AuthContextType;
let mockSurrealContextValue: SurrealContextType;
let mockSnackbarContextValue: SnackbarContextType;

// Utility function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/select-case']}>
      <AuthContext.Provider value={mockAuthContextValue}>
        <SurrealContext.Provider value={mockSurrealContextValue}>
          <SnackbarContext.Provider value={mockSnackbarContextValue}>
            <Routes>
              <Route path="/select-case" element={ui} />
              <Route path="/login" element={<div>Login Page Mock</div>} />
              <Route path="/dashboard" element={<div>Dashboard Page Mock</div>} />
            </Routes>
          </SnackbarContext.Provider>
        </SurrealContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('CaseSelectionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContextValue = {
      user: mockUser,
      selectCase: jest.fn().mockResolvedValue(undefined),
      selectedCaseId: null,
      isLoading: false, // Auth loading, not case loading
      isCaseLoading: false, // Specific to case loading within AuthContext
      isLoggedIn: true,
      refreshUserCasesAndRoles: jest.fn().mockResolvedValue(undefined),
      hasRole: jest.fn().mockReturnValue(false),
      navMenuItems: [],
      isMenuLoading: false,
      logout: jest.fn(),
      setAuthState: jest.fn(),
      oidcUser: null,
      userCases: [], // Initially empty, will be populated by Surreal mock
      currentUserCaseRoles: [],
    } as unknown as AuthContextType;

    mockSurrealContextValue = {
      surreal: {
        query: jest.fn().mockImplementation((query) => {
          // This mock simulates the query made by CaseSelectionPage to fetch cases
          // It should return an array, where the first element is the array of results
          if (query.includes('SELECT id, name, case_number, case_procedure, procedure_phase, acceptance_date, case_manager_name FROM case WHERE id IN')) {
            return Promise.resolve([mockCases]); // Simulate successful case data fetch
          }
          // This mock simulates the query made by CaseSelectionPage to fetch user_case_role
           if (query.includes('FROM user_case_role WHERE user_id =')) {
            return Promise.resolve([mockCases.map(c => ({ case_id: c.id.toString() }))]);
          }
          return Promise.resolve([[]]); // Default empty result
        }),
        select: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        merge: jest.fn(),
        delete: jest.fn(),
        live: jest.fn(),
        kill: jest.fn(),
        let: jest.fn(),
        unset: jest.fn(),
        signup: jest.fn(),
        signin: jest.fn(),
        invalidate: jest.fn(),
        authenticate: jest.fn(),
        sync: jest.fn(),
        close: jest.fn(),
      },
      isConnected: true,
      isLoading: false, // Surreal client general loading
      error: null,
      dbInfo: null,
      connect: jest.fn(),
      signout: jest.fn(),
    } as unknown as SurrealContextType;

    mockSnackbarContextValue = {
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn(),
      showWarning: jest.fn(),
    };
  });

  test('renders loading state initially when AuthContext isLoading is true', () => {
    mockAuthContextValue.isLoading = true; // Simulate initial auth loading
    renderWithProviders(<CaseSelectionPage />);
    // The component has its own isLoadingCases state, this test targets AuthContext's loading
    expect(screen.getByText('Loading cases...')).toBeInTheDocument();
  });

  test('renders loading state initially when internal isLoadingCases is true', () => {
    // This requires mocking useState within the component or relying on initial state
    // For simplicity, we assume initial state is true for isLoadingCases
    renderWithProviders(<CaseSelectionPage />);
    expect(screen.getByText('Loading cases...')).toBeInTheDocument();
  });

  test('renders no cases available message', async () => {
    mockSurrealContextValue.surreal.query = jest.fn()
        .mockResolvedValueOnce([[]]) // For user_case_role query
        .mockResolvedValueOnce([[]]); // For case details query
    renderWithProviders(<CaseSelectionPage />);
    await waitFor(() => {
      expect(screen.getByText('You have not been assigned to any cases.')).toBeInTheDocument();
    });
  });

  test('handles error when fetching user_case_role', async () => {
    mockSurrealContextValue.surreal.query = jest.fn().mockRejectedValueOnce(new Error('DB Error fetching user_case_role'));
    renderWithProviders(<CaseSelectionPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load case list.')).toBeInTheDocument();
      expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('Failed to load case list.');
    });
  });

  test('handles error when fetching case details', async () => {
    // First query for user_case_role succeeds
    mockSurrealContextValue.surreal.query = jest.fn()
        .mockResolvedValueOnce([mockCases.map(c => ({ case_id: c.id.toString() }))]) // user_case_role
        .mockRejectedValueOnce(new Error('DB Error fetching case details')); // case details
    renderWithProviders(<CaseSelectionPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load case list.')).toBeInTheDocument();
      expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('Failed to load case list.');
    });
  });

  test('displays cases and allows selection', async () => {
    renderWithProviders(<CaseSelectionPage />);

    await waitFor(() => {
      expect(screen.getByText('Case Alpha')).toBeInTheDocument();
      expect(screen.getByText('C-001')).toBeInTheDocument();
      expect(screen.getByText('Case Beta')).toBeInTheDocument();
      expect(screen.getByText('C-002')).toBeInTheDocument();
    });

    // Find the button within the card for "Case Alpha"
    const caseAlphaCard = screen.getByText('Case Alpha').closest('div.MuiPaper-root');
    const selectButton = within(caseAlphaCard!).getByText('Select This Case');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(mockAuthContextValue.selectCase).toHaveBeenCalledWith(mockCases[0].id.toString());
      // refreshUserCasesAndRoles is called internally by selectCase in this version of AuthContext
      // So we don't need to check it here explicitly unless selectCase mock is more detailed
      // expect(mockAuthContextValue.refreshUserCasesAndRoles).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  test('redirects to login if not logged in', () => {
    mockAuthContextValue.isLoggedIn = false;
    mockAuthContextValue.user = null;
    renderWithProviders(<CaseSelectionPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  test('highlights selected case', async () => {
    mockAuthContextValue.selectedCaseId = mockCases[1].id.toString(); // Case Beta is selected
    renderWithProviders(<CaseSelectionPage />);

    await waitFor(() => {
      expect(screen.getByText('Case Alpha')).toBeInTheDocument();
      expect(screen.getByText('Case Beta')).toBeInTheDocument();
    });

    const caseBetaCard = screen.getByText('Case Beta').closest('div.MuiPaper-root');
    expect(caseBetaCard).toBeInTheDocument();

    // Check for the icon within this specific card
    const checkIcon = within(caseBetaCard!).getByTestId('selected-check-icon');
    expect(checkIcon).toBeInTheDocument();

    // Also check that the other case is NOT highlighted
    const caseAlphaCard = screen.getByText('Case Alpha').closest('div.MuiPaper-root');
    expect(caseAlphaCard).toBeInTheDocument();
    expect(within(caseAlphaCard!).queryByTestId('selected-check-icon')).not.toBeInTheDocument();
  });

  test('handles case selection failure', async () => {
    mockAuthContextValue.selectCase = jest.fn().mockRejectedValue(new Error('Selection Failed'));
    renderWithProviders(<CaseSelectionPage />);

    await waitFor(() => {
      expect(screen.getByText('Case Alpha')).toBeInTheDocument();
    });

    const caseAlphaCard = screen.getByText('Case Alpha').closest('div.MuiPaper-root');
    const selectButton = within(caseAlphaCard!).getByText('Select This Case');
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('Failed to select case.');
    });
  });

});
