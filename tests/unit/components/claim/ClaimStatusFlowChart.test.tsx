import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ClaimStatusFlowChart from "@/src/components/claim/ClaimStatusFlowChart";
import { ClaimStatusFlow, TransitionType } from "@/src/types/claimTracking";

// Mock the services
import { vi } from "vitest";

// Mock date-fns format function to ensure consistent timezone behavior
vi.mock("date-fns", async () => {
  const actual = await vi.importActual<typeof import("date-fns")>("date-fns");
  return {
    ...actual,
    format: vi.fn((date: Date, formatStr: string) => {
      // Convert to UTC+8 (China timezone) for consistent testing
      const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
      const chinaTime = new Date(utcTime + 8 * 60 * 60 * 1000);

      if (formatStr === "yyyy-MM-dd HH:mm:ss") {
        const year = chinaTime.getFullYear();
        const month = String(chinaTime.getMonth() + 1).padStart(2, "0");
        const day = String(chinaTime.getDate()).padStart(2, "0");
        const hours = String(chinaTime.getHours()).padStart(2, "0");
        const minutes = String(chinaTime.getMinutes()).padStart(2, "0");
        const seconds = String(chinaTime.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
      // For other formats, use the actual implementation
      return actual.format(date, formatStr);
    }),
  };
});

// Mock the SurrealProvider context
const mockSurrealContext = {
  client: {},
  isConnected: true,
  connectionStatus: "connected" as const,
  query: vi.fn(),
  queryWithAuth: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

vi.mock("@/src/contexts/SurrealProvider", () => ({
  useSurreal: () => mockSurrealContext,
  SurrealProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock the ClaimStatusFlowService
const mockGetStatusFlowHistory = vi.fn();
vi.mock("@/src/services/claimStatusFlowService", () => ({
  ClaimStatusFlowService: vi.fn().mockImplementation(() => ({
    getStatusFlowHistory: mockGetStatusFlowHistory,
  })),
}));

const theme = createTheme();

const mockStatusFlows: ClaimStatusFlow[] = [
  {
    id: "flow:1",
    claim_id: "claim:test",
    from_status: undefined,
    to_status: "status:draft",
    transition_type: TransitionType.USER_ACTION,
    trigger_reason: "创建债权申报",
    transition_time: "2024-01-15T10:30:00Z",
    operator_id: "user:1",
    operator_role: "债权人",
    transition_notes: "初始创建",
    duration_in_previous_status: undefined,
  },
  {
    id: "flow:2",
    claim_id: "claim:test",
    from_status: "status:draft",
    to_status: "status:submitted",
    transition_type: TransitionType.USER_ACTION,
    trigger_reason: "提交债权申报",
    transition_time: "2024-01-15T11:00:00Z",
    operator_id: "user:1",
    operator_role: "债权人",
    transition_notes: "完成填写后提交",
    duration_in_previous_status: "PT30M",
  },
  {
    id: "flow:3",
    claim_id: "claim:test",
    from_status: "status:submitted",
    to_status: "status:under_review",
    transition_type: TransitionType.SYSTEM_ACTION,
    trigger_reason: "自动进入审核流程",
    transition_time: "2024-01-15T11:01:00Z",
    operator_id: "system:1",
    operator_role: "系统",
    duration_in_previous_status: "PT1M",
  },
  {
    id: "flow:4",
    claim_id: "claim:test",
    from_status: "status:under_review",
    to_status: "status:approved",
    transition_type: TransitionType.ADMIN_ACTION,
    trigger_reason: "审核通过",
    transition_time: "2024-01-16T09:00:00Z",
    operator_id: "user:2",
    operator_role: "审核员",
    review_comments: "材料齐全，审核通过",
    duration_in_previous_status: "PT22H",
  },
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe("ClaimStatusFlowChart", () => {
  const defaultProps = {
    claimId: "claim:test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatusFlowHistory.mockResolvedValue(mockStatusFlows);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("should render status flow chart", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    // 检查标题
    expect(screen.getByText("状态流转历史")).toBeInTheDocument();

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 检查状态流转记录
    expect(screen.getByText("提交债权申报")).toBeInTheDocument();
    expect(screen.getByText("自动进入审核流程")).toBeInTheDocument();
    expect(screen.getByText("审核通过")).toBeInTheDocument();
  });

  it("should show loading state", () => {
    mockGetStatusFlowHistory.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should show error state", async () => {
    mockGetStatusFlowHistory.mockRejectedValue(new Error("Network error"));

    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("加载状态流转历史失败，请重试"),
      ).toBeInTheDocument();
    });
  });

  it("should show empty state when no flows", async () => {
    mockGetStatusFlowHistory.mockResolvedValue([]);

    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("暂无状态流转记录")).toBeInTheDocument();
    });
  });

  it("should display transition types correctly", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(
      () => {
        expect(screen.getByText("创建债权申报")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // 检查不同类型的操作
    expect(screen.getAllByText("用户操作")).toHaveLength(2); // 创建和提交
    expect(screen.getByText("系统操作")).toBeInTheDocument();
    expect(screen.getByText("管理员操作")).toBeInTheDocument();
  });

  it("should handle refresh button click", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("刷新")).toBeInTheDocument();
    });

    // 点击刷新按钮
    fireEvent.click(screen.getByText("刷新"));

    // 验证服务被再次调用
    await waitFor(() => {
      expect(mockGetStatusFlowHistory).toHaveBeenCalledTimes(2);
    });
  });

  it("should handle interactive mode", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} interactive={true} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 在交互模式下，应该有查看详情的按钮
    const viewButtons = screen.getAllByRole("button");
    const viewButton = viewButtons.find((button) =>
      button.querySelector('svg path[d*="eye"]'),
    );

    if (viewButton) {
      fireEvent.click(viewButton);

      // 检查详情对话框
      await waitFor(() => {
        expect(screen.getByText("状态流转详情")).toBeInTheDocument();
      });
    }
  });

  it("should display review comments when available", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("审核意见:")).toBeInTheDocument();
      expect(screen.getByText("材料齐全，审核通过")).toBeInTheDocument();
    });
  });

  it("should display duration information", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 检查持续时间显示
    expect(screen.getByText(/停留.*30分钟/)).toBeInTheDocument();
    expect(screen.getByText(/停留.*22小时/)).toBeInTheDocument();
  });

  it("should render without timeline when showTimeline is false", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} showTimeline={false} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 在非时间轴模式下，应该显示为卡片列表
    // 这里简化测试，主要检查内容是否正确显示
    expect(screen.getByText("提交债权申报")).toBeInTheDocument();
    expect(screen.getByText("审核通过")).toBeInTheDocument();
  });

  it("should call onRefresh when provided", async () => {
    const mockOnRefresh = vi.fn();

    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} onRefresh={mockOnRefresh} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("刷新")).toBeInTheDocument();
    });

    // 点击刷新按钮
    fireEvent.click(screen.getByText("刷新"));

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it("should respect maxHeight prop", () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} maxHeight={400} />
      </TestWrapper>,
    );

    const contentBox = screen
      .getByText("状态流转历史")
      .closest("div")?.nextElementSibling;
    expect(contentBox).toHaveStyle({ maxHeight: "400px" });
  });

  it("should format time correctly", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 检查时间格式化
    expect(screen.getByText(/2024-01-15.*18:30/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15.*19:00/)).toBeInTheDocument();
  });

  it("should handle status name extraction", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("创建债权申报")).toBeInTheDocument();
    });

    // 检查状态名称是否正确提取和显示，使用 getAllByText 来处理可能的重复元素
    expect(screen.getAllByText("draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("submitted").length).toBeGreaterThan(0);
    expect(screen.getAllByText("under_review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("approved").length).toBeGreaterThan(0);
  });

  it("should call service with correct parameters", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(mockGetStatusFlowHistory).toHaveBeenCalledWith("claim:test");
    });
  });

  it("should handle transition notes display", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("初始创建")).toBeInTheDocument();
      expect(screen.getByText("完成填写后提交")).toBeInTheDocument();
    });
  });

  it("should display operator roles correctly", async () => {
    render(
      <TestWrapper>
        <ClaimStatusFlowChart {...defaultProps} />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("债权人")).toHaveLength(2);
      expect(screen.getByText("系统")).toBeInTheDocument();
      expect(screen.getByText("审核员")).toBeInTheDocument();
    });
  });
});
