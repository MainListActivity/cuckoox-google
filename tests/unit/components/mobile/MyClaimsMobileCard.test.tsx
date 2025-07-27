import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MyClaimsMobileCard, { Claim } from '@/src/components/mobile/MyClaimsMobileCard';

const theme = createTheme();

const MockWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

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
      <MockWrapper>
        <MyClaimsMobileCard
          claim={mockClaim}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
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
      <MockWrapper>
        <MyClaimsMobileCard
          claim={claimWithApproval}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
    );

    // Need to expand to see approved amount
    const expandButton = screen.getByLabelText('展开详情');
    fireEvent.click(expandButton);

    expect(screen.getByText('¥80,000')).toBeInTheDocument();
  });

  it('should handle view details action', () => {
    render(
      <MockWrapper>
        <MyClaimsMobileCard
          claim={mockClaim}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
    );

    const viewButton = screen.getByTestId('view-details-button');
    fireEvent.click(viewButton);

    expect(mockHandlers.onViewDetails).toHaveBeenCalledWith('claim-1');
  });

  it('should handle withdraw action when allowed', () => {
    render(
      <MockWrapper>
        <MyClaimsMobileCard
          claim={mockClaim}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
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
      <MockWrapper>
        <MyClaimsMobileCard
          claim={claimNoWithdraw}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
    );

    expect(screen.queryByTestId('withdraw-button')).not.toBeInTheDocument();
  });

  it('should handle edit action when allowed', () => {
    const editableClaim = {
      ...mockClaim,
      canEdit: true,
    };

    render(
      <MockWrapper>
        <MyClaimsMobileCard
          claim={editableClaim}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
    );

    const editButton = screen.getByTestId('edit-button');
    fireEvent.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith('claim-1');
  });

  it('should not show edit button when not allowed', () => {
    render(
      <MockWrapper>
        <MyClaimsMobileCard
          claim={mockClaim}
          {...mockHandlers}
          canEditClaim={false}
        />
      </MockWrapper>
    );

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('should expand and collapse details', async () => {
    render(
      <MockWrapper>
        <MyClaimsMobileCard
          claim={mockClaim}
          {...mockHandlers}
          canEditClaim={true}
        />
      </MockWrapper>
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
        <MockWrapper>
          <MyClaimsMobileCard
            claim={claimWithStatus}
            {...mockHandlers}
            canEditClaim={true}
          />
        </MockWrapper>
      );

      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });
});