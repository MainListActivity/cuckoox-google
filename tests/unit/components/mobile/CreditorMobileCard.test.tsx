import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { render } from '../../utils/testUtils';
import CreditorMobileCard, { Creditor } from '@/src/components/mobile/CreditorMobileCard';

// Remove MockWrapper as we now use testUtils

describe('CreditorMobileCard', () => {
  const mockCreditor: Creditor = {
    id: 'creditor-1',
    name: '测试债权人',
    identifier: '123456789012345678',
    contact_person_name: '张三',
    contact_person_phone: '13800138000',
    address: '北京市朝阳区测试街道123号',
    type: '个人',
    case_id: 'case-1',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-16T10:30:00Z',
    total_claim_amount: 150000,
    claim_count: 2,
  };

  const mockHandlers = {
    onSelectionChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onViewClaims: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('should render creditor information correctly', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    expect(screen.getByText('测试债权人')).toBeInTheDocument();
    expect(screen.getByText('123456789012345678')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getByText('个人')).toBeInTheDocument();
    expect(screen.getByText('¥150,000.00')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should render organization type correctly', () => {
    const orgCreditor = {
      ...mockCreditor,
      type: '组织' as const,
      name: '测试公司',
    };

    render(
      <CreditorMobileCard
        creditor={orgCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    expect(screen.getByText('组织')).toBeInTheDocument();
    expect(screen.getByText('测试公司')).toBeInTheDocument();
  });

  it('should handle selection change', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockHandlers.onSelectionChange).toHaveBeenCalledWith('creditor-1', true);
  });

  it('should show selected state correctly', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={true}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should handle edit action when permitted', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={false}
      />
    );

    const editButton = screen.getByLabelText('编辑债权人');
    fireEvent.click(editButton);

    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockCreditor);
  });

  it('should not show edit button when not permitted', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={false}
        canDelete={true}
      />
    );

    expect(screen.queryByLabelText('编辑债权人')).not.toBeInTheDocument();
  });

  it('should handle delete action when permitted', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={false}
        canDelete={true}
      />
    );

    const deleteButton = screen.getByLabelText('删除债权人');
    fireEvent.click(deleteButton);

    expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockCreditor);
  });

  it('should not show delete button when not permitted', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={false}
      />
    );

    expect(screen.queryByLabelText('删除债权人')).not.toBeInTheDocument();
  });

  it('should handle view claims action when creditor has claims', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    // Find the claims summary section and click on it
    const claimsCount = screen.getByText('2');
    const claimsSection = claimsCount.closest('div');
    expect(claimsSection).toBeInTheDocument();
    
    // Click on the claims section
    fireEvent.click(claimsSection!);

    expect(mockHandlers.onViewClaims).toHaveBeenCalledWith(mockCreditor);
  });

  it('should not make claims clickable when creditor has no claims', () => {
    const creditorNoClaims = {
      ...mockCreditor,
      claim_count: 0,
      total_claim_amount: 0,
    };

    const { container } = render(
      <CreditorMobileCard
        creditor={creditorNoClaims}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    const claimsCount = screen.getByText('0');
    const claimsSection = claimsCount.closest('div');
    
    // Click on the claims section
    fireEvent.click(claimsSection!);

    // Should not trigger onViewClaims for creditors with no claims
    expect(mockHandlers.onViewClaims).not.toHaveBeenCalled();
  });

  it('should expand and collapse details', () => {
    render(
      <CreditorMobileCard
        creditor={mockCreditor}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    // Find expand button
    const expandButton = screen.getByLabelText('展开详情');
    expect(expandButton).toBeInTheDocument();

    // Expand
    fireEvent.click(expandButton);

    // Now detailed information should be visible
    expect(screen.getByText('联系地址')).toBeInTheDocument();
    expect(screen.getByText('北京市朝阳区测试街道123号')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();

    // Check that button text changed to collapse
    const collapseButton = screen.getByLabelText('收起详情');
    expect(collapseButton).toBeInTheDocument();

    // Collapse
    fireEvent.click(collapseButton);

    // Check that button text changed back to expand
    expect(screen.getByLabelText('展开详情')).toBeInTheDocument();
  });

  it('should display correct currency formatting', () => {
    const creditorLargeAmount = {
      ...mockCreditor,
      total_claim_amount: 1234567.89,
    };

    render(
      <CreditorMobileCard
        creditor={creditorLargeAmount}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    expect(screen.getByText('¥1,234,567.89')).toBeInTheDocument();
  });

  it('should handle missing contact information gracefully', () => {
    const creditorMinimalInfo = {
      ...mockCreditor,
      contact_person_name: '',
      contact_person_phone: '',
      address: '',
    };

    render(
      <CreditorMobileCard
        creditor={creditorMinimalInfo}
        isSelected={false}
        {...mockHandlers}
        canEdit={true}
        canDelete={true}
      />
    );

    // Should still render main information
    expect(screen.getByText('测试债权人')).toBeInTheDocument();
    expect(screen.getByText('123456789012345678')).toBeInTheDocument();

    // Contact info should not be displayed when empty
    expect(screen.queryByText('联系人:')).not.toBeInTheDocument();
    expect(screen.queryByText('电话:')).not.toBeInTheDocument();
  });
});