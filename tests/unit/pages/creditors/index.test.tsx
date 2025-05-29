import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CreditorListPage from '../../../../src/pages/creditors'; // Adjust path as needed
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SnackbarProvider } // Using actual provider to allow context to work
    from '../../../../src/contexts/SnackbarContext';


// Mock child components (Dialogs)
const mockAddCreditorDialog = jest.fn();
jest.mock('../../../../src/components/creditor/AddCreditorDialog', () => (props: any) => {
  mockAddCreditorDialog(props); // To check props passed to it
  return (
    <div data-testid="mock-add-creditor-dialog" data-open={props.open}>
      Mock AddCreditorDialog - Editing: {props.existingCreditor?.name || 'No'}
      <button onClick={props.onClose}>Close Add/Edit</button>
      <button onClick={() => props.onSave(props.existingCreditor || { 
        id: props.existingCreditor ? props.existingCreditor.id : undefined, 
        category: '组织', name: 'New/Edited Creditor', identifier: 'TestID123', 
        contactPersonName: 'Test Contact', contactInfo: '1234567890', address: 'Test Address' 
      })}>
        Save Creditor
      </button>
    </div>
  );
});

const mockBatchImportDialog = jest.fn();
jest.mock('../../../../src/components/creditor/BatchImportCreditorsDialog', () => (props: any) => {
  mockBatchImportDialog(props);
  return (
    <div data-testid="mock-batch-import-dialog" data-open={props.open} data-importing={props.isImporting}>
      Mock BatchImportCreditorsDialog
      <button onClick={props.onClose}>Close Import</button>
      <button onClick={() => props.onImport(new File(['content'], 'test.csv'))}>Import File</button>
    </div>
  );
});

const mockPrintWaybillsDialog = jest.fn();
jest.mock('../../../../src/components/creditor/PrintWaybillsDialog', () => (props: any) => {
  mockPrintWaybillsDialog(props);
  return (
    <div data-testid="mock-print-waybills-dialog" data-open={props.open}>
      Mock PrintWaybillsDialog - Creditors: {props.selectedCreditors?.length || 0}
      <button onClick={props.onClose}>Close Print</button>
    </div>
  );
});

// Mock context hooks
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn(); // if used
jest.mock('../../../../src/contexts/SnackbarContext', () => ({
  ...jest.requireActual('../../../../src/contexts/SnackbarContext'),
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (key: string, options?: any) => key, // Simple pass-through mock
    i18n: { changeLanguage: jest.fn() }
  }),
}));

const theme = createTheme();

const renderCreditorListPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider> {/* Use actual provider to allow snackbar context to work */}
          <CreditorListPage />
      </SnackbarProvider>
    </ThemeProvider>
  );
};

const initialMockCreditors = [
  { id: 'cred001', type: '组织' as const, name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000', address: '科技园路1号' },
  { id: 'cred002', type: '个人' as const, name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000', address: '文三路202号' },
  { id: 'cred003', type: '组织' as const, name: 'Beta LLC', identifier: '91330100MA2YYYYY2B', contact_person_name: 'Mike Johnson', contact_person_phone: '13700137000', address: '创新大道33号' },
];


describe('CreditorListPage', () => {
  beforeEach(() => {
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
    mockAddCreditorDialog.mockClear();
    mockBatchImportDialog.mockClear();
    mockPrintWaybillsDialog.mockClear();
    // Reset the component's internal state if possible, or re-render.
    // Since the component manages its own state, re-rendering is the primary way for isolation.
  });

  test('renders page title and initial action buttons', () => {
    renderCreditorListPage();
    expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument(); // Mocked t function returns key
    expect(screen.getByLabelText('search_creditors_label')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_single_creditor_button' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batch_import_creditors_button' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'print_waybill_button' })).toBeInTheDocument();
  });

  test('renders table with initial mock creditors', () => {
    renderCreditorListPage();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(initialMockCreditors.length + 1); // +1 for header row
  });

  test('search functionality filters creditors', () => {
    renderCreditorListPage();
    const searchInput = screen.getByLabelText('search_creditors_label');
    
    fireEvent.change(searchInput, { target: { value: 'Acme' } });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(1 + 1); // Acme Corp + header

    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.getByText('no_creditors_found')).toBeInTheDocument();
  });

  describe('Selection Logic', () => {
    test('individual checkbox selection works', () => {
      renderCreditorListPage();
      const checkboxes = screen.getAllByRole('checkbox'); // Includes header checkbox
      const firstRowCheckbox = checkboxes[1] as HTMLInputElement; // First data row checkbox
      
      expect(firstRowCheckbox.checked).toBe(false);
      fireEvent.click(firstRowCheckbox);
      expect(firstRowCheckbox.checked).toBe(true);

      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();

      fireEvent.click(firstRowCheckbox); // Deselect
      expect(firstRowCheckbox.checked).toBe(false);
      expect(printButton).toBeDisabled();
    });

    test('"Select All" checkbox works', () => {
      renderCreditorListPage();
      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      const selectAllCheckbox = checkboxes[0];
      
      fireEvent.click(selectAllCheckbox);
      checkboxes.slice(1).forEach(cb => expect(cb.checked).toBe(true));
      expect(screen.getByRole('button', { name: 'print_waybill_button' })).not.toBeDisabled();

      fireEvent.click(selectAllCheckbox); // Deselect all
      checkboxes.slice(1).forEach(cb => expect(cb.checked).toBe(false));
      expect(screen.getByRole('button', { name: 'print_waybill_button' })).toBeDisabled();
    });
  });

  describe('Dialog Interactions', () => {
    test('AddCreditorDialog opens for adding, saves, and closes', async () => {
      renderCreditorListPage();
      fireEvent.click(screen.getByRole('button', { name: 'add_single_creditor_button' }));
      
      const dialog = screen.getByTestId('mock-add-creditor-dialog');
      expect(dialog).toBeVisible();
      expect(mockAddCreditorDialog).toHaveBeenCalledWith(expect.objectContaining({ open: true, existingCreditor: null }));

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save Creditor' }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditor_added_success');
      });
      expect(screen.getByText('New/Edited Creditor')).toBeInTheDocument(); // Check if added to list
      expect(dialog).toHaveAttribute('data-open', 'false'); // Check if dialog closed
    });

    test('AddCreditorDialog opens for editing, saves, and closes', async () => {
      renderCreditorListPage();
      // Find an edit button (e.g., for Acme Corp)
      const acmeRow = screen.getByText('Acme Corp').closest('tr');
      expect(acmeRow).not.toBeNull();
      if (!acmeRow) return;

      const editButton = within(acmeRow).getByRole('button', { name: 'edit_creditor_tooltip' });
      fireEvent.click(editButton);
      
      const dialog = screen.getByTestId('mock-add-creditor-dialog');
      expect(dialog).toBeVisible();
      expect(mockAddCreditorDialog).toHaveBeenCalledWith(expect.objectContaining({ 
        open: true, 
        existingCreditor: expect.objectContaining({ name: 'Acme Corp' }) 
      }));

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save Creditor' }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditor_updated_success');
      });
      // Check if name was updated (mock save logic assumes it's "New/Edited Creditor")
      expect(within(acmeRow).getByText('New/Edited Creditor')).toBeInTheDocument();
      expect(dialog).toHaveAttribute('data-open', 'false');
    });

    test('BatchImportCreditorsDialog opens, imports, and closes', async () => {
        renderCreditorListPage();
        fireEvent.click(screen.getByRole('button', { name: 'batch_import_creditors_button' }));

        const dialog = screen.getByTestId('mock-batch-import-dialog');
        expect(dialog).toBeVisible();
        expect(mockBatchImportDialog).toHaveBeenCalledWith(expect.objectContaining({ open: true }));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Import File' }));
        // Check if loading state is passed (isImporting becomes true)
        await waitFor(() => expect(dialog).toHaveAttribute('data-importing', 'true'));
        
        // Simulate import completion (mock implementation has a setTimeout)
        await waitFor(() => {
            expect(mockShowSuccess).toHaveBeenCalledWith('creditors_imported_success_mock');
        }, { timeout: 2000 }); // Wait for simulated import
        
        // Check if new creditors from mock import are added
        expect(screen.getByText('进口公司X')).toBeInTheDocument();
        expect(screen.getByText('进口个人Y')).toBeInTheDocument();
        expect(dialog).toHaveAttribute('data-open', 'false');
    });

    test('PrintWaybillsDialog opens and closes', () => {
      renderCreditorListPage();
      // Select a creditor first
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Select first data row creditor

      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();
      fireEvent.click(printButton);

      const dialog = screen.getByTestId('mock-print-waybills-dialog');
      expect(dialog).toBeVisible();
      expect(mockPrintWaybillsDialog).toHaveBeenCalledWith(expect.objectContaining({ 
        open: true,
        selectedCreditors: expect.arrayContaining([
          expect.objectContaining({ name: 'Acme Corp' })
        ])
      }));
      
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close Print' }));
      expect(dialog).toHaveAttribute('data-open', 'false');
    });
  });
  
  test('Delete button console logs (conceptual - actual deletion needs more setup)', () => {
    renderCreditorListPage();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    const acmeRow = screen.getByText('Acme Corp').closest('tr');
    expect(acmeRow).not.toBeNull();
    if (!acmeRow) return;

    const deleteButton = within(acmeRow).getByRole('button', { name: 'delete_creditor_tooltip' });
    fireEvent.click(deleteButton);

    expect(consoleSpy).toHaveBeenCalledWith("TODO: Implement delete creditor", "cred001");
    consoleSpy.mockRestore();
  });

});
