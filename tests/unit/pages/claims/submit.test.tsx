import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom'; // For useNavigate
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
import ClaimSubmissionPage from '@/src/pages/claims/submit';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();

vi.mock('../../../../src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('../../../../src/contexts/SnackbarContext');
  return {
    ...actual, // Spread actual to keep SnackbarProvider if it's used by the test directly
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: mockShowInfo,
      showWarning: mockShowWarning,
    }),
  };
});

describe('ClaimSubmissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any open handles
    vi.clearAllMocks();
    
    // Force cleanup of any pending promises
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Clear any timers
    vi.clearAllTimers();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <SnackbarProvider> {/* Actual provider to allow useSnackbar mock to work */}
            <ClaimSubmissionPage />
          </SnackbarProvider>
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  // Rendering Test
  it('renders the form with required fields', () => {
    renderComponent();
    expect(screen.getByText('填写债权基本信息')).toBeInTheDocument();
    expect(screen.getByLabelText(/债权性质/)).toBeInTheDocument();
    expect(screen.getByLabelText(/本金/)).toBeInTheDocument();
    expect(screen.getByLabelText(/币种/)).toBeInTheDocument();
    expect(screen.getByLabelText(/利息/)).toBeInTheDocument();
    expect(screen.getByLabelText(/其他费用/)).toBeInTheDocument();
    expect(screen.getByLabelText(/债权总额/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存并下一步（编辑附件）' })).toBeInTheDocument();
  });

  // Validation Tests
  it('shows an error if required fields are empty on submit', async () => {
    renderComponent();
    const submitButton = screen.getByRole('button', { name: '保存并下一步（编辑附件）' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // It's possible the inline error appears, and then the snackbar.
      // Ensure both are checked within a single waitFor if their appearance is coupled.
      expect(screen.getByText('本金不能为空')).toBeInTheDocument();
      expect(mockShowError).toHaveBeenCalledWith('请修正表单中的错误。');
    }, { timeout: 2000 }); // Explicit longer timeout for safety
    // Note: Default values for select might prevent '不能为空' for claimNature and currency initially
  });

  it('shows an error if principal is not a positive number', async () => {
    renderComponent();
    fireEvent.change(screen.getByLabelText(/本金/), { target: { value: '0' } });
    const submitButton = screen.getByRole('button', { name: '保存并下一步（编辑附件）' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('本金必须为正数')).toBeInTheDocument();
      expect(mockShowError).toHaveBeenCalledWith('请修正表单中的错误。'); // Changed to mockShowError
    });
  });

  // Total Amount Calculation Test
  it('updates totalAmount when principal, interest, or otherFees change', () => {
    renderComponent();
    const principalInput = screen.getByLabelText(/本金/);
    const interestInput = screen.getByLabelText(/利息/);
    const otherFeesInput = screen.getByLabelText(/其他费用/);
    const totalAmountDisplay = screen.getByLabelText(/债权总额/) as HTMLInputElement;

    fireEvent.change(principalInput, { target: { value: '1000' } });
    expect(totalAmountDisplay.value).toMatch(/1,000\.00/);

    fireEvent.change(interestInput, { target: { value: '100' } });
    expect(totalAmountDisplay.value).toMatch(/1,100\.00/);
    
    fireEvent.change(otherFeesInput, { target: { value: '50' } });
    expect(totalAmountDisplay.value).toMatch(/1,150\.00/);
    
    fireEvent.change(principalInput, { target: { value: '2000' } });
    expect(totalAmountDisplay.value).toMatch(/2,150\.00/);
  });

  // Navigation on Submit Test
  it('navigates to attachment page with claimId on successful submission', async () => {
    renderComponent();
    
    // Fill required fields
    // For MUI Select: first click the select to open it, then click the option.
    const claimNatureSelect = screen.getByLabelText(/债权性质/);
    fireEvent.mouseDown(claimNatureSelect);
    const optionOrdinary = await screen.findByRole('option', { name: '普通债权' });
    fireEvent.click(optionOrdinary);

    fireEvent.change(screen.getByLabelText(/本金/), { target: { value: '5000' } });

    const currencySelect = screen.getByLabelText(/币种/);
    fireEvent.mouseDown(currencySelect);
    const optionCNY = await screen.findByRole('option', { name: 'CNY' });
    fireEvent.click(optionCNY);

    const submitButton = screen.getByRole('button', { name: '保存并下一步（编辑附件）' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('债权基本信息已保存。'); // Changed to mockShowSuccess
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/claim-attachment/CLAIM-'));
    });
  });
});
