import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import CaseListPage from '@/src/pages/cases/index';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import { Context as SurrealContext } from '@/src/contexts/SurrealProvider';
import type Surreal from 'surrealdb';

// Define the context type based on the SurrealProvider implementation
interface SurrealContextType {
  surreal: Surreal;
  isConnecting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  signin: (auth: unknown) => Promise<any>;
  signout: () => Promise<void>;
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
  default: (props: MockModifyCaseStatusDialogProps) => ( // MODIFIED
    <div data-testid="mock-modify-status-dialog" data-open={props.open}>
      Mock ModifyCaseStatusDialog - Case ID: {props.currentCase?.id}
      <button onClick={props.onClose}>Close Modify</button>
    </div>
  )
}));

vi.mock('../../../../src/components/case/MeetingMinutesDialog', () => ({
  default: (props: MockMeetingMinutesDialogProps) => ( // MODIFIED
    <div data-testid="mock-meeting-minutes-dialog" data-open={props.open}>
      Mock MeetingMinutesDialog - Case ID: {props.caseInfo?.caseId} - Title: {props.meetingTitle}
      <button onClick={props.onClose}>Close Minutes</button>
      <button onClick={() => props.onSave({ ops: [{ insert: 'Test minutes' }] }, props.meetingTitle)}>Save Minutes</button>
    </div>
  )
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

// Mock useTranslation
vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');

  const mockT = (key: string, options?: Record<string, unknown>) => { // MODIFIED
    if (options && options.title) return options.title as string; // Ensure title is treated as string
    if (key === 'first_creditors_meeting_minutes_title') return '第一次债权人会议纪要';
    if (key === 'second_creditors_meeting_minutes_title') return '第二次债权人会议纪要';
    if (key === 'meeting_minutes_generic_title') return '会议纪要';
    if (key === 'meeting_minutes_save_success_mock') return '会议纪要已（模拟）保存成功！';
    // Add other specific key translations from your existing mock
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
    return key; // Default fallback
  };

  const mockI18n = {
    changeLanguage: vi.fn(),
    // Add any other i18n properties your component might rely on,
    // ensuring they are stable references if necessary.
  };

  return {
    ...actual,
    useTranslation: () => ({
      t: mockT, // Use the stable mockT
      i18n: mockI18n, // Use the stable mockI18n
    }),
  };
});


const theme = createTheme();

// Mock data for cases, similar to the one in the component
const mockCasesData = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice M.', case_procedure: '破产清算', creator_name: 'Sys Admin', current_stage: '债权申报' as const, acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob A.', case_procedure: '破产和解', creator_name: 'John Doe', current_stage: '立案' as const, acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol H.', case_procedure: '破产重整', creator_name: 'Jane Roe', current_stage: '债权人第一次会议' as const, acceptance_date: '2023-03-10' },
];

// Define mockSurrealContextValue in the describe scope
let mockSurrealContextValue: SurrealContextType;

// Helper function to render the component with necessary providers
const renderCaseListPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        {/* Ensure mockSurrealContextValue is fully typed or cast correctly at the point of use */}
        <SurrealContext.Provider value={mockSurrealContextValue as SurrealContextType}>
          <SnackbarProvider>
            <CaseListPage />
          </SnackbarProvider>
        </SurrealContext.Provider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

describe('CaseListPage', () => {
  beforeEach(() => {
    mockShowSuccess.mockClear();
    mockShowError.mockClear();

    mockSurrealContextValue = {
      surreal: {
        query: vi.fn().mockResolvedValue([mockCasesData]),
        select: vi.fn().mockResolvedValue([]), // Add mock for select
        create: vi.fn().mockResolvedValue({}),  // Add mock for create
        update: vi.fn().mockResolvedValue({}),  // Add mock for update
        merge: vi.fn().mockResolvedValue({}),   // Add mock for merge
        delete: vi.fn().mockResolvedValue({}),  // Add mock for delete
        live: vi.fn(),   // Mock other methods if potentially called, even if not directly by CaseListPage
        kill: vi.fn(),
        let: vi.fn(),
        unset: vi.fn(),
        signup: vi.fn().mockResolvedValue({}),
        signin: vi.fn().mockResolvedValue({}), // Ensure this matches the context type
        invalidate: vi.fn().mockResolvedValue(undefined),
        authenticate: vi.fn().mockResolvedValue(''),
        sync: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        // Ensure all methods expected by Surreal type are here or use a more robust mock for Surreal class
      } as unknown as Surreal, // Cast to Surreal, assuming all necessary methods are mocked
      isConnecting: false,
      isSuccess: true,
      isError: false,
      error: null,
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signin: vi.fn().mockResolvedValue({}), // Matches updated SurrealContextType
      signout: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders page title "案件列表"', () => {
    renderCaseListPage();
    expect(screen.getByText('案件列表', { selector: 'h1' })).toBeInTheDocument();
  });

  it('renders "创建新案件" button', () => {
    renderCaseListPage();
    const createLink = screen.getByRole('link', { name: /创建新案件/i });
    expect(createLink).toBeInTheDocument();
    expect(createLink).toHaveAttribute('href', '/cases/create');
  });

  it('renders search field and filter button', () => {
    renderCaseListPage();
    expect(screen.getByPlaceholderText('搜索案件...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /筛选/i })).toBeInTheDocument();
  });

  it('renders table headers correctly', () => {
    renderCaseListPage();
    expect(screen.getByText('案件编号')).toBeInTheDocument();
    expect(screen.getByText('案件程序')).toBeInTheDocument();
    expect(screen.getByText('案件负责人')).toBeInTheDocument();
    // ... add other headers
    expect(screen.getByText('程序进程')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('renders a list of mock cases', async () => { // Made async
    renderCaseListPage();
    // Data is fetched via mocked query, so need to wait for it.
    await waitFor(() => {
      expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      // The mockCasesData has case_lead_name, not case_lead_name like 'Alice Manager'. Assuming component displays 'case_lead_name'.
      expect(screen.getByText('Alice M.')).toBeInTheDocument();
      expect(screen.getByText('破产清算')).toBeInTheDocument();
      expect(screen.getByText('债权申报')).toBeInTheDocument();
      expect(screen.getByText('BK-2023-002')).toBeInTheDocument();
    });
  });

  it('renders action buttons for each case row', async () => { // Made async
    renderCaseListPage();
    await waitFor(() => { // Wait for cases to render
      expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
    });
    // For the first case (BK-2023-001)
    const firstRowActions = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-001'));
    expect(firstRowActions).not.toBeNull();

    if (firstRowActions) {
      expect(within(firstRowActions).getByRole('link', { name: /查看详情/i })).toBeInTheDocument();
      expect(within(firstRowActions).getByRole('link', { name: /查看材料/i })).toBeInTheDocument();
      expect(within(firstRowActions).getByRole('button', { name: /修改状态/i })).toBeInTheDocument();
      // Meeting minutes button is conditional, BK-2023-001 is '债权申报', so no button
      expect(within(firstRowActions).queryByRole('button', { name: /会议纪要/i })).not.toBeInTheDocument();
    }
    
    // For the third case (BK-2023-003) which is '债权人第一次会议'
    const thirdRowActions = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-003'));
    expect(thirdRowActions).not.toBeNull();
    if (thirdRowActions) {
        expect(within(thirdRowActions).getByRole('button', { name: /会议纪要/i })).toBeInTheDocument();
    }
  });
  
  it('shows "暂无案件数据" when no cases are provided', async () => { // Made async
    // Override the default query mock for this specific test
    (mockSurrealContextValue.surreal.query as Mock).mockResolvedValueOnce([[]]); // Return empty array
    renderCaseListPage();
    await waitFor(() => {
      expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
    });
  });

  describe('Dialog Interactions', () => {
    it('Modify Status Dialog opens and closes', async () => { // Made async
      renderCaseListPage();
      await waitFor(() => { // Wait for cases to render
        expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
      });
      const modifyButton = screen.getAllByRole('button', { name: /修改状态/i })[0]; // Get first modify button
      fireEvent.click(modifyButton);

      const dialog = screen.getByTestId('mock-modify-status-dialog');
      expect(dialog).toBeVisible();
      expect(dialog).toHaveAttribute('data-open', 'true');
      expect(dialog).toHaveTextContent('case001'); // Check if correct case id is passed

      fireEvent.click(screen.getByText('Close Modify'));
      // Use waitFor to handle potential async state updates or animations for dialog closing
      waitFor(() => {
         expect(dialog).toHaveAttribute('data-open', 'false');
      });
    });

    it('Meeting Minutes Dialog opens, saves, and closes for appropriate case', async () => { // Made async
      renderCaseListPage();
      await waitFor(() => { // Wait for cases to render
        expect(screen.getByText('BK-2023-003')).toBeInTheDocument();
      });
      // Find the row for 'BK-2023-003' which should have the meeting minutes button
      const caseRow = screen.getAllByRole('row').find(row => row.textContent?.includes('BK-2023-003'));
      expect(caseRow).toBeDefined();

      if (caseRow) {
        const meetingButton = within(caseRow).getByRole('button', { name: /会议纪要/i });
        fireEvent.click(meetingButton);

        const dialog = screen.getByTestId('mock-meeting-minutes-dialog');
        expect(dialog).toBeVisible();
        expect(dialog).toHaveAttribute('data-open', 'true');
        expect(dialog).toHaveTextContent('case003'); // Check caseId
        expect(dialog).toHaveTextContent('第一次债权人会议纪要'); // Check title based on mocked t function

        fireEvent.click(screen.getByText('Save Minutes'));
        expect(mockShowSuccess).toHaveBeenCalledWith('会议纪要已（模拟）保存成功！');
        
        waitFor(() => {
           expect(dialog).toHaveAttribute('data-open', 'false');
        });
      }
    });
  });
});
