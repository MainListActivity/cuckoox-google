import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n/i18n';

import AdvancedSearchDialog, { type AdvancedSearchCriteria } from '@/src/pages/creditors/AdvancedSearchDialog';

// Mock 主题
const theme = createTheme();

// 创建测试包装器
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </LocalizationProvider>
  </ThemeProvider>
);

describe('AdvancedSearchDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSearch = vi.fn();
  const mockOnClear = vi.fn();

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onSearch: mockOnSearch,
    onClear: mockOnClear,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染高级搜索对话框', () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('高级搜索')).toBeInTheDocument();
  });

  it('应该显示全文搜索和字段搜索切换', () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const fullTextToggle = screen.getByRole('checkbox');
    expect(fullTextToggle).toBeInTheDocument();
    
    // 默认应该是关闭状态
    expect(fullTextToggle).not.toBeChecked();
  });

  it('应该在切换到全文搜索时显示全文搜索框', async () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const fullTextToggle = screen.getByRole('checkbox');
    fireEvent.click(fullTextToggle);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/输入关键词进行全文搜索/)).toBeInTheDocument();
    });
  });

  it('应该在字段搜索模式下显示各个搜索字段', () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByLabelText(/债权人姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/证件号码/)).toBeInTheDocument();
    expect(screen.getByLabelText(/联系人姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/联系电话/)).toBeInTheDocument();
    expect(screen.getByLabelText(/联系地址/)).toBeInTheDocument();
  });

  it('应该在有搜索条件时启用搜索按钮', async () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText(/债权人姓名/);
    fireEvent.change(nameInput, { target: { value: '测试债权人' } });

    await waitFor(() => {
      const searchButton = screen.getByText('开始搜索');
      expect(searchButton).not.toBeDisabled();
    });
  });

  it('应该在点击搜索时调用 onSearch 回调', async () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText(/债权人姓名/);
    fireEvent.change(nameInput, { target: { value: '测试债权人' } });

    await waitFor(() => {
      const searchButton = screen.getByText('开始搜索');
      fireEvent.click(searchButton);
    });

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '测试债权人',
        useFullTextSearch: false,
      })
    );
  });

  it('应该在点击清除搜索时调用 onClear 回调', () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const clearButton = screen.getByText('清除搜索');
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalled();
  });

  it('应该在点击关闭按钮时调用 onClose 回调', () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('应该显示搜索条件预览', async () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText(/债权人姓名/);
    fireEvent.change(nameInput, { target: { value: '测试债权人' } });

    await waitFor(() => {
      expect(screen.getByText('搜索条件预览')).toBeInTheDocument();
      expect(screen.getByText(/姓名: "测试债权人"/)).toBeInTheDocument();
    });
  });

  it('应该在全文搜索模式下显示相应的预览', async () => {
    render(
      <TestWrapper>
        <AdvancedSearchDialog {...defaultProps} />
      </TestWrapper>
    );

    // 切换到全文搜索
    const fullTextToggle = screen.getByRole('checkbox');
    fireEvent.click(fullTextToggle);

    await waitFor(() => {
      const fullTextInput = screen.getByPlaceholderText(/输入关键词进行全文搜索/);
      fireEvent.change(fullTextInput, { target: { value: '测试关键词' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/全文搜索: "测试关键词"/)).toBeInTheDocument();
    });
  });
});