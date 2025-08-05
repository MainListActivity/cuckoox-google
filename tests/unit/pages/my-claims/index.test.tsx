import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { SnackbarProvider } from "@/src/contexts/SnackbarContext";
import MyClaimsPage from "@/src/pages/my-claims/index";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
const mockUser = {
  id: "test-user-id",
  github_id: "test-github-id",
  name: "Test User",
  email: "test@example.com",
};

vi.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    selectedCaseId: "test-case-id",
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowWarning = vi.fn();
const mockShowInfo = vi.fn();
vi.mock("@/src/contexts/SnackbarContext", async () => {
  const actual = await vi.importActual("@/src/contexts/SnackbarContext");
  return {
    ...actual,
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showWarning: mockShowWarning,
      showInfo: mockShowInfo,
    }),
  };
});

// Mock useOperationPermission
vi.mock("@/src/hooks/usePermission", () => ({
  useOperationPermission: () => ({
    hasPermission: true,
    isLoading: false,
  }),
}));

// Mock useResponsiveLayout
vi.mock("@/src/hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

// Mock i18n translation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        my_claims: "我的债权申报",
        submit_new_claim: "发起新的债权申报",
        view_details: "查看详情",
        edit: "编辑",
        withdraw: "撤回",
        error_loading_claims: "加载债权列表失败",
        loading_claims: "正在加载债权列表...",
        claim_id: "债权编号",
        claim_amount: "申报金额",
        claim_status: "申报状态",
        actions: "操作",
        no_claims: "暂无债权申报记录",
      };
      return translations[key] || key;
    },
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock queryWithAuth
vi.mock("@/src/utils/surrealAuth", () => ({
  queryWithAuth: vi.fn(),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthenticationRequiredError";
    }
  },
}));

// Mock useSurrealClient
const mockClient = {
  query: vi.fn(),
  select: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  merge: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/src/contexts/SurrealProvider", async () => {
  const actual = await vi.importActual("@/src/contexts/SurrealProvider");
  return {
    ...actual,
    useSurrealClient: () => mockClient,
    AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "AuthenticationRequiredError";
      }
    },
  };
});

const theme = createTheme();

// Mock claims data - 匹配 RawClaimData 接口结构
const mockClaimsData = [
  {
    id: "CLAIM-001",
    claim_number: "CLAIM-001",
    case_id: "case:test",
    creditor_id: "creditor:test",
    status: "待审核",
    submission_time: "2023-10-26T00:00:00Z",
    review_status_id: "status:pending",
    review_comments: "",
    created_at: "2023-10-26T00:00:00Z",
    updated_at: "2023-10-26T00:00:00Z",
    created_by: "user:test",
    asserted_claim_details: {
      nature: "普通债权",
      principal: 15000,
      interest: 0,
      other_amount: 0,
      total_asserted_amount: 15000,
      currency: "CNY",
      brief_description: "测试债权",
    },
  },
  {
    id: "CLAIM-002",
    claim_number: "CLAIM-002",
    case_id: "case:test",
    creditor_id: "creditor:test",
    status: "审核通过",
    submission_time: "2023-10-20T00:00:00Z",
    review_status_id: "status:approved",
    review_comments: "符合要求",
    created_at: "2023-10-20T00:00:00Z",
    updated_at: "2023-10-20T00:00:00Z",
    created_by: "user:test",
    asserted_claim_details: {
      nature: "有财产担保债权",
      principal: 125000,
      interest: 0,
      other_amount: 0,
      total_asserted_amount: 125000,
      currency: "CNY",
      brief_description: "有担保债权",
    },
    approved_claim_details: {
      nature: "有财产担保债权",
      principal: 125000,
      interest: 0,
      other_amount: 0,
      total_approved_amount: 125000,
      currency: "CNY",
    },
  },
  {
    id: "CLAIM-003",
    claim_number: "CLAIM-003",
    case_id: "case:test",
    creditor_id: "creditor:test",
    status: "已驳回",
    submission_time: "2023-09-15T00:00:00Z",
    review_status_id: "status:rejected",
    review_comments: "材料不足，请补充合同和工资流水。",
    created_at: "2023-09-15T00:00:00Z",
    updated_at: "2023-09-15T00:00:00Z",
    created_by: "user:test",
    asserted_claim_details: {
      nature: "劳动报酬",
      principal: 8000,
      interest: 0,
      other_amount: 0,
      total_asserted_amount: 8000,
      currency: "CNY",
      brief_description: "劳动报酬债权",
    },
  },
  {
    id: "CLAIM-004",
    claim_number: "CLAIM-004",
    case_id: "case:test",
    creditor_id: "creditor:test",
    status: "需要补充",
    submission_time: "2023-11-01T00:00:00Z",
    review_status_id: "status:supplement",
    review_comments: "请提供债权发生时间的证明。",
    created_at: "2023-11-01T00:00:00Z",
    updated_at: "2023-11-01T00:00:00Z",
    created_by: "user:test",
    asserted_claim_details: {
      nature: "普通债权",
      principal: 22000,
      interest: 0,
      other_amount: 0,
      total_asserted_amount: 22000,
      currency: "USD",
      brief_description: "美元债权",
    },
  },
];

// Helper function to render component with providers
const renderMyClaimsPage = () => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <SnackbarProvider>
          <MyClaimsPage />
        </SnackbarProvider>
      </BrowserRouter>
    </ThemeProvider>,
  );
};

describe("MyClaimsPage", () => {
  let mockQueryWithAuth: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked function
    mockQueryWithAuth = (await import("@/src/utils/surrealAuth"))
      .queryWithAuth as Mock;

    // 设置默认的 queryWithAuth mock 行为
    // queryWithAuth 返回数组，组件中会取 results[0] 作为数据数组
    mockQueryWithAuth.mockImplementation(async () => [[]]);
  });

  describe("Page Rendering", () => {
    it("renders the page title", async () => {
      // 设置空数据响应
      mockQueryWithAuth.mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(() => {
        expect(screen.getByText("我的债权申报")).toBeInTheDocument();
      });
    });

    it("shows loading state while fetching data", async () => {
      // 创建一个延迟的Promise来测试加载状态
      let resolveQuery: (value: any) => void;
      const loadingPromise = new Promise((resolve) => {
        resolveQuery = resolve;
      });

      mockQueryWithAuth.mockImplementationOnce(() => loadingPromise);

      await act(async () => {
        renderMyClaimsPage();
      });

      // 验证加载状态显示
      expect(screen.getByText("正在加载债权列表...")).toBeInTheDocument();

      // 解析Promise完成加载
      await act(async () => {
        resolveQuery!([mockClaimsData]);
      });

      // 等待加载状态消失
      await waitFor(() => {
        expect(
          screen.queryByText("正在加载债权列表..."),
        ).not.toBeInTheDocument();
      });
    });

    it("shows error message when data fetching fails", async () => {
      const errorMessage = "Failed to load claims";
      mockQueryWithAuth.mockRejectedValueOnce(new Error(errorMessage));

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(errorMessage);
      });
    });

    it("shows empty state when no claims exist", async () => {
      // 返回空数组
      mockQueryWithAuth.mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(() => {
        expect(screen.getByText("暂无债权申报记录")).toBeInTheDocument();
      });
    });

    it("renders all claims in the table", async () => {
      // 第一次调用返回债权数据，第二次调用可能返回状态定义（为空也没关系）
      mockQueryWithAuth
        .mockResolvedValueOnce([mockClaimsData])
        .mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(
        () => {
          expect(screen.getByText("CLAIM-001")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-002")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-003")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-004")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // 检查所有债权是否都渲染了
      mockClaimsData.forEach((claim) => {
        const row = screen.getByText(claim.claim_number).closest("tr");
        expect(row).toBeInTheDocument();
      });
    });
  });

  describe("Button States", () => {
    // Helper function to setup data and render
    const setupAndRender = async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([mockClaimsData])
        .mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(
        () => {
          expect(screen.getByText("CLAIM-001")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-002")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-003")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-004")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    };

    it("does not show withdraw button for claims not in pending review", async () => {
      await setupAndRender();

      const rowForClaim002 = screen.getByText("CLAIM-002").closest("tr");
      expect(rowForClaim002).toBeInTheDocument();
      const withdrawButton = within(rowForClaim002!).queryByTestId(
        "withdraw-button",
      );
      expect(withdrawButton).not.toBeInTheDocument();
    });

    it("enables withdraw button for claims in pending review", async () => {
      await setupAndRender();

      const rowForClaim001 = screen.getByText("CLAIM-001").closest("tr");
      expect(rowForClaim001).toBeInTheDocument();
      const withdrawButton = within(rowForClaim001!).getByTestId(
        "withdraw-button",
      );
      expect(withdrawButton).not.toBeDisabled();
    });

    it("does not show edit button for claims not in rejected or supplement status", async () => {
      await setupAndRender();

      const rows = ["CLAIM-001", "CLAIM-002"].map((id) => {
        const row = screen.getByText(id).closest("tr");
        expect(row).toBeInTheDocument();
        return row!;
      });

      rows.forEach((row) => {
        const editButton = within(row).queryByTestId("edit-button");
        expect(editButton).not.toBeInTheDocument();
      });
    });

    it("shows edit button for claims in rejected or supplement status", async () => {
      await setupAndRender();

      const rows = ["CLAIM-003", "CLAIM-004"].map((id) => {
        const row = screen.getByText(id).closest("tr");
        expect(row).toBeInTheDocument();
        return row!;
      });

      rows.forEach((row) => {
        const editButton = within(row).getByTestId("edit-button");
        expect(editButton).toBeInTheDocument();
        expect(editButton).not.toBeDisabled();
      });
    });
  });

  describe("Navigation", () => {
    const setupAndRender = async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([mockClaimsData])
        .mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(
        () => {
          expect(screen.getByText("CLAIM-001")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-002")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-003")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-004")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    };

    it("navigates to claim details page on view details click", async () => {
      await setupAndRender();

      const rowForClaim001 = screen.getByText("CLAIM-001").closest("tr");
      expect(rowForClaim001).toBeInTheDocument();
      const viewDetailsButton = within(rowForClaim001!).getByTestId(
        "view-details-button",
      );

      await act(async () => {
        fireEvent.click(viewDetailsButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/my-claims/CLAIM-001");
    });

    it("navigates to edit page for editable claims", async () => {
      await setupAndRender();

      const rowForClaim003 = screen.getByText("CLAIM-003").closest("tr");
      expect(rowForClaim003).toBeInTheDocument();
      const editButton = within(rowForClaim003!).getByTestId("edit-button");

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/claims/submit/CLAIM-003");
    });

    it("navigates to new claim submission on button click", async () => {
      mockQueryWithAuth.mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(() => {
        const newClaimButton = screen.getByRole("button", {
          name: "发起新的债权申报",
        });
        expect(newClaimButton).toBeInTheDocument();
      });

      const newClaimButton = screen.getByRole("button", {
        name: "发起新的债权申报",
      });

      await act(async () => {
        fireEvent.click(newClaimButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/claims/submit");
    });
  });

  describe("Claim Actions", () => {
    const setupAndRender = async () => {
      mockQueryWithAuth
        .mockResolvedValueOnce([mockClaimsData])
        .mockResolvedValueOnce([[]]);

      await act(async () => {
        renderMyClaimsPage();
      });

      await waitFor(
        () => {
          expect(screen.getByText("CLAIM-001")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-002")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-003")).toBeInTheDocument();
          expect(screen.getByText("CLAIM-004")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    };

    it("handles claim withdrawal successfully", async () => {
      await setupAndRender();

      // Mock 撤回成功的响应
      mockQueryWithAuth.mockResolvedValueOnce([[{ id: "status:draft" }]]); // 状态查询
      mockQueryWithAuth.mockResolvedValueOnce([{}]); // 更新操作

      const rowForClaim001 = screen.getByText("CLAIM-001").closest("tr");
      expect(rowForClaim001).toBeInTheDocument();
      const withdrawButton = within(rowForClaim001!).getByTestId(
        "withdraw-button",
      );

      await act(async () => {
        fireEvent.click(withdrawButton);
      });

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith(
          "债权 CLAIM-001 已成功撤回。",
        );
      });
    });

    it("handles claim withdrawal error", async () => {
      await setupAndRender();

      // Mock 撤回失败的响应
      mockQueryWithAuth.mockRejectedValueOnce(
        new Error("Failed to withdraw claim"),
      );

      const rowForClaim001 = screen.getByText("CLAIM-001").closest("tr");
      expect(rowForClaim001).toBeInTheDocument();
      const withdrawButton = within(rowForClaim001!).getByTestId(
        "withdraw-button",
      );

      await act(async () => {
        fireEvent.click(withdrawButton);
      });

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          expect.stringContaining("撤回失败"),
        );
      });
    });

    it("does not show withdraw button for non-pending claims", async () => {
      await setupAndRender();

      const rowForClaim002 = screen.getByText("CLAIM-002").closest("tr");
      expect(rowForClaim002).toBeInTheDocument();
      const withdrawButton = within(rowForClaim002!).queryByTestId(
        "withdraw-button",
      );
      expect(withdrawButton).not.toBeInTheDocument();
    });
  });
});
