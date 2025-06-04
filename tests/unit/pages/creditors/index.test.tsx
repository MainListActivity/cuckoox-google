import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import '@testing-library/jest-dom';
import CreditorListPage from '@/src/pages/creditors';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SnackbarProvider } from '../../../../src/contexts/SnackbarContext';
import { Context as SurrealContext, SurrealContextValue } from '@/src/contexts/SurrealProvider'; // Added SurrealContext imports
import Surreal, { RecordId, AnyAuth } from 'surrealdb'; // Added Surreal and AnyAuth imports
import { AuthContext, AuthContextType, AppUser } from '@/src/contexts/AuthContext'; // Added AuthContext imports
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

// Create a minimal i18n instance for testing
const i18nTestInstance = {
  language: 'cimode', // Use 'cimode' to return keys themselves
  languages: ['cimode'],
  isInitialized: true,
  t: (key: string, options?: any) => {
    if (options && typeof options.defaultValue === 'string' && key === options.defaultValue) {
      return key;
    }
    if (options && options.count) {
      return `${key}_plural_${options.count}`;
    }
    // A simple way to include interpolation options in the returned string for debugging
    if (typeof options === 'object' && options !== null && Object.keys(options).length > 0 && !(options.hasOwnProperty('defaultValue'))) {
      try {
        return `${key} ${JSON.stringify(options)}`;
      } catch (e) {
        // Fallback if options cannot be stringified (e.g. circular objects)
        return `${key} [interpolation options]`;
      }
    }
    return options?.defaultValue || key;
  },
  changeLanguage: vi.fn().mockResolvedValue(Promise.resolve()),
  on: vi.fn(),
  off: vi.fn(),
  // Add any other i18n instance properties your app might rely on during testing
  // For example, if you use i18n.getFixedT or other methods directly.
  getFixedT: () => (key: string, options?: any) => i18nTestInstance.t(key, options),
  format: (value: any, format?: string, lng?: string) => String(value),
  exists: (key: string | string[], options?: any) => true,
  loadNamespaces: vi.fn().mockResolvedValue(Promise.resolve()),
  loadLanguages: vi.fn().mockResolvedValue(Promise.resolve()),
  setDefaultNamespace: vi.fn(),
  dir: (lng?: string) => 'ltr',
  reloadResources: vi.fn().mockResolvedValue(Promise.resolve()),
  options: {},
  services: {
    formatter: { add: vi.fn(), format: (value: any) => String(value) },
    interpolator: { interpolate: (str: string) => str, init: vi.fn(), reset: vi.fn(), resetRegExp: vi.fn() },
    resourceStore: { getData: () => ({}), on: vi.fn(), off: vi.fn() },
    languageUtils: { formatLanguageCode: (code: string) => code, getLanguagePartFromCode: (code: string) => code },
    pluralResolver: {needsPlural: () => false, getPluralForms: () => [], getSuffix: () => '' },
    backendConnector: { backend: null, read: vi.fn(), save: vi.fn(), create: vi.fn(), loadFlags: {}}
  },
  modules: { external: [] },
  isBound: false,
  bound: [],
   περίπου: undefined,
  hasLoadedNamespace: vi.fn().mockReturnValue(true),
  resolvedLanguage: 'cimode',
} as any; // Using 'as any' to simplify for testing, can be typed more strictly if needed

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
const mockSnackbarShowError = vi.fn();
const mockSnackbarShowWarning = vi.fn();
const mockSnackbarShowInfo = vi.fn();

// MODIFIED: Corrected SnackbarContext mock to export SnackbarProvider
vi.mock('@/src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual<typeof import('@/src/contexts/SnackbarContext')>('@/src/contexts/SnackbarContext');
  return {
    ...actual, // Retain all actual exports, including SnackbarProvider
    useSnackbar: () => ({ // Override only useSnackbar
      showSuccess: mockShowSuccess,
      showError: mockSnackbarShowError,
      showWarning: mockSnackbarShowWarning,
      showInfo: mockSnackbarShowInfo,
    }),
  };
});

// Mock react-i18next's useTranslation
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual, // Import and retain actual I18nextProvider, Trans, etc.
    useTranslation: () => ({
      t: i18nTestInstance.t, // Use the t function from our test instance
      i18n: i18nTestInstance, // Provide the whole instance if needed by components
    }),
  };
});

const theme = createTheme();

// Define mock data first as it might be used by mock instances
const initialMockCreditors = [
  { id: 'cred001', type: '组织' as const, name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000', address: '科技园路1号' },
  { id: 'cred002', type: '个人' as const, name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000', address: '文三路202号' },
  { id: 'cred003', type: '组织' as const, name: 'Beta LLC', identifier: '91330100MA2YYYYY2B', contact_person_name: 'Mike Johnson', contact_person_phone: '13700137000', address: '创新大道33号' },
];

const mockUser: AppUser = {
  id: new RecordId('user', 'testuser'),
  github_id: 'test-user-github-id',
  name: 'Test User',
  email: 'test@example.com',
  created_at: new Date(),
  updated_at: new Date(),
  last_login_case_id: null,
};

// Mock for AuthContext
const mockAuthContextValue_Auth: AuthContextType = {
  isLoggedIn: true,
  user: mockUser,
  oidcUser: null,
  setAuthState: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  isLoading: false,
  selectedCaseId: 'case:test-case-id',
  userCases: [{ id: new RecordId('case', 'test-case-id'), name: 'Test Case' }],
  currentUserCaseRoles: [{ id: new RecordId('role', 'case_manager'), name: 'case_manager'}],
  isCaseLoading: false,
  selectCase: vi.fn().mockResolvedValue(undefined),
  hasRole: vi.fn().mockImplementation((roleName: string) => {
    if (roleName === 'admin') return mockUser.github_id === '--admin--';
    return mockAuthContextValue_Auth.currentUserCaseRoles.some(role => role.name === roleName);
  }),
  refreshUserCasesAndRoles: vi.fn().mockResolvedValue(undefined),
  navMenuItems: [],
  isMenuLoading: false,
  navigateTo: null,
  clearNavigateTo: vi.fn(),
};

// Mock for SurrealContext
const mockSurrealInstance_Surreal = {
  query: vi.fn().mockImplementation(async (query: string, params: any) => {
    const caseIdParam = params && typeof params.caseId === 'string' ? params.caseId : (params?.caseId as RecordId)?.toString();

    if (caseIdParam !== 'case:test-case-id') {
        if (query.includes('count() AS total')) return Promise.resolve([{ total: 0 }]);
        return Promise.resolve([[]]);
    }

    if (query.includes('count() AS total')) {
      const search = params?.searchTerm?.toLowerCase() || '';
      const filteredCount = initialMockCreditors.filter(creditor =>
        creditor.name.toLowerCase().includes(search) ||
        creditor.identifier.toLowerCase().includes(search) ||
        (creditor.contact_person_name && creditor.contact_person_name.toLowerCase().includes(search)) ||
        (creditor.contact_person_phone && creditor.contact_person_phone.toLowerCase().includes(search)) ||
        (creditor.address && creditor.address.toLowerCase().includes(search))
      ).length;
      return Promise.resolve([{ total: filteredCount }]);
    } else if (query.startsWith('SELECT id, type, name')) {
      const limit = params?.limit !== undefined ? Number(params.limit) : 10;
      const start = params?.start !== undefined ? Number(params.start) : 0;
      const search = params?.searchTerm?.toLowerCase() || '';

      const filteredData = initialMockCreditors.filter(creditor =>
        creditor.name.toLowerCase().includes(search) ||
        creditor.identifier.toLowerCase().includes(search) ||
        (creditor.contact_person_name && creditor.contact_person_name.toLowerCase().includes(search)) ||
        (creditor.contact_person_phone && creditor.contact_person_phone.toLowerCase().includes(search)) ||
        (creditor.address && creditor.address.toLowerCase().includes(search))
      );
      const paginatedData = filteredData.slice(start, start + limit);
      return Promise.resolve([paginatedData]);
    }
    if (query.includes('count() AS total')) return Promise.resolve([{ total: 0 }]);
    return Promise.resolve([[]]);
  }),
  select: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockImplementation(async (thing: string, data: any) => Promise.resolve([{ ...data, id: new RecordId('creditor', 'newMockId') }])),
  update: vi.fn().mockImplementation(async (thing: string, data: any) => Promise.resolve([{ ...data, id: thing }])),
  merge: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue([{}]),
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
  status: 'connected',
  use: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
} as unknown as Surreal;

const mockSurrealContextValue_Surreal: SurrealContextValue = {
  surreal: mockSurrealInstance_Surreal,
  isConnecting: false,
  isSuccess: true,
  isError: false,
  error: null,
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  signin: vi.fn().mockResolvedValue({}),
  signout: vi.fn().mockResolvedValue(undefined),
};

describe('CreditorListPage', () => {
  beforeEach(() => {
    (global as any).IS_REACT_ACT_ENVIRONMENT = true; 
    vi.clearAllMocks();

    (mockSurrealInstance_Surreal.query as Mock).mockImplementation(async (query: string, params: any) => {
      const caseIdParam = params && typeof params.caseId === 'string' ? params.caseId : (params?.caseId as RecordId)?.toString();
      if (caseIdParam !== 'case:test-case-id') {
        if (query.toLowerCase().includes('count() as total')) return Promise.resolve([{ total: 0 }]);
        return Promise.resolve([[]]);
      }
      const lowerCaseQuery = query.toLowerCase();
      const searchTerm = params?.searchTerm?.toLowerCase() || '';
      if (lowerCaseQuery.includes('count() as total')) {
        const filteredCount = initialMockCreditors.filter(c => c.name.toLowerCase().includes(searchTerm) || c.identifier.toLowerCase().includes(searchTerm)).length;
        return Promise.resolve([{ total: filteredCount }]);
      } else if (lowerCaseQuery.startsWith('select ') && lowerCaseQuery.includes('from creditor')) {
        const limit = params?.limit !== undefined ? Number(params.limit) : 10;
        const start = params?.start !== undefined ? Number(params.start) : 0;
        const filteredData = initialMockCreditors.filter(c => c.name.toLowerCase().includes(searchTerm) || c.identifier.toLowerCase().includes(searchTerm));
        const paginatedData = filteredData.slice(start, start + limit);
        return Promise.resolve([paginatedData]);
      }
      console.warn(`Unhandled Surreal query in mock (caseId: ${caseIdParam}): ${query}`);
      if (lowerCaseQuery.includes('count()')) return Promise.resolve([{ total: 0 }]);
      return Promise.resolve([[]]);
    });

    (mockAuthContextValue_Auth.hasRole as Mock).mockImplementation((roleName: string) => {
      if (roleName === 'admin') return mockAuthContextValue_Auth.user?.github_id === '--admin--';
      return mockAuthContextValue_Auth.currentUserCaseRoles.some(role => role.name === roleName);
    });
  });

  afterEach(() => {
    if ((global as any).IS_REACT_ACT_ENVIRONMENT) {
      delete (global as any).IS_REACT_ACT_ENVIRONMENT;
    }
  });

  const renderCreditorListPage = () => {
    return render(
      <ThemeProvider theme={theme}>
        <SurrealContext.Provider value={mockSurrealContextValue_Surreal}>
          <AuthContext.Provider value={mockAuthContextValue_Auth}>
            <SnackbarProvider>
              <I18nextProvider i18n={i18nTestInstance}>
                <BrowserRouter>
                  <CreditorListPage />
                </BrowserRouter>
              </I18nextProvider>
            </SnackbarProvider>
          </AuthContext.Provider>
        </SurrealContext.Provider>
      </ThemeProvider>
    );
  };

  test('renders page title and initial action buttons', async () => {
    renderCreditorListPage();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

    expect(screen.getByText('creditor_list_page_title')).toBeInTheDocument();
    expect(screen.getByLabelText('search_creditors_label')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'add_single_creditor_button' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batch_import_creditors_button' })).toBeInTheDocument();
    const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
    expect(printButton).toBeDisabled();
  });

  test('renders table with initial mock creditors', async () => {
    renderCreditorListPage();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 7000 });

    expect(await screen.findByText('Acme Corp', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(await screen.findAllByText('Jane Smith', {}, { timeout: 2000 })).toHaveLength(2);
    expect(await screen.findByText('Beta LLC', {}, { timeout: 2000 })).toBeInTheDocument();

    const tableBody = screen.getByRole('table').querySelector('tbody');
    const dataRows = tableBody ? tableBody.querySelectorAll('tr') : [];
    expect(dataRows.length).toBe(initialMockCreditors.length);
  }, 10000);

  test.skip('search functionality filters creditors', async () => {
    renderCreditorListPage();
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

    const searchInput = screen.getByLabelText('search_creditors_label');
    await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Acme' } });
    });
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Beta LLC')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1–1 of 1/)).toBeInTheDocument());
  });

  describe.skip('Selection Logic', () => {
    test('individual checkbox selection works', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      
      await screen.findByText('Acme Corp'); 

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(initialMockCreditors.length + 1);
      const firstRowCheckbox = checkboxes[1];
      
      expect(firstRowCheckbox).not.toBeUndefined();
      
      fireEvent.click(firstRowCheckbox);
      
      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();

      fireEvent.click(firstRowCheckbox);
      
      expect(printButton).toBeDisabled();
    });

    test('"Select All" checkbox works', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

      await screen.findByText('Acme Corp');

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(initialMockCreditors.length + 1);
      const selectAllCheckbox = checkboxes[0];
      expect(selectAllCheckbox).not.toBeUndefined();
      
      fireEvent.click(selectAllCheckbox);
      
      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();

      fireEvent.click(selectAllCheckbox);
      
      expect(printButton).toBeDisabled();
    });
  });

  describe.skip('Dialog Interactions', () => {
    test('AddCreditorDialog opens for adding, saves, and closes', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

      const addButton = await screen.findByRole('button', { name: 'add_single_creditor_button' });
      fireEvent.click(addButton);
      
      const dialog = await screen.findByTestId('mock-add-creditor-dialog');
      expect(dialog).toBeVisible();
      expect(mockAddCreditorDialog).toHaveBeenCalledWith(expect.objectContaining({ open: true, existingCreditor: null }));

      const saveButtonInDialog = within(dialog).getByRole('button', { name: 'Save Creditor' });
      fireEvent.click(saveButtonInDialog);
      
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditor_added_success');
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      expect(await screen.findByText('New/Edited Creditor')).toBeInTheDocument();
      
      await waitFor(() => {
         expect(screen.getByTestId('mock-add-creditor-dialog')).toHaveAttribute('data-open', 'false');
      });
    });

    test('AddCreditorDialog opens for editing, saves, and closes', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      
      const acmeRow = await screen.findByText('Acme Corp');
      const parentRow = acmeRow.closest('tr');
      expect(parentRow).not.toBeNull();
      if (!parentRow) return;

      const editButton = within(parentRow).getByRole('button', { name: 'edit creditor' });
      fireEvent.click(editButton);
      
      const dialog = await screen.findByTestId('mock-add-creditor-dialog');
      expect(dialog).toBeVisible();
      expect(mockAddCreditorDialog).toHaveBeenCalledWith(expect.objectContaining({ 
        open: true, 
        existingCreditor: expect.objectContaining({ name: 'Acme Corp' }) 
      }));

      const saveButtonInDialog = within(dialog).getByRole('button', { name: 'Save Creditor' });
      fireEvent.click(saveButtonInDialog);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditor_updated_success');
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      expect(await screen.findByText('New/Edited Creditor')).toBeInTheDocument(); 
      await waitFor(() => {
        expect(screen.getByTestId('mock-add-creditor-dialog')).toHaveAttribute('data-open', 'false');
      });
    });

    test('BatchImportCreditorsDialog opens, imports, and closes', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

      const importButton = await screen.findByRole('button', { name: 'batch_import_creditors_button' });
      fireEvent.click(importButton);
      
      const dialog = await screen.findByTestId('mock-batch-import-dialog');
      expect(dialog).toBeVisible();
      expect(mockBatchImportDialog).toHaveBeenCalledWith(expect.objectContaining({ open: true }));

      const importFileButtonInDialog = within(dialog).getByRole('button', { name: 'Import File' });
      fireEvent.click(importFileButtonInDialog);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditors_imported_success');
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      await waitFor(() => {
         expect(screen.getByTestId('mock-batch-import-dialog')).toHaveAttribute('data-open', 'false');
      });
    });

    test('PrintWaybillsDialog opens and closes', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      
      await screen.findByText('Acme Corp');

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(initialMockCreditors.length + 1);
      const firstRowCheckbox = checkboxes[1]; 
      expect(firstRowCheckbox).not.toBeUndefined();
      fireEvent.click(firstRowCheckbox);

      const printButton = screen.getByRole('button', { name: 'print_waybill_button' });
      expect(printButton).not.toBeDisabled();
      fireEvent.click(printButton);
      
      const dialog = await screen.findByTestId('mock-print-waybills-dialog');
      expect(dialog).toBeVisible();
      expect(mockPrintWaybillsDialog).toHaveBeenCalledWith(expect.objectContaining({ 
        open: true, 
        selectedCreditors: expect.arrayContaining([expect.objectContaining({ name: 'Acme Corp' })])
      }));
      
      const closeButtonInDialog = within(dialog).getByRole('button', { name: 'Close Print' });
      fireEvent.click(closeButtonInDialog);
      await waitFor(() => {
        expect(screen.getByTestId('mock-print-waybills-dialog')).toHaveAttribute('data-open', 'false');
      });
    });
  });

  describe.skip('Delete button interactions', () => {
    test('opens confirmation, deletes on confirm, and updates list', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

      const acmeRowElement = await screen.findByText('Acme Corp');
      const parentRow = acmeRowElement.closest('tr');
      expect(parentRow).not.toBeNull();
      if (!parentRow) return;

      const deleteButton = within(parentRow).getByRole('button', { name: 'delete creditor' });
      fireEvent.click(deleteButton);

      const dialog = await screen.findByTestId('mock-confirm-delete-dialog');
      expect(dialog).toBeVisible();
      expect(mockConfirmDeleteDialog).toHaveBeenCalledWith(expect.objectContaining({ 
        open: true, 
        title: 'confirm_delete_creditor_title',
      }));

      const confirmButtonInDialog = within(dialog).getByRole('button', { name: 'Confirm Delete' });
      fireEvent.click(confirmButtonInDialog);

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('creditor_deleted_success');
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });
      await waitFor(() => {
        expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
      });
      if (initialMockCreditors.length > 1) {
        expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
      }
    });

    test('opens confirmation, cancellation keeps creditor', async () => {
      renderCreditorListPage();
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(), { timeout: 4000 });

      const acmeRowElement = await screen.findByText('Acme Corp');
      const parentRow = acmeRowElement.closest('tr');
      expect(parentRow).not.toBeNull();
      if (!parentRow) return;

      const deleteButton = within(parentRow).getByRole('button', { name: 'delete creditor' });
      fireEvent.click(deleteButton);

      const dialog = await screen.findByTestId('mock-confirm-delete-dialog');
      expect(dialog).toBeVisible();

      const cancelButtonInDialog = within(dialog).getByRole('button', { name: 'Cancel Delete' });
      fireEvent.click(cancelButtonInDialog);

      await waitFor(() => {
        expect(mockConfirmDeleteDialog).toHaveBeenCalledWith(expect.objectContaining({ open: false }));
      });
      expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    });
  });
});
