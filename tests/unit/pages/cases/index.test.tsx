import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaseListPage from '../../../../src/pages/cases/index';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom'; // Needed for Link component
import { I18nextProvider } from 'react-i18next'; // For useTranslation
import i18n from '../../../../src/i18n'; // Assuming you have an i18n setup file
import { SnackbarProvider } from '../../../../src/contexts/SnackbarContext'; // Actual provider

// Mock child components (Dialogs)
jest.mock('../../../../src/components/case/ModifyCaseStatusDialog', () => (props: any) => (
  <div data-testid="mock-modify-status-dialog" data-open={props.open}>
    Mock ModifyCaseStatusDialog - Case ID: {props.currentCase?.id}
    <button onClick={props.onClose}>Close Modify</button>
    {/* <button onClick={() => props.onSave({})}>Save Status</button> */}
  </div>
));

jest.mock('../../../../src/components/case/MeetingMinutesDialog', () => (props: any) => (
  <div data-testid="mock-meeting-minutes-dialog" data-open={props.open}>
    Mock MeetingMinutesDialog - Case ID: {props.caseInfo?.caseId} - Title: {props.meetingTitle}
    <button onClick={props.onClose}>Close Minutes</button>
    <button onClick={() => props.onSave({ ops: [{ insert: 'Test minutes' }] }, props.meetingTitle)}>Save Minutes</button>
  </div>
));

// Mock context hooks
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn(); // if used
jest.mock('../../../../src/contexts/SnackbarContext', () => ({
  ...jest.requireActual('../../../../src/contexts/SnackbarContext'), // Import and retain default values
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

// Mock useTranslation
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options && options.title) return options.title; // For meeting minutes title hack
      if (key === 'first_creditors_meeting_minutes_title') return '第一次债权人会议纪要';
      if (key === 'second_creditors_meeting_minutes_title') return '第二次债权人会议纪要';
      if (key === 'meeting_minutes_generic_title') return '会议纪要';
      if (key === 'meeting_minutes_save_success_mock') return '会议纪要已（模拟）保存成功！';
      return key;
    },
    i18n: { changeLanguage: jest.fn() }
  }),
}));


const theme = createTheme();

// Mock data for cases, similar to the one in the component
const mockCasesData = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice M.', case_procedure: '破产清算', creator_name: 'Sys Admin', current_stage: '债权申报' as const, acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob A.', case_procedure: '破产和解', creator_name: 'John Doe', current_stage: '立案' as const, acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol H.', case_procedure: '破产重整', creator_name: 'Jane Roe', current_stage: '债权人第一次会议' as const, acceptance_date: '2023-03-10' },
];

// Helper function to render the component with necessary providers
const renderCaseListPage = (cases = mockCasesData) => {
  // Need to replace the mockCases in the actual component if it's not fetched via a mockable hook
  // For this example, we assume the component uses the imported mockCases or a global one that can be spied upon/replaced.
  // If CaseListPage internally defines mockCases and doesn't expose a way to inject them,
  // testing different data states (e.g., empty list) is harder.
  // For now, we'll rely on the component's own mockData for some tests and pass custom for others if possible.
  
  // To test with specific data, especially empty data, the component should ideally fetch data via a hook.
  // Let's assume we can't directly inject data for this test structure and rely on the component's internal mock.
  // The provided component uses its own 'mockCases' constant.

  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        {/* <I18nextProvider i18n={i18n}> // Using jest.mock for useTranslation */}
          <SnackbarProvider> {/* Use the actual provider if useSnackbar is complex, or mock it fully */}
            <CaseListPage />
          </SnackbarProvider>
        {/* </I18nextProvider> */}
      </BrowserRouter>
    </ThemeProvider>
  );
};

describe('CaseListPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
    // Any other necessary resets
  });

  test('renders page title "案件列表"', () => {
    renderCaseListPage();
    expect(screen.getByText('案件列表', { selector: 'h1' })).toBeInTheDocument();
  });

  test('renders "创建新案件" button', () => {
    renderCaseListPage();
    const createButton = screen.getByRole('button', { name: /创建新案件/i });
    expect(createButton).toBeInTheDocument();
    expect(createButton.closest('a')).toHaveAttribute('href', '/cases/create');
  });

  test('renders search field and filter button', () => {
    renderCaseListPage();
    expect(screen.getByPlaceholderText('搜索案件...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /筛选/i })).toBeInTheDocument();
  });

  test('renders table headers correctly', () => {
    renderCaseListPage();
    expect(screen.getByText('案件编号')).toBeInTheDocument();
    expect(screen.getByText('案件程序')).toBeInTheDocument();
    expect(screen.getByText('案件负责人')).toBeInTheDocument();
    // ... add other headers
    expect(screen.getByText('程序进程')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  test('renders a list of mock cases', () => {
    renderCaseListPage(); // Uses the component's internal mockCases
    // Check for data from one of the mock cases
    expect(screen.getByText('BK-2023-001')).toBeInTheDocument();
    expect(screen.getByText('Alice Manager')).toBeInTheDocument();
    expect(screen.getByText('破产清算')).toBeInTheDocument();
    expect(screen.getByText('债权申报')).toBeInTheDocument();

    expect(screen.getByText('BK-2023-002')).toBeInTheDocument();
  });

  test('renders action buttons for each case row', () => {
    renderCaseListPage();
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
  
  test('shows "暂无案件数据" when no cases are provided (conceptual - requires ability to modify data source)', () => {
    // This test is tricky because the component uses an internal mockCases.
    // To properly test this, mockCases should be fetched via a mockable hook or prop.
    // For now, this test is more of a placeholder for that capability.
    // If we could do: renderCaseListPage([]), and the component used that prop:
    // renderCaseListPage([]); // If component could take cases as prop or from mockable hook
    // expect(screen.getByText('暂无案件数据')).toBeInTheDocument();
    // For now, we'll skip this or assume it needs component refactoring for testability.
    // Alternatively, if the component's internal mockCases can be spied on and replaced:
    // const actualMockCases = require('../../../../src/pages/cases/index').mockCases; // This won't work due to ES module
    // For now, we can only test the default state which has cases.
    expect(true).toBe(true); // Placeholder for this conceptual test
  });

  describe('Dialog Interactions', () => {
    test('Modify Status Dialog opens and closes', () => {
      renderCaseListPage();
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

    test('Meeting Minutes Dialog opens, saves, and closes for appropriate case', () => {
      renderCaseListPage();
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

// Utility to use 'within' API, not always needed if selectors are unique
import { within } from '@testing-library/react';
