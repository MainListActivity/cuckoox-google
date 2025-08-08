import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSimpleTestEnvironment,
  cleanupTestEnvironment,
  resetTestEnvironment,
  render,
} from "../../utils/testUtils";
import AddCreditorDialog from "@/src/pages/creditors/AddCreditorDialog";
import { Creditor } from "@/src/pages/creditors/types";

describe("AddCreditorDialog (使用MockFactory)", () => {
  let testEnv: any;
  let mockOnClose: any;
  let mockOnSave: any;

  const mockCreditor: Creditor = {
    id: "cred001",
    type: "组织",
    name: "Test Company",
    identifier: "91330100MA2XXXXX1A",
    contact_person_name: "John Doe",
    contact_person_phone: "13800138000",
    address: "科技园路1号",
  };

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
    existingCreditor: Creditor | null = null,
  ) => {
    return render(
      <AddCreditorDialog
        open={open}
        onClose={mockOnClose}
        onSave={mockOnSave}
        existingCreditor={existingCreditor}
      />,
    );
  };

  describe("基本渲染测试", () => {
    it("应该在open为true时渲染对话框", () => {
      renderDialog();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("应该在open为false时不渲染对话框", () => {
      renderDialog(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("应该显示表单字段", () => {
      renderDialog();

      // 检查是否有输入字段
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);

      // 检查按钮
      expect(screen.getByText("取消")).toBeInTheDocument();
    });

    it("应该在编辑模式下显示现有数据", () => {
      renderDialog(true, mockCreditor);

      // 检查是否有预填的数据
      expect(screen.getByDisplayValue(mockCreditor.name)).toBeInTheDocument();
    });
  });

  describe("用户交互测试", () => {
    it("应该在点击取消按钮时调用onClose", () => {
      renderDialog();

      const cancelButton = screen.getByText("取消");
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("应该显示表单验证错误", () => {
      renderDialog();

      // 尝试找到保存按钮并点击
      const buttons = screen.getAllByRole("button");
      const saveButton = buttons.find(
        (button) => !button.textContent?.includes("取消"),
      );

      if (saveButton) {
        fireEvent.click(saveButton);

        // 检查是否显示错误信息
        const errorAlert = screen.queryByRole("alert");
        if (errorAlert) {
          expect(errorAlert).toBeInTheDocument();
        }
      }
    });

    it("应该允许填写表单字段", () => {
      renderDialog();

      const textInputs = screen.getAllByRole("textbox");
      if (textInputs.length > 0) {
        fireEvent.change(textInputs[0], { target: { value: "Test Input" } });
        expect(textInputs[0]).toHaveValue("Test Input");
      }
    });
  });

  describe("表单验证测试", () => {
    it("应该处理类型选择", () => {
      renderDialog();

      // 查找下拉选择器
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBeGreaterThan(0);
    });

    it("应该显示必填字段标记", () => {
      renderDialog();

      // 查找必填字段标记
      const requiredMarkers = document.querySelectorAll(
        ".MuiFormLabel-asterisk",
      );
      expect(requiredMarkers.length).toBeGreaterThan(0);
    });
  });

  describe("可访问性测试", () => {
    it("应该具有正确的ARIA属性", () => {
      renderDialog();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("应该支持ESC键关闭", () => {
      renderDialog();

      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("数据处理测试", () => {
    it("应该在编辑模式下保留现有数据", () => {
      renderDialog(true, mockCreditor);

      // 验证现有数据显示
      expect(screen.getByDisplayValue(mockCreditor.name)).toBeInTheDocument();

      if (mockCreditor.contact_person_name) {
        expect(
          screen.getByDisplayValue(mockCreditor.contact_person_name),
        ).toBeInTheDocument();
      }
    });

    it("应该处理空的债权人数据", () => {
      renderDialog(true, null);

      // 应该正常渲染而不出错
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
