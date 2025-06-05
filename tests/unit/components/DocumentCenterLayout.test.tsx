import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import DocumentCenterLayout from '@/src/components/DocumentCenterLayout';

const renderWithTheme = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockCaseInfo = {
  caseNumber: 'TEST001',
  responsiblePerson: '张三',
  stage: '立案',
  acceptanceDate: '2024-01-01'
};

const mockComments = [
  {
    id: '1',
    author: '王五',
    content: '这是一条测试评论',
    time: '2024-01-01 10:00'
  },
  {
    id: '2',
    author: '李四',
    content: '这是另一条测试评论',
    time: '2024-01-01 11:00'
  }
];

describe('DocumentCenterLayout', () => {
  it('renders document center layout with four panels', () => {
    renderWithTheme(
      <DocumentCenterLayout
        documentTitle="测试文档"
        caseInfo={mockCaseInfo}
        comments={mockComments}
      >
        <div data-testid="editor-content">富文本编辑器内容</div>
      </DocumentCenterLayout>
    );

    // 验证左侧一：文档菜单
    expect(screen.getByText('文档资料')).toBeInTheDocument();
    expect(screen.getByText('案件资料')).toBeInTheDocument();
    expect(screen.getByText('债权审核')).toBeInTheDocument();
    expect(screen.getByText('会议纪要')).toBeInTheDocument();

    // 验证左侧二：文档标题和案件详情
    expect(screen.getByText('测试文档')).toBeInTheDocument();
    expect(screen.getByText('案件信息')).toBeInTheDocument();
    expect(screen.getByText('案件编号')).toBeInTheDocument();
    expect(screen.getByText('TEST001')).toBeInTheDocument();
    expect(screen.getByText('负责人')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();

    // 验证中间：富文本编辑器
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();

    // 验证右侧：评论面板
    expect(screen.getByText('评论 (2)')).toBeInTheDocument();
    expect(screen.getByText('这是一条测试评论')).toBeInTheDocument();
    expect(screen.getByText('这是另一条测试评论')).toBeInTheDocument();
  });

  it('renders document tree structure correctly', () => {
    renderWithTheme(
      <DocumentCenterLayout>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 验证文档树结构
    expect(screen.getByText('立案申请书')).toBeInTheDocument();
    expect(screen.getByText('债权人名册')).toBeInTheDocument();
    expect(screen.getByText('债权申报表')).toBeInTheDocument();
    expect(screen.getByText('审核结果')).toBeInTheDocument();
    expect(screen.getByText('第一次债权人会议')).toBeInTheDocument();
  });

  it('allows collapsing and expanding document menu', () => {
    renderWithTheme(
      <DocumentCenterLayout>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 验证初始状态菜单是展开的
    expect(screen.getByText('文档资料')).toBeInTheDocument();

    // 点击收起按钮
    const collapseButton = screen.getAllByRole('button')[0]; // 第一个按钮是收起按钮
    fireEvent.click(collapseButton);

    // 验证菜单标题被隐藏（菜单收起）
    expect(screen.queryByText('文档资料')).not.toBeInTheDocument();
  });

  it('handles comment panel visibility correctly', () => {
    renderWithTheme(
      <DocumentCenterLayout comments={mockComments}>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 验证评论面板初始显示
    expect(screen.getByText('评论 (2)')).toBeInTheDocument();

    // 关闭评论面板
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // 验证评论面板被隐藏
    expect(screen.queryByText('评论 (2)')).not.toBeInTheDocument();
  });

  it('handles adding new comments', () => {
    const mockOnAddComment = vi.fn();
    
    renderWithTheme(
      <DocumentCenterLayout 
        comments={mockComments}
        onAddComment={mockOnAddComment}
      >
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 找到评论输入框
    const commentInput = screen.getByPlaceholderText('添加评论...');
    
    // 输入评论内容
    fireEvent.change(commentInput, { target: { value: '新的评论内容' } });

    // 点击发送按钮
    const sendButton = screen.getByText('发送');
    fireEvent.click(sendButton);

    // 验证回调被调用
    expect(mockOnAddComment).toHaveBeenCalledWith('新的评论内容');
  });

  it('hides comment panel when no comments exist', () => {
    renderWithTheme(
      <DocumentCenterLayout comments={[]}>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 验证没有评论时不显示评论面板
    expect(screen.queryByText('评论')).not.toBeInTheDocument();
  });

  it('renders case information correctly', () => {
    renderWithTheme(
      <DocumentCenterLayout caseInfo={mockCaseInfo}>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 验证案件信息显示
    expect(screen.getByText('受理日期')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('当前阶段')).toBeInTheDocument();
    expect(screen.getByText('立案')).toBeInTheDocument();
  });

  it('renders default document title when not provided', () => {
    renderWithTheme(
      <DocumentCenterLayout>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    expect(screen.getByText('未命名文档')).toBeInTheDocument();
  });

  it('displays last edited time', () => {
    renderWithTheme(
      <DocumentCenterLayout>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    expect(screen.getByText(/最后编辑：/)).toBeInTheDocument();
  });

  it('renders floating comment button when comments exist but panel is hidden', () => {
    renderWithTheme(
      <DocumentCenterLayout comments={mockComments}>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 关闭评论面板
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // 应该显示浮动评论按钮（通过定位样式验证）
    const floatingButton = screen.getAllByRole('button').find(button => 
      button.querySelector('[data-testid="CommentIcon"]') !== null
    );
    expect(floatingButton).toBeInTheDocument();
  });

  it('handles document tree item clicks', () => {
    renderWithTheme(
      <DocumentCenterLayout>
        <div>Content</div>
      </DocumentCenterLayout>
    );

    // 点击文档项
    const docItem = screen.getByText('立案申请书');
    fireEvent.click(docItem);

    // 验证点击不会产生错误（功能性测试）
    expect(docItem).toBeInTheDocument();
  });
}); 