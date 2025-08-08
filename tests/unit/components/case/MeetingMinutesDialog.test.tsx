import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSimpleTestEnvironment,
  cleanupTestEnvironment,
  resetTestEnvironment,
} from "../../utils/testUtils";
import MeetingMinutesDialog, {
  QuillDelta,
} from "@/src/components/case/MeetingMinutesDialog";
import { Delta } from "quill/core";

// Mock RichTextEditor
vi.mock("../../../../src/components/RichTextEditor", () => ({
  __esModule: true,
  default: vi.fn(({ value, onChange, placeholder }) => (
    <textarea
      data-testid="mocked-rich-text-editor"
      placeholder={placeholder}
      defaultValue={
        typeof value === "string" ? value : JSON.stringify(value?.ops || [])
      }
      onChange={(e) => {
        const mockDelta = new Delta().insert(e.target.value);
        if (onChange) {
          onChange(mockDelta, mockDelta, "user");
        }
      }}
    />
  )),
}));

describe("MeetingMinutesDialog (使用MockFactory)", () => {
  let testEnv: any;
  let mockOnClose: any;
  let mockOnSave: any;

  const mockCaseInfo = {
    caseId: "case:testcaseid",
    caseName: "Test Case Name 2023",
  };

  const mockMeetingTitle = "Test Meeting Minutes Title";

  beforeEach(() => {
    testEnv = createSimpleTestEnvironment();
    mockOnClose = vi.fn();
    mockOnSave = vi.fn();
  });

  afterEach(() => {
    resetTestEnvironment();
    cleanupTestEnvironment();
  });

  const renderDialog = (
    open = true,
    onClose = mockOnClose,
    onSave = mockOnSave,
    existingMinutes?: QuillDelta | string,
  ) => {
    return render(
      <div data-testid="test-providers">
        <MeetingMinutesDialog
          open={open}
          onClose={onClose}
          caseInfo={mockCaseInfo}
          title={mockMeetingTitle}
          onSave={onSave}
          existingMinutes={existingMinutes}
        />
      </div>,
    );
  };

  describe("基本功能测试", () => {
    it("应该在open为true时渲染对话框", () => {
      renderDialog(true);
      expect(screen.getByTestId("mocked-rich-text-editor")).toBeInTheDocument();
      expect(screen.getByText("取消")).toBeInTheDocument();
      expect(screen.getByText("save_minutes_button")).toBeInTheDocument();
    });

    it("应该在open为false时不渲染对话框", () => {
      renderDialog(false);
      expect(
        screen.queryByTestId("mocked-rich-text-editor"),
      ).not.toBeInTheDocument();
    });

    it("应该初始禁用保存按钮", () => {
      renderDialog();
      const saveButton = screen.getByText("save_minutes_button");
      expect(saveButton).toBeDisabled();
    });

    it("应该在编辑器有内容后启用保存按钮", async () => {
      renderDialog();

      const editor = screen.getByTestId("mocked-rich-text-editor");
      const saveButton = screen.getByText("save_minutes_button");

      expect(saveButton).toBeDisabled();

      fireEvent.change(editor, { target: { value: "Test content" } });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("用户交互测试", () => {
    it("应该在点击取消按钮时调用onClose", () => {
      renderDialog();

      const cancelButton = screen.getByText("取消");
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("应该在点击保存按钮时调用onSave", async () => {
      renderDialog();

      const editor = screen.getByTestId("mocked-rich-text-editor");
      const saveButton = screen.getByText("save_minutes_button");

      // 输入内容启用保存按钮
      fireEvent.change(editor, { target: { value: "Test meeting content" } });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      // 点击保存
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });

  describe("内容处理测试", () => {
    it("应该处理Delta类型的现有纪要", () => {
      const existingContent = new Delta().insert("Existing content");
      renderDialog(true, mockOnClose, mockOnSave, existingContent);

      const editor = screen.getByTestId("mocked-rich-text-editor");
      expect(editor).toBeInTheDocument();
    });

    it("应该处理字符串类型的现有纪要", () => {
      const existingContent = "String content";
      renderDialog(true, mockOnClose, mockOnSave, existingContent);

      const editor = screen.getByTestId("mocked-rich-text-editor");
      expect(editor).toBeInTheDocument();
    });
  });

  describe("错误处理测试", () => {
    it("应该正确处理保存失败", async () => {
      const mockOnSaveWithError = vi
        .fn()
        .mockRejectedValue(new Error("Save failed"));
      renderDialog(true, mockOnClose, mockOnSaveWithError);

      const editor = screen.getByTestId("mocked-rich-text-editor");
      const saveButton = screen.getByText("save_minutes_button");

      // 输入内容
      fireEvent.change(editor, { target: { value: "Test content" } });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      // 点击保存
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSaveWithError).toHaveBeenCalled();
      });
    });
  });

  describe("可访问性测试", () => {
    it("应该具有正确的dialog角色", () => {
      renderDialog();
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
    });

    it("应该支持ESC键关闭", () => {
      renderDialog();

      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
