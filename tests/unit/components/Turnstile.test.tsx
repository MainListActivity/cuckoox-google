import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Turnstile from '@/src/components/Turnstile';

// Mock window.turnstile
const mockTurnstile = {
  render: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
  getResponse: vi.fn(),
  isExpired: vi.fn(),
};

describe('Turnstile Component', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();
  const mockOnExpire = vi.fn();
  const testSiteKey = '1x00000000000000000000AA';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock window.turnstile
    (window as any).turnstile = mockTurnstile;
    
    // Mock render to return a widget ID
    mockTurnstile.render.mockReturnValue('widget-123');
  });

  afterEach(() => {
    // Clean up
    delete (window as any).turnstile;
  });

  it('renders loading state initially', () => {
    // Temporarily remove window.turnstile to test loading state
    delete (window as any).turnstile;
    
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('加载验证组件...')).toBeInTheDocument();
  });

  it('renders Turnstile widget when loaded', async () => {
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        onExpire={mockOnExpire}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          sitekey: testSiteKey,
          callback: expect.any(Function),
          'error-callback': expect.any(Function),
          'expired-callback': expect.any(Function),
          theme: 'auto',
          size: 'normal',
          language: 'auto',
          appearance: 'always',
          'response-field': false,
          'refresh-expired': 'auto',
        })
      );
    });
  });

  it('calls onSuccess when verification succeeds', async () => {
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });

    // Get the callback function passed to render
    const renderCall = mockTurnstile.render.mock.calls[0];
    const params = renderCall[1];
    const successCallback = params.callback;

    // Simulate successful verification
    const testToken = 'test-token-123';
    successCallback(testToken);

    expect(mockOnSuccess).toHaveBeenCalledWith(testToken);
  });

  it('calls onError when verification fails', async () => {
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });

    // Get the error callback
    const renderCall = mockTurnstile.render.mock.calls[0];
    const params = renderCall[1];
    const errorCallback = params['error-callback'];

    // Simulate error
    const testError = 'verification-failed';
    errorCallback(testError);

    expect(mockOnError).toHaveBeenCalledWith(testError);
  });

  it('calls onExpire when token expires', async () => {
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        onExpire={mockOnExpire}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });

    // Get the expire callback
    const renderCall = mockTurnstile.render.mock.calls[0];
    const params = renderCall[1];
    const expireCallback = params['expired-callback'];

    // Simulate token expiration
    expireCallback();

    expect(mockOnExpire).toHaveBeenCalled();
  });

  it('removes widget on unmount', async () => {
    const { unmount } = render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });

    unmount();

    expect(mockTurnstile.remove).toHaveBeenCalledWith('widget-123');
  });

  it('supports different sizes', async () => {
    const { rerender } = render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        size="compact"
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          size: 'compact',
        })
      );
    });

    // Clear previous calls
    mockTurnstile.render.mockClear();

    rerender(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        size="flexible"
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          size: 'flexible',
        })
      );
    });
  });

  it('supports theme customization', async () => {
    render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
        theme="dark"
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          theme: 'dark',
        })
      );
    });
  });

  it('exposes reset method', async () => {
    const { container } = render(
      <Turnstile
        siteKey={testSiteKey}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(mockTurnstile.render).toHaveBeenCalled();
    });

    // Get the Turnstile container div
    const turnstileContainer = container.querySelector('.MuiBox-root') as any;
    
    // The reset method should be available
    expect(turnstileContainer.reset).toBeDefined();
    
    // Call reset
    turnstileContainer.reset();
    
    expect(mockTurnstile.reset).toHaveBeenCalledWith('widget-123');
  });
}); 