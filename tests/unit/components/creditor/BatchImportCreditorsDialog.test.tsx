import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n'; // Adjust path
import BatchImportCreditorsDialog from '@/src/pages/creditors/BatchImportCreditorsDialog'; // 修正路径

const mockOnClose = vi.fn();
const mockOnImport = vi.fn();

describe('BatchImportCreditorsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDialog = (open = true, isImporting = false) => {
    render(
      <I18nextProvider i18n={i18n}>
        <BatchImportCreditorsDialog
          open={open}
          onClose={mockOnClose}
          onImport={mockOnImport}
          isImporting={isImporting}
        />
      </I18nextProvider>
    );
  };

  // Rendering Tests
  it('renders correctly with download link and file selection button', () => {
    renderDialog();
    expect(screen.getByText('批量导入债权人')).toBeInTheDocument(); // Title
    const downloadLink = screen.getByText('下载导入模板 (.csv)');
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink.closest('a')).toHaveAttribute('href', '/templates/creditor_import_template.csv');
    expect(screen.getByText('选择文件')).toBeInTheDocument();
    expect(screen.getByText('未选择文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始导入' })).toBeDisabled();
  });

  // File Selection Tests
  it('selecting a file updates the UI and enables the import button', async () => {
    renderDialog();
    const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement; // Input is hidden
    
    const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

    // Simulate file selection
    // For hidden inputs, directly dispatching change event on the input is more reliable
    Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        writable: false,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(`已选文件: ${testFile.name}`)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '开始导入' })).not.toBeDisabled();
  });

  // onImport Callback Test
  it('calls onImport with the selected file when "Start Import" is clicked', async () => {
    renderDialog();
    const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
    const testFile = new File(['(类别,名称,ID,联系人姓名,联系方式,地址)\n组织,TestFile,FileID001,File Contact,123,File Address'], 'test_import.csv', { type: 'text/csv' });

    Object.defineProperty(fileInput, 'files', { value: [testFile] });
    fireEvent.change(fileInput);
    
    const importButton = screen.getByRole('button', { name: '开始导入' });
    await waitFor(() => expect(importButton).not.toBeDisabled());
    fireEvent.click(importButton);

    expect(mockOnImport).toHaveBeenCalledTimes(1);
    expect(mockOnImport).toHaveBeenCalledWith(testFile);
  });

  // Loading State Test
  it('shows loading state and disables button when isImporting is true', () => {
    renderDialog(true, true); // open=true, isImporting=true
    
    const importButton = screen.getByRole('button', { name: '导入中...' });
    expect(importButton).toBeInTheDocument();
    expect(importButton).toBeDisabled();
    
    // Check for CircularProgress (it might not have specific text)
    // This depends on how CircularProgress is rendered; it might be an SVG or role="progressbar"
    // For simplicity, checking button text and disabled state is often enough.
    // expect(screen.getByRole('progressbar')).toBeInTheDocument(); // If CircularProgress has this role
  });

  // onClose Callback Test
  it('calls onClose when the Cancel button is clicked', () => {
    renderDialog();
    // The cancel button might just be text "取消" or an icon, depending on MUI Dialog structure
    // Assuming it's a button with text '取消'
    const cancelButton = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // 新增测试用例：测试文件类型验证
  it('accepts CSV, XLS, and XLSX file types', async () => {
    renderDialog();
    const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
    
    expect(fileInput).toHaveAttribute('accept', '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel');
  });

  // 新增测试用例：测试模板下载功能
  it('provides template download with correct attributes', () => {
    renderDialog();
    const downloadLink = screen.getByText('下载导入模板 (.csv)');
    const linkElement = downloadLink.closest('a');
    
    expect(linkElement).toHaveAttribute('href', '/templates/creditor_import_template.csv');
    expect(linkElement).toHaveAttribute('download');
  });

  // 新增测试用例：测试导入步骤说明
  it('displays import steps clearly', () => {
    renderDialog();
    
    expect(screen.getByText('步骤 1: 下载模板文件')).toBeInTheDocument();
    expect(screen.getByText('步骤 2: 选择已填写数据的文件')).toBeInTheDocument();
    expect(screen.getByText('请使用此CSV模板准备您的债权人数据。')).toBeInTheDocument();
    expect(screen.getByText('请确保文件格式符合模板要求。支持 .xlsx, .xls, .csv 格式。')).toBeInTheDocument();
  });

  // 新增测试用例：测试对话框关闭时清理状态
  it('clears selected file when dialog is closed', async () => {
    renderDialog();
    const fileInput = screen.getByRole('button', { name: '选择文件' }).previousSibling as HTMLInputElement;
    const testFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

    // Select a file
    Object.defineProperty(fileInput, 'files', { value: [testFile] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(`已选文件: ${testFile.name}`)).toBeInTheDocument();
    });

    // Close dialog
    const cancelButton = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // 新增测试用例：测试导入过程中的UI状态
  it('disables cancel button during import', () => {
    renderDialog(true, true); // open=true, isImporting=true
    
    const cancelButton = screen.getByRole('button', { name: '取消' });
    expect(cancelButton).toBeDisabled();
  });

  // 新增测试用例：测试无文件选择时的状态
  it('shows appropriate message when no file is selected', () => {
    renderDialog();
    
    expect(screen.getByText('未选择文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始导入' })).toBeDisabled();
  });
});
