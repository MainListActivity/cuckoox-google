import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import CaseMemberManagementPage from '@/src/pages/case-members/index';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({
    client: {
      query: vi.fn().mockResolvedValue([]),
    },
    isConnected: true,
  }),
}));

vi.mock('@/src/hooks/useOperationPermission', () => ({
  useOperationPermissions: () => ({
    permissions: {
      'case_manage_members': true,
      'case_member_list_view': true,
      'case_member_add': true,
      'case_member_remove': true,
      'case_member_change_owner': true,
    },
    isLoading: false,
  }),
}));

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    selectedCaseId: 'case-123',
    user: { id: 'user-123' },
  }),
}));

vi.mock('@/src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

vi.mock('@/src/components/case/CaseMemberTab', () => ({
  default: function MockCaseMemberTab({ caseId }: { caseId: string }) {
    return <div data-testid="case-member-tab">Case Member Tab for {caseId}</div>;
  },
}));


const theme = createTheme();

const MockWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </MemoryRouter>
);

describe('CaseMemberManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title correctly', async () => {
    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    expect(screen.getByText('案件成员管理')).toBeInTheDocument();
  });

  it('should render case member tab component', async () => {
    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    expect(screen.getByTestId('case-member-tab')).toBeInTheDocument();
    expect(screen.getByText(/Case Member Tab for case-123/)).toBeInTheDocument();
  });

  it('should show error when no case is selected', async () => {
    // Mock no selected case
    vi.mocked(require('@/src/contexts/AuthContext').useAuth).mockReturnValue({
      selectedCaseId: null,
      user: { id: 'user-123' },
    });

    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    expect(screen.getByText('请先选择一个案件。')).toBeInTheDocument();
  });

  it('should show permission error when user lacks permissions', async () => {
    // Mock no permissions
    vi.mocked(require('@/src/hooks/useOperationPermission').useOperationPermissions).mockReturnValue({
      permissions: {
        'case_manage_members': false,
        'case_member_list_view': false,
        'case_member_add': false,
        'case_member_remove': false,
        'case_member_change_owner': false,
      },
      isLoading: false,
    });

    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    expect(screen.getByText('您没有权限访问此功能')).toBeInTheDocument();
  });

  it('should render mobile layout when on mobile device', async () => {
    // Mock mobile device
    vi.mocked(require('@/src/hooks/useResponsiveLayout').useResponsiveLayout).mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });

    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    // Should render mobile optimized layout
    expect(screen.getByText('案件成员管理')).toBeInTheDocument();
    expect(screen.getByTestId('case-member-tab')).toBeInTheDocument();
  });

  it('should show loading state when permissions are loading', async () => {
    // Mock loading permissions
    vi.mocked(require('@/src/hooks/useOperationPermission').useOperationPermissions).mockReturnValue({
      permissions: {},
      isLoading: true,
    });

    render(
      <MockWrapper>
        <CaseMemberManagementPage />
      </MockWrapper>
    );

    // Should show skeleton loading
    expect(document.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
  });
});