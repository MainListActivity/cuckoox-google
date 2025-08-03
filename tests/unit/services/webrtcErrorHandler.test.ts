import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { webrtcErrorHandler } from '@/src/services/webrtcErrorHandler';
import { useSnackbar } from '@/src/contexts/SnackbarContext';

// Mock dependencies
vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: vi.fn(),
}));

const mockUseSnackbar = useSnackbar as Mock;
const mockEnqueueSnackbar = vi.fn();

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

describe('WebRTCErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup snackbar mock
    mockUseSnackbar.mockReturnValue({
      enqueueSnackbar: mockEnqueueSnackbar,
    });
    
    // Reset error handler state
    (webrtcErrorHandler as any).errorCounts = new Map();
    (webrtcErrorHandler as any).lastErrors = new Map();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify media permission error correctly', () => {
      // Arrange
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';

      // Act
      const classification = webrtcErrorHandler.classifyError(error);

      // Assert
      expect(classification).toEqual({
        type: 'MEDIA_PERMISSION_DENIED',
        severity: 'high',
        recoverable: false,
        userMessage: '无法访问摄像头或麦克风，请检查浏览器权限设置',
        technicalMessage: 'Permission denied',
        suggestedActions: [
          '检查浏览器权限设置',
          '确保摄像头和麦克风未被其他应用占用',
          '尝试刷新页面重新授权'
        ]
      });
    });

    it('should classify network connection error correctly', () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';

      // Act
      const classification = webrtcErrorHandler.classifyError(error);

      // Assert
      expect(classification).toEqual({
        type: 'NETWORK_CONNECTION_FAILED',
        severity: 'medium',
        recoverable: true,
        userMessage: '网络连接失败，请检查网络连接',
        technicalMessage: 'Network error',
        suggestedActions: [
          '检查网络连接状态',
          '尝试切换网络环境',
          '稍后重试连接'
        ]
      });
    });

    it('should classify peer connection error correctly', () => {
      // Arrange
      const error = new Error('Connection failed');
      error.name = 'InvalidStateError';

      // Act
      const classification = webrtcErrorHandler.classifyError(error);

      // Assert
      expect(classification).toEqual({
        type: 'PEER_CONNECTION_FAILED',
        severity: 'high',
        recoverable: true,
        userMessage: '连接建立失败，正在尝试重新连接',
        technicalMessage: 'Connection failed',
        suggestedActions: [
          '检查防火墙设置',
          '尝试使用不同的网络',
          '联系技术支持'
        ]
      });
    });

    it('should classify unknown error as generic', () => {
      // Arrange
      const error = new Error('Unknown error');

      // Act
      const classification = webrtcErrorHandler.classifyError(error);

      // Assert
      expect(classification.type).toBe('UNKNOWN_ERROR');
      expect(classification.severity).toBe('medium');
      expect(classification.recoverable).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle error with user notification', async () => {
      // Arrange
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      const context = { userId: 'user123', callId: 'call456' };

      // Act
      await webrtcErrorHandler.handleError(error, context);

      // Assert
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        '无法访问摄像头或麦克风，请检查浏览器权限设置',
        'error'
      );
      expect(mockConsole.error).toHaveBeenCalledWith(
        'WebRTC Error:',
        expect.objectContaining({
          type: 'MEDIA_PERMISSION_DENIED',
          context,
        })
      );
    });

    it('should track error frequency', async () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';
      const context = { userId: 'user123' };

      // Act
      await webrtcErrorHandler.handleError(error, context);
      await webrtcErrorHandler.handleError(error, context);

      // Assert
      const errorCount = (webrtcErrorHandler as any).errorCounts.get('NETWORK_CONNECTION_FAILED');
      expect(errorCount).toBe(2);
    });

    it('should suppress duplicate errors within time window', async () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';
      const context = { userId: 'user123' };

      // Act
      await webrtcErrorHandler.handleError(error, context);
      await webrtcErrorHandler.handleError(error, context); // Should be suppressed

      // Assert
      expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    });

    it('should not suppress different error types', async () => {
      // Arrange
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';
      
      const context = { userId: 'user123' };

      // Act
      await webrtcErrorHandler.handleError(networkError, context);
      await webrtcErrorHandler.handleError(permissionError, context);

      // Assert
      expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery', () => {
    it('should attempt recovery for recoverable errors', async () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';
      const context = { userId: 'user123', callId: 'call456' };
      
      const recoveryCallback = vi.fn().mockResolvedValue(true);
      webrtcErrorHandler.setRecoveryCallback('NETWORK_CONNECTION_FAILED', recoveryCallback);

      // Act
      const recovered = await webrtcErrorHandler.attemptRecovery(error, context);

      // Assert
      expect(recovered).toBe(true);
      expect(recoveryCallback).toHaveBeenCalledWith(context);
    });

    it('should not attempt recovery for non-recoverable errors', async () => {
      // Arrange
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      const context = { userId: 'user123' };

      // Act
      const recovered = await webrtcErrorHandler.attemptRecovery(error, context);

      // Assert
      expect(recovered).toBe(false);
    });

    it('should handle recovery callback failure', async () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';
      const context = { userId: 'user123' };
      
      const recoveryCallback = vi.fn().mockRejectedValue(new Error('Recovery failed'));
      webrtcErrorHandler.setRecoveryCallback('NETWORK_CONNECTION_FAILED', recoveryCallback);

      // Act
      const recovered = await webrtcErrorHandler.attemptRecovery(error, context);

      // Assert
      expect(recovered).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Recovery attempt failed:',
        expect.any(Error)
      );
    });
  });

  describe('Error Statistics', () => {
    it('should return error statistics', async () => {
      // Arrange
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';

      // Act
      await webrtcErrorHandler.handleError(networkError, {});
      await webrtcErrorHandler.handleError(networkError, {});
      await webrtcErrorHandler.handleError(permissionError, {});

      const stats = webrtcErrorHandler.getErrorStatistics();

      // Assert
      expect(stats).toEqual({
        totalErrors: 3,
        errorsByType: {
          NETWORK_CONNECTION_FAILED: 2,
          MEDIA_PERMISSION_DENIED: 1,
        },
        mostCommonError: 'NETWORK_CONNECTION_FAILED',
        errorRate: expect.any(Number),
      });
    });

    it('should reset error statistics', async () => {
      // Arrange
      const error = new Error('Network error');
      error.name = 'NetworkError';
      await webrtcErrorHandler.handleError(error, {});

      // Act
      webrtcErrorHandler.resetStatistics();
      const stats = webrtcErrorHandler.getErrorStatistics();

      // Assert
      expect(stats.totalErrors).toBe(0);
      expect(Object.keys(stats.errorsByType)).toHaveLength(0);
    });
  });

  describe('User Guidance', () => {
    it('should provide troubleshooting steps for media errors', () => {
      // Arrange
      const errorType = 'MEDIA_PERMISSION_DENIED';

      // Act
      const guidance = webrtcErrorHandler.getTroubleshootingSteps(errorType);

      // Assert
      expect(guidance).toEqual([
        {
          step: 1,
          title: '检查浏览器权限',
          description: '确保已允许网站访问摄像头和麦克风',
          action: 'click_browser_settings'
        },
        {
          step: 2,
          title: '检查设备状态',
          description: '确保摄像头和麦克风未被其他应用占用',
          action: 'check_device_usage'
        },
        {
          step: 3,
          title: '重新授权',
          description: '刷新页面并重新授权设备访问',
          action: 'refresh_page'
        }
      ]);
    });

    it('should provide troubleshooting steps for network errors', () => {
      // Arrange
      const errorType = 'NETWORK_CONNECTION_FAILED';

      // Act
      const guidance = webrtcErrorHandler.getTroubleshootingSteps(errorType);

      // Assert
      expect(guidance).toContainEqual(
        expect.objectContaining({
          title: '检查网络连接',
          description: '确保网络连接稳定',
        })
      );
    });

    it('should return empty guidance for unknown error types', () => {
      // Arrange
      const errorType = 'UNKNOWN_ERROR_TYPE';

      // Act
      const guidance = webrtcErrorHandler.getTroubleshootingSteps(errorType);

      // Assert
      expect(guidance).toEqual([]);
    });
  });

  describe('Error Context Enhancement', () => {
    it('should enhance error context with browser info', () => {
      // Arrange
      const error = new Error('Test error');
      const context = { userId: 'user123' };

      // Mock navigator
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Chrome/91.0)',
        configurable: true
      });

      // Act
      const enhancedContext = webrtcErrorHandler.enhanceErrorContext(error, context);

      // Assert
      expect(enhancedContext).toEqual({
        ...context,
        timestamp: expect.any(String),
        userAgent: 'Mozilla/5.0 (Chrome/91.0)',
        url: expect.any(String),
        errorStack: error.stack,
      });
    });

    it('should enhance error context with WebRTC capabilities', async () => {
      // Arrange
      const error = new Error('Test error');
      const context = { userId: 'user123' };

      // Mock WebRTC capabilities
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            { kind: 'videoinput', label: 'Camera' },
            { kind: 'audioinput', label: 'Microphone' }
          ])
        },
        configurable: true
      });

      // Act
      const enhancedContext = await webrtcErrorHandler.enhanceErrorContextAsync(error, context);

      // Assert
      expect(enhancedContext).toEqual({
        ...context,
        timestamp: expect.any(String),
        userAgent: expect.any(String),
        url: expect.any(String),
        errorStack: error.stack,
        availableDevices: [
          { kind: 'videoinput', label: 'Camera' },
          { kind: 'audioinput', label: 'Microphone' }
        ],
        webrtcSupport: {
          getUserMedia: true,
          RTCPeerConnection: true,
          RTCDataChannel: true,
        }
      });
    });
  });

  describe('Error Reporting', () => {
    it('should generate error report', async () => {
      // Arrange
      const error = new Error('Test error');
      const context = { userId: 'user123', callId: 'call456' };

      // Act
      const report = await webrtcErrorHandler.generateErrorReport(error, context);

      // Assert
      expect(report).toEqual({
        errorId: expect.any(String),
        timestamp: expect.any(String),
        errorType: expect.any(String),
        severity: expect.any(String),
        userMessage: expect.any(String),
        technicalMessage: 'Test error',
        context: expect.objectContaining(context),
        browserInfo: expect.any(Object),
        systemInfo: expect.any(Object),
        suggestedActions: expect.any(Array),
      });
    });

    it('should export error logs', async () => {
      // Arrange
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      await webrtcErrorHandler.handleError(error1, { userId: 'user1' });
      await webrtcErrorHandler.handleError(error2, { userId: 'user2' });

      // Act
      const logs = webrtcErrorHandler.exportErrorLogs();

      // Assert
      expect(logs).toHaveLength(2);
      expect(logs[0]).toEqual(expect.objectContaining({
        timestamp: expect.any(String),
        errorType: expect.any(String),
        message: 'Error 1',
      }));
    });

    it('should clear error logs', async () => {
      // Arrange
      const error = new Error('Test error');
      await webrtcErrorHandler.handleError(error, {});

      // Act
      webrtcErrorHandler.clearErrorLogs();
      const logs = webrtcErrorHandler.exportErrorLogs();

      // Assert
      expect(logs).toHaveLength(0);
    });
  });

  describe('Integration with Other Services', () => {
    it('should notify call manager of critical errors', async () => {
      // Arrange
      const error = new Error('Critical error');
      error.name = 'InvalidStateError';
      const context = { callId: 'call123' };
      
      const callManagerCallback = vi.fn();
      webrtcErrorHandler.setCallManagerCallback(callManagerCallback);

      // Act
      await webrtcErrorHandler.handleError(error, context);

      // Assert
      expect(callManagerCallback).toHaveBeenCalledWith({
        callId: 'call123',
        errorType: 'PEER_CONNECTION_FAILED',
        severity: 'high',
      });
    });

    it('should notify analytics service of errors', async () => {
      // Arrange
      const error = new Error('Analytics error');
      const context = { userId: 'user123' };
      
      const analyticsCallback = vi.fn();
      webrtcErrorHandler.setAnalyticsCallback(analyticsCallback);

      // Act
      await webrtcErrorHandler.handleError(error, context);

      // Assert
      expect(analyticsCallback).toHaveBeenCalledWith({
        event: 'webrtc_error',
        errorType: expect.any(String),
        userId: 'user123',
        timestamp: expect.any(String),
      });
    });
  });
});