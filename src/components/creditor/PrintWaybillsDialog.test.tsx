import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n'; // Adjust path
import PrintWaybillsDialog from './PrintWaybillsDialog';
import { Creditor } from '../../pages/CreditorListPage'; // Adjust path
import { SnackbarProvider } from '../../contexts/SnackbarContext';

const mockOnClose = vi.fn();

const mockCreditors: Creditor[] = [
  { id: 'cred001', type: '组织', name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000', address: '科技园路1号' },
  { id: 'cred002', type: '个人', name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000', address: '文三路202号' },
];

describe('PrintWaybillsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to verify output if needed, though showSuccess is now primary feedback
    // console.log = vi.fn(); 
  });

  const renderDialog = (open = true, selectedCreditors: Creditor[] = mockCreditors) => {
    render(
      <I18nextProvider i18n={i18n}>
        <SnackbarProvider> {/* Required due to useSnackbar in component */}
          <PrintWaybillsDialog
            open={open}
            onClose={mockOnClose}
            selectedCreditors={selectedCreditors}
          />
        </SnackbarProvider>
      </I18nextProvider>
    );
  };

  // Rendering Tests
  it('renders correctly with selected creditors', () => {
    renderDialog();
    expect(screen.getByText('确认打印快递单号')).toBeInTheDocument(); // Title
    expect(screen.getByText(/将为以下 2 位债权人打印快递单/)).toBeInTheDocument(); // Count message
    
    // Check for creditor names
    expect(screen.getByText(mockCreditors[0].name)).toBeInTheDocument();
    expect(screen.getByText(mockCreditors[1].name)).toBeInTheDocument();
    // Check for some secondary info
    expect(screen.getByText(new RegExp(mockCreditors[0].identifier))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockCreditors[0].address))).toBeInTheDocument();
  });

  it('renders correctly with no selected creditors', () => {
    renderDialog(true, []);
    expect(screen.getByText('确认打印快递单号')).toBeInTheDocument();
    expect(screen.getByText(/将为以下 0 位债权人打印快递单/)).toBeInTheDocument();
    // The list should be empty, so no creditor names should be found
    expect(screen.queryByText(mockCreditors[0].name)).not.toBeInTheDocument();
  });

  // Button State Test
  it('"Confirm Print" button is disabled if no creditors are selected', () => {
    renderDialog(true, []);
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    expect(confirmButton).toBeDisabled();
  });

  it('"Confirm Print" button is enabled if creditors are selected', () => {
    renderDialog(true, mockCreditors);
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    expect(confirmButton).not.toBeDisabled();
  });

  // onClose Callback Test
  it('calls onClose when "Confirm Print" button is clicked', () => {
    renderDialog();
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    fireEvent.click(confirmButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when "Cancel" button is clicked', () => {
    renderDialog();
    const cancelButton = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
  
  // Mock console log test (optional, as showSuccess is now the main feedback)
  it('logs correct information to console when "Confirm Print" is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    renderDialog();
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    fireEvent.click(confirmButton);
    
    expect(consoleSpy).toHaveBeenCalledWith("--- Mock Printing Waybills ---");
    const expectedWaybillDataForCred001 = 
      `--- Waybill ---\n` +
      `      To: ${mockCreditors[0].name}\n` +
      `      Address: ${mockCreditors[0].address}\n` +
      `      Contact: ${mockCreditors[0].contact_person_name}, ${mockCreditors[0].contact_person_phone}\n` +
      `      ID: ${mockCreditors[0].identifier}\n` +
      `      ---------------`;
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(expectedWaybillDataForCred001));
    consoleSpy.mockRestore(); // Restore original console.log
  });

});
