import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Assuming your i18n setup is here
import { SurrealProvider } from '@/src/contexts/SurrealProvider';
import { AuthContext } from '@/src/contexts/AuthContext';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import CreateCasePage from '@/src/pages/cases/create';

// Mocks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../../../src/components/RichTextEditor', () => ({
  __esModule: true,
  default: vi.fn(({ value, onTextChange, placeholder, readOnly }) => (
    <textarea
      data-testid="mocked-rich-text-editor"
      placeholder={placeholder}
      readOnly={readOnly}
      value={typeof value === 'string' ? value : JSON.stringify(value?.ops)}
      onChange={(e) => {
        // Simulate a QuillDelta-like object for onTextChange
        const mockDelta = { ops: [{ insert: e.target.value }] };
        if (onTextChange) {
          onTextChange(mockDelta, mockDelta, 'user');
        }
      }}
    />
  )),
}));


const mockSurrealClient = {
  create: vi.fn().mockResolvedValue([{ id: 'document:testdocid' }]),
  merge: vi.fn().mockResolvedValue({}),
  live: vi.fn().mockImplementation(async () => {
    // Mock the async generator
    async function* stream() {
      // yield { action: 'UPDATE', result: { content: '{"ops":[{"insert":"test"}]}', last_edited_by: 'otherUser' } };
    }
    return stream();
  }),
  kill: vi.fn().mockResolvedValue({}),
};

const mockUser = {
  id: 'user:testuserid',
  // ... other user properties
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};


describe('CreateCasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset date states for each test if they were module-level (they are component state, so fine)
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <SurrealProvider client={mockSurrealClient as any}>
            <AuthContext.Provider value={{ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn(), token: 'test-token' }}>
              <SnackbarProvider>
                <CreateCasePage />
              </SnackbarProvider>
            </AuthContext.Provider>
          </SurrealProvider>
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  it('should auto-populate announcementDate when acceptanceDate is filled and procedure is bankruptcy-related', async () => {
    renderComponent();

    // Wait for editor to finish its initial loading/creation logic if any async ops are involved
    // This might involve waiting for the mockSurrealClient.create('document') to resolve
    await waitFor(() => expect(mockSurrealClient.create).toHaveBeenCalledWith('document', expect.anything()));
    
    // Select "破产清算" (Liquidation) as case procedure - it's the default, but we can be explicit
    const caseProcedureSelect = screen.getByLabelText(/案件程序/); // Adjust if label changes
    fireEvent.mouseDown(caseProcedureSelect); // Open the select dropdown
    // Assuming MUI structure, options might not be directly in DOM until open
    // For simplicity, if '破产清算' is default, this step might not be needed or might need specific MUI way to select
    // Let's assume '破产清算' is already selected or easily selectable.
    // fireEvent.click(screen.getByText('破产清算')); // if options are rendered

    // Fill in the acceptance date
    const acceptanceDateInput = screen.getByLabelText(/受理时间/); // Adjust if label changes
    fireEvent.change(acceptanceDateInput, { target: { value: '2023-10-01' } });
    
    // Check the announcement date
    const announcementDateInput = screen.getByLabelText(/公告时间/) as HTMLInputElement; // Adjust if label changes
    
    const expectedDate = new Date(2023, 9, 26); // 2023-10-01 + 25 days
    const expectedDateString = formatDate(expectedDate);

    await waitFor(() => {
      expect(announcementDateInput.value).toBe(expectedDateString);
    });

    // Also test claim start and end dates based on the new announcement date
    const claimStartDateInput = screen.getByLabelText(/债权申报开始时间/) as HTMLInputElement;
    const claimEndDateInput = screen.getByLabelText(/债权申报截止时间/) as HTMLInputElement;

    const expectedClaimStartDate = new Date(2023, 9, 26); // announcementDate
    expectedClaimStartDate.setDate(expectedClaimStartDate.getDate() + 30);
    const expectedClaimStartDateString = formatDate(expectedClaimStartDate);

    const expectedClaimEndDate = new Date(2023, 9, 26); // announcementDate
    expectedClaimEndDate.setMonth(expectedClaimEndDate.getMonth() + 3);
    const expectedClaimEndDateString = formatDate(expectedClaimEndDate);
    
    await waitFor(() => {
        expect(claimStartDateInput.value).toBe(expectedClaimStartDateString);
        expect(claimEndDateInput.value).toBe(expectedClaimEndDateString);
    });

  });
});
