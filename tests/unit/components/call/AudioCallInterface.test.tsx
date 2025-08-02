import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AudioCallInterface from '@/src/components/call/AudioCallInterface';
import callManager, { CallSession, CallState, MediaState } from '@/src/services/callManager';

// Mock callManager
vi.mock('@/src/services/callManager', () => ({
  default: {
    getCallSession: vi.fn(),
    toggleMicrophone: vi.fn(),
    toggleSpeaker: vi.fn(),
    endCall: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    switchToVideoCall: vi.fn(),
  },
}));

const mockCallManager = callManager as {
  getCallSession: Mock;
  toggleMicrophone: Mock;
  toggleSpeaker: Mock;
  endCall: Mock;
  addEventListener: Mock;
  removeEventListener: Mock;
  startScreenShare: Mock;
  stopScreenShare: Mock;
  switchToVideoCall: Mock;
};

// Mock HTMLAudioElement
const mockAudioElement = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  srcObject: null,
  volume: 1,
  muted: false,
};

vi.stubGlobal('HTMLAudioElement', vi.fn(() => mockAudioElement));

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Helper to create mock call session
const createMockCallSession = (overrides: Partial<CallSession> = {}): CallSession => ({
  callId: 'call_123',
  callType: 'audio',
  direction: 'outgoing',
  state: 'connected',
  participants: new Map(),
  localParticipant: {
    userId: 'user123',
    userName: 'Local User',
    isLocal: true,
    mediaState: {
      audioEnabled: true,
      videoEnabled: false,
      speakerEnabled: false,
      micMuted: false,
      cameraOff: true,
      screenSharing: false,
    },
    connectionState: 'connected',
    joinedAt: Date.now() - 60000, // 1 minute ago
  },
  startTime: Date.now() - 60000, // 1 minute ago
  duration: 60000,
  isGroup: false,
  ...overrides,
});

// Helper to render component with theme
const renderWithTheme = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('AudioCallInterface', () => {
  const defaultProps = {
    callId: 'call_123',
    onCallEnd: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default call session
    mockCallManager.getCallSession.mockReturnValue(createMockCallSession());
    
    // Mock timers for call duration updates
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render audio call interface correctly', () => {
      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('通话中')).toBeInTheDocument();
      expect(screen.getByText('Local User')).toBeInTheDocument();
      expect(screen.getByLabelText('静音')).toBeInTheDocument();
      expect(screen.getByLabelText('扬声器')).toBeInTheDocument();
      expect(screen.getByLabelText('结束通话')).toBeInTheDocument();
    });

    it('should display correct call state', () => {
      // Arrange
      const connectingCallSession = createMockCallSession({ state: 'connecting' });
      mockCallManager.getCallSession.mockReturnValue(connectingCallSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('连接中')).toBeInTheDocument();
    });

    it('should display call duration', () => {
      // Arrange
      const callSession = createMockCallSession({
        startTime: Date.now() - 65000, // 1 minute 5 seconds ago
        duration: 65000,
      });
      mockCallManager.getCallSession.mockReturnValue(callSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('01:05')).toBeInTheDocument();
    });

    it('should show incoming call state for incoming calls', () => {
      // Arrange
      const incomingCallSession = createMockCallSession({
        direction: 'incoming',
        state: 'ringing',
      });
      mockCallManager.getCallSession.mockReturnValue(incomingCallSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('响铃中')).toBeInTheDocument();
    });
  });

  describe('Media Controls', () => {
    it('should toggle microphone when mic button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockCallManager.toggleMicrophone.mockResolvedValue(true); // unmuted
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const micButton = screen.getByLabelText('静音');
      await user.click(micButton);

      // Assert
      expect(mockCallManager.toggleMicrophone).toHaveBeenCalledWith('call_123');
    });

    it('should toggle speaker when speaker button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockCallManager.toggleSpeaker.mockResolvedValue(true);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const speakerButton = screen.getByLabelText('扬声器');
      await user.click(speakerButton);

      // Assert
      expect(mockCallManager.toggleSpeaker).toHaveBeenCalledWith('call_123');
    });

    it('should show correct microphone state', () => {
      // Arrange
      const mutedCallSession = createMockCallSession();
      mutedCallSession.localParticipant.mediaState.micMuted = true;
      mockCallManager.getCallSession.mockReturnValue(mutedCallSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      const micButton = screen.getByLabelText('取消静音');
      expect(micButton).toBeInTheDocument();
    });

    it('should show correct speaker state', () => {
      // Arrange
      const speakerOnCallSession = createMockCallSession();
      speakerOnCallSession.localParticipant.mediaState.speakerEnabled = true;
      mockCallManager.getCallSession.mockReturnValue(speakerOnCallSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      const speakerButton = screen.getByLabelText('关闭扬声器');
      expect(speakerButton).toBeInTheDocument();
    });
  });

  describe('Call Actions', () => {
    it('should end call when hang up button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockCallManager.endCall.mockResolvedValue(undefined);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      await user.click(hangupButton);

      // Assert
      expect(mockCallManager.endCall).toHaveBeenCalledWith('call_123');
      expect(defaultProps.onCallEnd).toHaveBeenCalled();
    });

    it('should show confirmation dialog for ending call', async () => {
      // Arrange
      const user = userEvent.setup();
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      await user.click(hangupButton);

      // Assert
      expect(screen.getByText('确认结束通话')).toBeInTheDocument();
      expect(screen.getByText('确定要结束当前通话吗？')).toBeInTheDocument();
    });

    it('should cancel call end when dialog is cancelled', async () => {
      // Arrange
      const user = userEvent.setup();
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      await user.click(hangupButton);
      
      const cancelButton = screen.getByText('取消');
      await user.click(cancelButton);

      // Assert
      expect(mockCallManager.endCall).not.toHaveBeenCalled();
      expect(screen.queryByText('确认结束通话')).not.toBeInTheDocument();
    });

    it('should switch to video call when video button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockCallManager.switchToVideoCall.mockResolvedValue(undefined);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const videoButton = screen.getByLabelText('开启视频');
      await user.click(videoButton);

      // Assert
      expect(mockCallManager.switchToVideoCall).toHaveBeenCalledWith('call_123');
    });
  });

  describe('Screen Sharing', () => {
    it('should start screen sharing when screen share button is clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      mockCallManager.startScreenShare.mockResolvedValue(undefined);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const screenShareButton = screen.getByLabelText('开始屏幕共享');
      await user.click(screenShareButton);

      // Assert
      expect(mockCallManager.startScreenShare).toHaveBeenCalledWith('call_123');
    });

    it('should stop screen sharing when already sharing', async () => {
      // Arrange
      const user = userEvent.setup();
      const screenSharingSession = createMockCallSession();
      screenSharingSession.localParticipant.mediaState.screenSharing = true;
      mockCallManager.getCallSession.mockReturnValue(screenSharingSession);
      mockCallManager.stopScreenShare.mockResolvedValue(undefined);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const screenShareButton = screen.getByLabelText('停止屏幕共享');
      await user.click(screenShareButton);

      // Assert
      expect(mockCallManager.stopScreenShare).toHaveBeenCalledWith('call_123');
    });
  });

  describe('Error Handling', () => {
    it('should handle microphone toggle errors', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new Error('Microphone access denied');
      mockCallManager.toggleMicrophone.mockRejectedValue(error);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const micButton = screen.getByLabelText('静音');
      await user.click(micButton);

      // Assert
      expect(defaultProps.onError).toHaveBeenCalledWith(error);
    });

    it('should handle call end errors', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new Error('Failed to end call');
      mockCallManager.endCall.mockRejectedValue(error);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      await user.click(hangupButton);
      
      const confirmButton = screen.getByText('确定');
      await user.click(confirmButton);

      // Assert
      expect(defaultProps.onError).toHaveBeenCalledWith(error);
    });

    it('should handle screen sharing errors', async () => {
      // Arrange
      const user = userEvent.setup();
      const error = new Error('Screen sharing not supported');
      mockCallManager.startScreenShare.mockRejectedValue(error);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const screenShareButton = screen.getByLabelText('开始屏幕共享');
      await user.click(screenShareButton);

      // Assert
      expect(defaultProps.onError).toHaveBeenCalledWith(error);
    });
  });

  describe('Call State Updates', () => {
    it('should update duration automatically', async () => {
      // Arrange
      const callSession = createMockCallSession({
        startTime: Date.now() - 60000, // 1 minute ago
        state: 'connected',
      });
      mockCallManager.getCallSession.mockReturnValue(callSession);
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);
      
      // Initial duration
      expect(screen.getByText('01:00')).toBeInTheDocument();

      // Act - Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('01:01')).toBeInTheDocument();
      });
    });

    it('should handle call session not found', () => {
      // Arrange
      mockCallManager.getCallSession.mockReturnValue(null);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('通话不存在')).toBeInTheDocument();
    });

    it('should update UI when call state changes', () => {
      // Arrange
      const initialCallSession = createMockCallSession({ state: 'connecting' });
      mockCallManager.getCallSession.mockReturnValue(initialCallSession);
      
      const { rerender } = renderWithTheme(<AudioCallInterface {...defaultProps} />);
      expect(screen.getByText('连接中')).toBeInTheDocument();

      // Act - Update call state
      const connectedCallSession = createMockCallSession({ state: 'connected' });
      mockCallManager.getCallSession.mockReturnValue(connectedCallSession);
      
      rerender(
        <ThemeProvider theme={createTheme()}>
          <AudioCallInterface {...defaultProps} />
        </ThemeProvider>
      );

      // Assert
      expect(screen.getByText('通话中')).toBeInTheDocument();
    });
  });

  describe('Audio Element Management', () => {
    it('should create audio elements for local and remote streams', () => {
      // Arrange
      const callSession = createMockCallSession();
      // Mock stream objects
      const localStream = { id: 'local-stream' };
      const remoteStream = { id: 'remote-stream' };
      
      callSession.localParticipant.stream = localStream as MediaStream;
      // Add remote participant with stream
      callSession.participants.set('user456', {
        userId: 'user456',
        userName: 'Remote User',
        isLocal: false,
        mediaState: {
          audioEnabled: true,
          videoEnabled: false,
          speakerEnabled: false,
          micMuted: false,
          cameraOff: true,
          screenSharing: false,
        },
        connectionState: 'connected',
        joinedAt: Date.now(),
        stream: remoteStream as MediaStream,
      });
      
      mockCallManager.getCallSession.mockReturnValue(callSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(HTMLAudioElement).toHaveBeenCalledTimes(2); // local + remote
    });

    it('should handle audio play errors gracefully', async () => {
      // Arrange
      mockAudioElement.play.mockRejectedValue(new Error('Play failed'));
      
      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert - Should not crash the component
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('音频播放失败'),
        expect.any(Error)
      );
    });
  });

  describe('Connection Quality', () => {
    it('should display connection quality indicator', () => {
      // Arrange
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('连接质量: 未知')).toBeInTheDocument();
    });

    it('should update connection quality based on call session', () => {
      // Arrange
      const callSession = createMockCallSession();
      // Mock connection quality in call session
      (callSession as any).connectionQuality = 'good';
      mockCallManager.getCallSession.mockReturnValue(callSession);

      // Act
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('连接质量: 良好')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator during call operations', async () => {
      // Arrange
      const user = userEvent.setup();
      
      // Mock slow operation
      mockCallManager.toggleMicrophone.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );
      
      renderWithTheme(<AudioCallInterface {...defaultProps} />);

      // Act
      const micButton = screen.getByLabelText('静音');
      const clickPromise = user.click(micButton);

      // Assert - Loading state should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Wait for operation to complete
      await clickPromise;
      
      // Loading should be gone
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
