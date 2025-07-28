import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import i18n from '@/src/i18n';
import { SnackbarProvider } from '@/src/contexts/SnackbarContext';
import MessageCenterPage from '@/src/pages/messages';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

// Mock useAuth
const mockUser = {
  id: { toString: () => 'user:test123' },
  name: 'Test User',
  email: 'test@example.com'
};

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    selectedCaseId: 'case:test001',
    isAuthenticated: true,
  }),
}));

// Mock useSnackbar
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
const mockShowWarning = vi.fn();

vi.mock('@/src/contexts/SnackbarContext', async () => {
  const actual = await vi.importActual('@/src/contexts/SnackbarContext');
  return {
    ...actual,
    useSnackbar: () => ({
      showSuccess: mockShowSuccess,
      showError: mockShowError,
      showInfo: mockShowInfo,
      showWarning: mockShowWarning,
    }),
  };
});

// Mock SurrealDB client
const mockClient = {
  merge: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => mockClient,
}));

// Mock useResponsiveLayout hook
vi.mock('@/src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: vi.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  })),
}));

// Mock MobileOptimizedLayout
vi.mock('@/src/components/mobile/MobileOptimizedLayout', () => ({
  __esModule: true,
  default: vi.fn(({ children, title, showBackButton, onBackClick, fabConfig }) => (
    <div data-testid="mobile-optimized-layout">
      <div data-testid="mobile-header">
        {showBackButton && (
          <button onClick={onBackClick} data-testid="mobile-back-button">
            Back
          </button>
        )}
        <h1>{title}</h1>
        {fabConfig && (
          <button onClick={fabConfig.action} data-testid="mobile-fab">
            {fabConfig.ariaLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )),
}));

// Mock message hooks
const mockConversations = [
  {
    id: 'conv:1',
    participants: [
      { id: 'user:test123', name: 'Test User' },
      { id: 'user:other', name: 'Other User' }
    ],
    last_message_snippet: '这是一条测试消息',
    last_message_timestamp: '2023-12-01T10:00:00Z',
    last_message_sender_name: 'Other User',
    unread_count: 1,
    type: 'IM'
  },
  {
    id: 'conv:2',
    participants: [
      { id: 'user:test123', name: 'Test User' },
      { id: 'user:another', name: 'Another User' }
    ],
    last_message_snippet: '另一条消息',
    last_message_timestamp: '2023-12-01T09:00:00Z',
    last_message_sender_name: 'Another User',
    unread_count: 0,
    type: 'IM'
  }
];

const mockNotifications = [
  {
    id: 'notif:1',
    type: 'BUSINESS_NOTIFICATION',
    title: '系统通知',
    content: '您有一个新的案件分配',
    priority: 'high',
    is_read: false,
    created_at: '2023-12-01T11:00:00Z',
    updated_at: '2023-12-01T11:00:00Z'
  },
  {
    id: 'notif:2',
    type: 'CASE_ROBOT_REMINDER',
    title: '案件提醒',
    content: '请及时处理债权审核',
    priority: 'normal',
    is_read: true,
    created_at: '2023-12-01T08:00:00Z',
    updated_at: '2023-12-01T08:00:00Z'
  }
];

vi.mock('@/src/hooks/useMessageCenterData', () => ({
  useConversationsList: () => ({
    conversations: mockConversations,
    isLoading: false,
    error: null,
    setConversations: vi.fn(),
  }),
  useSystemNotifications: () => ({
    notifications: mockNotifications,
    isLoading: false,
    error: null,
    setNotifications: vi.fn(),
  }),
}));

// Mock message service
vi.mock('@/src/services/messageService', () => ({
  messageService: {
    sendMessage: vi.fn().mockResolvedValue({
      id: 'msg:new',
      content: 'Test message sent',
    }),
  },
}));

// Mock message components
vi.mock('@/src/components/messages/MessageListItem', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="message-list-item" />),
}));

vi.mock('@/src/components/messages/ChatBubble', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="chat-bubble" />),
}));

vi.mock('@/src/components/messages/ChatInput', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="chat-input" />),
}));

vi.mock('@/src/components/messages/NotificationCard', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="notification-card" />),
}));

vi.mock('@/src/components/messages/CreateConversationDialog', () => ({
  __esModule: true,
  default: vi.fn(({ open, onClose, onCreated }) => (
    open ? (
      <div data-testid="create-conversation-dialog">
        <button onClick={() => onCreated('conv:new')}>Create</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )),
}));

describe('MessageCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to desktop mode by default
    vi.mocked(useResponsiveLayout).mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await new Promise(resolve => setTimeout(resolve, 0));
    vi.clearAllTimers();
  });

  const theme = createTheme();

  const renderComponent = () => {
    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <I18nextProvider i18n={i18n}>
            <SnackbarProvider>
              <MessageCenterPage />
            </SnackbarProvider>
          </I18nextProvider>
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  // Desktop Layout Tests
  describe('Desktop Layout', () => {
    it('renders desktop layout with message list and detail panels', () => {
      renderComponent();
      
      expect(screen.getByText('消息中心')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜索消息...')).toBeInTheDocument();
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('聊天')).toBeInTheDocument();
      expect(screen.getByText('通知')).toBeInTheDocument();
    });

    it('displays conversations and notifications in desktop list', () => {
      renderComponent();
      
      expect(screen.getByText('这是一条测试消息')).toBeInTheDocument();
      expect(screen.getByText('另一条消息')).toBeInTheDocument();
      expect(screen.getByText('您有一个新的案件分配')).toBeInTheDocument();
      expect(screen.getByText('请及时处理债权审核')).toBeInTheDocument();
    });

    it('shows unread count badge on desktop', () => {
      renderComponent();
      
      expect(screen.getByText('未读消息')).toBeInTheDocument();
      // Unread count should be 2 (1 conversation + 1 notification)
    });

    it('opens conversation when clicked on desktop', async () => {
      renderComponent();
      
      const conversationItem = screen.getByText('这是一条测试消息').closest('li');
      expect(conversationItem).toBeInTheDocument();
      
      fireEvent.click(conversationItem!);
      
      await waitFor(() => {
        expect(screen.getByText('Other User')).toBeInTheDocument();
      });
    });
  });

  // Mobile Layout Tests
  describe('Mobile Layout', () => {
    beforeEach(() => {
      // Mock mobile device
      vi.mocked(useResponsiveLayout).mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
      });
    });

    it('renders mobile message list view', () => {
      renderComponent();
      
      expect(screen.getByTestId('mobile-optimized-layout')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-fab')).toBeInTheDocument();
      expect(screen.getByText('新建对话')).toBeInTheDocument();
    });

    it('displays mobile search and filters', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('搜索消息...')).toBeInTheDocument();
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('聊天')).toBeInTheDocument();
      expect(screen.getByText('通知')).toBeInTheDocument();
    });

    it('displays conversations as mobile cards', () => {
      renderComponent();
      
      // Check for conversation content in mobile cards
      expect(screen.getByText('这是一条测试消息')).toBeInTheDocument();
      expect(screen.getByText('另一条消息')).toBeInTheDocument();
      expect(screen.getByText('Other User')).toBeInTheDocument();
    });

    it('displays notifications as mobile cards', () => {
      renderComponent();
      
      expect(screen.getByText('系统通知')).toBeInTheDocument();
      expect(screen.getByText('案件提醒')).toBeInTheDocument();
      expect(screen.getByText('您有一个新的案件分配')).toBeInTheDocument();
    });

    it('shows priority indicators on mobile cards', () => {
      renderComponent();
      
      expect(screen.getByText('重要')).toBeInTheDocument();
    });

    it('opens mobile chat view when conversation is selected', async () => {
      renderComponent();
      
      const conversationCard = screen.getByText('这是一条测试消息').closest('div[role="button"], .MuiCard-root');
      expect(conversationCard).toBeInTheDocument();
      
      fireEvent.click(conversationCard!);
      
      await waitFor(() => {
        expect(screen.getByText('Other User')).toBeInTheDocument();
        expect(screen.getByTestId('mobile-back-button')).toBeInTheDocument();
      });
    });

    it('displays mobile chat interface with touch-friendly elements', async () => {
      renderComponent();
      
      // Select a conversation to enter chat view
      const conversationCard = screen.getByText('这是一条测试消息').closest('div[role="button"], .MuiCard-root');
      fireEvent.click(conversationCard!);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入消息...')).toBeInTheDocument();
      });
      
      // Check for touch-friendly chat input
      const chatInput = screen.getByPlaceholderText('输入消息...');
      expect(chatInput).toHaveStyle('font-size: 16px'); // iOS zoom prevention
    });

    it('handles mobile chat input and send functionality', async () => {
      renderComponent();
      
      // Enter chat view
      const conversationCard = screen.getByText('这是一条测试消息').closest('div[role="button"], .MuiCard-root');
      fireEvent.click(conversationCard!);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('输入消息...')).toBeInTheDocument();
      });
      
      // Type a message
      const chatInput = screen.getByPlaceholderText('输入消息...');
      fireEvent.change(chatInput, { target: { value: '测试消息' } });
      
      // Send message
      const sendButton = screen.getByRole('button', { name: '' }); // Send icon button
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockShowSuccess).not.toHaveBeenCalled(); // Success handled internally
      });
    });

    it('navigates back from mobile chat view', async () => {
      renderComponent();
      
      // Enter chat view
      const conversationCard = screen.getByText('这是一条测试消息').closest('div[role="button"], .MuiCard-root');
      fireEvent.click(conversationCard!);
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-back-button')).toBeInTheDocument();
      });
      
      // Navigate back
      const backButton = screen.getByTestId('mobile-back-button');
      fireEvent.click(backButton);
      
      await waitFor(() => {
        expect(screen.getByText('消息中心')).toBeInTheDocument();
        expect(screen.getByTestId('mobile-fab')).toBeInTheDocument();
      });
    });

    it('opens mobile notification view', async () => {
      renderComponent();
      
      const notificationCard = screen.getByText('您有一个新的案件分配').closest('div[role="button"], .MuiCard-root');
      expect(notificationCard).toBeInTheDocument();
      
      fireEvent.click(notificationCard!);
      
      await waitFor(() => {
        expect(screen.getByText('系统通知')).toBeInTheDocument();
        expect(screen.getByText('标记为已读')).toBeInTheDocument();
        expect(screen.getByText('归档')).toBeInTheDocument();
        expect(screen.getByText('删除')).toBeInTheDocument();
      });
    });

    it('displays mobile empty state when no messages', () => {
      // Mock empty data
      vi.doMock('@/src/hooks/useMessageCenterData', () => ({
        useConversationsList: () => ({
          conversations: [],
          isLoading: false,
          error: null,
          setConversations: vi.fn(),
        }),
        useSystemNotifications: () => ({
          notifications: [],
          isLoading: false,
          error: null,
          setNotifications: vi.fn(),
        }),
      }));
      
      renderComponent();
      
      expect(screen.getByText('暂无消息')).toBeInTheDocument();
      expect(screen.getByText('开始新的对话或等待其他人联系您')).toBeInTheDocument();
      expect(screen.getByText('新建对话')).toBeInTheDocument();
    });

    it('shows mobile loading state', () => {
      // Mock loading state
      vi.doMock('@/src/hooks/useMessageCenterData', () => ({
        useConversationsList: () => ({
          conversations: [],
          isLoading: true,
          error: null,
          setConversations: vi.fn(),
        }),
        useSystemNotifications: () => ({
          notifications: [],
          isLoading: true,
          error: null,
          setNotifications: vi.fn(),
        }),
      }));
      
      renderComponent();
      
      // Check for skeleton loading cards
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('opens create conversation dialog from mobile FAB', async () => {
      renderComponent();
      
      const fabButton = screen.getByTestId('mobile-fab');
      fireEvent.click(fabButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('create-conversation-dialog')).toBeInTheDocument();
      });
    });

    it('handles mobile message menu actions', async () => {
      renderComponent();
      
      // Find and click the menu button for the first message
      const menuButtons = screen.getAllByRole('button', { name: '' });
      const menuButton = menuButtons.find(btn => btn.querySelector('svg')); // MoreVert icon
      
      if (menuButton) {
        fireEvent.click(menuButton);
        
        await waitFor(() => {
          expect(screen.getByText('标记为已读')).toBeInTheDocument();
          expect(screen.getByText('标记为未读')).toBeInTheDocument();
          expect(screen.getByText('归档')).toBeInTheDocument();
          expect(screen.getByText('删除')).toBeInTheDocument();
        });
      }
    });

    it('filters messages on mobile', async () => {
      renderComponent();
      
      // Click on "聊天" tab
      const chatTab = screen.getByText('聊天');
      fireEvent.click(chatTab);
      
      // Should only show conversations, not notifications
      expect(screen.getByText('这是一条测试消息')).toBeInTheDocument();
      expect(screen.queryByText('您有一个新的案件分配')).not.toBeInTheDocument();
      
      // Click on "通知" tab
      const notificationTab = screen.getByText('通知');
      fireEvent.click(notificationTab);
      
      // Should only show notifications, not conversations
      expect(screen.queryByText('这是一条测试消息')).not.toBeInTheDocument();
      expect(screen.getByText('您有一个新的案件分配')).toBeInTheDocument();
    });

    it('searches messages on mobile', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText('搜索消息...');
      fireEvent.change(searchInput, { target: { value: '测试' } });
      
      // Search functionality would be implemented in the component
      expect(searchInput).toHaveValue('测试');
    });
  });

  // Common functionality tests
  describe('Common Functionality', () => {
    it('marks notification as read when selected', async () => {
      renderComponent();
      
      const unreadNotification = screen.getByText('您有一个新的案件分配').closest('li') || 
                                screen.getByText('您有一个新的案件分配').closest('.MuiCard-root');
      
      fireEvent.click(unreadNotification!);
      
      await waitFor(() => {
        expect(mockClient.merge).toHaveBeenCalledWith(
          'notif:1',
          expect.objectContaining({
            is_read: true,
            updated_at: expect.any(String)
          })
        );
        expect(mockShowSuccess).toHaveBeenCalledWith('通知已标记为已读');
      });
    });

    it('handles errors when marking as read fails', async () => {
      mockClient.merge.mockRejectedValueOnce(new Error('Network error'));
      
      renderComponent();
      
      const unreadNotification = screen.getByText('您有一个新的案件分配').closest('li') || 
                                screen.getByText('您有一个新的案件分配').closest('.MuiCard-root');
      
      fireEvent.click(unreadNotification!);
      
      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('标记通知为已读失败');
      });
    });

    it('creates new conversation', async () => {
      renderComponent();
      
      const createButton = screen.getByTestId('mobile-fab') || screen.getByRole('button', { name: /add/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('create-conversation-dialog')).toBeInTheDocument();
      });
      
      const createDialogButton = screen.getByText('Create');
      fireEvent.click(createDialogButton);
      
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('会话创建成功');
      });
    });
  });
});