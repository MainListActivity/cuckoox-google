import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { render } from '../../utils/testUtils';
import MyClaimsMobileCard, { Claim } from '@/src/components/mobile/MyClaimsMobileCard';

// Remove MockWrapper as we now use testUtils

describe('MyClaimsMobileCard', () => {
  const mockClaim: Claim = {
    id: 'claim-1',
    claimNumber: 'CL-2024-001',
    submissionDate: '2024-01-15',
    claimNature: '普通债权',
    totalAmount: 100000,
    currency: 'CNY',
    reviewStatus: '待审核',
    reviewOpinion: '需要补充材料',
    canWithdraw: true,
    canEdit: false,
    approvedAmount: undefined,
  };

  const mockHandlers = {
    onViewDetails: vi.fn(),
    onWithdraw: vi.fn(),
    onEdit: vi.fn(),
    formatCurrencyDisplay: vi.fn((amount: number, currency: string) => `¥${amount.toLocaleString()}`),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render claim information correctly', () => {
    render(
      <MyClaimsMobileCard
        claim={mockClaim}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    expect(screen.getByText('CL-2024-001')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('普通债权')).toBeInTheDocument();
    expect(screen.getByText('¥100,000')).toBeInTheDocument();
    expect(screen.getByText('待审核')).toBeInTheDocument();
  });

  it('should show approved amount when available', () => {
    const claimWithApproval = {
      ...mockClaim,
      approvedAmount: 80000,
      reviewStatus: '审核通过' as const,
    };

    render(
      <MyClaimsMobileCard
        claim={claimWithApproval}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    // Need to expand to see approved amount
    const expandButton = screen.getByLabelText('展开详情');
    fireEvent.click(expandButton);

    expect(screen.getByText('¥80,000')).toBeInTheDocument();
  });

  it('should handle view details action', () => {
    render(
      <MyClaimsMobileCard
        claim={mockClaim}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    const viewButton = screen.getByTestId('view-details-button');
    fireEvent.click(viewButton);

    expect(mockHandlers.onViewDetails).toHaveBeenCalledWith('claim-1');
  });

  it('should handle withdraw action when allowed', () => {
    render(
      <MyClaimsMobileCard
        claim={mockClaim}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    const withdrawButton = screen.getByTestId('withdraw-button');
    fireEvent.click(withdrawButton);

    expect(mockHandlers.onWithdraw).toHaveBeenCalledWith('claim-1', mockClaim);
  });

  it('should not show withdraw button when not allowed', () => {
    const claimNoWithdraw = {
      ...mockClaim,
      canWithdraw: false,
    };

    render(
      <MyClaimsMobileCard
        claim={claimNoWithdraw}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    expect(screen.queryByTestId('withdraw-button')).not.toBeInTheDocument();
  });

  it('should handle edit action when allowed', () => {
    const editableClaim = {
      ...mockClaim,
      canEdit: true,
    };

    render(
      <MyClaimsMobileCard
        claim={editableClaim}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    const editButton = screen.getByTestId('edit-button');
    fireEvent.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith('claim-1');
  });

  it('should not show edit button when not allowed', () => {
    render(
      <MyClaimsMobileCard
        claim={mockClaim}
        {...mockHandlers}
        canEditClaim={false}
      />
    );

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('should expand and collapse details', async () => {
    render(
      <MyClaimsMobileCard
        claim={mockClaim}
        {...mockHandlers}
        canEditClaim={true}
      />
    );

    // Find expand button
    const expandButton = screen.getByLabelText('展开详情');
    expect(expandButton).toBeInTheDocument();

    // Expand
    fireEvent.click(expandButton);

    // Now review opinion should be visible
    expect(screen.getByText('需要补充材料')).toBeInTheDocument();

    // Check that button text changed to collapse
    const collapseButton = screen.getByLabelText('收起详情');
    expect(collapseButton).toBeInTheDocument();

    // Collapse
    fireEvent.click(collapseButton);

    // Check that button text changed back to expand
    expect(screen.getByLabelText('展开详情')).toBeInTheDocument();
  });

  it('should display correct status chip colors', () => {
    const statuses: Array<{ status: Claim['reviewStatus'], expectedClass: string }> = [
      { status: '待审核', expectedClass: 'MuiChip-colorWarning' },
      { status: '审核通过', expectedClass: 'MuiChip-colorSuccess' },
      { status: '已驳回', expectedClass: 'MuiChip-colorError' },
      { status: '需要补充', expectedClass: 'MuiChip-colorInfo' },
    ];

    statuses.forEach(({ status }) => {
      const claimWithStatus = {
        ...mockClaim,
        reviewStatus: status,
      };

      const { unmount } = render(
        <MyClaimsMobileCard
          claim={claimWithStatus}
          {...mockHandlers}
          canEditClaim={true}
        />
      );

      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });
});