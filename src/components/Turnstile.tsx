import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

interface TurnstileProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  action?: string;
  cData?: string;
  language?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileRenderParams {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': (error: string) => void;
  'expired-callback': () => void;
  theme: string;
  size: string;
  action?: string;
  cData?: string;
  language: string;
  appearance: string;
  'response-field': boolean;
  'refresh-expired': string;
}

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, params: TurnstileRenderParams) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
      isExpired: (widgetId: string) => boolean;
    };
  }
}

interface TurnstileElement extends HTMLDivElement {
  reset?: () => void;
}

const Turnstile: React.FC<TurnstileProps> = ({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  action,
  cData,
  language = 'auto',
  appearance = 'always',
}) => {
  const containerRef = useRef<TurnstileElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const renderTurnstile = () => {
      if (!containerRef.current || !window.turnstile) {
        return;
      }

      // 清理之前的widget
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.warn('Failed to remove previous Turnstile widget:', e);
        }
      }

      try {
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            console.log('Turnstile验证成功');
            onSuccess(token);
          },
          'error-callback': (error: string) => {
            console.error('Turnstile错误:', error);
            onError?.(error);
          },
          'expired-callback': () => {
            console.log('Turnstile token已过期');
            onExpire?.();
          },
          theme,
          size,
          action,
          cData,
          language,
          appearance,
          'response-field': false, // 不创建隐藏的input字段
          'refresh-expired': 'auto', // 自动刷新过期的token
        });

        widgetIdRef.current = widgetId;
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to render Turnstile:', error);
        setIsLoading(false);
        onError?.('Failed to render Turnstile');
      }
    };

    // 检查Turnstile是否已加载
    const checkTurnstileReady = () => {
      if (window.turnstile) {
        renderTurnstile();
      } else {
        // 如果还未加载，等待一段时间后重试
        timeoutId = setTimeout(checkTurnstileReady, 100);
      }
    };

    checkTurnstileReady();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.warn('Failed to remove Turnstile widget on cleanup:', e);
        }
      }
    };
  }, [siteKey, onSuccess, onError, onExpire, theme, size, action, cData, language, appearance]);

  // 提供重置方法
  useEffect(() => {
    // 将重置方法暴露给父组件
    if (containerRef.current) {
      containerRef.current.reset = () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      };
    }
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: size === 'compact' ? 140 : 65,
        width: '100%',
        position: 'relative',
      }}
    >
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'text.secondary',
            fontSize: '0.875rem',
          }}
        >
          加载验证组件...
        </Box>
      )}
    </Box>
  );
};

export default Turnstile; 