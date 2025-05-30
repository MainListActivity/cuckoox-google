import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
import ClaimAttachmentPage from '@/src/pages/claims/attachment';
import { Delta } from 'quill/core';

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockClaimId = 'CLAIM-MOCK-123';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ claimId: mockClaimId }),
  };
});

// Mock RichTextEditor
vi.mock('../../../../src/components/RichTextEditor', () => ({
  __esModule: true,
  default: vi.fn(({ value, onChange }) => ( // Adjusted to onChange
    <textarea
      data-testid="mocked-rich-text-editor"
      value={value instanceof Delta ? JSON.stringify(value.ops) : ''} // Handle Delta object
      onChange={(e) => {
        // Simulate Delta for onChange
        const mockDelta = new Delta().insert(e.target.value);
        if (onChange) {
          onChange(mockDelta); // Pass only the new Delta
        }
      }}
    />
  )),
}));


// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../../../../src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
  return {
    ...actual,
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: vi.fn(),
      showInfo: vi.fn(),
    }),
  };
});

describe('ClaimAttachmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <SnackbarProvider>
            <ClaimAttachmentPage />
          </SnackbarProvider>
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  // Rendering Test
  it('renders the page, displays claimId, and shows RichTextEditor', () => {
    renderComponent();
    expect(screen.getByText('编辑附件材料')).toBeInTheDocument();
    expect(screen.getByText(mockClaimId)).toBeInTheDocument(); // Check if claimId is displayed
    expect(screen.getByTestId('mocked-rich-text-editor')).toBeInTheDocument();
  });

  // Button Actions & Navigation Tests
  it('clicking "返回修改基本信息" calls navigate with the correct path', () => {
    renderComponent();
    const backButton = screen.getByRole('button', { name: '返回修改基本信息' });
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(`/claims/submit/${mockClaimId}`);
  });

  it('handleSaveDraft logs correctly and shows a snackbar', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    renderComponent();
    const saveDraftButton = screen.getByRole('button', { name: '保存草稿' });
    
    // Simulate adding content to editor to make it "dirty" if needed by actual logic
    const editor = screen.getByTestId('mocked-rich-text-editor');
    fireEvent.change(editor, { target: { value: 'Draft content.' } });
    
    fireEvent.click(saveDraftButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Saving draft for claim ID: ${mockClaimId}`),
        expect.any(String) // For the JSON.stringify(editorContent.ops)
      );
    });
    // Check if either success or error was called (depends on Math.random)
    expect(mockShowSuccess.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0);
    consoleSpy.mockRestore();
  });

  it('handleSubmitClaim logs correctly, shows a snackbar, and calls navigate', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    renderComponent();
    const submitClaimButton = screen.getByRole('button', { name: '提交申报' });

    // Simulate adding content
    const editor = screen.getByTestId('mocked-rich-text-editor');
    fireEvent.change(editor, { target: { value: 'Final claim content.' } });

    fireEvent.click(submitClaimButton);

    await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Submitting claim ID: ${mockClaimId}`),
            expect.any(String) // For the JSON.stringify(editorContent.ops)
        );
    });
    
    // Check if either success or error was called (depends on Math.random)
    expect(mockShowSuccess.mock.calls.length + mockShowError.mock.calls.length).toBeGreaterThan(0);

    // If submission was successful, navigate should have been called
    if (mockShowSuccess.mock.calls.length > 0) {
        expect(mockNavigate).toHaveBeenCalledWith(`/my-claims/${mockClaimId}/submitted`);
    }
    consoleSpy.mockRestore();
  });
});
