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

// Create stable mock objects to avoid reference changes
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();

const mockSurrealClient = {
  query: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

const mockAuthUser = {
  id: 'user:test',
  name: 'Test User',
  github_id: 'testuser'
};

const mockHasRole = vi.fn();

// Mock dependencies with stable references
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
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: mockShowInfo,
    showWarning: mockShowWarning,
  }),
}));

vi.mock('@/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

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
    isSuccess: true,
  }),
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
    mockSurrealClient.query.mockResolvedValue([mockCreditors]);
  });

  describe('CreditorListPage Component', () => {
    describe('Basic Rendering', () => {
      it('renders the page title and main components', async () => {
        renderWithProviders(<CreditorListPage />);
        
        expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
        expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
      });

      it('displays loading state initially', async () => {
        // Mock a promise that never resolves to simulate loading
        mockSurrealClient.query.mockImplementation(() => new Promise(() => {}));
        renderWithProviders(<CreditorListPage />);
        
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      it('shows error message when no case is selected', async () => {
        // Temporarily override the mock to return null selectedCaseId
        vi.mocked(vi.importActual('@/src/contexts/AuthContext')).useAuth = () => ({
          selectedCaseId: null,
          user: mockAuthUser,
          isLoggedIn: true,
          hasRole: mockHasRole,
        });
        
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('error_no_case_selected')).toBeInTheDocument();
        }, { timeout: 2000 });
      });
    });

    describe('Data Fetching and Display', () => {
      it('fetches and displays creditors successfully', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
          expect(screen.getByText('张三')).toBeInTheDocument();
        }, { timeout: 2000 });

        expect(mockSurrealClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id, type, name, identifier'),
          expect.objectContaining({ caseId: 'case:123' })
        );
      });

      it('handles fetch error gracefully', async () => {
        mockSurrealClient.query.mockRejectedValue(new Error('Database error'));
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('error_fetching_creditors')).toBeInTheDocument();
        }, { timeout: 2000 });
      });

      it('displays empty state when no creditors found', async () => {
        mockSurrealClient.query.mockResolvedValue([[]]);
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('no_creditors_found')).toBeInTheDocument();
        }, { timeout: 2000 });
      });
    });

    describe('Search Functionality', () => {
      it('performs search when typing in search field', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        }, { timeout: 2000 });

        const searchInput = screen.getByLabelText('search_creditors_label');
        fireEvent.change(searchInput, { target: { value: 'Acme' } });
        
        await waitFor(() => {
          expect(mockSurrealClient.query).toHaveBeenCalledWith(
            expect.stringContaining('name CONTAINS $searchTerm'),
            expect.objectContaining({ searchTerm: 'Acme' })
          );
        }, { timeout: 2000 });
      });
    });

    describe('Selection and Actions', () => {
      it('allows selecting individual creditors', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        }, { timeout: 2000 });

        const checkboxes = screen.getAllByRole('checkbox');
        const firstCreditorCheckbox = checkboxes[1]; // Skip the "select all" checkbox
        
        fireEvent.click(firstCreditorCheckbox);
        expect(firstCreditorCheckbox).toBeChecked();
      });

      it('allows selecting all creditors', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        }, { timeout: 2000 });

        const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(selectAllCheckbox);
        
        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.forEach(checkbox => {
          expect(checkbox).toBeChecked();
        });
      });
    });

    describe('Dialog Management', () => {
      it('opens add creditor dialog when button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('add_single_creditor_button')).toBeInTheDocument();
        }, { timeout: 2000 });

        const addButton = screen.getByText('add_single_creditor_button');
        fireEvent.click(addButton);
        
        // Check if dialog is opened (this might need adjustment based on actual dialog implementation)
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, { timeout: 1000 });
      });

      it('opens batch import dialog when button is clicked', async () => {
        renderWithProviders(<CreditorListPage />);
        
        await waitFor(() => {
          expect(screen.getByText('batch_import_creditors_button')).toBeInTheDocument();
        }, { timeout: 2000 });

        const batchImportButton = screen.getByText('batch_import_creditors_button');
        fireEvent.click(batchImportButton);
        
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, { timeout: 1000 });
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
          editingCreditor={null}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderWithProviders(
        <AddCreditorDialog
          open={false}
          onClose={vi.fn()}
          onSave={vi.fn()}
          editingCreditor={null}
        />
      );
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('BatchImportCreditorsDialog Component', () => {
    it('renders dialog when open', () => {
      renderWithProviders(
        <BatchImportCreditorsDialog
          open={true}
          onClose={vi.fn()}
          onImport={vi.fn()}
          isProcessing={false}
        />
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
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
  });
}); 