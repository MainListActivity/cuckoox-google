import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom'; // For useNavigate
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '../contexts/SnackbarContext';
import ClaimSubmissionPage from './ClaimSubmissionPage';

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
const mockShowSnackbar = vi.fn();
vi.mock('../contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('../contexts/SnackbarContext');
  return {
    ...actual,
    useSnackbar: () => ({
      showSnackbar: mockShowSnackbar,
    }),
  };
});

describe('ClaimSubmissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockShowSnackbar).toHaveBeenCalledWith('请修正表单中的错误。', 'error');
    });
    // Check for specific error messages (optional, but good)
    expect(screen.getByText('本金不能为空')).toBeInTheDocument(); 
    // Note: Default values for select might prevent '不能为空' for claimNature and currency initially
  });

  it('shows an error if principal is not a positive number', async () => {
    renderComponent();
    fireEvent.change(screen.getByLabelText(/本金/), { target: { value: '0' } });
    const submitButton = screen.getByRole('button', { name: '保存并下一步（编辑附件）' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('本金必须为正数')).toBeInTheDocument();
      expect(mockShowSnackbar).toHaveBeenCalledWith('请修正表单中的错误。', 'error');
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
    fireEvent.change(screen.getByLabelText(/债权性质/), { target: { value: '普通债权' } });
    fireEvent.change(screen.getByLabelText(/本金/), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText(/币种/), { target: { value: 'CNY' } });

    const submitButton = screen.getByRole('button', { name: '保存并下一步（编辑附件）' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith('债权基本信息已保存。', 'success');
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/claim-attachment/CLAIM-'));
    });
  });
});
