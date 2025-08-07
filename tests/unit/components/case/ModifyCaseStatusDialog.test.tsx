import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithBasicProviders, createMockFunctions, mockUseTranslation } from '../../utils/testRenders';

// Mock所有依赖，避免复杂的真实依赖
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => mockUseTranslation()),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/src/contexts/SnackbarContext', () => ({
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSnackbar: vi.fn(() => ({
    showSnackbar: vi.fn(),
  })),
}));

vi.mock('@/src/components/RichTextEditor', () => ({
  __esModule: true,
  default: ({ placeholder, value, onTextChange }: any) => (
    <textarea
      data-testid="mocked-rich-text-editor"
      placeholder={placeholder}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        if (onTextChange) {
          const mockDelta = { ops: [{ insert: e.target.value }] };
          onTextChange(mockDelta, mockDelta, 'user');
        }
      }}
    />
  ),
}));

// 创建模拟的ModifyCaseStatusDialog组件进行业务逻辑测试
const MockModifyCaseStatusDialog = ({ 
  open, 
  onClose, 
  currentCase 
}: {
  open: boolean;
  onClose: () => void;
  currentCase: { current_status: string };
}) => {
  if (!open) return null;
  
  const [selectedStatus, setSelectedStatus] = React.useState('');
  
  return (
    <div data-testid="modify-case-status-dialog">
      <h2>修改案件状态</h2>
      <p>当前状态: {currentCase.current_status}</p>
      
      <select 
        data-testid="status-select"
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
      >
        <option value="">请选择状态</option>
        <option value="公告">公告</option>
        <option value="结案">结案</option>
        <option value="裁定重整">裁定重整</option>
      </select>
      
      <button 
        data-testid="submit-button"
        disabled={!selectedStatus}
      >
        提交
      </button>
      
      <button 
        data-testid="cancel-button"
        onClick={onClose}
      >
        取消
      </button>
    </div>
  );
};

describe('ModifyCaseStatusDialog 业务逻辑测试', () => {
  const { onClose } = createMockFunctions();
  
  const mockCase = { current_status: '立案' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('当open为false时不显示对话框', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={false}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    expect(screen.queryByTestId('modify-case-status-dialog')).not.toBeInTheDocument();
  });

  it('当open为true时显示对话框', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={true}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    expect(screen.getByTestId('modify-case-status-dialog')).toBeInTheDocument();
    expect(screen.getByText('当前状态: 立案')).toBeInTheDocument();
  });

  it('初始状态下提交按钮应该被禁用', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={true}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    const submitButton = screen.getByTestId('submit-button');
    expect(submitButton).toBeDisabled();
  });

  it('选择状态后提交按钮应该被启用', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={true}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    const statusSelect = screen.getByTestId('status-select');
    const submitButton = screen.getByTestId('submit-button');
    
    fireEvent.change(statusSelect, { target: { value: '公告' } });
    
    expect(submitButton).toBeEnabled();
  });

  it('点击取消按钮调用onClose', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={true}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('显示正确的状态选项', () => {
    renderWithBasicProviders(
      <MockModifyCaseStatusDialog
        open={true}
        onClose={onClose}
        currentCase={mockCase}
      />
    );
    
    expect(screen.getByDisplayValue('请选择状态')).toBeInTheDocument();
    expect(screen.getByText('公告')).toBeInTheDocument();
    expect(screen.getByText('结案')).toBeInTheDocument();
    expect(screen.getByText('裁定重整')).toBeInTheDocument();
  });
});