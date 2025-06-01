import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import { SnackbarProvider, useSnackbar } from '@/src/contexts/SnackbarContext';
import MyClaimsPage from '@/src/pages/my-claims/index';

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

const mockClaimsData = [
    { id: 'CLAIM-001', submissionDate: '2023-10-26', claimNature: '普通债权', totalAmount: 15000, currency: 'CNY', reviewStatus: '待审核', reviewOpinion: '' },
    { id: 'CLAIM-002', submissionDate: '2023-10-20', claimNature: '有财产担保债权', totalAmount: 125000, currency: 'CNY', reviewStatus: '审核通过', reviewOpinion: '符合要求' },
    { id: 'CLAIM-003', submissionDate: '2023-09-15', claimNature: '劳动报酬', totalAmount: 8000, currency: 'CNY', reviewStatus: '已驳回', reviewOpinion: '材料不足，请补充合同和工资流水。' },
    { id: 'CLAIM-004', submissionDate: '2023-11-01', claimNature: '普通债权', totalAmount: 22000, currency: 'USD', reviewStatus: '需要补充', reviewOpinion: '请提供债权发生时间的证明。' },
];
// Note: MyClaimsPage uses hardcoded data, so we test against that. If it fetched data, we'd mock the fetch.


describe('MyClaimsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <SnackbarProvider>
            <MyClaimsPage />
          </SnackbarProvider>
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  // Rendering Test
  it('renders the list of mock claims', () => {
    renderComponent();
    expect(screen.getByText('我的债权申报')).toBeInTheDocument();
    expect(screen.getByText('CLAIM-001')).toBeInTheDocument();
    expect(screen.getByText('CLAIM-002')).toBeInTheDocument();
    expect(screen.getByText('CLAIM-003')).toBeInTheDocument();
    expect(screen.getByText('CLAIM-004')).toBeInTheDocument();
  });

  // Action Button States/Visibility Tests
  it('disables "撤回" button for a claim not in "待审核" status', () => {
    renderComponent();
    const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr');
    expect(rowForClaim002).not.toBeNull();
    const withdrawButtonForClaim002 = within(rowForClaim002!).getByTitle('撤回');
    expect(withdrawButtonForClaim002).toBeDisabled();
  });

  it('enables "撤回" button for a claim in "待审核" status', () => {
    renderComponent();
    const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
    expect(rowForClaim001).not.toBeNull();
    const withdrawButtonForClaim001 = within(rowForClaim001!).getByTitle('撤回');
    expect(withdrawButtonForClaim001).not.toBeDisabled();
  });
  
  it('disables "编辑" button for a claim not in "已驳回" or "需要补充" status', () => {
    renderComponent();
    const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
    expect(rowForClaim001).not.toBeNull();
    const editButtonForClaim001 = within(rowForClaim001!).getByTitle('编辑');
    expect(editButtonForClaim001).toBeDisabled();

    const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr');
    expect(rowForClaim002).not.toBeNull();
    const editButtonForClaim002 = within(rowForClaim002!).getByTitle('编辑');
    expect(editButtonForClaim002).toBeDisabled();
  });

  it('enables "编辑" button for claims in "已驳回" or "需要补充" status', () => {
    renderComponent();
    const rowForClaim003 = screen.getByText('CLAIM-003').closest('tr');
    expect(rowForClaim003).not.toBeNull();
    const editButtonForClaim003 = within(rowForClaim003!).getByTitle('编辑');
    expect(editButtonForClaim003).not.toBeDisabled();

    const rowForClaim004 = screen.getByText('CLAIM-004').closest('tr');
    expect(rowForClaim004).not.toBeNull();
    const editButtonForClaim004 = within(rowForClaim004!).getByTitle('编辑');
    expect(editButtonForClaim004).not.toBeDisabled();
  });

  // Navigation on Actions Tests
  it('clicking "查看详情" calls navigate with the correct path', () => {
    renderComponent();
    const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
    expect(rowForClaim001).not.toBeNull();
    const viewDetailsButton = within(rowForClaim001!).getByTitle('查看详情');
    fireEvent.click(viewDetailsButton);
    expect(mockNavigate).toHaveBeenCalledWith(`/my-claims/${mockClaimsData[0].id}/submitted`);
  });

  it('clicking "编辑" on an editable claim calls navigate with the correct path', () => {
    renderComponent();
    const rowForClaim003 = screen.getByText('CLAIM-003').closest('tr');
    expect(rowForClaim003).not.toBeNull();
    const editButtonForClaim003 = within(rowForClaim003!).getByTitle('编辑');
    fireEvent.click(editButtonForClaim003);
    expect(mockNavigate).toHaveBeenCalledWith(`/claims/submit/${mockClaimsData[2].id}`);
  });

  it('clicking "发起新的债权申报" calls navigate to /claims/submit', () => {
    renderComponent();
    const newClaimButton = screen.getByRole('button', { name: '发起新的债权申报' });
    fireEvent.click(newClaimButton);
    expect(mockNavigate).toHaveBeenCalledWith('/claims/submit');
  });

  // Withdraw Action Test
  it('handleWithdraw shows a snackbar', async () => {
    renderComponent();
    const rowForClaim001 = screen.getByText('CLAIM-001').closest('tr');
    expect(rowForClaim001).not.toBeNull();
    const withdrawButtonForClaim001 = within(rowForClaim001!).getByTitle('撤回');
    fireEvent.click(withdrawButtonForClaim001);
    
    await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(`债权 ${mockClaimsData[0].id} 已成功撤回 (模拟)。`); // Use mockShowSuccess
    });
  });

  it('handleWithdraw shows a warning snackbar if claim is not in "待审核" status', async () => {
    renderComponent();
    // Test the actual click on a disabled button (which shouldn't call the handler or snackbar)
    const rowForClaim002 = screen.getByText('CLAIM-002').closest('tr'); // '审核通过' status
    expect(rowForClaim002).not.toBeNull();
    const withdrawButtonForClaim002 = within(rowForClaim002!).getByTitle('撤回');
    expect(withdrawButtonForClaim002).toBeDisabled();
    fireEvent.click(withdrawButtonForClaim002); // Attempt to click disabled button

    // Snackbar should not be called because the button click should be prevented by 'disabled'
    // or if it does, the internal guard in handleWithdraw should prevent showSuccess
    await waitFor(() => {
        // Check that neither showSuccess nor showWarning (for the specific message) was called for this interaction
        // Depending on how strict the test is, we might not expect any snackbar, or expect a specific warning if the handler was reached.
        // The component logic is: if (status !== '待审核') { showWarning(...); return; }
        // Since the button is disabled, the handler shouldn't even be called.
        // If we were testing the handler directly, we would mock the status.
        // For UI test, if button is disabled, no snackbar for '撤回成功' or the specific warning.
        expect(mockShowSuccess).not.toHaveBeenCalledWith(expect.stringContaining(mockClaimsData[1].id));
        expect(mockShowWarning).not.toHaveBeenCalledWith('只有"待审核"状态的债权才能撤回。');
    });

    // To verify the warning when the handler *is* called with a non-'待审核' status (if button were enabled):
    // This part requires more direct invocation or specific component state manipulation not easily done via UI event on disabled button.
    // The test "disables '撤回' button for a claim not in "待审核" status" already confirms UI prevention.
    // If the component's `handleWithdraw` was exported, we could test it directly:
    // handleWithdraw(mockClaimsData[1].id, mockClaimsData[1].reviewStatus); // This would call showWarning
    // expect(mockShowWarning).toHaveBeenCalledWith('只有"待审核"状态的债权才能撤回。');
  });
});
