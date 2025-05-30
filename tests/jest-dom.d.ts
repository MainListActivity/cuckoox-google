/// <reference types="@testing-library/jest-dom" />

import 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): void;
    toBeDisabled(): void;
    toBeEnabled(): void;
    toBeVisible(): void;
    toContainElement(element: HTMLElement | null): void;
    toHaveAttribute(attr: string, value?: string): void;
    toHaveClass(...classNames: string[]): void;
    toHaveStyle(css: string | Record<string, any>): void;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
  }
}
