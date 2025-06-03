import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path if your i18n setup is elsewhere
import CreditorListPage, { Creditor } from '@/src/pages/creditors';
import { AuthContext, AuthContextType } from '@/src/contexts/AuthContext';
import { SurrealContext, SurrealContextType } from '@/src/contexts/SurrealProvider';
import { SnackbarContext, SnackbarContextType } from '@/src/contexts/SnackbarContext';
import { RecordId } from 'surrealdb';

// Mock papaparse
vi.mock('papaparse', () => ({
  parse: vi.fn(),
}));

// Mock i18n (already in other files, but good to have it explicitly for page tests too)
// If you have a central test setup for i18n, this might not be needed in every file.
// For this example, we keep it explicit.
const mockT = vi.fn((key, options) => {
  if (options) {
    // Crude interpolation for testing, replace with more sophisticated if needed
    let message = key;
    for (const optKey in options) {
      message = message.replace(`{{${optKey}}}`, options[optKey]);
    }
    return message;
  }
  return key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children, // Pass through provider
}));


// Mock react-router-dom (if any navigation calls are made from the page directly)
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Default Mock Values
let mockAuthContextValue: AuthContextType;
let mockSurrealContextValue: Partial<SurrealContextType>; // Use Partial for flexibility
let mockSnackbarContextValue: SnackbarContextType;

const mockCreditors: Creditor[] = [
  { id: 'creditor:001', type: '组织', name: 'Acme Corp', identifier: 'ID001', contact_person_name: 'John D.', contact_person_phone: '111', address: 'Addr1', case_id: 'case:123', created_at: new Date().toISOString() },
  { id: 'creditor:002', type: '个人', name: 'Beta LLC', identifier: 'ID002', contact_person_name: 'Jane S.', contact_person_phone: '222', address: 'Addr2', case_id: 'case:123', created_at: new Date().toISOString() },
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter initialEntries={['/creditors']}>
      <AuthContext.Provider value={mockAuthContextValue}>
        <SurrealContext.Provider value={mockSurrealContextValue as SurrealContextType}>
          <SnackbarContext.Provider value={mockSnackbarContextValue}>
            <Routes>
              <Route path="/creditors" element={children} />
            </Routes>
          </SnackbarContext.Provider>
        </SurrealContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  </I18nextProvider>
);

const renderCreditorListPage = () => {
  return render(
    <TestWrapper>
      <CreditorListPage />
    </TestWrapper>
  );
};

describe('CreditorListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clears all mocks, including Papa.parse

    mockAuthContextValue = {
      selectedCaseId: 'case:123' as unknown as RecordId, // Mock selected case
      // Add other necessary auth context values if CreditorListPage uses them
      user: { id: 'user:test' } as any,
      isLoggedIn: true,
      isLoading: false,
    } as AuthContextType;

    mockSurrealContextValue = {
      surreal: {
        query: vi.fn().mockResolvedValue([[]]), // Default to empty successful fetch
        create: vi.fn().mockResolvedValue([{ id: 'creditor:newid', ...mockCreditors[0] }]), // Mock create
        delete: vi.fn().mockResolvedValue(undefined), // Mock delete
        // Add other surreal client methods if needed by the component
      },
      isConnected: true,
      isLoading: false,
    };

    mockSnackbarContextValue = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
      showWarning: vi.fn(),
    };

    // Reset t mock calls
    mockT.mockClear();
    mockNavigate.mockClear(); // Reset navigation mock calls
  });

  describe('Initial Render & Data Fetching (Read)', () => {
    it('shows loading state initially', async () => {
      // Override surreal query to be pending indefinitely for this test
      mockSurrealContextValue.surreal!.query = vi.fn(() => new Promise(() => {}));
      renderCreditorListPage();
      expect(screen.getByText('loading_creditors', { exact: false })).toBeInTheDocument(); // Using exact:false for key
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('fetches and displays creditors successfully', async () => {
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([mockCreditors]);
      renderCreditorListPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      });
      expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, type, name, identifier, contact_person_name, contact_person_phone, address, created_at, case_id FROM creditor WHERE case_id = $caseId ORDER BY created_at DESC;'),
        { caseId: 'case:123' }
      );
    });

    it('displays an error message if fetching creditors fails', async () => {
      const errorMessage = 'Failed to fetch creditors';
      mockSurrealContextValue.surreal!.query = vi.fn().mockRejectedValueOnce(new Error(errorMessage));
      renderCreditorListPage();

      await waitFor(() => {
        expect(screen.getByText('error_fetching_creditors', { exact: false })).toBeInTheDocument();
      });
      expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('error_fetching_creditors');
    });

    it('displays "no creditors found" message if fetch returns empty list', async () => {
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[]]); // Empty list
      renderCreditorListPage();

      await waitFor(() => {
        expect(screen.getByText('no_creditors_found', { exact: false })).toBeInTheDocument();
      });
    });

    it('displays specific error if no case is selected', async () => {
        mockAuthContextValue.selectedCaseId = null;
        // query should not even be called if selectedCaseId is null by fetchCreditors logic
        mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[]]);
        renderCreditorListPage();

        await waitFor(() => {
            // Check for the specific error message related to no case selected
            // The key 'error_no_case_selected' is used in the component
            expect(screen.getByText('error_no_case_selected', { exact: false })).toBeInTheDocument();
        });
        expect(mockSurrealContextValue.surreal!.query).not.toHaveBeenCalled();
    });
  });

  // More tests for Create, Update, Delete, Batch Import, Search, Selection will be added here
  // For brevity in this step, only Read tests are fully fleshed out.

  describe('Add Creditor (Create)', () => {
    it('opens AddCreditorDialog, creates a new creditor, refreshes list, and shows success', async () => {
      // Initial fetch
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([mockCreditors]);
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      // Click "Add Creditor" button
      fireEvent.click(screen.getByText('add_single_creditor_button', { exact: false }));

      // Dialog should be open - we'd typically assert its title
      // For this test, we assume AddCreditorDialog is tested separately for its own rendering.
      // We are testing the integration with CreditorListPage.
      // The actual AddCreditorDialog component is mocked by its import if we were to do that,
      // but here we are testing the page, so the real dialog should render unless we explicitly mock it.
      // For now, let's assume the dialog opens and we can interact with its save mechanism.
      // To truly test this without being an E2E test, AddCreditorDialog's onSave would be triggered by mocking its internal save.
      // However, the page directly passes its handleSaveCreditor to the dialog.

      // Mock a successful creation
      const newCreditorData = {
        type: '个人' as '个人' | '组织',
        name: 'New Person',
        identifier: 'NEWID001',
        contactPersonName: 'New Contact',
        contactInfo: '1234567890',
        address: 'New Address 123',
      };
      // This simulates the dialog calling onSave, which is handleSaveCreditor in the page.
      // We need to get access to the onSave prop of AddCreditorDialog.
      // This is tricky without a direct way to get dialog props.
      // A common pattern is to have a test-id on the save button inside the dialog.
      // For now, let's assume `handleSaveCreditor` is called directly for unit testing the page logic.
      // This means we are not testing the dialog interaction itself here, but the page's response to it.

      // Simulate the dialog save process by calling what would be its onSave prop
      // This requires handleSaveCreditor to be accessible or to simulate the dialog's save action.
      // The page renders the real AddCreditorDialog. We need to fill its form and click its save.

      // Wait for dialog to be fully open and form elements available
      await screen.findByText('add_single_creditor_button', { exact: false }); // This is the page button
      // Let's assume dialog title is '添加单个债权人' from i18n
      await screen.findByText('添加单个债权人');


      fireEvent.mouseDown(screen.getByLabelText(/类别/));
      fireEvent.click(await screen.findByText(newCreditorData.type));
      fireEvent.change(screen.getByLabelText(/名称/), { target: { value: newCreditorData.name } });
      fireEvent.change(screen.getByLabelText(/ID/), { target: { value: newCreditorData.identifier } });
      fireEvent.change(screen.getByLabelText(/联系人姓名/), { target: { value: newCreditorData.contactPersonName } });
      fireEvent.change(screen.getByLabelText(/联系方式/), { target: { value: newCreditorData.contactInfo } });
      fireEvent.change(screen.getByLabelText(/地址/), { target: { value: newCreditorData.address } });

      // Mock the create call
      const createdRecord = { ...newCreditorData, id: 'creditor:newlyCreated', case_id: 'case:123', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      mockSurrealContextValue.surreal!.create = vi.fn().mockResolvedValueOnce([createdRecord]);

      // Mock the second fetchCreditors call (after successful creation)
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[...mockCreditors, createdRecord]]);

      fireEvent.click(screen.getByRole('button', { name: '保存' })); // Save button in dialog

      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.create).toHaveBeenCalledWith('creditor', expect.objectContaining({
          case_id: 'case:123',
          name: newCreditorData.name,
          identifier: newCreditorData.identifier,
        }));
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showSuccess).toHaveBeenCalledWith('creditor_added_success');
      });

      // Verify fetchCreditors was called again (query was called twice)
      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1); // Once for initial, once for refresh
         // Check if the new creditor is now in the document
        expect(screen.getByText(newCreditorData.name)).toBeInTheDocument();
      });
    });

    it('shows error if creating creditor fails', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument()); // Initial load

      fireEvent.click(screen.getByText('add_single_creditor_button', { exact: false }));
      await screen.findByText('添加单个债权人'); // Dialog title

      const newCreditorData = { type: '个人' as '个人' | '组织', name: 'Fail Case', identifier: 'FAILID001' };
      fireEvent.mouseDown(screen.getByLabelText(/类别/));
      fireEvent.click(await screen.findByText(newCreditorData.type));
      fireEvent.change(screen.getByLabelText(/名称/), { target: { value: newCreditorData.name } });
      fireEvent.change(screen.getByLabelText(/ID/), { target: { value: newCreditorData.identifier } });

      mockSurrealContextValue.surreal!.create = vi.fn().mockRejectedValueOnce(new Error('Create failed'));

      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('creditor_add_failed');
      });
       // Ensure fetchCreditors is not called again if create fails (original query count should be 1)
      expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Creditor (Update)', () => {
    it('opens AddCreditorDialog in edit mode, updates creditor, refreshes list, and shows success', async () => {
      const initialCreditor = mockCreditors[0];
      // Mock for initial fetch for this specific test
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[initialCreditor]]);
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText(initialCreditor.name)).toBeInTheDocument());

      const editButton = screen.getAllByLabelText('edit creditor', { exact: false })[0];
      fireEvent.click(editButton);
      await screen.findByText('编辑债权人');

      const updatedName = 'Acme Corp Updated';
      fireEvent.change(screen.getByLabelText(/名称/), { target: { value: updatedName } });

      // Setup mocks for the sequence: UPDATE query, then SELECT query (for refresh)
      const updateOperationMock = vi.fn().mockResolvedValueOnce([[{ ...initialCreditor, name: updatedName }]]);
      const refreshOperationMock = vi.fn().mockResolvedValueOnce([[{ ...initialCreditor, name: updatedName }]]);

      // Chain these for subsequent calls to client.query after the initial load's query
      // The initial load has already used one 'call' to the page's client.query reference.
      // So we re-assign query to a new mock for the operations within this interaction.
      mockSurrealContextValue.surreal!.query = vi.fn()
          .mockImplementationOnce(updateOperationMock)  // For UPDATE $id MERGE $data
          .mockImplementationOnce(refreshOperationMock); // For SELECT ... (fetchCreditors)

      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(updateOperationMock).toHaveBeenCalledWith(
          'UPDATE $id MERGE $data;',
          expect.objectContaining({
            id: initialCreditor.id,
            data: expect.objectContaining({ name: updatedName }),
          })
        );
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showSuccess).toHaveBeenCalledWith('creditor_updated_success');
      });

      await waitFor(() => {
        expect(refreshOperationMock).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id, type, name, identifier, contact_person_name, contact_person_phone, address, created_at, case_id FROM creditor WHERE case_id = $caseId ORDER BY created_at DESC;'),
            { caseId: 'case:123' }
        );
        expect(screen.getByText(updatedName)).toBeInTheDocument();
      });
    });

    it('shows error if updating creditor fails', async () => {
      const initialCreditor = mockCreditors[0];
      // Mock for initial fetch
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[initialCreditor]]);
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText(initialCreditor.name)).toBeInTheDocument());

      const editButton = screen.getAllByLabelText('edit creditor', { exact: false })[0];
      fireEvent.click(editButton);
      await screen.findByText('编辑债权人');

      fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Attempted Update' } });

      // Mock the update call to fail. This will be the next call to query.
      const updateFailureMock = vi.fn().mockRejectedValueOnce(new Error('Update failed'));
      mockSurrealContextValue.surreal!.query = updateFailureMock;

      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(updateFailureMock).toHaveBeenCalledWith(
          'UPDATE $id MERGE $data;',
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('creditor_update_failed');
      });
      // We expect client.query to have been called for the initial load (handled by the first mock in this test)
      // and then for the update (handled by updateFailureMock). No subsequent refresh call should be made.
      // To verify this, we ensure no other calls to `query` (if it were a single spy) or specifically that `refreshOperationMock` (if distinct) wasn't called.
      // Since updateFailureMock is a fresh mock assigned to .query, it having been called once is sufficient.
    });
  });

  describe('Delete Creditor', () => {
    it('deletes a creditor, refreshes list, and shows success', async () => {
      const creditorToDelete = mockCreditors[0];
      // Mock for initial fetch
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[creditorToDelete, mockCreditors[1]]]);
      renderCreditorListPage();

      await waitFor(() => expect(screen.getByText(creditorToDelete.name)).toBeInTheDocument());

      // Find and click the delete button for the first creditor
      const deleteButton = screen.getAllByLabelText('delete creditor', { exact: false })[0];
      fireEvent.click(deleteButton);

      // Confirm deletion in dialog
      await screen.findByText('delete_creditor_dialog_title', { exact: false });
      fireEvent.click(screen.getByRole('button', { name: '确认删除' })); // Assuming '确认删除' is the confirm button text

      // Mock the delete call (client.delete)
      mockSurrealContextValue.surreal!.delete = vi.fn().mockResolvedValueOnce(undefined);

      // Mock the subsequent fetchCreditors call (client.query)
      // It should return the list without the deleted creditor
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[mockCreditors[1]]]);


      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.delete).toHaveBeenCalledWith(creditorToDelete.id);
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showSuccess).toHaveBeenCalledWith('creditor_deleted_success');
      });

      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id, type, name, identifier, contact_person_name, contact_person_phone, address, created_at, case_id FROM creditor WHERE case_id = $caseId ORDER BY created_at DESC;'),
            { caseId: 'case:123' }
        );
        // Check that the deleted creditor is no longer in the document
        expect(screen.queryByText(creditorToDelete.name)).not.toBeInTheDocument();
        // Check that other creditors are still there
        expect(screen.getByText(mockCreditors[1].name)).toBeInTheDocument();
      });
    });

    it('shows error if deleting creditor fails', async () => {
      const creditorToDelete = mockCreditors[0];
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[creditorToDelete]]);
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText(creditorToDelete.name)).toBeInTheDocument());

      const deleteButton = screen.getAllByLabelText('delete creditor', { exact: false })[0];
      fireEvent.click(deleteButton);
      await screen.findByText('delete_creditor_dialog_title', { exact: false });

      mockSurrealContextValue.surreal!.delete = vi.fn().mockRejectedValueOnce(new Error('Delete failed'));
      // Store the current mock for query to ensure it's not called again for refresh
      const queryMockBeforeDeleteAttempt = mockSurrealContextValue.surreal!.query;

      fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.delete).toHaveBeenCalledWith(creditorToDelete.id);
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('creditor_delete_failed');
      });

      // Ensure fetchCreditors (which calls client.query) was not called after failed delete
      // This means the query mock should be the same one as before the delete attempt,
      // or if it's a spy on all query calls, its call count shouldn't increase for a refresh.
      expect(queryMockBeforeDeleteAttempt).toHaveBeenCalledTimes(1); // Only initial fetch
      expect(screen.getByText(creditorToDelete.name)).toBeInTheDocument(); // Still there
    });
  });

  describe('Batch Import Creditors', () => {
    const mockValidCSVData = [
      { '类别': '组织', '名称': 'CSV Corp 1', 'ID/统一码': 'CSV001', '联系人姓名': 'Contact A', '联系方式': '123', '地址': 'Addr A' },
      { '类别': '个人', '名称': 'CSV Person 2', 'ID/统一码': 'CSV002', '联系人姓名': 'Contact B', '联系方式': '456', '地址': 'Addr B' },
    ];
    const mockInvalidCSVRow = { '类别': '组织', '名称': '', 'ID/统一码': '', '联系人姓名': 'Contact C', '联系方式': '789', '地址': 'Addr C' }; // Missing Name and ID

    beforeEach(() => {
      // Reset Papa.parse mock before each test in this describe block
      (Papa.parse as vi.Mock).mockReset();
    });

    it('successfully imports valid CSV data, refreshes list, and shows success summary', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1)); // Initial fetch

      fireEvent.click(screen.getByText('batch_import_creditors_button', { exact: false }));
      await screen.findByText('批量导入债权人'); // Dialog title

      const file = new File(["csv,content"], "creditors.csv", { type: "text/csv" });
      const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);
      await waitFor(() => expect(screen.getByText('已选文件: creditors.csv')).toBeInTheDocument());

      // Mock Papa.parse for this test
      (Papa.parse as vi.Mock).mockImplementation((_, config) => {
        config.complete({ data: mockValidCSVData, errors: [], meta: {} });
      });

      // Mock client.create for each valid row
      mockSurrealContextValue.surreal!.create = vi.fn().mockResolvedValue([{}]); // Assume successful creation for each

      // Mock the fetchCreditors call after import
      const importedCreditorsForFetch = mockValidCSVData.map((row, i) => ({
        id: `creditor:csv${i}`, type: row['类别'], name: row['名称'], identifier: row['ID/统一码'], case_id: 'case:123'
      }));
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([importedCreditorsForFetch]);

      fireEvent.click(screen.getByRole('button', { name: '开始导入' }));

      await waitFor(() => {
        expect(Papa.parse).toHaveBeenCalledWith(file, expect.any(Object));
        expect(mockSurrealContextValue.surreal!.create).toHaveBeenCalledTimes(mockValidCSVData.length);
        expect(mockSurrealContextValue.surreal!.create).toHaveBeenCalledWith('creditor', expect.objectContaining({ name: 'CSV Corp 1' }));
        expect(mockSurrealContextValue.surreal!.create).toHaveBeenCalledWith('creditor', expect.objectContaining({ name: 'CSV Person 2' }));
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showSuccess).toHaveBeenCalledWith(
          `batch_import_summary_all_success.successCount:${mockValidCSVData.length}` // Simplified check for message key with count
        );
      });

      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1); // For the refresh
        // Check if new items are rendered (optional, depends on test focus)
        // expect(screen.getByText('CSV Corp 1')).toBeInTheDocument();
      });
    });

    it('handles CSV data with some invalid rows, shows warning summary', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1)); // Initial fetch

      fireEvent.click(screen.getByText('batch_import_creditors_button', { exact: false }));
      await screen.findByText('批量导入债权人');

      const file = new File(["csv,content"], "creditors_mixed.csv", { type: "text/csv" });
      const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      const mixedData = [mockValidCSVData[0], mockInvalidCSVRow, mockValidCSVData[1]];
      (Papa.parse as vi.Mock).mockImplementation((_, config) => {
        config.complete({ data: mixedData, errors: [], meta: {} });
      });

      mockSurrealContextValue.surreal!.create = vi.fn().mockResolvedValue([{}]);
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([[]]); // For refresh

      fireEvent.click(screen.getByRole('button', { name: '开始导入' }));

      await waitFor(() => {
        expect(mockSurrealContextValue.surreal!.create).toHaveBeenCalledTimes(2); // Only valid rows
      });

      await waitFor(() => {
        expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith( // Using showError for partial success as per implementation
          `batch_import_summary_with_errors.successCount:2.failureCount:1`
        );
      });
      expect(mockSurrealContextValue.surreal!.query).toHaveBeenCalledTimes(1); // Refresh
    });

    it('handles CSV parsing error', async () => {
      renderCreditorListPage();
      fireEvent.click(screen.getByText('batch_import_creditors_button', { exact: false }));
      await screen.findByText('批量导入债权人');

      const file = new File(["csv,content"], "bad.csv", { type: "text/csv" });
      const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fireEvent.change(fileInput);

      (Papa.parse as vi.Mock).mockImplementation((_, config) => {
        config.error({ message: 'Parse error' } as Papa.ParseError);
      });

      const createMock = mockSurrealContextValue.surreal!.create = vi.fn();
      const queryMock = mockSurrealContextValue.surreal!.query = vi.fn();


      fireEvent.click(screen.getByRole('button', { name: '开始导入' }));

      await waitFor(() => {
        expect(mockSnackbarContextValue.showError).toHaveBeenCalledWith('csv_parse_error');
      });
      expect(createMock).not.toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalledTimes(1); // Only initial fetch should have happened
    });
  });

  describe('Search and Filtering', () => {
    it('filters creditors based on search term', async () => {
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([mockCreditors]);
      renderCreditorListPage();

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('search_creditors_label', { exact: false });
      fireEvent.change(searchInput, { target: { value: 'Acme' } });

      await waitFor(() => {
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.queryByText('Beta LLC')).not.toBeInTheDocument();
      });

      fireEvent.change(searchInput, { target: { value: 'ID002' } });
      await waitFor(() => {
        expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
        expect(screen.getByText('Beta LLC')).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('selects and deselects individual creditors and "select all"', async () => {
      mockSurrealContextValue.surreal!.query = vi.fn().mockResolvedValueOnce([mockCreditors]);
      renderCreditorListPage();
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const selectAllCheckbox = checkboxes[0]; // First checkbox is usually "select all"
      const rowCheckboxes = checkboxes.slice(1);

      // Initial state: no creditor selected, print button disabled
      expect(screen.getByRole('button', {name: 'print_waybill_button', exact: false})).toBeDisabled();


      // Select first creditor
      fireEvent.click(rowCheckboxes[0]);
      await waitFor(() => {
        expect(rowCheckboxes[0].checked).toBe(true);
        expect(selectAllCheckbox.checked).toBe(false); // Not all selected yet
        expect(selectAllCheckbox.indeterminate).toBe(true);
      });
      expect(screen.getByRole('button', {name: 'print_waybill_button', exact: false})).not.toBeDisabled();


      // Select second creditor
      fireEvent.click(rowCheckboxes[1]);
      await waitFor(() => {
        expect(rowCheckboxes[1].checked).toBe(true);
        expect(selectAllCheckbox.checked).toBe(true); // All are now selected
        expect(selectAllCheckbox.indeterminate).toBe(false);
      });

      // Deselect all using "select all"
      fireEvent.click(selectAllCheckbox);
      await waitFor(() => {
        expect(rowCheckboxes[0].checked).toBe(false);
        expect(rowCheckboxes[1].checked).toBe(false);
        expect(selectAllCheckbox.checked).toBe(false);
        expect(selectAllCheckbox.indeterminate).toBe(false);
      });
      expect(screen.getByRole('button', {name: 'print_waybill_button', exact: false})).toBeDisabled();


      // Select all using "select all"
      fireEvent.click(selectAllCheckbox);
      await waitFor(() => {
        expect(rowCheckboxes[0].checked).toBe(true);
        expect(rowCheckboxes[1].checked).toBe(true);
        expect(selectAllCheckbox.checked).toBe(true);
      });
    });
  });
});
