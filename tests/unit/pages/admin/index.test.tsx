import React from "react";
import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdminPage from "@/src/pages/admin/index";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  MockFactory,
  createLightweightTestEnvironment,
} from "../../utils/mockFactory";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) =>
    React.createElement(
      "div",
      { "data-testid": "mock-i18n-provider" },
      children,
    ),
}));

// Mock react-router-dom
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
    useParams: () => ({}),
    BrowserRouter: ({ children, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "mock-browser-router", ...props },
        children,
      ),
  };
});

const theme = createTheme();
let testEnv: any;

describe("AdminPage", () => {
  beforeEach(() => {
    testEnv = createLightweightTestEnvironment();
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <AdminPage />
        </ThemeProvider>
      </BrowserRouter>,
    );
  });

  afterEach(() => {
    cleanup();
    if (testEnv) {
      testEnv.cleanup();
    }
    MockFactory.cleanup();
    vi.clearAllMocks();
  });

  test('renders the main title "系统管理"', () => {
    expect(
      screen.getByText("系统管理", { selector: "h1" }),
    ).toBeInTheDocument();
  });

  // Dynamically create tests for each admin section based on the local definition if possible,
  // or by using the actual definition from the component file if it were exported.
  // Since it's not exported, we'll use the one defined in the component.
  // This means if the component's adminSections changes, this test needs to be updated.
  const sections = [
    {
      title: "用户管理",
      description: "管理系统用户账户、分配全局角色。",
      buttonText: "管理用户",
    },
    {
      title: "身份与权限管理",
      description: "定义用户身份（角色）及其可操作的菜单和功能权限。",
      buttonText: "管理身份权限",
    },
    {
      title: "审核状态维护",
      description: "配置债权审核时可选的审核状态列表。",
      buttonText: "维护审核状态",
    },
    {
      title: "案件通知规则",
      description: "配置案件机器人基于案件阶段发送通知的规则和模板。",
      buttonText: "配置通知规则",
    },
    {
      title: "系统配置",
      description: "管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。",
      buttonText: "系统配置",
    },
  ];

  sections.forEach((section) => {
    test(`renders card for "${section.title}"`, () => {
      // Check for section title
      expect(
        screen.getByText(section.title, { selector: "h2" }),
      ).toBeInTheDocument();
      // Check for section description
      expect(screen.getByText(section.description)).toBeInTheDocument();
      // Check for section button
      expect(
        screen.getByRole("button", { name: section.buttonText }),
      ).toBeInTheDocument();
      // Check for an icon in the card. Since SvgIcon is complex to test directly without specific test IDs on icons,
      // we can check if an SVG element is rendered within the card containing the title.
      const titleElement = screen.getByText(section.title, { selector: "h2" });
      const cardElement = titleElement.closest(".MuiCard-root"); // Find the parent card
      expect(cardElement).not.toBeNull();
      if (cardElement) {
        const svgElement = cardElement.querySelector("svg");
        expect(svgElement).toBeInTheDocument();
      }
    });
  });

  test("renders the footer text", () => {
    expect(
      screen.getByText(/系统管理页面，仅限管理员访问。/),
    ).toBeInTheDocument();
  });
});
