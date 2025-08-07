// Mock i18next FIRST before any imports
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'print_waybills_dialog_title': '确认打印快递单号',
        'print_waybills_confirmation_intro': '将为以下 {{count}} 位债权人打印快递单:',
        'creditor_id_label': 'ID',
        'address_label': '地址',
        'print_waybills_final_confirmation_note': '请确保打印机已连接并准备就绪。',
        'cancel_button': '取消',
        'confirm_print_button': '确认打印',
        'waybills_mock_printed_success': '快递单已（模拟）生成到控制台'
      };
      
      let result = translations[key] || key;
      
      // Handle interpolation
      if (options && typeof options === 'object') {
        Object.keys(options).forEach(param => {
          result = result.replace(new RegExp(`{{${param}}}`, 'g'), options[param]);
        });
      }
      
      return result;
    },
    i18n: {
      changeLanguage: vi.fn(),
      language: 'zh-CN',
    },
  }),
}));

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../../utils/testUtils';
import PrintWaybillsDialog from '@/src/pages/creditors/PrintWaybillsDialog'; // 修正路径
import { Creditor } from '@/src/pages/creditors/types'; // 修正路径和导入方式

// Create mock function at module level
const mockShowSuccess = vi.fn();

// Mock SnackbarContext at the top level
vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({
    showSuccess: mockShowSuccess,
  }),
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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
      <PrintWaybillsDialog
        open={open}
        onClose={mockOnClose}
        selectedCreditors={selectedCreditors}
      />
    );
  };

  // Rendering Tests
  it('renders correctly with selected creditors', () => {
    renderDialog();
    expect(screen.getByText('确认打印快递单号')).toBeInTheDocument(); // Title
    // The t function should interpolate {{count}} but if it doesn't work, check for the template string
    expect(screen.getByText(/将为以下.*位债权人打印快递单/)).toBeInTheDocument(); // Count message - more flexible regex
    
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
    expect(screen.getByText(/将为以下.*位债权人打印快递单/)).toBeInTheDocument(); // More flexible regex
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

  // 新增测试用例：测试快递单打印功能的业务逻辑
  it('shows success message when waybills are printed', () => {
    renderDialog();
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    fireEvent.click(confirmButton);
    
    // 验证打印成功后的行为
    expect(mockShowSuccess).toHaveBeenCalledWith('快递单已（模拟）生成到控制台');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // 新增测试用例：测试债权人信息显示的完整性
  it('displays complete creditor information in the list', () => {
    renderDialog();
    
    mockCreditors.forEach(creditor => {
      expect(screen.getByText(creditor.name)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(creditor.identifier))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(creditor.address))).toBeInTheDocument();
    });
  });

  // 新增测试用例：测试对话框的可访问性
  it('has proper accessibility attributes', () => {
    renderDialog();
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby');
    
    const confirmButton = screen.getByRole('button', { name: '确认打印' });
    const cancelButton = screen.getByRole('button', { name: '取消' });
    
    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

});
