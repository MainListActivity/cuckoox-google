import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '../../utils/testUtils';
import CaseMobileCard, { CaseData, CaseAction } from '@/src/components/mobile/CaseMobileCard';

// Mock useResponsiveLayout hook
vi.mock('@/src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    deviceType: 'mobile',
    screenSize: 'xs',
  }),
}));

// Remove MockWrapper as we now use testUtils

describe('CaseMobileCard', () => {
  const mockCaseData: CaseData = {
    id: '1',
    case_no: 'BK-2025-123456',
    name: '测试案件',
    procedure_type: '破产清算',
    status: '立案',
    responsible_person: '张三',
    created_at: '2025-01-20T10:00:00Z',
    updated_at: '2025-01-25T15:30:00Z',
    creator: '李四',
    description: '这是一个测试案件的描述信息',
    company_name: '测试公司有限责任公司',
  };

  const mockActions: CaseAction[] = [
    {
      icon: 'mdi-eye-outline',
      label: '查看',
      onClick: vi.fn(),
      color: 'primary',
    },
    {
      icon: 'mdi-pencil-outline',
      label: '编辑',
      onClick: vi.fn(),
      color: 'secondary',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该正确渲染案件基本信息', () => {
    render(
      <CaseMobileCard case={mockCaseData} />
    );

    // 检查案件编号
    expect(screen.getByText(/BK-2025-123456/)).toBeInTheDocument();
    
    // 检查程序类型
    expect(screen.getByText('破产清算')).toBeInTheDocument();
    
    // 检查状态标签
    expect(screen.getByText('立案')).toBeInTheDocument();
    
    // 检查负责人
    expect(screen.getByText('张三')).toBeInTheDocument();
  });

  it('应该正确显示状态标签颜色', () => {
    const { rerender } = render(
      <MockWrapper>
        <CaseMobileCard case={{ ...mockCaseData, status: '立案' }} />
    );

    let statusChip = screen.getByText('立案');
    expect(statusChip).toHaveStyle({ color: '#1976D2' });

    // 测试不同状态
    rerender(
      <MockWrapper>
        <CaseMobileCard case={{ ...mockCaseData, status: '进行中' }} />
    );
    
    statusChip = screen.getByText('进行中');
    expect(statusChip).toHaveStyle({ color: '#F57C00' });
  });

  it('应该正确处理展开/收起功能', async () => {
    render(
      <CaseMobileCard case={mockCaseData} expandable={true} />
    );

    // 初始状态下，详细信息应该是隐藏的
    expect(screen.queryByText('创建人:')).not.toBeInTheDocument();
    
    // 点击展开按钮
    const expandButton = screen.getByLabelText(/展开详情/);
    fireEvent.click(expandButton);

    // 等待展开动画完成
    await waitFor(() => {
      expect(screen.getByText('创建人:')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
      expect(screen.getByText('测试公司有限责任公司')).toBeInTheDocument();
    });

    // 再次点击应该收起
    const collapseButton = screen.getByLabelText(/收起/);
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.queryByText('创建人:')).not.toBeInTheDocument();
    });
  });

  it('应该正确处理卡片点击事件', () => {
    const mockOnCardClick = vi.fn();
    
    render(
      <CaseMobileCard case={mockCaseData} onCardClick={mockOnCardClick} />
    );

    // 卡片不是一个button元素，而是一个可点击的Card，通过包含案件编号的元素来找到并点击
    const caseNumberElement = screen.getByText(/BK-2025-123456/);
    const card = caseNumberElement.closest('.MuiCard-root');
    
    if (card) {
      fireEvent.click(card);
    }

    expect(mockOnCardClick).toHaveBeenCalledWith(mockCaseData);
  });

  it('应该正确处理操作按钮点击', () => {
    render(
      <CaseMobileCard case={mockCaseData} actions={mockActions} />
    );

    const viewButton = screen.getByLabelText('查看');
    fireEvent.click(viewButton);

    expect(mockActions[0].onClick).toHaveBeenCalledWith(mockCaseData);
  });

  it('应该在紧凑模式下正确渲染', () => {
    render(
      <CaseMobileCard case={mockCaseData} compact={true} />
    );

    // 在紧凑模式下，某些信息可能不显示
    expect(screen.getByText(/BK-2025-123456/)).toBeInTheDocument();
    expect(screen.getByText('破产清算')).toBeInTheDocument();
  });

  it('应该正确显示序号', () => {
    render(
      <CaseMobileCard case={mockCaseData} showIndex={true} index={5} />
    );

    expect(screen.getByText('#6')).toBeInTheDocument();
  });

  it('应该正确处理时间格式化', () => {
    const todayCase = {
      ...mockCaseData,
      created_at: new Date().toISOString(),
    };

    render(
      <CaseMobileCard case={todayCase} />
    );

    expect(screen.getByText('今天')).toBeInTheDocument();
  });

  it('应该在没有操作时隐藏操作区域', () => {
    render(
      <CaseMobileCard case={mockCaseData} showActions={false} />
    );

    // 不应该显示操作按钮区域
    expect(screen.queryByLabelText('查看')).not.toBeInTheDocument();
  });

  it('应该正确处理缺失的可选数据', () => {
    const minimalCase: CaseData = {
      id: '2',
      case_no: 'BK-2025-789',
      procedure_type: '破产重组',
      status: '进行中',
      created_at: '2025-01-15T08:00:00Z',
    };

    render(
      <CaseMobileCard case={minimalCase} />
    );

    expect(screen.getByText(/BK-2025-789/)).toBeInTheDocument();
    expect(screen.getByText('破产重组')).toBeInTheDocument();
    expect(screen.getByText('未分配')).toBeInTheDocument(); // 默认负责人
  });

  it('应该阻止操作按钮点击事件冒泡', () => {
    const mockOnCardClick = vi.fn();
    
    render(
      <CaseMobileCard 
        case={mockCaseData} 
        actions={mockActions}
        onCardClick={mockOnCardClick}
      />
    );

    const actionButton = screen.getByLabelText('查看');
    fireEvent.click(actionButton);

    // 操作按钮点击不应该触发卡片点击
    expect(mockOnCardClick).not.toHaveBeenCalled();
    expect(mockActions[0].onClick).toHaveBeenCalledWith(mockCaseData);
  });

  it('应该阻止展开按钮点击事件冒泡', () => {
    const mockOnCardClick = vi.fn();
    
    render(
      <CaseMobileCard 
        case={mockCaseData} 
        onCardClick={mockOnCardClick}
        expandable={true}
      />
    );

    const expandButton = screen.getByLabelText(/展开详情/);
    fireEvent.click(expandButton);

    // 展开按钮点击不应该触发卡片点击
    expect(mockOnCardClick).not.toHaveBeenCalled();
  });

  it('应该正确处理禁用的操作按钮', () => {
    const disabledAction: CaseAction = {
      icon: 'mdi-delete',
      label: '删除',
      onClick: vi.fn(),
      color: 'error',
      disabled: true,
    };

    render(
      <CaseMobileCard case={mockCaseData} actions={[disabledAction]} />
    );

    const deleteButton = screen.getByLabelText('删除');
    expect(deleteButton).toBeDisabled();
  });
});