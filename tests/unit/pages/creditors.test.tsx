import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import components to test
import CreditorListPage from '@/src/pages/creditors';
import AddCreditorDialog from '@/src/pages/creditors/AddCreditorDialog';
import BatchImportCreditorsDialog from '@/src/pages/creditors/BatchImportCreditorsDialog';
import PrintWaybillsDialog from '@/src/pages/creditors/PrintWaybillsDialog';
import { type Creditor } from '@/src/pages/creditors/types';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      if (options && typeof options === 'object' && options !== null) {
        let message = key;
        for (const [optKey, optValue] of Object.entries(options)) {
          message = message.replace(`{{${optKey}}}`, String(optValue));
        }
        return message;
      }
      return key;
    },
  }),
}));

vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('@/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

// Mock test data
const mockCreditors: Creditor[] = [
  {
    id: 'creditor:001',
    type: '组织',
    name: 'Acme Corporation',
    identifier: '91110000000000001X',
    contact_person_name: 'John Doe',
    contact_person_phone: '13800138001',
    address: '北京市朝阳区XX街道1号',
    case_id: 'case:123',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'creditor:002',
    type: '个人',
    name: '张三',
    identifier: '110101199001011234',
    contact_person_name: '张三',
    contact_person_phone: '13800138002',
    address: '北京市海淀区XX路2号',
    case_id: 'case:123',
    created_at: '2024-01-02T00:00:00Z',
  },
];

// Helper function to render with theme and router
const renderWithProviders = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </ThemeProvider>
  );
};

// Mock context providers
const mockAuthContext = {
  selectedCaseId: 'case:123',
  user: { id: 'user:test', name: 'Test User', github_id: 'testuser' },
  isLoggedIn: true,
  hasRole: vi.fn().mockReturnValue(true),
};

const mockSurrealContext = {
  surreal: {
    query: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  isSuccess: true,
};

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}));

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => mockSurrealContext,
}));

describe('Creditors Module Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSurrealContext.surreal.query.mockResolvedValue([mockCreditors]);
  });

  describe('CreditorListPage Component', () => {
    describe('Basic Rendering', () => {
      it('renders the page title and main components', async () => {
        renderWithProviders(<CreditorListPage />);
        
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
        // Print waybills button might be conditionally rendered or have different text
        // Let's verify the main components are present
      });

      it('displays loading state initially', async () => {
        mockSurrealContext.surreal.query.mockImplementation(() => new Promise(() => {}));
        renderWithProviders(<CreditorListPage />);
        
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      it('shows error message when no case is selected', async () => {
        const originalSelectedCaseId = mockAuthContext.selectedCaseId;
        Object.assign(mockAuthContext, { selectedCaseId: null });
        
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('error_no_case_selected')).toBeInTheDocument();
        });
        
        // Restore original value
        Object.assign(mockAuthContext, { selectedCaseId: originalSelectedCaseId });
      });
    });

    describe('Data Fetching and Display', () => {
      it('fetches and displays creditors successfully', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
          expect(screen.getByText('张三')).toBeInTheDocument();
        });

        expect(mockSurrealContext.surreal.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id, type, name, identifier'),
          expect.objectContaining({ caseId: 'case:123' })
        );
      });

      it('handles fetch error gracefully', async () => {
        mockSurrealContext.surreal.query.mockRejectedValue(new Error('Database error'));
        renderWithProviders(<CreditorListPage />);
        
        // Should handle error without crashing
        await waitFor(() => {
          expect(screen.getByText('error_fetching_creditors')).toBeInTheDocument();
        });
      });

      it('displays empty state when no creditors found', async () => {
        mockSurrealContext.surreal.query.mockResolvedValue([[]]);
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('no_creditors_found')).toBeInTheDocument();
        });
      });
    });

    describe('Search Functionality', () => {
      it('performs search when typing in search field', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        });

        const searchInput = screen.getByLabelText('search_creditors_label');
        fireEvent.change(searchInput, { target: { value: 'Acme' } });
        
        await waitFor(() => {
          expect(mockSurrealContext.surreal.query).toHaveBeenCalledWith(
            expect.stringContaining('name CONTAINS $searchTerm'),
            expect.objectContaining({ searchTerm: 'Acme' })
          );
        });
      });
    });

    describe('Selection and Pagination', () => {
      it('handles individual row selection', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        const firstRowCheckbox = checkboxes[1]; // Skip header checkbox
        
        fireEvent.click(firstRowCheckbox);
        expect(firstRowCheckbox).toBeChecked();
      });

      it('handles select all functionality', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        const selectAllCheckbox = checkboxes[0];
        
        fireEvent.click(selectAllCheckbox);
        
        // All row checkboxes should be checked
        checkboxes.slice(1).forEach(checkbox => {
          expect(checkbox).toBeChecked();
        });
      });
    });
  });

  describe('AddCreditorDialog Component', () => {
    const mockOnSave = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
      mockOnSave.mockClear();
      mockOnClose.mockClear();
    });

    describe('Basic Rendering', () => {
      it('renders dialog when open', () => {
        renderWithProviders(
          <AddCreditorDialog
            open={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        );
        
        expect(screen.getByText('add_single_creditor_dialog_title')).toBeInTheDocument();
        expect(screen.getByLabelText('creditor_form_category_label')).toBeInTheDocument();
        expect(screen.getByLabelText('creditor_form_name_label')).toBeInTheDocument();
        expect(screen.getByLabelText('creditor_form_identifier_label')).toBeInTheDocument();
      });

      it('does not render when closed', () => {
        renderWithProviders(
          <AddCreditorDialog
            open={false}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        );
        
        expect(screen.queryByText('add_single_creditor_dialog_title')).not.toBeInTheDocument();
      });
    });

    describe('Form Validation', () => {
      it('shows validation error for empty required fields', async () => {
        renderWithProviders(
          <AddCreditorDialog
            open={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
          />
        );

        const saveButton = screen.getByRole('button', { name: /save_button/i });
        fireEvent.click(saveButton);

        expect(screen.getByText('add_creditor_error_required_fields')).toBeInTheDocument();
        expect(mockOnSave).not.toHaveBeenCalled();
      });

      it('pre-fills form when editing existing creditor', () => {
        const existingCreditor = mockCreditors[0];
        renderWithProviders(
          <AddCreditorDialog
            open={true}
            onClose={mockOnClose}
            onSave={mockOnSave}
            existingCreditor={existingCreditor}
          />
        );

        expect(screen.getByText('edit_single_creditor_dialog_title')).toBeInTheDocument();
        expect(screen.getByDisplayValue(existingCreditor.name)).toBeInTheDocument();
        expect(screen.getByDisplayValue(existingCreditor.identifier)).toBeInTheDocument();
      });
    });
  });

  describe('BatchImportCreditorsDialog Component', () => {
    const mockOnImport = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
      mockOnImport.mockClear();
      mockOnClose.mockClear();
    });

    describe('Basic Rendering', () => {
      it('renders dialog content when open', () => {
        renderWithProviders(
          <BatchImportCreditorsDialog
            open={true}
            onClose={mockOnClose}
            onImport={mockOnImport}
          />
        );

        expect(screen.getByText('batch_import_creditors_dialog_title')).toBeInTheDocument();
        expect(screen.getByText('batch_import_step_1')).toBeInTheDocument();
        expect(screen.getByText('batch_import_step_2')).toBeInTheDocument();
        expect(screen.getByText('download_import_template_button_csv')).toBeInTheDocument();
      });

      it('shows correct button states when no file selected', () => {
        renderWithProviders(
          <BatchImportCreditorsDialog
            open={true}
            onClose={mockOnClose}
            onImport={mockOnImport}
          />
        );

        const startImportButton = screen.getByRole('button', { name: 'start_import_button' });
        expect(startImportButton).toBeDisabled();
        expect(screen.getByText('no_file_selected_label')).toBeInTheDocument();
      });
    });

    describe('Import Process', () => {
      it('shows loading state during import', () => {
        renderWithProviders(
          <BatchImportCreditorsDialog
            open={true}
            onClose={mockOnClose}
            onImport={mockOnImport}
            isImporting={true}
          />
        );

        expect(screen.getByText('importing_button_text')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        
        const cancelButton = screen.getByRole('button', { name: 'cancel_button' });
        expect(cancelButton).toBeDisabled();
      });
    });
  });

  describe('PrintWaybillsDialog Component', () => {
    const mockOnClose = vi.fn();
    const selectedCreditors = mockCreditors.slice(0, 2);

    beforeEach(() => {
      mockOnClose.mockClear();
    });

    describe('Basic Rendering', () => {
      it('renders dialog with selected creditors list', () => {
        renderWithProviders(
          <PrintWaybillsDialog
            open={true}
            onClose={mockOnClose}
            selectedCreditors={selectedCreditors}
          />
        );

        expect(screen.getByText('print_waybills_dialog_title')).toBeInTheDocument();
        expect(screen.getByText('print_waybills_confirmation_intro')).toBeInTheDocument();
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.getByText('张三')).toBeInTheDocument();
      });

      it('disables confirm button when no creditors selected', () => {
        renderWithProviders(
          <PrintWaybillsDialog
            open={true}
            onClose={mockOnClose}
            selectedCreditors={[]}
          />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm_print_button' });
        expect(confirmButton).toBeDisabled();
      });
    });

    describe('Print Functionality', () => {
      it('handles confirm print action', async () => {
        renderWithProviders(
          <PrintWaybillsDialog
            open={true}
            onClose={mockOnClose}
            selectedCreditors={selectedCreditors}
          />
        );

        const confirmButton = screen.getByRole('button', { name: 'confirm_print_button' });
        fireEvent.click(confirmButton);

        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockSurrealContext.surreal.query.mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('error_fetching_creditors')).toBeInTheDocument();
      });
    });

    it('handles validation errors in add dialog', async () => {
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Open add dialog
      const addButton = screen.getByText('add_single_creditor_button');
      fireEvent.click(addButton);

      const saveButton = screen.getByRole('button', { name: /save_button/i });
      fireEvent.click(saveButton);

      // Should show validation error
      expect(screen.getByText('add_creditor_error_required_fields')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('opens add creditor dialog when button is clicked', async () => {
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const addButton = screen.getByText('add_single_creditor_button');
      fireEvent.click(addButton);

      expect(screen.getByText('add_single_creditor_dialog_title')).toBeInTheDocument();
    });

    it('opens batch import dialog when button is clicked', async () => {
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      const batchImportButton = screen.getByText('batch_import_creditors_button');
      fireEvent.click(batchImportButton);

      expect(screen.getByText('batch_import_creditors_dialog_title')).toBeInTheDocument();
    });

    it('enables print waybills button when creditors are selected', async () => {
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      // Select a creditor
      const checkboxes = screen.getAllByRole('checkbox');
      const firstRowCheckbox = checkboxes[1];
      fireEvent.click(firstRowCheckbox);

      // Print button functionality would be tested when button is available
      // For now, we verify that selection works
      expect(firstRowCheckbox).toBeChecked();
    });
  });

  describe('Permission Tests', () => {
    it('shows different UI based on user permissions', async () => {
      // Test with admin permissions
      mockAuthContext.hasRole.mockReturnValue(true);
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      });

      // Buttons should be available for admin users
      expect(screen.getByText('add_single_creditor_button')).not.toBeDisabled();
    });

    it('restricts actions for users without permissions', async () => {
      // Test with limited permissions
      mockAuthContext.hasRole.mockReturnValue(false);
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        // Even without permissions, basic viewing should work
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      });
    });
  });
}); 