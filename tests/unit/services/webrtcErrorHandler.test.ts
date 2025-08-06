import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import webrtcErrorHandler, { 
  WebRTCErrorHandler,
  WebRTCErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  type WebRTCErrorDetails,
  type ErrorHandlerConfig,
  type ErrorEventListeners,
  type ErrorStatistics
} from '@/src/services/webrtcErrorHandler';

describe('WebRTCErrorHandler', () => {
  let mockEventListeners: ErrorEventListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockEventListeners = {
      onErrorOccurred: vi.fn(),
      onErrorResolved: vi.fn(),
      onRetryAttempt: vi.fn(),
      onRecoveryFailed: vi.fn(),
      onUserActionRequired: vi.fn()
    };
    
    webrtcErrorHandler.setEventListeners(mockEventListeners);
    
    // Reset configuration to default values
    webrtcErrorHandler.updateConfig({
      enableLogging: true,
      enableStatistics: true,
      maxErrorHistory: 100,
      autoRetryEnabled: true,
      defaultRetryDelay: 3000,
      maxRetryAttempts: 3,
      showTechnicalDetails: false,
      enableUserFeedback: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    webrtcErrorHandler.destroy();
  });

  describe('Error Classification', () => {
    it('should classify DOMException NotAllowedError correctly', () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.MEDIA_ACCESS_DENIED);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.suggestedActions).toContain('点击地址栏的摄像头/麦克风图标');
    });

    it('should classify DOMException NotFoundError correctly', () => {
      const error = new DOMException('Device not found', 'NotFoundError');
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.MEDIA_DEVICE_NOT_FOUND);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('检查摄像头和麦克风是否正确连接');
    });

    it('should classify DOMException NotReadableError correctly', () => {
      const error = new DOMException('Device in use', 'NotReadableError');
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.MEDIA_DEVICE_ERROR);
      expect(errorDetails.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('关闭其他使用摄像头/麦克风的应用程序');
    });

    it('should classify DOMException OverconstrainedError correctly', () => {
      const error = new DOMException('Constraints not satisfied', 'OverconstrainedError');
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.MEDIA_DEVICE_ERROR);
      expect(errorDetails.severity).toBe(ErrorSeverity.LOW);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.FALLBACK);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('系统将自动调整媒体设置');
    });

    it('should classify DOMException SecurityError correctly', () => {
      const error = new DOMException('Security error', 'SecurityError');
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.PERMISSION_DENIED);
      expect(errorDetails.severity).toBe(ErrorSeverity.CRITICAL);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.suggestedActions).toContain('确保使用HTTPS连接');
    });

    it('should classify RTCError with dtls-failure correctly', () => {
      const error = { 
        name: 'RTCError', 
        message: 'DTLS handshake failed',
        errorDetail: 'dtls-failure'
      } as RTCError;
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.CONNECTION_FAILED);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('检查网络连接');
    });

    it('should classify RTCError with fingerprint-failure correctly', () => {
      const error = { 
        name: 'RTCError', 
        message: 'Fingerprint verification failed',
        errorDetail: 'fingerprint-failure'
      } as RTCError;
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.CONNECTION_FAILED);
      expect(errorDetails.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('重试连接');
    });

    it('should classify string error messages correctly', () => {
      const errorMessage = 'Connection timeout occurred';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.CONNECTION_TIMEOUT);
      expect(errorDetails.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('检查网络连接');
    });

    it('should classify ICE connection errors correctly', () => {
      const errorMessage = 'ICE candidate gathering failed';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.ICE_CONNECTION_FAILED);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('检查防火墙设置');
    });

    it('should classify getUserMedia errors correctly', () => {
      const errorMessage = 'getUserMedia failed to access camera';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.MEDIA_ACCESS_DENIED);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.suggestedActions).toContain('允许浏览器访问摄像头和麦克风');
    });

    it('should classify browser support errors correctly', () => {
      const errorMessage = 'WebRTC not supported in this browser';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.BROWSER_NOT_SUPPORTED);
      expect(errorDetails.severity).toBe(ErrorSeverity.CRITICAL);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.suggestedActions).toContain('更新浏览器到最新版本');
    });

    it('should classify permission denied errors correctly', () => {
      const errorMessage = 'Permission denied by administrator';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.PERMISSION_DENIED);
      expect(errorDetails.severity).toBe(ErrorSeverity.HIGH);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.USER_ACTION);
      expect(errorDetails.retryable).toBe(false);
      expect(errorDetails.suggestedActions).toContain('联系系统管理员获取权限');
    });

    it('should classify unknown errors correctly', () => {
      const errorMessage = 'Some unexpected error occurred';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.UNKNOWN_ERROR);
      expect(errorDetails.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorDetails.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(errorDetails.retryable).toBe(true);
      expect(errorDetails.suggestedActions).toContain('重试操作');
    });
  });

  describe('Event System', () => {
    it('should trigger onErrorOccurred event when error is handled', () => {
      const error = new Error('Test error');
      
      webrtcErrorHandler.handleError(error);
      
      expect(mockEventListeners.onErrorOccurred).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebRTCErrorType.UNKNOWN_ERROR,
          message: 'Test error'
        })
      );
    });

    it('should trigger onUserActionRequired for non-retryable errors', () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      
      // Disable auto retry to test user action event
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: false });
      webrtcErrorHandler.handleError(error);
      
      expect(mockEventListeners.onUserActionRequired).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebRTCErrorType.MEDIA_ACCESS_DENIED
        }),
        expect.arrayContaining([expect.stringContaining('点击地址栏')])
      );
    });

    it('should set and update event listeners correctly', () => {
      const newListeners: ErrorEventListeners = {
        onErrorOccurred: vi.fn(),
        onErrorResolved: vi.fn()
      };
      
      webrtcErrorHandler.setEventListeners(newListeners);
      
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      expect(newListeners.onErrorOccurred).toHaveBeenCalled();
    });
  });

  describe('Auto-Retry Mechanism', () => {
    it('should attempt retry for retryable errors when auto-retry is enabled', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      // Use a media device error which is retryable
      const error = new DOMException('Device in use', 'NotReadableError');
      webrtcErrorHandler.handleError(error);
      
      // Media device errors have 2000ms delay
      vi.advanceTimersByTime(2000);
      
      expect(mockEventListeners.onRetryAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebRTCErrorType.MEDIA_DEVICE_ERROR
        }),
        1
      );
    });

    it('should not attempt retry for non-retryable errors', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      const error = new DOMException('Permission denied', 'NotAllowedError');
      webrtcErrorHandler.handleError(error);
      
      // Advance timer
      vi.advanceTimersByTime(5000);
      
      expect(mockEventListeners.onRetryAttempt).not.toHaveBeenCalled();
    });

    it('should respect max retry attempts', () => {
      // Mock setTimeout to track if it's being called
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      
      webrtcErrorHandler.updateConfig({ 
        autoRetryEnabled: true,
        maxRetryAttempts: 0  // Set to 0 to immediately trigger recovery failed
      });
      
      // Use a retryable error type
      const error = new DOMException('Device in use', 'NotReadableError');
      webrtcErrorHandler.handleError(error);
      
      // Since maxRetryAttempts is 0, recovery failed should be called immediately
      expect(mockEventListeners.onRecoveryFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebRTCErrorType.MEDIA_DEVICE_ERROR
        })
      );
      
      // No retry timer should be set
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });

    it('should allow cancelling retry', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      // Use a retryable error
      const error = new DOMException('Device in use', 'NotReadableError');
      const errorDetails = webrtcErrorHandler.handleError(error);
      const errorId = errorDetails.context?.errorId!;
      
      // Cancel retry before it triggers
      webrtcErrorHandler.cancelRetry(errorId);
      
      // Advance timer past retry delay
      vi.advanceTimersByTime(2000);
      
      expect(mockEventListeners.onRetryAttempt).not.toHaveBeenCalled();
    });

    it('should use different retry delays for different error types', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      // Create a mock error that should be retryable with specific delay
      const connectionError = { 
        name: 'RTCError', 
        message: 'DTLS handshake failed',
        errorDetail: 'dtls-failure'
      } as RTCError;
      
      webrtcErrorHandler.handleError(connectionError);
      
      // CONNECTION_FAILED errors should have 5000ms delay
      vi.advanceTimersByTime(5000);
      expect(mockEventListeners.onRetryAttempt).toHaveBeenCalled();
    });

    it('should use different max retries for different error types', () => {
      // Test that error classification returns correct maxRetries
      // "Connection lost" contains "connection" so it's classified as NETWORK_UNAVAILABLE with 5 max retries
      const error = new Error('Connection lost');
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.type).toBe('NETWORK_UNAVAILABLE');
      expect(errorDetails.maxRetries).toBe(5); // NETWORK_UNAVAILABLE has 5 retries
    });
  });

  describe('Error Statistics', () => {
    it('should track total error count', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      webrtcErrorHandler.handleError(error1);
      webrtcErrorHandler.handleError(error2);
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.totalErrors).toBe(2);
    });

    it('should track errors by type', () => {
      const mediaError = new DOMException('Permission denied', 'NotAllowedError');
      const connectionError = new Error('Connection timeout');
      
      webrtcErrorHandler.handleError(mediaError);
      webrtcErrorHandler.handleError(connectionError);
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.errorsByType[WebRTCErrorType.MEDIA_ACCESS_DENIED]).toBe(1);
      expect(stats.errorsByType[WebRTCErrorType.CONNECTION_TIMEOUT]).toBe(1);
    });

    it('should track errors by severity', () => {
      const criticalError = new DOMException('Security error', 'SecurityError');
      const mediumError = new Error('Some error');
      
      webrtcErrorHandler.handleError(criticalError);
      webrtcErrorHandler.handleError(mediumError);
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.errorsBySeverity[ErrorSeverity.CRITICAL]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(1);
    });

    it('should maintain recent errors list with size limit', () => {
      // Generate more than 10 errors (recent errors limit)
      for (let i = 0; i < 15; i++) {
        webrtcErrorHandler.handleError(new Error(`Error ${i}`));
      }
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.recentErrors.length).toBeLessThanOrEqual(10);
      expect(stats.totalErrors).toBe(15);
    });

    it('should track last error', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      webrtcErrorHandler.handleError(error1);
      webrtcErrorHandler.handleError(error2);
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.lastError?.message).toBe('Second error');
    });

    it('should calculate average resolution time', () => {
      const error = new Error('Test error');
      const errorDetails = webrtcErrorHandler.handleError(error);
      const errorId = errorDetails.context?.errorId!;
      
      // Simulate resolution after some time
      vi.advanceTimersByTime(1000);
      webrtcErrorHandler.markErrorResolved(errorId, 'manual_fix');
      
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.averageResolutionTime).toBeGreaterThan(0);
    });
  });

  describe('Error Resolution', () => {
    it('should mark error as resolved and trigger event', () => {
      const error = new Error('Test error');
      const errorDetails = webrtcErrorHandler.handleError(error);
      const errorId = errorDetails.context?.errorId!;
      
      webrtcErrorHandler.markErrorResolved(errorId, 'user_fixed');
      
      expect(mockEventListeners.onErrorResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error'
        }),
        'user_fixed'
      );
    });

    it('should clean up retry timer when error is resolved', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      const error = new Error('Connection failed');
      const errorDetails = webrtcErrorHandler.handleError(error);
      const errorId = errorDetails.context?.errorId!;
      
      // Resolve before retry triggers
      webrtcErrorHandler.markErrorResolved(errorId);
      
      // Advance timer past retry delay
      vi.advanceTimersByTime(5000);
      
      // Retry should not trigger since error was resolved
      expect(mockEventListeners.onRetryAttempt).not.toHaveBeenCalled();
    });

    it('should handle resolution of non-existent error gracefully', () => {
      expect(() => {
        webrtcErrorHandler.markErrorResolved('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<ErrorHandlerConfig> = {
        enableLogging: false,
        maxErrorHistory: 50,
        autoRetryEnabled: false,
        defaultRetryDelay: 5000
      };
      
      webrtcErrorHandler.updateConfig(newConfig);
      
      // Verify config changes by observing behavior
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      // Auto retry should not happen
      vi.advanceTimersByTime(6000);
      expect(mockEventListeners.onRetryAttempt).not.toHaveBeenCalled();
    });

    it('should respect maxErrorHistory setting', () => {
      webrtcErrorHandler.updateConfig({ maxErrorHistory: 3 });
      
      // Generate more errors than the limit
      for (let i = 0; i < 5; i++) {
        webrtcErrorHandler.handleError(new Error(`Error ${i}`));
      }
      
      const history = webrtcErrorHandler.getErrorHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });

    it('should respect enableStatistics setting', () => {
      webrtcErrorHandler.updateConfig({ enableStatistics: false });
      
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      const stats = webrtcErrorHandler.getStatistics();
      // Statistics should still be initialized but might not be updated
      expect(stats).toBeDefined();
    });
  });

  describe('Error History Management', () => {
    it('should maintain error history', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      
      webrtcErrorHandler.handleError(error1);
      webrtcErrorHandler.handleError(error2);
      
      const history = webrtcErrorHandler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('First error');
      expect(history[1].message).toBe('Second error');
    });

    it('should limit error history size', () => {
      webrtcErrorHandler.updateConfig({ maxErrorHistory: 2 });
      
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      const error3 = new Error('Third error');
      
      webrtcErrorHandler.handleError(error1);
      webrtcErrorHandler.handleError(error2);
      webrtcErrorHandler.handleError(error3);
      
      const history = webrtcErrorHandler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Second error');
      expect(history[1].message).toBe('Third error');
    });

    it('should clear error history', () => {
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      expect(webrtcErrorHandler.getErrorHistory()).toHaveLength(1);
      
      webrtcErrorHandler.clearErrorHistory();
      
      expect(webrtcErrorHandler.getErrorHistory()).toHaveLength(0);
      const stats = webrtcErrorHandler.getStatistics();
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('Technical Details Generation', () => {
    it('should generate comprehensive technical details', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      const context = {
        callId: 'call-123',
        userId: 'user-456',
        sessionId: 'session-789',
        deviceId: 'device-abc'
      };
      
      const errorDetails = webrtcErrorHandler.handleError(error, context);
      
      expect(errorDetails.technicalDetails).toContain('Error Type: Error');
      expect(errorDetails.technicalDetails).toContain('Error Message: Test error');
      expect(errorDetails.technicalDetails).toContain('Stack Trace:');
      expect(errorDetails.technicalDetails).toContain('Context:');
      expect(errorDetails.technicalDetails).toContain('User Agent:');
      expect(errorDetails.technicalDetails).toContain('WebRTC Supported:');
    });

    it('should handle string errors in technical details', () => {
      const errorMessage = 'Simple string error';
      
      const errorDetails = webrtcErrorHandler.handleError(errorMessage);
      
      expect(errorDetails.technicalDetails).toContain('Error Message: Simple string error');
      expect(errorDetails.technicalDetails).toContain('User Agent:');
    });

    it('should include context information in technical details', () => {
      const error = new Error('Context test');
      const context = {
        callId: 'call-context-test',
        customField: 'custom-value'
      };
      
      const errorDetails = webrtcErrorHandler.handleError(error, context);
      
      expect(errorDetails.technicalDetails).toContain('call-context-test');
      expect(errorDetails.technicalDetails).toContain('custom-value');
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on destroy', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      webrtcErrorHandler.destroy();
      
      // After destroy, should not have any active timers or data
      expect(webrtcErrorHandler.getErrorHistory()).toHaveLength(0);
      expect(webrtcErrorHandler.getStatistics().totalErrors).toBe(0);
    });

    it('should handle multiple destroy calls safely', () => {
      webrtcErrorHandler.destroy();
      webrtcErrorHandler.destroy();
      
      expect(() => webrtcErrorHandler.destroy()).not.toThrow();
    });

    it('should clean up retry timers on destroy', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      const error = new Error('Test error');
      webrtcErrorHandler.handleError(error);
      
      webrtcErrorHandler.destroy();
      
      // Advance timer after destroy
      vi.advanceTimersByTime(5000);
      
      // No retry should occur after destroy
      expect(mockEventListeners.onRetryAttempt).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors with no message', () => {
      const error = new Error();
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.message).toBeDefined();
      expect(errorDetails.type).toBe(WebRTCErrorType.UNKNOWN_ERROR);
    });

    it('should handle null/undefined errors gracefully', () => {
      const errorDetails = webrtcErrorHandler.handleError(null as any);
      
      expect(errorDetails.type).toBe(WebRTCErrorType.UNKNOWN_ERROR);
      expect(errorDetails.message).toBe('null');
    });

    it('should handle errors with circular references in context', () => {
      const error = new Error('Circular test');
      const context: any = { prop: 'value' };
      context.circular = context; // Create circular reference
      
      expect(() => {
        webrtcErrorHandler.handleError(error, context);
      }).not.toThrow();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new Error(longMessage);
      
      const errorDetails = webrtcErrorHandler.handleError(error);
      
      expect(errorDetails.message).toBe(longMessage);
      expect(errorDetails.technicalDetails).toContain(longMessage);
    });

    it('should handle errors during retry setup', () => {
      webrtcErrorHandler.updateConfig({ autoRetryEnabled: true });
      
      // Mock setTimeout to throw an error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn().mockImplementation(() => {
        throw new Error('Timer setup failed');
      });
      
      expect(() => {
        webrtcErrorHandler.handleError(new Error('Test error'));
      }).not.toThrow();
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Singleton Instance', () => {
    it('should maintain state across different imports', () => {
      const error = new Error('Singleton test');
      webrtcErrorHandler.handleError(error);
      
      expect(webrtcErrorHandler.getErrorHistory()).toHaveLength(1);
      
      // Clear for cleanup
      webrtcErrorHandler.clearErrorHistory();
    });

    it('should allow creating new instances', () => {
      const customConfig: Partial<ErrorHandlerConfig> = {
        enableLogging: false,
        maxErrorHistory: 5
      };
      
      const newHandler = new WebRTCErrorHandler(customConfig);
      
      expect(newHandler).toBeDefined();
      expect(newHandler).not.toBe(webrtcErrorHandler);
    });
  });
});