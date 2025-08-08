import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { SnackbarProvider } from "@/src/contexts/SnackbarContext";
import AdminCreateClaimAttachmentsPage from "@/src/pages/admin/create-claim-attachments";
import { Delta } from "quill/core";
import {
  MockFactory,
  createLightweightTestEnvironment,
} from "../../utils/mockFactory";

// Mock data
const mockNavigate = vi.fn();
const mockTempClaimId = "TEMP-CLAIM-MOCK-456";
const mockShowSnackbar = vi.fn();
let testEnv: any;

// Mock react-router-dom
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ tempClaimId: mockTempClaimId }),
    BrowserRouter: ({ children, ...props }: any) =>
      React.createElement(
        "div",
        { "data-testid": "mock-browser-router", ...props },
        children,
      ),
  };
});

// Mock RichTextEditor
vi.mock("../../../../src/components/RichTextEditor", () => ({
  __esModule: true,
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="mocked-rich-text-editor"
      value={value instanceof Delta ? JSON.stringify(value.ops) : ""}
      onChange={(e) => {
        const newDelta = new Delta([{ insert: e.target.value }]);
        onChange(newDelta);
      }}
    />
  )),
}));

// Mock SnackbarContext
vi.mock("@/src/contexts/SnackbarContext", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSnackbar: () => ({
      showSnackbar: mockShowSnackbar,
    }),
    SnackbarProvider: ({ children }: any) =>
      React.createElement(
        "div",
        { "data-testid": "mock-snackbar-provider" },
        children,
      ),
  };
});

const theme = createTheme();

describe("AdminCreateClaimAttachmentsPage", () => {
  beforeEach(() => {
    testEnv = createLightweightTestEnvironment();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    if (testEnv) {
      testEnv.cleanup();
    }
    MockFactory.cleanup();
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <SnackbarProvider>
            <AdminCreateClaimAttachmentsPage />
          </SnackbarProvider>
        </ThemeProvider>
      </BrowserRouter>,
    );
  };

  it("renders the page with MUI components, displays tempClaimId, and shows RichTextEditor", async () => {
    renderComponent();

    // Check that the temp claim ID is displayed
    expect(screen.getByText(new RegExp(mockTempClaimId))).toBeInTheDocument();

    // Check that RichTextEditor is rendered
    expect(screen.getByTestId("mocked-rich-text-editor")).toBeInTheDocument();

    // Check for MUI components
    expect(
      screen.getByRole("button", { name: "back_to_edit_basic_info_button" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "save_draft_button" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "complete_and_submit_claim_button" }),
    ).toBeInTheDocument();
  });

  it('clicking "返回修改基本信息" calls navigate with -1 (or specific path)', async () => {
    renderComponent();

    const backButton = screen.getByRole("button", {
      name: "back_to_edit_basic_info_button",
    });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('"保存草稿" button logs correctly and calls showSnackbar', async () => {
    renderComponent();

    const saveButton = screen.getByRole("button", {
      name: "save_draft_button",
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        "admin_attachments_draft_saved_success",
        "success",
      );
    });
  });

  it('"完成并提交债权" button logs, calls showSnackbar, and navigates', async () => {
    renderComponent();

    const submitButton = screen.getByRole("button", {
      name: "complete_and_submit_claim_button",
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        "admin_claim_submitted_success",
        "success",
      );
      expect(mockNavigate).toHaveBeenCalledWith("/admin/claims");
    });
  });
});
