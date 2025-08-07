import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { vi } from 'vitest';
import i18n from '@/src/i18n';

// 创建唯一key以确保每个测试都有独立的Provider状态
let routerKey = 0;

// 增强的渲染函数，确保每次渲染都是完全独立的
const render = (ui: React.ReactElement, options?: RenderOptions) => {
  // 为每个测试生成唯一的key，避免Provider状态污染
  const uniqueKey = `test-render-${++routerKey}-${Date.now()}`;
  
  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <BrowserRouter key={uniqueKey}>
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </BrowserRouter>
    );
  };

  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
};

// 最简单的渲染helper - 不使用任何provider
export const simpleRender = (ui: React.ReactElement) => {
  return rtlRender(ui);
};

// Mock hooks
export const mockUseTranslation = () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'create_user_and_add_to_case': '创建用户并添加到案件',
      'username_label': '用户名',
      'cancel_button': '取消',
      'create_user_and_add': '创建用户并添加',
      'password_label': '密码',
      'email_label': '邮箱',
      'display_name_label': '显示姓名',
      'role_in_case_label': '在案件中的角色',
      'username_required': '用户名不能为空',
      'password_required': '密码不能为空',
      'email_required': '邮箱不能为空',
      'name_required': '姓名不能为空',
      'email_invalid': '邮箱格式不正确',
    };
    return translations[key] || key;
  },
});

export const mockUseNavigate = vi.fn();
export const mockUseLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
}));
export const mockUseParams = vi.fn(() => ({}));

// Export enhanced render as default and all testing-library functions
export { render };
export * from '@testing-library/react';