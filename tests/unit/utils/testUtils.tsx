import React from "react";
import { render as originalRender } from "@testing-library/react";
import { vi } from "vitest";

// 最简单的渲染helper - 不使用任何provider，保持与原来的兼容性
export const simpleRender = (ui: React.ReactElement) => {
  return originalRender(ui);
};

// 保持原来的render函数作为默认导出，确保现有测试不受影响
export const render = simpleRender;

// Mock hooks - 保持原来的实现
export const mockUseTranslation = () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      create_user_and_add_to_case: "创建用户并添加到案件",
      username_label: "用户名",
      cancel_button: "取消",
      create_user_and_add: "创建用户并添加",
      password_label: "密码",
      email_label: "邮箱",
      display_name_label: "显示姓名",
      role_in_case_label: "在案件中的角色",
      username_required: "用户名不能为空",
      password_required: "密码不能为空",
      email_required: "邮箱不能为空",
      name_required: "姓名不能为空",
      email_invalid: "邮箱格式不正确",
    };
    return translations[key] || key;
  },
});

export const mockUseNavigate = vi.fn();
export const mockUseLocation = vi.fn(() => ({
  pathname: "/",
  search: "",
  hash: "",
  state: null,
}));
export const mockUseParams = vi.fn(() => ({}));

// Export everything from testing-library
export * from "@testing-library/react";
