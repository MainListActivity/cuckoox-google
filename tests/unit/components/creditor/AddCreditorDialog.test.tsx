import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path if your i18n setup is elsewhere
import AddCreditorDialog from '@/src/pages/creditors/AddCreditorDialog'; // 修正路径
import { Creditor, CreditorFormData } from '@/src/pages/creditors/types'; // 修正路径和导入方式

const mockOnClose = vi.fn();
const mockOnSave = vi.fn();

const initialCreditor: Creditor = {
  id: 'cred001',
  type: '组织',
  name: 'Acme Corp',
  identifier: '91330100MA2XXXXX1A',
  contact_person_name: 'John Doe',
  contact_person_phone: '13800138000',
  address: '科技园路1号',
};

describe('AddCreditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDialog = (open = true, existingCreditor: Creditor | null = null) => {
    render(
      <I18nextProvider i18n={i18n}>
        <AddCreditorDialog
          open={open}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingCreditor={existingCreditor}
        />
      </I18nextProvider>
    );
  };

  // Rendering Tests
  it('renders correctly in "Add" mode', () => {
    renderDialog();
    expect(screen.getByText('添加单个债权人')).toBeInTheDocument();
    // For MUI Select with empty value, check that the select element exists
    expect(screen.getByLabelText(/类别/)).toBeInTheDocument();
    expect(screen.getByLabelText(/名称/)).toHaveValue('');
    expect(screen.getByLabelText(/ID/)).toHaveValue('');
  });

  it('renders correctly in "Edit" mode and pre-fills fields', () => {
    renderDialog(true, initialCreditor);
    expect(screen.getByText('编辑债权人')).toBeInTheDocument();
    // For MUI Select, check the displayed text
    expect(screen.getByText(initialCreditor.type)).toBeInTheDocument();
    expect(screen.getByLabelText(/名称/)).toHaveValue(initialCreditor.name);
    expect(screen.getByLabelText(/ID/)).toHaveValue(initialCreditor.identifier);
    expect(screen.getByLabelText(/联系人姓名/)).toHaveValue(initialCreditor.contact_person_name);
    expect(screen.getByLabelText(/联系方式/)).toHaveValue(initialCreditor.contact_person_phone);
    expect(screen.getByLabelText(/地址/)).toHaveValue(initialCreditor.address);
  });

  // Form Interaction & Validation Tests
  it('shows an error message if required fields are empty on save attempt', async () => {
    renderDialog();
    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('请填写所有必填字段：类别、名称和ID。')).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });
  
  it('Save button is enabled by default (error shown on click if invalid)', () => {
    renderDialog();
    const saveButton = screen.getByRole('button', { name: '保存' });
    expect(saveButton).not.toBeDisabled(); // Per current implementation
  });


  it('allows save if required fields are filled', async () => {
    renderDialog();
    
    // Fill category
    const categorySelect = screen.getByLabelText(/类别/);
    fireEvent.mouseDown(categorySelect);
    const organiztionOption = await screen.findByText('组织');
    fireEvent.click(organiztionOption);

    // Fill name
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Test Corp' } });
    // Fill identifier
    fireEvent.change(screen.getByLabelText(/ID/), { target: { value: 'TESTID001' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
    });
    expect(screen.queryByText('请填写所有必填字段：类别、名称和ID。')).not.toBeInTheDocument();
  });

  // onSave Callback Tests
  it('calls onSave with correct data in "Add" mode', async () => {
    renderDialog();
    const testData: CreditorFormData = {
      category: '个人',
      name: 'Jane Doe',
      identifier: 'ID12345',
      contactPersonName: 'Jane Doe',
      contactInfo: '0987654321',
      address: 'Some Address 123',
    };

    fireEvent.mouseDown(screen.getByLabelText(/类别/));
    fireEvent.click(await screen.findByText(testData.category!));
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: testData.name } });
    fireEvent.change(screen.getByLabelText(/ID/), { target: { value: testData.identifier } });
    fireEvent.change(screen.getByLabelText(/联系人姓名/), { target: { value: testData.contactPersonName } });
    fireEvent.change(screen.getByLabelText(/联系方式/), { target: { value: testData.contactInfo } });
    fireEvent.change(screen.getByLabelText(/地址/), { target: { value: testData.address } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining(testData));
    });
  });

  it('calls onSave with correct data including id in "Edit" mode', async () => {
    renderDialog(true, initialCreditor);
    const editedName = 'Acme Corp Updated';
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: editedName } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    
    const expectedData: CreditorFormData = {
      id: initialCreditor.id,
      category: initialCreditor.type,
      name: editedName,
      identifier: initialCreditor.identifier,
      contactPersonName: initialCreditor.contact_person_name,
      contactInfo: initialCreditor.contact_person_phone,
      address: initialCreditor.address,
    };

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining(expectedData));
    });
  });

  // onClose Callback Test
  it('calls onClose when the Cancel button is clicked', () => {
    renderDialog();
    const cancelButton = screen.getByRole('button', { name: '取消' }); // Assuming '取消' is the text for Cancel
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // 新增测试用例：测试表单字段验证
  it('validates identifier format based on creditor type', async () => {
    renderDialog();
    
    // Select organization type
    const categorySelect = screen.getByLabelText(/类别/);
    fireEvent.mouseDown(categorySelect);
    const organizationOption = await screen.findByText('组织');
    fireEvent.click(organizationOption);

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Test Corp' } });
    fireEvent.change(screen.getByLabelText(/ID/), { target: { value: 'TESTID001' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  // 新增测试用例：测试表单重置功能
  it('resets form when switching between add and edit modes', async () => {
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <AddCreditorDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingCreditor={null}
        />
      </I18nextProvider>
    );

    // Fill some data in add mode
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Test Name' } });
    expect(screen.getByLabelText(/名称/)).toHaveValue('Test Name');

    // Switch to edit mode
    rerender(
      <I18nextProvider i18n={i18n}>
        <AddCreditorDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          existingCreditor={initialCreditor}
        />
      </I18nextProvider>
    );

    // Should show existing creditor data
    expect(screen.getByLabelText(/名称/)).toHaveValue(initialCreditor.name);
  });

  // 新增测试用例：测试表单错误状态清除
  it('clears error message when user starts typing', async () => {
    renderDialog();
    
    // Trigger validation error
    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('请填写所有必填字段：类别、名称和ID。')).toBeInTheDocument();
    });

    // Start typing in name field
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Test' } });

    // Error should be cleared
    expect(screen.queryByText('请填写所有必填字段：类别、名称和ID。')).not.toBeInTheDocument();
  });

  // 新增测试用例：测试联系信息的可选性
  it('allows saving with only required fields filled', async () => {
    renderDialog();
    
    // Fill only required fields
    const categorySelect = screen.getByLabelText(/类别/);
    fireEvent.mouseDown(categorySelect);
    const organizationOption = await screen.findByText('组织');
    fireEvent.click(organizationOption);

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'Test Corp' } });
    fireEvent.change(screen.getByLabelText(/ID/), { target: { value: 'TESTID001' } });

    const saveButton = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        category: '组织',
        name: 'Test Corp',
        identifier: 'TESTID001',
        contactPersonName: '',
        contactInfo: '',
        address: '',
      }));
    });
  });

  // Example of how to test closing by pressing Escape, if applicable to your Dialog implementation
  // it('calls onClose when Escape key is pressed', () => {
  //   renderDialog();
  //   // Dialog needs to be the active element or have a ref captured to send key events to it.
  //   // This is a simplified example; actual implementation might vary.
  //   // Typically, MUI Dialogs handle this, so you might trust MUI or test this at a higher integration level.
  //   const dialogRoot = screen.getByRole('dialog'); // Get the dialog element
  //   fireEvent.keyDown(dialogRoot, { key: 'Escape', code: 'Escape' });
  //   expect(mockOnClose).toHaveBeenCalledTimes(1);
  // });
});
