import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';
import { vi } from 'vitest';

// Mock the ClaimAuditService
const mockGetAuditLog = vi.fn();
vi.mock('@/src/services/claimAuditService', () => ({
  ClaimAuditService: vi.fn().mockImplementation(() => ({
    getAuditLog: mockGetAuditLog
  }))
}));

// Mock the SurrealProvider context
vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({
    client: {},
    isConnected: true,
    connectionStatus: 'connected' as const,
    query: vi.fn(),
    queryWithAuth: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  }),
  SurrealProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock touch target utils
vi.mock('@/src/utils/touchTargetUtils', () => ({
  touchFriendlyIconButtonSx: {}
}));

import ClaimAuditLog from '@/src/components/claim/ClaimAuditLog';
import {
  ClaimAccessLog,
  AccessType,
  AccessResult
} from '@/src/types/claimTracking';

const theme = createTheme();

const mockAuditLogs: ClaimAccessLog[] = [
  {
    id: 'access_log:1',
    claim_id: 'claim:test1',
    access_type: AccessType.VIEW,
    accessor_id: 'user:accessor1',
    accessor_name: '张三',
    accessor_role: '债权审核员',
    access_time: '2024-01-15T10:30:00Z',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    accessed_fields: ['claim_number', 'asserted_amount'],
    access_duration: 'PT2M30S',
    access_result: AccessResult.SUCCESS
  },
  {
    id: 'access_log:2',
    claim_id: 'claim:test1',
    access_type: AccessType.DOWNLOAD,
    accessor_id: 'user:accessor2',
    accessor_name: '李四',
    accessor_role: '案件负责人',
    access_time: '2024-01-15T11:00:00Z',
    ip_address: '192.168.1.101',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    access_result: AccessResult.SUCCESS
  },
  {
    id: 'access_log:3',
    claim_id: 'claim:test1',
    access_type: AccessType.EXPORT,
    accessor_id: 'user:accessor3',
    accessor_name: '王五',
    accessor_role: '债权人',
    access_time: '2024-01-15T12:00:00Z',
    ip_address: '192.168.1.102',
    access_result: AccessResult.DENIED,
    denial_reason: '权限不足'
  }
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
);

describe('ClaimAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditLog.mockResolvedValue(mockAuditLogs);
  });

  it('应该正确渲染审计日志组件', async () => {
    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    expect(screen.getByText('审计日志')).toBeInTheDocument();
    expect(screen.getByText('筛选')).toBeInTheDocument();
    expect(screen.getByText('刷新')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetAuditLog).toHaveBeenCalledWith({
        claim_id: 'claim:test1',
        user_id: undefined,
        limit: 20,
        offset: 0,
        access_type: undefined,
        access_result: undefined,
        date_range: undefined
      });
    });
  });

  it('应该显示加载状态', () => {
    mockGetAuditLog.mockImplementation(() => new Promise(() => {}));

    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('应该显示错误信息', async () => {
    const errorMessage = '加载审计日志失败';
    mockGetAuditLog.mockRejectedValue(new Error(errorMessage));

    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('加载审计日志失败，请重试')).toBeInTheDocument();
    });
  });

  it('应该显示空状态', async () => {
    mockGetAuditLog.mockResolvedValue([]);

    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('暂无审计记录')).toBeInTheDocument();
    });
  });

  it('应该正确显示审计日志列表', async () => {
    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('李四')).toBeInTheDocument();
      expect(screen.getByText('王五')).toBeInTheDocument();
      expect(screen.getByText('查看')).toBeInTheDocument();
      expect(screen.getByText('下载')).toBeInTheDocument();
      expect(screen.getByText('导出')).toBeInTheDocument();
    });
  });

  it('应该支持用户ID筛选', async () => {
    render(
      <TestWrapper>
        <ClaimAuditLog userId="user:test" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user:test'
        })
      );
    });
  });

  it('应该正确格式化访问时长', async () => {
    const logsWithDuration = [
      {
        ...mockAuditLogs[0],
        access_duration: 'PT1H30M45S' // 1小时30分45秒
      },
      {
        ...mockAuditLogs[1],
        access_duration: 'PT5M30S' // 5分30秒
      },
      {
        ...mockAuditLogs[2],
        access_duration: 'PT30S' // 30秒
      }
    ];

    mockGetAuditLog.mockResolvedValue(logsWithDuration);

    render(
      <TestWrapper>
        <ClaimAuditLog claimId="claim:test1" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1小时30分45秒')).toBeInTheDocument();
      expect(screen.getByText('5分30秒')).toBeInTheDocument();
      expect(screen.getByText('30秒')).toBeInTheDocument();
    });
  });
});