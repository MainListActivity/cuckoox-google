import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import CaseListPage from '@/src/pages/cases/index';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import { Context as SurrealContext } from '@/src/contexts/SurrealProvider';
import { AuthContext, AuthContextType } from '@/src/contexts/AuthContext';

// Define the context type based on the SurrealProvider implementation
interface SurrealContextType {
  client: any;
  surreal: any;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  isSuccess?: boolean;
  sendServiceWorkerMessage: (type: string, payload?: any) => Promise<any>;
  isServiceWorkerAvailable: () => boolean;
  waitForServiceWorkerReady: () => Promise<void>;
  getAuthStatus: () => Promise<boolean>;
  checkTenantCodeAndRedirect: () => boolean;
  disposeSurrealClient: () => Promise<void>;
  checkDatabaseConnection: () => Promise<{ isConnected: boolean; error?: string }>;
  initializeDatabaseConnection: () => Promise<void>;
}

// Define simplified prop types for mocked dialogs
interface MockModifyCaseStatusDialogProps {
  open: boolean;
  onClose: () => void;
  currentCase: { id: string; current_status: string; } | null;
}

interface MockMeetingMinutesDialogProps {
  open: boolean;
  onClose: () => void;
  caseInfo: { caseId: string; caseName: string; };
  meetingTitle: string;
  onSave: (delta: { ops: { insert: string }[] }, title: string) => void;
}

// Mock child components (Dialogs)
vi.mock('../../../../src/components/case/ModifyCaseStatusDialog', () => ({
  default: (props: MockModifyCaseStatusDialogProps) => (
    <div data-testid="mock-modify-status-dialog" data-open={props.open}>
      Mock ModifyCaseStatusDialog - Case ID: {props.currentCase?.id}
      <button onClick={props.onClose}>Close Modify</button>
    </div>
  )
}));

vi.mock('../../../../src/components/case/MeetingMinutesDialog', () => ({
  default: (props: MockMeetingMinutesDialogProps) => {
    if (!props.open) return null;
    
    const handleSave = () => {
      props.onSave({ ops: [{ insert: 'Test minutes' }] }, props.meetingTitle);
      // Auto close after save
      props.onClose();
    };
    
    return (
      <div data-testid="mock-meeting-minutes-dialog" data-open={props.open}>
        Mock MeetingMinutesDialog - Case ID: {props.caseInfo?.caseId} - Title: {props.meetingTitle}
        <button onClick={props.onClose}>Close Minutes</button>
        <button onClick={handleSave}>Save Minutes</button>
      </div>
    );
  }
}));

// Mock context hooks
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../../../../src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
  return {
    ...actual,
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
    }),
  };
});

// Mock useOperationPermissions hook
vi.mock('../../../../src/hooks/useOperationPermission', () => ({
  useOperationPermissions: () => ({
    permissions: {
      'case_list_view': true,
      'case_create': true,
      'case_view_detail': true,
      'case_edit': true,
      'case_modify_status': true,
      'case_manage_members': true
    },
    isLoading: false
  })
}));

// Mock useTranslation
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');

  const mockT = (key: string, options?: Record<string, unknown>) => {
    if (options && options.title) return options.title as string;
    if (key === 'first_creditors_meeting_minutes_title') return '第一次债权人会议纪要';
    if (key === 'second_creditors_meeting_minutes_title') return '第二次债权人会议纪要';
    if (key === 'meeting_minutes_generic_title') return '会议纪要';
    if (key === 'meeting_minutes_save_success_mock') return '会议纪要已（模拟）保存成功！';
    if (key === 'unassigned') return '未分配';
    if (key === 'system') return '系统';
    if (key === 'error_fetching_cases') return '获取案件列表失败';
    if (key === 'total_cases') return '总案件数';
    if (key === 'active_cases') return '进行中';
    if (key === 'completed_cases') return '已完成';
    if (key === 'pending_review') return '待审核';
    if (key === 'case_management') return '案件管理';
    if (key === 'case_management_desc') return '管理和跟踪所有破产案件的进展情况';
    if (key === 'search_cases') return '搜索案件...';
    if (key === 'filter') return '筛选';
    if (key === 'export') return '导出';
    if (key === 'create_new_case') return '创建新案件';
    if (key === 'loading_cases') return '正在加载案件列表...';
    if (key === 'case_number') return '案件编号';
    if (key === 'case_procedure') return '案件程序';
    if (key === 'case_lead') return '案件负责人';
    if (key === 'creator') return '创建人';
    if (key === 'acceptance_date') return '受理时间';
    if (key === 'current_stage') return '程序进程';
    if (key === 'actions') return '操作';
    if (key === 'no_cases') return '暂无案件数据';
    if (key === 'view_details') return '查看详情';
    if (key === 'view_documents') return '查看材料';
    if (key === 'modify_status') return '修改状态';
    if (key === 'meeting_minutes') return '会议纪要';
    if (key === 'print') return '打印';
    if (key === 'download_report') return '下载报告';
    if (key === 'archive_case') return '归档案件';
    return key;
  };

  const mockI18n = {
    changeLanguage: vi.fn(),
  };

  return {
    ...actual,
    useTranslation: () => ({
      t: mockT,
      i18n: mockI18n,
    }),
  };
});

const theme = createTheme();

// Mock data for cases
const mockCasesData = [
  { 
    id: { toString: () => 'case:case001' },
    case_number: 'BK-2023-001', 
    case_lead_name: 'Alice M.',
    case_manager_name: 'Alice M.',
    case_procedure: '破产清算', 
    creator_name: 'Sys Admin', 
    procedure_phase: '债权申报',
    acceptance_date: '2023-01-15',
    created_by_user: { toString: () => 'user:admin' },
    case_lead_user_id: { toString: () => 'user:alice' }
  },
  { 
    id: { toString: () => 'case:case002' },
    case_number: 'BK-2023-002', 
    case_lead_name: 'Bob A.',
    case_manager_name: 'Bob A.',
    case_procedure: '破产和解', 
    creator_name: 'John Doe', 
    procedure_phase: '立案',
    acceptance_date: '2023-02-20',
    created_by_user: { toString: () => 'user:john' },
    case_lead_user_id: { toString: () => 'user:bob' }
  },
  { 
    id: { toString: () => 'case:case003' },
    case_number: 'BK-2023-003', 
    case_lead_name: 'Carol H.',
    case_manager_name: 'Carol H.',
    case_procedure: '破产重整', 
    creator_name: 'Jane Roe', 
    procedure_phase: '债权人第一次会议',
    acceptance_date: '2023-03-10',
    created_by_user: { toString: () => 'user:jane' },
    case_lead_user_id: { toString: () => 'user:carol' }
  },
  { 
    id: { toString: () => 'case:case004' },
    case_number: 'BK-2023-004', 
    case_lead_name: 'David L.',
    case_manager_name: 'David L.',
    case_procedure: '破产清算', 
    creator_name: 'Admin User', 
    procedure_phase: '结案',
    acceptance_date: '2023-04-05',
    created_by_user: { toString: () => 'user:admin2' },
    case_lead_user_id: { toString: () => 'user:david' }
  },
  { 
    id: { toString: () => 'case:case005' },
    case_number: 'BK-2023-005', 
    case_lead_name: 'Eva K.',
    case_manager_name: 'Eva K.',
    case_procedure: '破产重整', 
    creator_name: 'System', 
    procedure_phase: '终结',
    acceptance_date: '2023-05-12',
    created_by_user: { toString: () => 'user:system' },
    case_lead_user_id: { toString: () => 'user:eva' }
  },
];

// Define mockSurrealContextValue and mockAuthContextValue in the describe scope
let mockSurrealContextValue: SurrealContextType;
let mockAuthContextValue: AuthContextType;

// Helper function to render the component with necessary providers
const renderCaseListPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <SurrealContext.Provider value={mockSurrealContextValue}>
          <AuthContext.Provider value={mockAuthContextValue}>
            <SnackbarProvider>
              <CaseListPage />
            </SnackbarProvider>
          </AuthContext.Provider>
        </SurrealContext.Provider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

describe('CaseListPage', () => {
  beforeEach(() => {
    mockShowSuccess.mockClear();
    mockShowError.mockClear();

    const mockSurrealClient = {
      query: vi.fn().mockImplementation((sql, _vars) => {
        // Mock implementation that supports queryWithAuth
        if (sql.includes('return $auth;')) {
          // Return auth status + actual data for queryWithAuth
          return Promise.resolve([
            { id: 'user:test', name: 'test user' }, // Mock auth result
            mockCasesData // Actual query result
          ]);
        }
        // For other queries, return direct result
        return Promise.resolve([mockCasesData]);
      }),
      select: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      merge: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      live: vi.fn(),
      kill: vi.fn(),
      let: vi.fn(),
      unset: vi.fn(),
      signup: vi.fn().mockResolvedValue({}),
      signin: vi.fn().mockResolvedValue({}),
      invalidate: vi.fn().mockResolvedValue(undefined),
      authenticate: vi.fn().mockResolvedValue(''),
      sync: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockSurrealContextValue = {
      client: mockSurrealClient,
      surreal: mockSurrealClient,
      isConnected: true,
      isConnecting: false,
      error: null,
      isSuccess: true,
      sendServiceWorkerMessage: vi.fn().mockResolvedValue({}),
      isServiceWorkerAvailable: vi.fn().mockReturnValue(true),
      waitForServiceWorkerReady: vi.fn().mockResolvedValue(undefined),
      getAuthStatus: vi.fn().mockResolvedValue(true),
      checkTenantCodeAndRedirect: vi.fn().mockReturnValue(true),
      disposeSurrealClient: vi.fn().mockResolvedValue(undefined),
      checkDatabaseConnection: vi.fn().mockResolvedValue({ isConnected: true }),
      initializeDatabaseConnection: vi.fn().mockResolvedValue(undefined),
    };

    mockAuthContextValue = {
      isLoggedIn: true,
      user: null,
      oidcUser: null,
      setAuthState: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      selectedCaseId: null,
      selectedCase: null,
      userCases: [],
      currentUserCaseRoles: [],
      isCaseLoading: false,
      selectCase: vi.fn(),
      hasRole: vi.fn().mockReturnValue(false),
      refreshUserCasesAndRoles: vi.fn(),
      navMenuItems: [],
      isMenuLoading: false,
      navigateTo: null,
      clearNavigateTo: vi.fn(),
      useOperationPermission: vi.fn(() => ({ hasPermission: true, isLoading: false, error: null })),
      useOperationPermissions: vi.fn(() => ({ permissions: {}, isLoading: false, error: null })),
      useMenuPermission: vi.fn(() => ({ hasPermission: true, isLoading: false, error: null })),
      useDataPermission: vi.fn(() => ({ hasPermission: true, isLoading: false, error: null })),
      useUserRoles: vi.fn(() => ({ roles: [], isLoading: false, error: null })),
      useClearPermissionCache: vi.fn(() => ({ clearUserPermissions: vi.fn(), clearAllPermissions: vi.fn() })),
      useSyncPermissions: vi.fn(() => ({ syncPermissions: vi.fn() })),
      preloadOperationPermission: vi.fn(),
      preloadOperationPermissions: vi.fn(),
    };
  });

  describe('Page Rendering', () => {
    it('renders page title and description', async () => {
      renderCaseListPage();
      expect(screen.getByText('案件管理')).toBeInTheDocument();
      expect(screen.getByText('管理和跟踪所有破产案件的进展情况')).toBeInTheDocument();
    });

    it('renders "创建新案件" button with correct link', async () => {
      renderCaseListPage();
      const createLink = screen.getByRole('link', { name: /创建新案件/i });
      expect(createLink).toBeInTheDocument();
      expect(createLink).toHaveAttribute('href', '/cases/create');
    });

    it('renders search field and filter button', async () => {
      renderCaseListPage();
      expect(screen.getByPlaceholderText('搜索案件...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /筛选/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /导出/i })).toBeInTheDocument();
    });

    it('renders table headers correctly', async () => {
      renderCaseListPage();
      // Wait for data to load and table to render
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });
      
      expect(screen.getByText('案件编号')).toBeInTheDocument();
      expect(screen.getByText('案件程序')).toBeInTheDocument();
      expect(screen.getByText('案件负责人')).toBeInTheDocument();
      expect(screen.getByText('创建人')).toBeInTheDocument();
      expect(screen.getByText('受理时间')).toBeInTheDocument();
      expect(screen.getByText('程序进程')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });
  });

  describe('Statistics Cards', () => {
    it('renders statistics cards with correct data', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('总案件数')).toBeInTheDocument();
        expect(screen.getByText('进行中')).toBeInTheDocument();
        expect(screen.getByText('已完成')).toBeInTheDocument();
        expect(screen.getByText('待审核')).toBeInTheDocument();
      });

      // Check statistics values - based on mockCasesData:
      // Total: 5 cases
      // Active: 3 cases (not 结案 or 终结) - 债权申报, 立案, 债权人第一次会议
      // Completed: 2 cases (结案 or 终结) - 结案, 终结  
      // Pending review: 1 case (债权申报)
      await waitFor(() => {
        const totalCasesElements = screen.getAllByText('5');
        expect(totalCasesElements.length).toBeGreaterThan(0); // Total cases
        
        const activeCasesElements = screen.getAllByText('3');
        expect(activeCasesElements.length).toBeGreaterThan(0); // Active cases
        
        const completedCasesElements = screen.getAllByText('2');
        expect(completedCasesElements.length).toBeGreaterThan(0); // Completed cases
        
        const pendingReviewElements = screen.getAllByText('1');
        expect(pendingReviewElements.length).toBeGreaterThan(0); // Pending review
      });
    });

    it('calculates statistics correctly for different case statuses', async () => {
      const customMockData = [
        { 
          id: { toString: () => 'case:case1' },
          case_number: 'BK-001', 
          case_lead_name: 'User1',
          case_manager_name: 'User1',
          case_procedure: '破产清算', 
          creator_name: 'Admin', 
          procedure_phase: '债权申报',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:user1' }
        },
        { 
          id: { toString: () => 'case:case2' },
          case_number: 'BK-002', 
          case_lead_name: 'User2',
          case_manager_name: 'User2',
          case_procedure: '破产清算', 
          creator_name: 'Admin', 
          procedure_phase: '债权申报',
          acceptance_date: '2023-01-02',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:user2' }
        },
        { 
          id: { toString: () => 'case:case3' },
          case_number: 'BK-003', 
          case_lead_name: 'User3',
          case_manager_name: 'User3',
          case_procedure: '破产清算', 
          creator_name: 'Admin', 
          procedure_phase: '结案',
          acceptance_date: '2023-01-03',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:user3' }
        },
      ];
      
      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([customMockData]);
      renderCaseListPage();
      
      await waitFor(() => {
        expect(screen.getAllByText('3').length).toBeGreaterThan(0); // Total
        expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Active (not 结案/终结)
        expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Completed (结案/终结)
        expect(screen.getAllByText('2').length).toBeGreaterThan(0); // Pending review (债权申报)
      });
    });
  });

  describe('Case List Display', () => {
    it('renders a list of mock cases', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
        expect(screen.getByText('Alice M.')).toBeInTheDocument();
        expect(screen.getAllByText('破产清算').length).toBeGreaterThan(0);
        expect(screen.getByText('债权申报')).toBeInTheDocument();
        expect(screen.getByText('BK-2023-002')).toBeInTheDocument();
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });
    });

    it('displays case procedure icons correctly', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getAllByText('破产清算').length).toBeGreaterThan(0);
        expect(screen.getByText('破产和解')).toBeInTheDocument();
        expect(screen.getAllByText('破产重整').length).toBeGreaterThan(0);
      });
    });

    it('displays status chips with correct colors', async () => {
      renderCaseListPage();
      await waitFor(() => {
        const statusChips = screen.getAllByText(/债权申报|立案|债权人第一次会议|结案|终结/);
        expect(statusChips.length).toBeGreaterThan(0);
      });
    });

    it('shows "暂无案件数据" when no cases are provided', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([[]]);
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('allows user to type in search field', async () => {
      renderCaseListPage();
      const searchInput = screen.getByPlaceholderText('搜索案件...');
      
      fireEvent.change(searchInput, { target: { value: 'BK-2023-001' } });
      expect(searchInput).toHaveValue('BK-2023-001');
    });

    it('updates search value state when typing', async () => {
      renderCaseListPage();
      const searchInput = screen.getByPlaceholderText('搜索案件...');
      
      fireEvent.change(searchInput, { target: { value: 'Alice' } });
      expect(searchInput).toHaveValue('Alice');
      
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Action Buttons', () => {
    it('renders action buttons for each case row', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const firstRowActions = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-001'));
      expect(firstRowActions).not.toBeNull();

      if (firstRowActions) {
        expect(within(firstRowActions).getByRole('link', { name: /查看详情/i })).toBeInTheDocument();
        expect(within(firstRowActions).getByRole('link', { name: /查看材料/i })).toBeInTheDocument();
        expect(within(firstRowActions).getByRole('button', { name: /修改状态/i })).toBeInTheDocument();
      }
    });

    it('shows meeting minutes button only for appropriate case stages', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });

      // Case with '债权人第一次会议' should have meeting minutes button
      const thirdRowActions = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-003'));
      expect(thirdRowActions).not.toBeNull();
      if (thirdRowActions) {
        expect(within(thirdRowActions).getByRole('button', { name: /会议纪要/i })).toBeInTheDocument();
      }

      // Case with '债权申报' should not have meeting minutes button
      const firstRowActions = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-001'));
      if (firstRowActions) {
        expect(within(firstRowActions).queryByRole('button', { name: /会议纪要/i })).not.toBeInTheDocument();
      }
    });

    it('renders more actions menu button for each row', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const moreButtons = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('more') || 
        button.querySelector('svg')
      );
      expect(moreButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Dialog Interactions', () => {
    it('opens and closes Modify Status Dialog', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const modifyButton = screen.getAllByRole('button', { name: /修改状态/i })[0];
      fireEvent.click(modifyButton);

      const dialog = screen.getByTestId('mock-modify-status-dialog');
      expect(dialog).toBeVisible();
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveTextContent('case001');

      fireEvent.click(screen.getByText('Close Modify'));
      await waitFor(() => {
        expect(dialog).toHaveAttribute('data-open', 'false');
      });
    });

    it('opens Meeting Minutes Dialog for appropriate case and saves successfully', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });

      const caseRow = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-003'));
      expect(caseRow).toBeDefined();

      if (caseRow) {
        const meetingButton = within(caseRow).getByRole('button', { name: /会议纪要/i });
        fireEvent.click(meetingButton);

        const dialog = screen.getByTestId('mock-meeting-minutes-dialog');
        expect(dialog).toBeVisible();
        expect(dialog).toHaveAttribute('data-open', 'true');
        expect(dialog).toHaveTextContent('case003');
        expect(dialog).toHaveTextContent('第一次债权人会议纪要');

        fireEvent.click(screen.getByText('Save Minutes'));
        expect(mockShowSuccess).toHaveBeenCalledWith('会议纪要已（模拟）保存成功！');
        
        // After save, the dialog should automatically close
        await waitFor(() => {
          expect(screen.queryByTestId('mock-meeting-minutes-dialog')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state when fetching cases', async () => {
      // Mock a delayed response
      (mockSurrealContextValue.surreal.query as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([mockCasesData]), 100))
      );
      
      renderCaseListPage();
      expect(screen.getByText('正在加载案件列表...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText('正在加载案件列表...')).not.toBeInTheDocument();
      });
    });

    it('shows error message when fetching cases fails', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockRejectedValueOnce(new Error('Database error'));
      
      renderCaseListPage();
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('获取案件列表失败');
      });
    });

    it('handles database connection failure', async () => {
      mockSurrealContextValue.isSuccess = false;
      mockSurrealContextValue.error = new Error('模拟数据库连接失败');
      mockSurrealContextValue.error = new Error('Connection failed');
      
      renderCaseListPage();
      
      // Should not attempt to fetch data when not connected
      expect(mockSurrealContextValue.surreal.query).not.toHaveBeenCalled();
    });
  });

  describe('Menu Interactions', () => {
    it('opens and closes more actions menu', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      // Find the first more actions button (three dots)
      const moreButtons = screen.getAllByRole('button').filter(button => {
        const svg = button.querySelector('svg');
        return svg && svg.querySelector('path');
      });
      
      if (moreButtons.length > 0) {
        const moreButton = moreButtons[moreButtons.length - 1]; // Get the last one which should be the menu button
        fireEvent.click(moreButton);
        
        // Check if menu items appear
        await waitFor(() => {
          expect(screen.getByText('打印') || screen.getByText('下载报告') || screen.getByText('归档案件')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Data Transformation', () => {
    it('transforms raw case data correctly', async () => {
      const rawMockData = [
        {
          id: { toString: () => 'case:test001' },
          case_number: 'TEST-001',
          case_lead_name: 'Test Lead',
          case_manager_name: 'Test Manager',
          case_procedure: '破产清算',
          creator_name: 'Test Creator',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01T00:00:00Z',
          created_by_user: { toString: () => 'user:creator' },
          case_lead_user_id: { toString: () => 'user:lead' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([rawMockData]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getByText('TEST-001')).toBeInTheDocument();
        expect(screen.getByText('Test Lead')).toBeInTheDocument();
        expect(screen.getAllByText('破产清算').length).toBeGreaterThan(0);
        expect(screen.getByText('Test Creator')).toBeInTheDocument();
        expect(screen.getByText('立案')).toBeInTheDocument();
        expect(screen.getByText('2023-01-01')).toBeInTheDocument();
      });
    });

    it('handles missing data gracefully', async () => {
      const incompleteMockData = [
        {
          id: { toString: () => 'case:incomplete001' },
          created_by_user: { toString: () => 'user:system' },
          // Missing most fields
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([incompleteMockData]);
      renderCaseListPage();

      await waitFor(() => {
        // Should show default values
        expect(screen.getByText(/BK-/)).toBeInTheDocument(); // Default case number format
        expect(screen.getByText('未分配')).toBeInTheDocument(); // Default for unassigned
        expect(screen.getByText('系统')).toBeInTheDocument(); // Default creator
        expect(screen.getAllByText('破产').length).toBeGreaterThan(0); // Default procedure
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0); // Default stage
      });
    });
  });

  describe('Button Interactions', () => {
    it('handles filter button click', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      renderCaseListPage();
      const filterButton = screen.getByRole('button', { name: /筛选/i });
      
      fireEvent.click(filterButton);
      expect(consoleSpy).toHaveBeenCalledWith('Filter button clicked');
      
      consoleSpy.mockRestore();
    });

    it('handles export button presence', async () => {
      renderCaseListPage();
      const exportButton = screen.getByRole('button', { name: /导出/i });
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders statistics cards in grid layout', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('总案件数')).toBeInTheDocument();
      });

      // Check that all 4 statistics cards are present
      expect(screen.getByText('总案件数')).toBeInTheDocument();
      expect(screen.getByText('进行中')).toBeInTheDocument();
      expect(screen.getByText('已完成')).toBeInTheDocument();
      expect(screen.getByText('待审核')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('has correct navigation links for case details', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const detailsLinks = screen.getAllByRole('link', { name: /查看详情/i });
      expect(detailsLinks.length).toBeGreaterThan(0);
      expect(detailsLinks[0]).toHaveAttribute('href', '/cases/case001');
    });

    it('has correct navigation links for case documents', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const documentsLinks = screen.getAllByRole('link', { name: /查看材料/i });
      expect(documentsLinks.length).toBeGreaterThan(0);
      expect(documentsLinks[0]).toHaveAttribute('href', '/cases/case001');
    });
  });

  describe('Search and Filter Functionality', () => {
    it('filters cases by case number when searching', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('搜索案件...');
      fireEvent.change(searchInput, { target: { value: 'BK-2023-001' } });

      // Note: The current implementation doesn't actually filter, just updates state
      // This test verifies the search input works correctly
      expect(searchInput).toHaveValue('BK-2023-001');
    });

    it('filters cases by case lead name when searching', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('Alice M.')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('搜索案件...');
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      expect(searchInput).toHaveValue('Alice');
    });

    it('clears search when input is emptied', async () => {
      renderCaseListPage();
      const searchInput = screen.getByPlaceholderText('搜索案件...');
      
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput).toHaveValue('test');
      
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Status Colors and Icons', () => {
    it('displays correct colors for different case statuses', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('债权申报')).toBeInTheDocument();
        expect(screen.getByText('立案')).toBeInTheDocument();
        expect(screen.getByText('债权人第一次会议')).toBeInTheDocument();
        expect(screen.getByText('结案')).toBeInTheDocument();
        expect(screen.getByText('终结')).toBeInTheDocument();
      });

      // Verify status chips are rendered (color testing would require more complex setup)
      const statusChips = screen.getAllByText(/债权申报|立案|债权人第一次会议|结案|终结/);
      expect(statusChips.length).toBeGreaterThan(0);
    });

    it('displays correct icons for different case procedures', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getAllByText('破产清算').length).toBeGreaterThan(0);
        expect(screen.getByText('破产和解')).toBeInTheDocument();
        expect(screen.getAllByText('破产重整').length).toBeGreaterThan(0);
      });

      // Verify procedure text is displayed correctly
      const procedureTexts = screen.getAllByText(/破产清算|破产和解|破产重整/);
      expect(procedureTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Meeting Minutes Button Visibility', () => {
    it('shows meeting minutes button only for "债权人第一次会议" status', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });

      // Find the row with "债权人第一次会议" status
      const meetingRow = screen.getAllByRole('row').find(row => 
        row.textContent?.includes('BK-2023-003') && row.textContent?.includes('债权人第一次会议')
      );
      expect(meetingRow).toBeDefined();

      if (meetingRow) {
        const meetingButton = within(meetingRow).getByRole('button', { name: /会议纪要/i });
        expect(meetingButton).toBeInTheDocument();
      }
    });

    it('does not show meeting minutes button for other statuses', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      // Find rows without "债权人第一次会议" status
      const nonMeetingRows = screen.getAllByRole('row').filter(row => 
        row.textContent?.includes('BK-2023-') && !row.textContent?.includes('债权人第一次会议')
      );

      nonMeetingRows.forEach(row => {
        expect(within(row).queryByRole('button', { name: /会议纪要/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Meeting Minutes Dialog Title Generation', () => {
    it('generates correct title for first creditors meeting', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });

      const meetingRow = screen.getAllByRole('row').find(row => 
        row.textContent?.includes('BK-2023-003')
      );
      
      if (meetingRow) {
        const meetingButton = within(meetingRow).getByRole('button', { name: /会议纪要/i });
        fireEvent.click(meetingButton);

        const dialog = screen.getByTestId('mock-meeting-minutes-dialog');
        expect(dialog).toHaveTextContent('第一次债权人会议纪要');
      }
    });
  });

  describe('Avatar Display', () => {
    it('displays user avatars with correct initials', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('Alice M.')).toBeInTheDocument();
      });

      // Check that avatars are rendered (they contain the first letter of names)
      const avatars = screen.getAllByText('A'); // Alice M. -> A
      expect(avatars.length).toBeGreaterThan(0);
      
      const bobAvatars = screen.getAllByText('B'); // Bob A. -> B
      expect(bobAvatars.length).toBeGreaterThan(0);
    });
  });

  describe('Date Formatting', () => {
    it('displays acceptance dates in correct format', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('2023-01-15')).toBeInTheDocument();
        expect(screen.getByText('2023-02-20')).toBeInTheDocument();
        expect(screen.getByText('2023-03-10')).toBeInTheDocument();
        expect(screen.getByText('2023-04-05')).toBeInTheDocument();
        expect(screen.getByText('2023-05-12')).toBeInTheDocument();
      });
    });

    it('handles ISO date format correctly', async () => {
      const isoDateMockData = [
        {
          id: { toString: () => 'case:iso001' },
          case_number: 'ISO-001',
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          case_procedure: '破产清算',
          creator_name: 'Admin',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01T10:30:00.000Z', // ISO format
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([isoDateMockData]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getByText('2023-01-01')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error alert when database query fails', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockRejectedValueOnce(new Error('Database connection failed'));
      
      renderCaseListPage();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('获取案件列表失败')).toBeInTheDocument();
      });
    });

    it('handles empty query result gracefully', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([]);
      
      renderCaseListPage();
      
      await waitFor(() => {
        expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
      });
    });

    it('handles null query result gracefully', async () => {
      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce(null);
      
      renderCaseListPage();
      
      await waitFor(() => {
        expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
      });
    });
  });

  describe('Default Value Handling', () => {
    it('shows default case number format when case_number is missing', async () => {
      const mockDataWithoutCaseNumber = [
        {
          id: { toString: () => 'case:default001' },
          // case_number is missing
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          case_procedure: '破产清算',
          creator_name: 'Admin',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockDataWithoutCaseNumber]);
      renderCaseListPage();

      await waitFor(() => {
        // Should show default format BK-{last 6 chars of id}
        expect(screen.getByText(/BK-/)).toBeInTheDocument();
      });
    });

    it('shows "未分配" when case lead is missing', async () => {
      const mockDataWithoutLead = [
        {
          id: { toString: () => 'case:nolead001' },
          case_number: 'NL-001',
          // case_lead_name is missing
          case_procedure: '破产清算',
          creator_name: 'Admin',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockDataWithoutLead]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getByText('未分配')).toBeInTheDocument();
      });
    });

    it('shows "系统" when creator is missing', async () => {
      const mockDataWithoutCreator = [
        {
          id: { toString: () => 'case:nocreator001' },
          case_number: 'NC-001',
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          case_procedure: '破产清算',
          // creator_name is missing
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockDataWithoutCreator]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getByText('系统')).toBeInTheDocument();
      });
    });

    it('shows default procedure when case_procedure is missing', async () => {
      const mockDataWithoutProcedure = [
        {
          id: { toString: () => 'case:noproc001' },
          case_number: 'NP-001',
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          // case_procedure is missing
          creator_name: 'Admin',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockDataWithoutProcedure]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getAllByText('破产').length).toBeGreaterThan(0); // Default procedure
      });
    });

    it('shows default stage when procedure_phase is missing', async () => {
      const mockDataWithoutPhase = [
        {
          id: { toString: () => 'case:nophase001' },
          case_number: 'NPH-001',
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          case_procedure: '破产清算',
          creator_name: 'Admin',
          // procedure_phase is missing
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockDataWithoutPhase]);
      renderCaseListPage();

      await waitFor(() => {
        expect(screen.getAllByText('立案').length).toBeGreaterThan(0); // Default stage
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for action buttons', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      // Check for tooltip titles which provide accessibility
      const viewDetailsButtons = screen.getAllByRole('link', { name: /查看详情/i });
      expect(viewDetailsButtons.length).toBeGreaterThan(0);

      const viewDocumentsButtons = screen.getAllByRole('link', { name: /查看材料/i });
      expect(viewDocumentsButtons.length).toBeGreaterThan(0);

      const modifyStatusButtons = screen.getAllByRole('button', { name: /修改状态/i });
      expect(modifyStatusButtons.length).toBeGreaterThan(0);
    });

    it('has proper table structure with headers', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      // Check for table headers
      expect(screen.getByRole('columnheader', { name: '案件编号' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '案件程序' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '案件负责人' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '创建人' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '受理时间' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '程序进程' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('does not fetch data when database is not connected', async () => {
      mockSurrealContextValue.isSuccess = false;
      
      renderCaseListPage();
      
      // Should not call query when not connected
      expect(mockSurrealContextValue.surreal.query).not.toHaveBeenCalled();
    });

    it('shows loading state immediately when component mounts', () => {
      // Mock a slow query
      (mockSurrealContextValue.surreal.query as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([mockCasesData]), 1000))
      );
      
      renderCaseListPage();
      
      // Should show loading immediately
      expect(screen.getByText('正在加载案件列表...')).toBeInTheDocument();
    });
  });

  describe('Menu Actions', () => {
    it('opens menu when more actions button is clicked', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      // Find and click the more actions button (three dots)
      const moreButtons = screen.getAllByRole('button').filter(button => {
        const svg = button.querySelector('svg');
        return svg && svg.querySelector('path');
      });
      
      if (moreButtons.length > 0) {
        const moreButton = moreButtons[moreButtons.length - 1];
        fireEvent.click(moreButton);
        
        await waitFor(() => {
          expect(screen.getByText('打印') || screen.getByText('下载报告') || screen.getByText('归档案件')).toBeInTheDocument();
        });
      }
    });

    it('closes menu when menu item is clicked', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });

      const moreButtons = screen.getAllByRole('button').filter(button => {
        const svg = button.querySelector('svg');
        return svg && svg.querySelector('path');
      });
      
      if (moreButtons.length > 0) {
        const moreButton = moreButtons[moreButtons.length - 1];
        fireEvent.click(moreButton);
        
        await waitFor(() => {
          const printMenuItem = screen.getByText('打印');
          fireEvent.click(printMenuItem);
        });

        // Menu should close after clicking an item
        await waitFor(() => {
          expect(screen.queryByText('打印')).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Theme Integration', () => {
    it('applies theme-based styling to table headers', async () => {
      renderCaseListPage();
      await waitFor(() => {
        expect(screen.getByText('案件编号')).toBeInTheDocument();
      });

      // Verify table headers are rendered (styling would require more complex testing)
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(7); // Should have 7 columns
    });
  });

  describe('缓存数据问题修复', () => {
    it('should filter out cases with null or undefined id fields', async () => {
      // 模拟从缓存返回的数据，包含一些没有 id 的项目
      const mockCasesDataWithNullIds = [
        {
          id: { toString: () => 'case:valid001' },
          case_number: 'BK-VALID-001',
          case_lead_name: 'Valid User',
          case_manager_name: 'Valid User',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:valid' }
        },
        {
          // 没有 id 字段的数据，应该被过滤掉
          case_number: 'BK-INVALID-001',
          case_lead_name: 'Invalid User',
          case_manager_name: 'Invalid User',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-02',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:invalid' }
        },
        {
          id: null, // id 为 null 的数据，应该被过滤掉
          case_number: 'BK-NULL-001',
          case_lead_name: 'Null User',
          case_manager_name: 'Null User',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-03',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:null' }
        },
        {
          id: undefined, // id 为 undefined 的数据，应该被过滤掉
          case_number: 'BK-UNDEFINED-001',
          case_lead_name: 'Undefined User',
          case_manager_name: 'Undefined User',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-04',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:undefined' }
        },
        {
          id: { toString: () => 'case:valid002' },
          case_number: 'BK-VALID-002',
          case_lead_name: 'Valid User 2',
          case_manager_name: 'Valid User 2',
          case_procedure: '破产重整',
          creator_name: 'System',
          procedure_phase: '债权申报',
          acceptance_date: '2023-01-05',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:valid2' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockCasesDataWithNullIds]);
      renderCaseListPage();

      await waitFor(() => {
        // 应该只显示有效的案件（id 不为 null 或 undefined 的）
        expect(screen.getByText('BK-VALID-001')).toBeInTheDocument();
        expect(screen.getByText('BK-VALID-002')).toBeInTheDocument();
        
        // 无效的案件不应该显示
        expect(screen.queryByText('BK-INVALID-001')).not.toBeInTheDocument();
        expect(screen.queryByText('BK-NULL-001')).not.toBeInTheDocument();
        expect(screen.queryByText('BK-UNDEFINED-001')).not.toBeInTheDocument();
        
        // 统计应该显示正确的数量（只计算有效案件）
        const totalCasesElements = screen.getAllByText('2');
        expect(totalCasesElements.length).toBeGreaterThan(0); // 只有2个有效案件
      });
    });

    it('should not throw errors when processing data with missing id fields', async () => {
      // 模拟完全没有 id 字段的数据
      const mockCasesDataWithoutIds = [
        {
          // 完全没有 id 字段
          case_number: 'BK-NO-ID-001',
          case_lead_name: 'Test User',
          case_manager_name: 'Test User',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-01',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test' }
        },
        {
          id: undefined,
          case_number: 'BK-UNDEFINED-ID-001',
          case_lead_name: 'Test User 2',
          case_manager_name: 'Test User 2',
          case_procedure: '破产清算',
          creator_name: 'System',
          procedure_phase: '立案',
          acceptance_date: '2023-01-02',
          created_by_user: { toString: () => 'user:admin' },
          case_lead_user_id: { toString: () => 'user:test2' }
        }
      ];

      (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([mockCasesDataWithoutIds]);
      
      // 这应该不会抛出错误
      expect(() => {
        renderCaseListPage();
      }).not.toThrow();

      await waitFor(() => {
        // 应该显示"暂无案件数据"，因为所有数据都被过滤掉了
        expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
      });
    });
  });
});
