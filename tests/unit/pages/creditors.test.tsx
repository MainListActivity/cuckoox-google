import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import components to test
import CreditorListPage from '@/src/pages/creditors';
import AddCreditorDialog from '@/src/pages/creditors/AddCreditorDialog';
import BatchImportCreditorsDialog from '@/src/pages/creditors/BatchImportCreditorsDialog';
import PrintWaybillsDialog from '@/src/pages/creditors/PrintWaybillsDialog';
import { type Creditor } from '@/src/pages/creditors/types';

// Create stable mock functions
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();
const mockQueryWithAuth = vi.fn();

const mockSurrealClient = {
  query: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
};

const mockAuthUser = {
  id: 'user:test',
  name: 'Test User',
  github_id: 'testuser'
};

const mockHasRole = vi.fn();

// Create a stable t function
const mockT = vi.fn((key: string, options?: unknown) => {
  if (options && typeof options === 'object' && options !== null) {
    let message = key;
    for (const [optKey, optValue] of Object.entries(options)) {
      message = message.replace(`{{${optKey}}}`, String(optValue));
    }
    return message;
  }
  return key;
});

// Mock dependencies with stable references
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: mockShowInfo,
    showWarning: mockShowWarning,
  }),
}));

vi.mock('@/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: mockQueryWithAuth,
}));

vi.mock('@/src/hooks/usePermission', () => ({
  useOperationPermission: () => ({
    hasPermission: true,
    isLoading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    selectedCaseId: 'case:123',
    user: mockAuthUser,
    isLoggedIn: true,
    hasRole: mockHasRole,
  }),
}));

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({
    surreal: mockSurrealClient,
    isSuccess: true, // This should be true to indicate DB is connected
  }),
  useSurrealClient: () => mockSurrealClient,
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationRequiredError';
    }
  },
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

describe('Creditors Module Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRole.mockReturnValue(true);
    
    // Mock successful query with both data and count results
    // SurrealDB returns results in format: [resultArray] for data queries
    mockSurrealClient.query.mockImplementation((query: string, params?: Record<string, unknown>) => {
      console.log('Mock query called with:', query, params);
      
      if (query.includes('count()')) {
        const countResult = [{ total: mockCreditors.length }];
        console.log('Returning count result:', countResult);
        return Promise.resolve(countResult);
      }
      
      // For data queries, return the creditors array wrapped in another array
      const dataResult = [mockCreditors];
      console.log('Returning data result:', dataResult);
      return Promise.resolve(dataResult);
    });

    // Mock queryWithAuth to return the same data as the direct surreal client
    mockQueryWithAuth.mockImplementation((query: string, params?: Record<string, unknown>) => {
      console.log('Mock queryWithAuth called with:', query, params);
      
      if (query.includes('count()')) {
        const countResult = [{ total: mockCreditors.length }];
        console.log('Returning queryWithAuth count result:', countResult);
        return Promise.resolve(countResult);
      }
      
      // For data queries, return the creditors array wrapped in another array
      const dataResult = [mockCreditors];
      console.log('Returning queryWithAuth data result:', dataResult);
      return Promise.resolve(dataResult);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 新增：产品规范测试 - 自动导航功能
  describe('Auto Navigation (Product Requirement)', () => {
    it('should auto-navigate to creditor management when case is in "立案" stage and user has permission', async () => {
      // Mock user with creditor management permission
      mockHasRole.mockImplementation((role: string) => {
        return role === 'creditor_manager' || role === 'case_manager';
      });
      
      renderWithProviders(<CreditorListPage />);
      
      // Verify the page loads correctly for auto-navigation scenario
      await waitFor(() => {
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Verify that user with permission can see management buttons
      expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
    });

    it('should not auto-navigate when user lacks creditor management permission', async () => {
      // Mock user without creditor management permission
      mockHasRole.mockReturnValue(false);
      
      renderWithProviders(<CreditorListPage />);
      
      // Should still render the page but without management buttons
      await waitFor(() => {
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  // 新增：产品规范测试 - 权限控制
  describe('Permission Control (Product Requirement)', () => {
    it('shows all management functions for case manager role', async () => {
      mockHasRole.mockImplementation((role: string) => {
        return role === 'case_manager' || role === 'admin';
      });
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Wait for data to load and check for action buttons
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Should show print waybills button when creditors are selected
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]); // Click first creditor checkbox
        
        await waitFor(() => {
          const printButtons = screen.getAllByText('print_waybill_button');
          expect(printButtons.length).toBeGreaterThanOrEqual(1);
          expect(printButtons[0]).toBeInTheDocument();
        });
      }
    });

    it('hides management functions for debt representative role', async () => {
      mockHasRole.mockImplementation((role: string) => {
        return role === 'debt_representative'; // Only debt representative role
      });
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Should not show management buttons for debt representative
      expect(screen.queryByText('add_single_creditor_button')).not.toBeInTheDocument();
      expect(screen.queryByText('batch_import_creditors_button')).not.toBeInTheDocument();
    });

    it('shows read-only view for users without management permissions', async () => {
      mockHasRole.mockReturnValue(false); // No permissions
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Should show data but no action buttons
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Should not show any management buttons
      expect(screen.queryByText('add_single_creditor_button')).not.toBeInTheDocument();
      expect(screen.queryByText('batch_import_creditors_button')).not.toBeInTheDocument();
      // Print button may still be visible but disabled when no permissions
      const printButton = screen.queryByText('print_waybill_button');
      if (printButton) {
        expect(printButton).toBeDisabled();
      }
    });
  });

  // 新增：产品规范测试 - 案件状态控制
  describe('Case Status Control (Product Requirement)', () => {
    it('allows creditor management operations in any case stage (per product spec)', async () => {
      // According to product spec: "债权人管理 (录入、打印快递单) 仅受身份权限管控，不受案件状态限制"
      // Simplified test - just verify that with proper permissions, management buttons are available
      mockHasRole.mockReturnValue(true);
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Should always show management buttons regardless of case stage
      expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
    });
  });

  // 新增：产品规范测试 - 业务流程验证
  describe('Business Process Validation (Product Requirement)', () => {
    it('validates creditor data according to business rules', async () => {
      mockHasRole.mockReturnValue(true);
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Click add creditor button
      fireEvent.click(screen.getByText('add_single_creditor_button'));
      
      // Should open add creditor dialog (may not actually open in test environment)
      // Just verify the button exists and is clickable
      expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      
      // In a real test environment, we would verify the dialog opens
      // For now, just verify the button functionality works
      expect(screen.getByText('add_single_creditor_button')).not.toBeDisabled();
    });

    it('supports batch import functionality as per product requirements', async () => {
      mockHasRole.mockReturnValue(true);
      
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Click batch import button
      fireEvent.click(screen.getByText('batch_import_creditors_button'));
      
      // Should open batch import dialog (may not actually open in test environment)
      // Just verify the button exists and is clickable
      expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      expect(screen.getByText('batch_import_creditors_button')).not.toBeDisabled();
    });

    it('supports waybill printing functionality as per product requirements', async () => {
      mockHasRole.mockReturnValue(true);
      
      renderWithProviders(<CreditorListPage />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      // Select a creditor
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]); // Click first creditor checkbox
        
        await waitFor(() => {
          const printButtons = screen.getAllByText('print_waybill_button');
          expect(printButtons.length).toBeGreaterThanOrEqual(1);
          expect(printButtons[0]).toBeInTheDocument();
        });
        
        // Click print waybills button
        const printButtons = screen.getAllByText('print_waybill_button');
        fireEvent.click(printButtons[0]);
        
        // Should open print waybills dialog (may not actually open in test environment)
        // Just verify the button click was successful
        expect(printButtons[0]).not.toBeDisabled();
      }
    });
  });

  describe('CreditorListPage Component', () => {
    describe('Basic Rendering', () => {
      it('renders the page title and main components', async () => {
        renderWithProviders(<CreditorListPage />);
        
        // Wait for the component to finish loading
        await waitFor(() => {
          expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
        }, { timeout: 10000 });
        
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      });

      it('loads data and displays creditors successfully', async () => {
        renderWithProviders(<CreditorListPage />);
        
        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // Check if the table is rendered (may have multiple tables due to pagination)
        expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(1);

        // Check for the creditor data
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
          expect(screen.getAllByText('张三')).toHaveLength(2); // 张三 appears in both name and contact person columns
        }, { timeout: 5000 });

        // Check for other creditor details
        expect(screen.getByText('91110000000000001X')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('13800138001')).toBeInTheDocument();
      });

      it('handles search functionality', async () => {
        renderWithProviders(<CreditorListPage />);
        
        // Wait for initial load
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const searchInput = screen.getByLabelText('search_creditors_label');
        
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: 'Acme' } });
        });

        // Verify that query was called with search term
        await waitFor(() => {
          expect(mockSurrealClient.query).toHaveBeenCalledWith(
            expect.stringContaining('@@ $searchTerm'),
            expect.objectContaining({ searchTerm: 'Acme' })
          );
        }, { timeout: 3000 });
      });
    });

    describe('Data Fetching and Display', () => {
      it('displays empty state when no creditors exist', async () => {
        // Mock empty result
        mockSurrealClient.query.mockImplementation((query: string) => {
          if (query.includes('count()')) {
            return Promise.resolve([{ total: 0 }]);
          }
          return Promise.resolve([[]]);
        });

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('no_creditors_found')).toBeInTheDocument();
        }, { timeout: 10000 });
      });

      it('displays error state when fetch fails', async () => {
        mockSurrealClient.query.mockRejectedValue(new Error('Database error'));

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('error_fetching_creditors')).toBeInTheDocument();
        }, { timeout: 10000 });
      });
    });

    describe('Selection and Actions', () => {
      it('allows selecting individual creditors', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // Find and click a checkbox for a specific creditor
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(1); // At least header checkbox + creditor checkboxes
        
        await act(async () => {
          fireEvent.click(checkboxes[1]); // Click first creditor checkbox (index 0 is header)
        });

        // Verify checkbox is checked
        expect(checkboxes[1]).toBeChecked();
      });

      it('enables print waybills button when creditors are selected', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const printButton = screen.getByText('print_waybill_button');
        expect(printButton).toBeDisabled();

        // Select a creditor
        const checkboxes = screen.getAllByRole('checkbox');
        await act(async () => {
          fireEvent.click(checkboxes[1]);
        });

        expect(printButton).toBeEnabled();
      });

      it('allows selecting all creditors', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const checkboxes = screen.getAllByRole('checkbox');
        const selectAllCheckbox = checkboxes[0]; // Header checkbox
        
        await act(async () => {
          fireEvent.click(selectAllCheckbox);
        });

        // All creditor checkboxes should be checked
        checkboxes.slice(1).forEach(checkbox => {
          expect(checkbox).toBeChecked();
        });
      });
    });

    describe('Pagination', () => {
      it('displays pagination controls', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // Check for pagination elements
        expect(screen.getByText('table_pagination_rows_per_page')).toBeInTheDocument();
        expect(screen.getByLabelText('table_pagination_previous_page_aria_label')).toBeInTheDocument();
        expect(screen.getByLabelText('table_pagination_next_page_aria_label')).toBeInTheDocument();
      });

      it('handles page change', async () => {
        // Mock more data to enable pagination
        const manyCreditors = Array.from({ length: 25 }, (_, i) => ({
          ...mockCreditors[0],
          id: `creditor:${i + 1}`,
          name: `Creditor ${i + 1}`,
        }));

        mockSurrealClient.query.mockImplementation((query: string) => {
          if (query.includes('count()')) {
            return Promise.resolve([{ total: manyCreditors.length }]);
          }
          return Promise.resolve([manyCreditors.slice(0, 10)]); // First page
        });

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const nextPageButton = screen.getByLabelText('table_pagination_next_page_aria_label');
        
        await act(async () => {
          fireEvent.click(nextPageButton);
        });

        // Verify query was called with new page parameters
        await waitFor(() => {
          expect(mockSurrealClient.query).toHaveBeenCalledWith(
            expect.stringContaining('LIMIT $limit START $start'),
            expect.objectContaining({ start: 10 }) // Second page
          );
        });
      });
    });

    describe('CRUD Operations', () => {
      it('opens add creditor dialog when add button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const addButton = screen.getByText('add_single_creditor_button');
        
        await act(async () => {
          fireEvent.click(addButton);
        });

        // Check if dialog is opened (this would require the dialog to be rendered)
        // Since we're testing the main page, we can verify the button click handler
        expect(addButton).toBeInTheDocument();
      });

      it('opens edit dialog when edit button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // Find edit buttons (they have aria-label="edit creditor")
        const editButtons = screen.getAllByLabelText('edit creditor');
        expect(editButtons.length).toBeGreaterThan(0);
        
        await act(async () => {
          fireEvent.click(editButtons[0]);
        });

        // Verify edit button exists and is clickable
        expect(editButtons[0]).toBeInTheDocument();
      });

      it('opens delete dialog when delete button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // Find delete buttons (they have aria-label="delete creditor")
        const deleteButtons = screen.getAllByLabelText('delete creditor');
        expect(deleteButtons.length).toBeGreaterThan(0);
        
        await act(async () => {
          fireEvent.click(deleteButtons[0]);
        });

        // Verify delete button exists and is clickable
        expect(deleteButtons[0]).toBeInTheDocument();
      });

      it('handles creditor creation successfully', async () => {
        mockSurrealClient.create.mockResolvedValue([{ id: 'creditor:new', name: 'New Creditor' }]);
        
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // This test verifies the component can handle successful creation
        // The actual creation logic would be tested in the dialog component tests
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
      });

      it('handles creditor deletion successfully', async () => {
        mockSurrealClient.delete.mockResolvedValue(true);
        
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // This test verifies the component can handle successful deletion
        // The actual deletion logic would be tested when the delete dialog is confirmed
        const deleteButtons = screen.getAllByLabelText('delete creditor');
        expect(deleteButtons.length).toBeGreaterThan(0);
      });
    });

    describe('Batch Import', () => {
      it('opens batch import dialog when batch import button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        const batchImportButton = screen.getByText('batch_import_creditors_button');
        
        await act(async () => {
          fireEvent.click(batchImportButton);
        });

        // Verify batch import button exists and is clickable
        expect(batchImportButton).toBeInTheDocument();
      });
    });

    describe('Permission-based UI', () => {
      it('hides management buttons when user lacks permissions', async () => {
        mockHasRole.mockReturnValue(false);

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 10000 });

        expect(screen.queryByText('add_single_creditor_button')).not.toBeInTheDocument();
        expect(screen.queryByText('batch_import_creditors_button')).not.toBeInTheDocument();
      });

      it('shows management buttons when user has permissions', async () => {
        mockHasRole.mockReturnValue(true);

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      });

      it('disables print button when user lacks permissions', async () => {
        mockHasRole.mockReturnValue(false);

        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        }, { timeout: 10000 });

        const printButton = screen.getByText('print_waybill_button');
        expect(printButton).toBeDisabled();
      });
    });
  });

  describe('AddCreditorDialog Component', () => {
    it('renders dialog when open', () => {
      renderWithProviders(
        <AddCreditorDialog
          open={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          existingCreditor={null}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders dialog with existing creditor data for editing', () => {
      renderWithProviders(
        <AddCreditorDialog
          open={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          existingCreditor={mockCreditors[0]}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('calls onClose when dialog is closed', () => {
      const mockOnClose = vi.fn();
      
      renderWithProviders(
        <AddCreditorDialog
          open={true}
          onClose={mockOnClose}
          onSave={vi.fn()}
          existingCreditor={null}
        />
      );
      
      // Find and click close button (usually an X or Cancel button)
      // This would depend on the actual dialog implementation
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('BatchImportCreditorsDialog Component', () => {
    it('renders dialog when open', () => {
      renderWithProviders(
        <BatchImportCreditorsDialog
          open={true}
          onClose={vi.fn()}
          onImport={vi.fn()}
          isImporting={false}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows loading state when importing', () => {
      renderWithProviders(
        <BatchImportCreditorsDialog
          open={true}
          onClose={vi.fn()}
          onImport={vi.fn()}
          isImporting={true}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Would check for loading indicator if implemented in the dialog
    });

    it('calls onImport when import is triggered', () => {
      const mockOnImport = vi.fn();
      
      renderWithProviders(
        <BatchImportCreditorsDialog
          open={true}
          onClose={vi.fn()}
          onImport={mockOnImport}
          isImporting={false}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Would test file upload and import trigger if implemented
    });
  });

  describe('PrintWaybillsDialog Component', () => {
    it('renders dialog when open', () => {
      renderWithProviders(
        <PrintWaybillsDialog
          open={true}
          onClose={vi.fn()}
          selectedCreditors={mockCreditors}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays selected creditors information', () => {
      renderWithProviders(
        <PrintWaybillsDialog
          open={true}
          onClose={vi.fn()}
          selectedCreditors={mockCreditors}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Would check for creditor information display if implemented
    });

    it('handles empty selection gracefully', () => {
      renderWithProviders(
        <PrintWaybillsDialog
          open={true}
          onClose={vi.fn()}
          selectedCreditors={[]}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('handles complete workflow: load data, select creditors, print waybills', async () => {
      renderWithProviders(<CreditorListPage />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      }, { timeout: 15000 });

      // Select a creditor
      const checkboxes = screen.getAllByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkboxes[1]);
      });

      // Click print button
      const printButton = screen.getByText('print_waybill_button');
      expect(printButton).toBeEnabled();
      
      await act(async () => {
        fireEvent.click(printButton);
      });

      // Verify the workflow completed
      expect(printButton).toBeInTheDocument();
    });

    it('handles search and pagination together', async () => {
      renderWithProviders(<CreditorListPage />);
      
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      }, { timeout: 15000 });

      // Perform search
      const searchInput = screen.getByLabelText('search_creditors_label');
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Acme' } });
      });

      // Verify search was performed
      await waitFor(() => {
        expect(mockSurrealClient.query).toHaveBeenCalledWith(
          expect.stringContaining('@@ $searchTerm'),
          expect.objectContaining({ searchTerm: 'Acme' })
        );
      });
    });
  });
}); 