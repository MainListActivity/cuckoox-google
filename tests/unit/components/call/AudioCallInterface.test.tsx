import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils/testUtils';
import AudioCallInterface from '@/src/components/call/AudioCallInterface';
import callManager, { CallSession, CallState, MediaState } from '@/src/services/callManager';

// Mock AuthContext to provide required context for useWebRTCPermissions
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    selectedCaseId: 'case:test',
    user: { id: 'user:test', name: 'Test User', github_id: 'test' },
    isLoggedIn: true,
    hasRole: vi.fn(() => true),
    useOperationPermission: vi.fn(() => ({
      hasPermission: true,
      isLoading: false,
      error: null,
    })),
    useOperationPermissions: vi.fn(() => ({
      permissions: {},
      isLoading: false,
      error: null,
    })),
    preloadOperationPermission: vi.fn(),
    preloadOperationPermissions: vi.fn(),
  }),
}));

// Mock useWebRTCPermissions directly to avoid dependency issues
vi.mock('@/src/hooks/useWebRTCPermissions', () => ({
  useWebRTCPermissions: () => ({
    permissions: {
      canToggleMicrophone: () => ({ hasPermission: true, isLoading: false, error: null }),
      canToggleSpeaker: () => ({ hasPermission: true, isLoading: false, error: null }),
      canToggleCamera: () => ({ hasPermission: true, isLoading: false, error: null }),
      canShareScreen: () => ({ hasPermission: true, isLoading: false, error: null }),
      canEndCall: () => ({ hasPermission: true, isLoading: false, error: null }),
    },
    preloadPermissionGroup: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock theme breakpoints
vi.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: vi.fn(() => false),
}));

// Mock useResponsiveLayout
vi.mock('@/src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenSize: 'desktop',
  }),
}));

// Mock callManager
vi.mock('@/src/services/callManager', () => ({
  default: {
    getCallSession: vi.fn(),
    toggleMute: vi.fn(),
    toggleSpeaker: vi.fn(),
    endCall: vi.fn(),
    setEventListeners: vi.fn(),
    startScreenShare: vi.fn(),
    stopScreenShare: vi.fn(),
    toggleCamera: vi.fn(),
  },
}));

const mockCallManager = callManager as {
  getCallSession: Mock;
  toggleMute: Mock;
  toggleSpeaker: Mock;
  endCall: Mock;
  setEventListeners: Mock;
  startScreenShare: Mock;
  stopScreenShare: Mock;
  toggleCamera: Mock;
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
  });

  describe('Component Rendering', () => {
    it('should render audio call interface correctly', () => {
      // Act
      render(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('通话中')).toBeInTheDocument();
      expect(screen.getByText('Local User')).toBeInTheDocument();
      expect(screen.getByLabelText('静音')).toBeInTheDocument();
    });

    it('should display correct call state', () => {
      // Arrange
      const connectingCallSession = createMockCallSession({ state: 'connecting' });
      mockCallManager.getCallSession.mockReturnValue(connectingCallSession);

      // Act
      render(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('连接中')).toBeInTheDocument();
    });

    it('should handle call session not found', () => {
      // Arrange
      mockCallManager.getCallSession.mockReturnValue(null);

      // Act
      render(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('正在加载通话信息...')).toBeInTheDocument();
    });
  });

  describe('Media Controls', () => {
    it('should toggle microphone when mic button is clicked', () => {
      // Arrange
      mockCallManager.toggleMute.mockReturnValue(true);
      
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const micButton = screen.getByLabelText('静音');
      fireEvent.click(micButton);

      // Assert
      expect(mockCallManager.toggleMute).toHaveBeenCalledWith('call_123');
    });

    it('should toggle speaker when speaker button is clicked', () => {
      // Arrange
      mockCallManager.toggleSpeaker.mockReturnValue(true);
      
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const speakerButton = screen.getByLabelText('开启扬声器');
      fireEvent.click(speakerButton);

      // Assert
      expect(mockCallManager.toggleSpeaker).toHaveBeenCalledWith('call_123');
    });

    it('should show correct microphone state', () => {
      // Arrange
      const mutedCallSession = createMockCallSession();
      mutedCallSession.localParticipant.mediaState.micMuted = true;
      mockCallManager.getCallSession.mockReturnValue(mutedCallSession);

      // Act
      render(<AudioCallInterface {...defaultProps} />);

      // Assert
      expect(screen.getByText('已静音')).toBeInTheDocument();
    });
  });

  describe('Call Actions', () => {
    it('should show confirmation dialog for ending call', () => {
      // Arrange
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      fireEvent.click(hangupButton);

      // Assert
      expect(screen.getByText('确认结束通话')).toBeInTheDocument();
      expect(screen.getByText('确定要结束当前通话吗？')).toBeInTheDocument();
    });

    it('should cancel call end when dialog is cancelled', async () => {
      // Arrange
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const hangupButton = screen.getByLabelText('结束通话');
      fireEvent.click(hangupButton);
      
      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      // Assert
      expect(mockCallManager.endCall).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText('确认结束通话')).not.toBeInTheDocument();
      });
    });
  });

  describe('Screen Sharing', () => {
    it('should start screen sharing when screen share button is clicked', () => {
      // Arrange
      mockCallManager.startScreenShare.mockResolvedValue(undefined);
      
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const screenShareButton = screen.getByLabelText('开始屏幕共享');
      fireEvent.click(screenShareButton);

      // Assert
      expect(mockCallManager.startScreenShare).toHaveBeenCalledWith('call_123');
    });

    it('should stop screen sharing when already sharing', () => {
      // Arrange
      const screenSharingSession = createMockCallSession();
      screenSharingSession.localParticipant.mediaState.screenSharing = true;
      mockCallManager.getCallSession.mockReturnValue(screenSharingSession);
      mockCallManager.stopScreenShare.mockResolvedValue(undefined);
      
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const screenShareButton = screen.getByLabelText('停止屏幕共享');
      fireEvent.click(screenShareButton);

      // Assert
      expect(mockCallManager.stopScreenShare).toHaveBeenCalledWith('call_123');
    });
  });

  describe('Error Handling', () => {
    it('should handle microphone toggle errors', async () => {
      // Arrange
      const error = new Error('Microphone access denied');
      mockCallManager.toggleMute.mockImplementation(() => {
        throw error;
      });
      
      render(<AudioCallInterface {...defaultProps} />);

      // Act
      const micButton = screen.getByLabelText('静音');
      fireEvent.click(micButton);

      // Assert
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Connection Quality', () => {
    it('should display participant connection state', () => {
      // Arrange
      render(<AudioCallInterface {...defaultProps} />);

      // Assert - 检查参与者连接状态显示
      expect(screen.getByText('已连接')).toBeInTheDocument();
    });
  });
});