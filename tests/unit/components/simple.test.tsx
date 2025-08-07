import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// 最简单的组件测试
function SimpleComponent() {
  return <div data-testid="simple-component">Hello World</div>;
}

describe('简单组件测试', () => {
  it('应该渲染Hello World', () => {
    render(<SimpleComponent />);
    expect(screen.getByTestId('simple-component')).toHaveTextContent('Hello World');
  });

  it('基础算术验证', () => {
    expect(2 + 2).toBe(4);
  });
});