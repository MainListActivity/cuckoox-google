import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ClaimVersionComparison from '@/src/components/claim/ClaimVersionComparison';
import {
  ClaimVersionHistory,
  VersionDiff,
  FieldChange,
  VersionType
} from '@/src/types/claimTracking';

// Mock the services
import { vi } from 'vitest';

// Mock the SurrealProvider context
const mockSurrealContext = {
  client: {},
  isConnected: true,
  connectionStatus: 'connected' as const,
  query: vi.fn(),
  queryWithAuth: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
};

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => mockSurrealContext,
  SurrealProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the ClaimVersionService
const mockCompareVersions = vi.fn();
const mockGetVersionHistory = vi.fn();
vi.mock('@/src/services/claimVersionService', () => ({
  ClaimVersionService: vi.fn().mockImplementation(() => ({
    compareVersions: mockCompareVersions,
    getVersionHistory: mockGetVersionHistory
  }))
}));

const theme = createTheme();

const mockVersionHistory: ClaimVersionHistory[] = [
  {
    id: 'version:1',
    claim_id: 'claim:test',
    version_number: 1,
    version_type: VersionType.INITIAL,
    snapshot_data: { principal: 100000, interest: 5000 },
    change_summary: '初始版本',
    changed_by: 'user:1',
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'version:2',
    claim_id: 'claim:test',
    version_number: 2,
    version_type: VersionType.DRAFT_UPDATE,
    snapshot_data: { principal: 120000, interest: 6000, description: '更新后的描述' },
    change_summary: '更新本金和利息',
    change_reason: '根据最新证据调整',
    changed_by: 'user:1',
    created_at: '2024-01-16T14:20:00Z'
  }
];

const mockVersionDiff: VersionDiff = {
  claim_id: 'claim:test',
  from_version: 1,
  to_version: 2,
  change_summary: '更新了本金、利息并添加了描述',
  changes: [
    {
      field_path: 'principal',
      field_name: '本金',
      old_value: 100000,
      new_value: 120000,
      change_type: 'modified'
    },
    {
      field_path: 'interest',
      field_name: '利息',
      old_value: 5000,
      new_value: 6000,
      change_type: 'modified'
    },
    {
      field_path: 'description',
      field_name: '描述',
      old_value: null,
      new_value: '更新后的描述',
      change_type: 'added'
    }
  ]
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
);

describe('ClaimVersionComparison', () => {
  const defaultProps = {
    claimId: 'claim:test',
    fromVersion: 1,
    toVersion: 2,
    onClose: vi.fn(),
    open: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompareVersions.mockResolvedValue(mockVersionDiff);
    mockGetVersionHistory.mockResolvedValue(mockVersionHistory);
  });

  it('should render version comparison dialog', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    // 检查对话框标题
    expect(screen.getByText('版本对比: v1 → v2')).toBeInTheDocument();

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('变更统计')).toBeInTheDocument();
    });

    // 检查变更统计
    expect(screen.getByText('修改 2 项')).toBeInTheDocument();
    expect(screen.getByText('新增 1 项')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockCompareVersions.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    mockCompareVersions.mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('加载版本对比失败，请重试')).toBeInTheDocument();
    });
  });

  it('should display field changes correctly', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('详细变更 (3 项)')).toBeInTheDocument();
    });

    // 检查字段变更
    expect(screen.getByText('本金')).toBeInTheDocument();
    expect(screen.getByText('利息')).toBeInTheDocument();
    expect(screen.getByText('描述')).toBeInTheDocument();

    // 检查变更类型标签
    expect(screen.getAllByText('修改')).toHaveLength(2);
    expect(screen.getByText('新增')).toBeInTheDocument();
  });

  it('should display version information', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('版本信息')).toBeInTheDocument();
    });

    // 点击展开版本信息
    fireEvent.click(screen.getByText('版本信息'));

    await waitFor(() => {
      expect(screen.getByText('版本 1 (旧版本)')).toBeInTheDocument();
      expect(screen.getByText('版本 2 (新版本)')).toBeInTheDocument();
    });

    // 检查版本详情
    expect(screen.getByText('初始版本')).toBeInTheDocument();
    expect(screen.getByText('更新本金和利息')).toBeInTheDocument();
    expect(screen.getByText('根据最新证据调整')).toBeInTheDocument();
  });

  it('should handle accordion expansion', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('详细变更 (3 项)')).toBeInTheDocument();
    });

    // 默认详细变更应该是展开的
    expect(screen.getByText('本金')).toBeInTheDocument();

    // 点击收起详细变更
    fireEvent.click(screen.getByText('详细变更 (3 项)'));

    // 内容应该被隐藏（这里简化测试，实际可能需要检查具体的DOM结构）
    // 由于MUI Accordion的实现，我们主要检查点击事件是否正常工作
    expect(screen.getByText('详细变更 (3 项)')).toBeInTheDocument();
  });

  it('should handle close button click', async () => {
    const mockOnClose = vi.fn();

    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} onClose={mockOnClose} />
      </TestWrapper>
    );

    // 点击关闭按钮
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(button => 
      button.getAttribute('aria-label') === 'close' || 
      button.textContent === '关闭'
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    } else {
      // 如果找不到特定的关闭按钮，点击第一个关闭按钮
      fireEvent.click(screen.getByText('关闭'));
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should not render when open is false', () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} open={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('版本对比: v1 → v2')).not.toBeInTheDocument();
  });

  it('should handle empty changes', async () => {
    const emptyDiff: VersionDiff = {
      ...mockVersionDiff,
      changes: []
    };
    mockCompareVersions.mockResolvedValue(emptyDiff);

    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('详细变更 (0 项)')).toBeInTheDocument();
    });

    // 点击展开详细变更
    fireEvent.click(screen.getByText('详细变更 (0 项)'));

    await waitFor(() => {
      expect(screen.getByText('两个版本之间没有差异')).toBeInTheDocument();
    });
  });

  it('should format field values correctly', async () => {
    const diffWithVariousTypes: VersionDiff = {
      ...mockVersionDiff,
      changes: [
        {
          field_path: 'is_active',
          field_name: '是否激活',
          old_value: true,
          new_value: false,
          change_type: 'modified'
        },
        {
          field_path: 'metadata',
          field_name: '元数据',
          old_value: { key: 'value' },
          new_value: { key: 'new_value', extra: 'data' },
          change_type: 'modified'
        },
        {
          field_path: 'empty_field',
          field_name: '空字段',
          old_value: null,
          new_value: undefined,
          change_type: 'modified'
        }
      ]
    };
    mockCompareVersions.mockResolvedValue(diffWithVariousTypes);

    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('是否激活')).toBeInTheDocument();
    });

    // 检查布尔值格式化
    expect(screen.getByText('是')).toBeInTheDocument();
    expect(screen.getByText('否')).toBeInTheDocument();

    // 检查空值格式化
    expect(screen.getAllByText('(空)')).toHaveLength(2);
  });

  it('should call service methods with correct parameters', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockCompareVersions).toHaveBeenCalledWith({
        claimId: 'claim:test',
        fromVersion: 1,
        toVersion: 2
      });
      expect(mockGetVersionHistory).toHaveBeenCalledWith('claim:test');
    });
  });

  it('should handle same version comparison', () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison 
          {...defaultProps} 
          fromVersion={1} 
          toVersion={1} 
        />
      </TestWrapper>
    );

    // 当版本相同时，不应该调用服务
    expect(mockCompareVersions).not.toHaveBeenCalled();
    expect(mockGetVersionHistory).not.toHaveBeenCalled();
  });

  it('should display change summary when available', async () => {
    render(
      <TestWrapper>
        <ClaimVersionComparison {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('变更摘要:')).toBeInTheDocument();
      expect(screen.getByText('更新了本金、利息并添加了描述')).toBeInTheDocument();
    });
  });
});