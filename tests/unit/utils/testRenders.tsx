import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// 超轻量级的测试渲染函数，避免复杂provider
export function renderLight(ui: React.ReactElement) {
  return render(ui);
}

// 针对需要基础provider的组件
export function renderWithBasicProviders(ui: React.ReactElement) {
  // 简单的i18n mock
  const MockI18nProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-i18n-provider">{children}</div>
  );
  
  // 简单的snackbar mock
  const MockSnackbarProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-snackbar-provider">{children}</div>
  );

  return render(
    <MockI18nProvider>
      <MockSnackbarProvider>
        {ui}
      </MockSnackbarProvider>
    </MockI18nProvider>
  );
}

// 通用的mock函数
export const createMockFunctions = () => ({
  onClose: vi.fn(),
  onSave: vi.fn(),
  onSubmit: vi.fn(),
  onChange: vi.fn(),
  onClick: vi.fn(),
});

// Mock i18n
export const mockT = (key: string) => key;

// Mock useTranslation
export const mockUseTranslation = () => ({
  t: mockT,
  i18n: {
    changeLanguage: vi.fn(),
    language: 'zh-CN',
  },
});

// Mock常见的hooks
export const mockUseNavigate = vi.fn();
export const mockUseLocation = () => ({ pathname: '/' });
export const mockUseParams = () => ({});