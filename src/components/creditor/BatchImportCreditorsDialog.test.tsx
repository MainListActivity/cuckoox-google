import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n'; // Adjust path
import BatchImportCreditorsDialog from './BatchImportCreditorsDialog';

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
    expect(screen.getByText('下载导入模板 (.csv)')).toBeInTheDocument();
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
});
