import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import CreditorListPage from '@/src/pages/creditors';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SnackbarProvider } from '../../../../src/contexts/SnackbarContext';

// Mock child components (Dialogs)
const mockAddCreditorDialog = vi.fn();
vi.mock('../../../../src/components/creditor/AddCreditorDialog', () => ({
  default: (props: any) => {
    mockAddCreditorDialog(props);
    return (
      <div data-testid="mock-add-creditor-dialog" data-open={props.open}>
        Mock AddCreditorDialog - Editing: {props.existingCreditor?.name || 'No'}
        <button onClick={props.onClose}>Close Add/Edit</button>
        <button onClick={() => props.onSave(props.existingCreditor ? {
          ...props.existingCreditor,
          category: props.existingCreditor.type || '组织',
          name: 'New/Edited Creditor',
          identifier: props.existingCreditor.identifier,
          contactPersonName: props.existingCreditor.contact_person_name,
          contactInfo: props.existingCreditor.contact_person_phone,
          address: props.existingCreditor.address
        } : { 
          id: undefined, 
          category: '组织', name: 'New/Edited Creditor', identifier: 'TestID123', 
          contactPersonName: 'Test Contact', contactInfo: '1234567890', address: 'Test Address' 
        })}>
          Save Creditor
        </button>
      </div>
    );
  }
}));

const mockBatchImportDialog = vi.fn();
vi.mock('../../../../src/components/creditor/BatchImportCreditorsDialog', () => ({
  default: (props: any) => {
    mockBatchImportDialog(props);
    return (
      <div data-testid="mock-batch-import-dialog" data-open={props.open} data-importing={props.isImporting}>
        Mock BatchImportCreditorsDialog
        <button onClick={props.onClose}>Close Import</button>
        <button onClick={() => props.onImport(new File(['content'], 'test.csv'))}>Import File</button>
      </div>
    );
  }
}));

const mockPrintWaybillsDialog = vi.fn();
vi.mock('../../../../src/components/creditor/PrintWaybillsDialog', () => ({
  default: (props: any) => {
    mockPrintWaybillsDialog(props);
    return (
      <div data-testid="mock-print-waybills-dialog" data-open={props.open}>
        Mock PrintWaybillsDialog - Creditors: {props.selectedCreditors?.length || 0}
        <button onClick={props.onClose}>Close Print</button>
      </div>
    );
  }
}));

// Mock ConfirmDeleteDialog
const mockConfirmDeleteDialog = vi.fn();
vi.mock('../../../../src/components/common/ConfirmDeleteDialog', () => ({
  default: (props: any) => {
    mockConfirmDeleteDialog(props);
    return (
      <div data-testid="mock-confirm-delete-dialog" data-open={props.open}>
        {props.title}
        <div>{props.contentText}</div>
        <button onClick={props.onClose}>Cancel Delete</button>
        <button onClick={props.onConfirm}>Confirm Delete</button>
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => key,
    i18n: { changeLanguage: vi.fn() }
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
    mockConfirmDeleteDialog.mockClear();
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
    // Use getAllByText since "Jane Smith" appears in both name and contact person columns
    expect(screen.getAllByText('Jane Smith')).toHaveLength(2);
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
    // Get all rows within the table body (excluding header)
    const tableBody = screen.getByRole('table').querySelector('tbody');
    const dataRows = tableBody ? tableBody.querySelectorAll('tr') : [];
    expect(dataRows.length).toBe(initialMockCreditors.length);
  });

  test('search functionality filters creditors', () => {
    renderCreditorListPage();
    const searchInput = screen.getByLabelText('search_creditors_label');
    
    fireEvent.change(searchInput, { target: { value: 'Acme' } });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    // Jane Smith should not appear in the name column when searching for "Acme"
    const janeElements = screen.queryAllByText('Jane Smith');
    expect(janeElements).toHaveLength(0);
    
    // Count visible data rows in table body (should be 1 for Acme Corp)
    const tableBody = screen.getByRole('table').querySelector('tbody');
    const dataRows = tableBody ? tableBody.querySelectorAll('tr') : [];
    expect(dataRows.length).toBe(1);

    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.getByText('no_creditors_found')).toBeInTheDocument();
  });

  describe('Selection Logic', () => {
    test('individual checkbox selection works', () => {
      renderCreditorListPage();
      const checkboxes = screen.getAllByRole('checkbox'); // Includes header checkbox
      const firstRowCheckbox = checkboxes[1]; // First data row checkbox
      
      // Click to select
      fireEvent.click(firstRowCheckbox);
      
      // Check if print button is enabled when a creditor is selected
      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();

      // Click to deselect
      fireEvent.click(firstRowCheckbox);
      
      // Check if print button is disabled when no creditors are selected
      expect(printButton).toBeDisabled();
    });

    test('"Select All" checkbox works', () => {
      renderCreditorListPage();
      const checkboxes = screen.getAllByRole('checkbox');
      const selectAllCheckbox = checkboxes[0];
      
      // Click to select all
      fireEvent.click(selectAllCheckbox);
      
      // Verify print button is enabled
      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();

      // Click to deselect all
      fireEvent.click(selectAllCheckbox);
      
      // Verify print button is disabled
      expect(printButton).toBeDisabled();
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

      const editButton = within(acmeRow).getByRole('button', { name: 'edit creditor' });
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
        // Use getAllByText since "进口个人Y" appears in both name and contact person columns
        const importedPersonElements = screen.getAllByText('进口个人Y');
        expect(importedPersonElements.length).toBeGreaterThan(0);
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
  
  test('Delete button opens confirmation dialog and deletes on confirm', async () => {
    renderCreditorListPage();
    
    const acmeRow = screen.getByText('Acme Corp').closest('tr');
    expect(acmeRow).not.toBeNull();
    if (!acmeRow) return;

    const deleteButton = within(acmeRow).getByRole('button', { name: 'delete creditor' });
    fireEvent.click(deleteButton);

    // Check if delete confirmation dialog opens
    const deleteDialog = screen.getByTestId('mock-confirm-delete-dialog');
    expect(deleteDialog).toBeVisible();
    expect(mockConfirmDeleteDialog).toHaveBeenCalledWith(expect.objectContaining({
      open: true,
      title: 'delete_creditor_dialog_title',
      contentText: 'delete_creditor_dialog_content'
    }));

    // Confirm deletion
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Confirm Delete' }));
    
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('creditor_deleted_success');
    });
    
    // Check if creditor is removed from list
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(deleteDialog).toHaveAttribute('data-open', 'false');
  });

  test('Delete button cancellation keeps creditor', () => {
    renderCreditorListPage();
    
    const acmeRow = screen.getByText('Acme Corp').closest('tr');
    expect(acmeRow).not.toBeNull();
    if (!acmeRow) return;

    const deleteButton = within(acmeRow).getByRole('button', { name: 'delete creditor' });
    fireEvent.click(deleteButton);

    const deleteDialog = screen.getByTestId('mock-confirm-delete-dialog');
    expect(deleteDialog).toBeVisible();

    // Cancel deletion
    fireEvent.click(within(deleteDialog).getByRole('button', { name: 'Cancel Delete' }));
    
    // Check if creditor is still in list
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(deleteDialog).toHaveAttribute('data-open', 'false');
  });

});
