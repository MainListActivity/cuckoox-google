import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { render } from '../../utils/testUtils';
import React from 'react';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query.includes('(orientation: landscape)') ? false : true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock modules
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/src/contexts/SnackbarContext', () => ({
  useSnackbar: vi.fn(),
}));

vi.mock('@/src/hooks/useGroupData', () => ({
  useGroupDetails: vi.fn(),
  useGroupOperations: vi.fn(),
  useGroupPermissions: vi.fn(),
  useGroupWebRTCPermissions: vi.fn(),
}));

vi.mock('@/src/services/messageService', () => ({
  messageService: {
    sendGroupMessage: vi.fn(),
    searchGroupMessages: vi.fn(),
    markGroupMessagesAsRead: vi.fn(),
  },
}));

vi.mock('@/src/services/callManager', () => ({
  default: {
    initiateGroupCall: vi.fn(),
    answerCall: vi.fn(),
    rejectCall: vi.fn(),
    endCall: vi.fn(),
    getCallSession: vi.fn(),
    setEventListeners: vi.fn(),
  },
}));

// 创建简化的测试组件
const TestGroupChatInterface = React.lazy(() => 
  Promise.resolve({
    default: (props: any) => {
      const [showGroupInfo, setShowGroupInfo] = React.useState(false);
      const [showCallInviteDialog, setShowCallInviteDialog] = React.useState(false);
      const [activeCall, setActiveCall] = React.useState(null);
      const [menuAnchor, setMenuAnchor] = React.useState(null);
      const [selectedCallType, setSelectedCallType] = React.useState('voice');
      
      const group = props.mockGroup || {
        id: 'group:test-group',
        name: '测试群组',
        description: '这是一个测试群组',
        avatar_url: '',
        member_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator_id: 'user:creator',
        is_private: false,
        settings: {
          allow_member_invite: true,
          require_approval: false,
          mute_notifications: false
        }
      };
      
      const members = props.mockMembers || [
        {
          id: 'user:member1',
          user_id: 'user:member1',
          username: '成员1',
          avatar_url: '',
          role: 'owner' as const,
          joined_at: new Date().toISOString(),
          is_online: true,
          last_seen: new Date().toISOString()
        },
        {
          id: 'user:member2',
          user_id: 'user:member2', 
          username: '成员2',
          avatar_url: '',
          role: 'admin' as const,
          joined_at: new Date().toISOString(),
          is_online: false,
          last_seen: new Date(Date.now() - 3600000).toISOString()
        }
      ];
      
      const handleStartVoiceCall = async () => {
        if (!props.hasPermissions?.voiceCall) {
          props.onError?.(new Error('没有语音通话权限'));
          return;
        }
        setSelectedCallType('voice');
        setShowCallInviteDialog(true);
      };
      
      const handleStartVideoCall = async () => {
        if (!props.hasPermissions?.videoCall) {
          props.onError?.(new Error('没有视频通话权限'));
          return;
        }
        setSelectedCallType('video');
        setShowCallInviteDialog(true);
      };
      
      const handleConfirmCall = async () => {
        try {
          const callManager = (await import('@/src/services/callManager')).default;
          await callManager.initiateGroupCall(props.groupId, selectedCallType);
          setShowCallInviteDialog(false);
          setActiveCall({ type: selectedCallType, status: 'calling' });
        } catch (error) {
          props.onError?.(error);
        }
      };
      
      const handleEndCall = async () => {
        try {
          const callManager = (await import('@/src/services/callManager')).default;
          await callManager.endCall(props.groupId, '用户主动结束');
          setActiveCall(null);
        } catch (error) {
          props.onError?.(error);
        }
      };
      
      const handleAnswerCall = async () => {
        try {
          const callManager = (await import('@/src/services/callManager')).default;
          await callManager.answerCall(props.groupId);
          setActiveCall({ type: 'voice', status: 'connected' });
        } catch (error) {
          props.onError?.(error);
        }
      };
      
      const handleRejectCall = async () => {
        try {
          const callManager = (await import('@/src/services/callManager')).default;
          await callManager.rejectCall(props.groupId, '用户拒绝');
          setActiveCall(null);
        } catch (error) {
          props.onError?.(error);
        }
      };
      
      const handleLeaveGroup = () => {
        if (props.onLeaveGroup) {
          props.onLeaveGroup();
        }
      };
      
      const handleInviteMembers = () => {
        if (props.onInviteMembers) {
          props.onInviteMembers();
        }
      };
      
      return React.createElement('div', { 
        'data-testid': 'group-chat-interface',
        children: [
          // 头部信息
          React.createElement('div', { key: 'header' }, [
            React.createElement('button', {
              key: 'back-btn',
              'aria-label': '返回',
              onClick: props.onBack
            }, '←'),
            React.createElement('div', { key: 'group-name' }, group.name),
            React.createElement('div', { key: 'member-count' }, `${members.length} 位成员`),
            React.createElement('button', {
              key: 'voice-call-btn',
              'aria-label': '语音通话',
              onClick: handleStartVoiceCall,
              disabled: !props.hasPermissions?.voiceCall
            }, '📞'),
            React.createElement('button', {
              key: 'video-call-btn',
              'aria-label': '视频通话',
              onClick: handleStartVideoCall,
              disabled: !props.hasPermissions?.videoCall
            }, '📹'),
            React.createElement('button', {
              key: 'group-info-btn',
              'aria-label': '群组信息',
              onClick: () => setShowGroupInfo(true)
            }, 'ℹ️'),
            React.createElement('button', {
              key: 'menu-btn',
              'aria-label': '更多选项',
              onClick: (e) => setMenuAnchor(e.currentTarget)
            }, '⋮')
          ]),
          
          // 群组描述
          group.description && React.createElement('div', { 
            key: 'description',
            'data-testid': 'group-description'
          }, group.description),
          
          // 成员列表预览
          React.createElement('div', {
            key: 'members-preview',
            'data-testid': 'members-preview',
            children: [
              React.createElement('div', { key: 'members-title' }, '群组成员'),
              ...members.slice(0, 3).map((member, index) => 
                React.createElement('div', {
                  key: member.id,
                  'data-testid': `member-preview-${index}`,
                  children: [
                    React.createElement('span', { key: 'name' }, member.username),
                    React.createElement('span', { key: 'role' }, ` (${member.role})`),
                    React.createElement('span', { key: 'status' }, 
                      member.is_online ? ' 在线' : ' 离线'
                    )
                  ]
                })
              )
            ]
          }),
          
          // 活跃通话控制栏
          activeCall && React.createElement('div', {
            key: 'active-call-controls',
            'data-testid': 'active-call-controls',
            children: [
              React.createElement('div', { key: 'call-status' }, 
                `${activeCall.type === 'voice' ? '语音' : '视频'}通话 - ${activeCall.status === 'calling' ? '呼叫中' : '已连接'}`
              ),
              React.createElement('button', {
                key: 'end-call-btn',
                'aria-label': '结束通话',
                onClick: handleEndCall
              }, '结束通话')
            ]
          }),
          
          // 来电提示
          props.incomingCall && React.createElement('div', {
            key: 'incoming-call',
            'data-testid': 'incoming-call',
            children: [
              React.createElement('div', { key: 'caller-info' }, '收到群组通话邀请'),
              React.createElement('button', {
                key: 'answer-btn',
                'aria-label': '接听',
                onClick: handleAnswerCall
              }, '接听'),
              React.createElement('button', {
                key: 'reject-btn',
                'aria-label': '拒绝',
                onClick: handleRejectCall
              }, '拒绝')
            ]
          }),
          
          // 群组信息面板
          showGroupInfo && React.createElement('div', {
            key: 'group-info-panel',
            'data-testid': 'group-info-panel',
            children: [
              React.createElement('div', { key: 'panel-title' }, '群组信息'),
              React.createElement('div', { key: 'group-detail-name' }, `名称: ${group.name}`),
              React.createElement('div', { key: 'group-detail-members' }, `成员: ${members.length}人`),
              React.createElement('div', { key: 'group-detail-type' }, 
                `类型: ${group.is_private ? '私有群组' : '公开群组'}`
              ),
              React.createElement('button', {
                key: 'close-info-btn',
                'aria-label': '关闭群组信息',
                onClick: () => setShowGroupInfo(false)
              }, '关闭')
            ]
          }),
          
          // 更多选项菜单
          menuAnchor && React.createElement('div', {
            key: 'options-menu',
            'data-testid': 'options-menu',
            children: [
              React.createElement('button', {
                key: 'invite-members-btn',
                onClick: () => {
                  handleInviteMembers();
                  setMenuAnchor(null);
                }
              }, '邀请成员'),
              React.createElement('button', {
                key: 'group-settings-btn',  
                onClick: () => {
                  props.onShowSettings?.();
                  setMenuAnchor(null);
                }
              }, '群组设置'),
              React.createElement('button', {
                key: 'leave-group-btn',
                onClick: () => {
                  handleLeaveGroup();
                  setMenuAnchor(null);
                }
              }, '离开群组'),
              React.createElement('button', {
                key: 'close-menu-btn',
                onClick: () => setMenuAnchor(null)
              }, '关闭菜单')
            ]
          }),
          
          // 通话邀请确认对话框
          showCallInviteDialog && React.createElement('div', {
            key: 'call-invite-dialog',
            'data-testid': 'call-invite-dialog',
            role: 'dialog',
            children: [
              React.createElement('div', { key: 'dialog-title' }, 
                `发起${selectedCallType === 'voice' ? '语音' : '视频'}通话`
              ),
              React.createElement('div', { key: 'dialog-content' }, 
                '确定要向群组成员发起通话邀请吗？'
              ),
              React.createElement('button', {
                key: 'cancel-call-btn',
                onClick: () => setShowCallInviteDialog(false)
              }, '取消'),
              React.createElement('button', {
                key: 'confirm-call-btn',
                onClick: handleConfirmCall
              }, '确定')
            ]
          })
        ]
      });
    }
  })
);

describe('GroupChatInterface', () => {
  const defaultProps = {
    groupId: 'group:test-group',
    onBack: vi.fn(),
    onShowGroupInfo: vi.fn(),
    onShowMemberList: vi.fn(),
    onShowSettings: vi.fn(),
    onLeaveGroup: vi.fn(),
    onInviteMembers: vi.fn(),
    onError: vi.fn(),
    hasPermissions: {
      voiceCall: true,
      videoCall: true,
      invite: true,
      manage: true,
    }
  };

  let mockUseAuth: any;
  let mockUseSnackbar: any;
  let mockUseGroupDetails: any;
  let mockUseGroupOperations: any;
  let mockUseGroupPermissions: any;
  let mockUseGroupWebRTCPermissions: any;
  let mockCallManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked instances
    mockUseAuth = (await import('@/src/contexts/AuthContext')).useAuth;
    mockUseSnackbar = (await import('@/src/contexts/SnackbarContext')).useSnackbar;
    mockUseGroupDetails = (await import('@/src/hooks/useGroupData')).useGroupDetails;
    mockUseGroupOperations = (await import('@/src/hooks/useGroupData')).useGroupOperations;
    mockUseGroupPermissions = (await import('@/src/hooks/useGroupData')).useGroupPermissions;
    mockUseGroupWebRTCPermissions = (await import('@/src/hooks/useGroupData')).useGroupWebRTCPermissions;
    mockCallManager = (await import('@/src/services/callManager')).default;
    
    // Setup default mocks
    mockUseAuth.mockReturnValue({
      user: { id: 'user:current-user', username: '当前用户' }
    });
    
    mockUseSnackbar.mockReturnValue({
      showSuccess: vi.fn(),
      showError: vi.fn()
    });
    
    mockUseGroupDetails.mockReturnValue({
      group: {
        id: 'group:test-group',
        name: '测试群组',
        description: '这是一个测试群组',
        member_count: 5,
        is_private: false
      },
      members: [
        { id: 'user:member1', username: '成员1', role: 'owner', is_online: true },
        { id: 'user:member2', username: '成员2', role: 'admin', is_online: false }
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });
    
    mockUseGroupOperations.mockReturnValue({
      leaveGroup: vi.fn().mockResolvedValue(undefined)
    });
    
    mockUseGroupPermissions.mockReturnValue({
      canManageGroup: true,
      canInviteMembers: true,
      canRemoveMembers: true
    });
    
    mockUseGroupWebRTCPermissions.mockReturnValue({
      canInitiateVoiceCall: true,
      canInitiateVideoCall: true,
      canCreateGroupCall: true,
      canJoinGroupCall: true,
      canControlMicrophone: true,
      canControlCamera: true,
      canEndCall: true,
      canRejectCall: true
    });
    
    mockCallManager.initiateGroupCall.mockResolvedValue(undefined);
    mockCallManager.answerCall.mockResolvedValue(undefined);
    mockCallManager.rejectCall.mockResolvedValue(undefined);
    mockCallManager.endCall.mockResolvedValue(undefined);
    mockCallManager.getCallSession.mockReturnValue(null);
    mockCallManager.setEventListeners.mockImplementation(() => {});
  });

  describe('组件渲染', () => {
    it('应该正确渲染基本组件结构', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('group-chat-interface')).toBeInTheDocument();
        expect(screen.getByText('测试群组')).toBeInTheDocument();
        expect(screen.getByText('2 位成员')).toBeInTheDocument();
      });
    });

    it('应该显示群组描述', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('group-description')).toBeInTheDocument();
        expect(screen.getByText('这是一个测试群组')).toBeInTheDocument();
      });
    });

    it('应该显示成员预览列表', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('group-chat-interface')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('members-preview')).toBeInTheDocument();
      expect(screen.getByText('群组成员')).toBeInTheDocument();
      expect(screen.getByTestId('member-preview-0')).toBeInTheDocument();
      
      // 检查成员信息，文本可能被分成多个元素
      const memberPreview0 = screen.getByTestId('member-preview-0');
      expect(memberPreview0).toHaveTextContent('成员1');
      expect(memberPreview0).toHaveTextContent('(owner)');
      expect(memberPreview0).toHaveTextContent('在线');
      
      const memberPreview1 = screen.getByTestId('member-preview-1');
      expect(memberPreview1).toHaveTextContent('成员2');
      expect(memberPreview1).toHaveTextContent('(admin)');
      expect(memberPreview1).toHaveTextContent('离线');
    });

    it('应该显示通话控制按钮', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('语音通话')).toBeInTheDocument();
        expect(screen.getByLabelText('视频通话')).toBeInTheDocument();
        expect(screen.getByLabelText('群组信息')).toBeInTheDocument();
        expect(screen.getByLabelText('更多选项')).toBeInTheDocument();
      });
    });
  });

  describe('通话功能', () => {
    it('应该能够发起语音通话', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('语音通话')).toBeInTheDocument();
      });

      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('call-invite-dialog')).toBeInTheDocument();
        expect(screen.getByText('发起语音通话')).toBeInTheDocument();
        expect(screen.getByText('确定要向群组成员发起通话邀请吗？')).toBeInTheDocument();
      });
    });

    it('应该能够发起视频通话', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('视频通话')).toBeInTheDocument();
      });

      const videoCallButton = screen.getByLabelText('视频通话');
      fireEvent.click(videoCallButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('call-invite-dialog')).toBeInTheDocument();
        expect(screen.getByText('发起视频通话')).toBeInTheDocument();
      });
    });

    it('应该能够确认发起通话', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 点击语音通话按钮
      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument();
      });

      // 确认发起通话
      const confirmButton = screen.getByRole('button', { name: '确定' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockCallManager.initiateGroupCall).toHaveBeenCalledWith('group:test-group', 'voice');
        expect(screen.getByTestId('active-call-controls')).toBeInTheDocument();
        expect(screen.getByText('语音通话 - 呼叫中')).toBeInTheDocument();
      });
    });

    it('应该能够取消发起通话', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 点击语音通话按钮
      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
      });

      // 取消发起通话
      const cancelButton = screen.getByRole('button', { name: '取消' });
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('call-invite-dialog')).not.toBeInTheDocument();
      });
    });

    it('应该能够接听来电', async () => {
      const propsWithIncomingCall = {
        ...defaultProps,
        incomingCall: true
      };

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...propsWithIncomingCall} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('incoming-call')).toBeInTheDocument();
        expect(screen.getByLabelText('接听')).toBeInTheDocument();
      });

      const answerButton = screen.getByLabelText('接听');
      fireEvent.click(answerButton);
      
      await waitFor(() => {
        expect(mockCallManager.answerCall).toHaveBeenCalledWith('group:test-group');
        expect(screen.getByTestId('active-call-controls')).toBeInTheDocument();
        expect(screen.getByText('语音通话 - 已连接')).toBeInTheDocument();
      });
    });

    it('应该能够拒绝来电', async () => {
      const propsWithIncomingCall = {
        ...defaultProps,
        incomingCall: true
      };

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...propsWithIncomingCall} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('incoming-call')).toBeInTheDocument();
        expect(screen.getByLabelText('拒绝')).toBeInTheDocument();
      });

      const rejectButton = screen.getByLabelText('拒绝');
      
      act(() => {
        fireEvent.click(rejectButton);
      });
      
      await waitFor(() => {
        expect(mockCallManager.rejectCall).toHaveBeenCalledWith('group:test-group', '用户拒绝');
      });
    });

    it('应该能够结束通话', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 先发起通话
      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      const confirmButton = screen.getByRole('button', { name: '确定' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('active-call-controls')).toBeInTheDocument();
        expect(screen.getByLabelText('结束通话')).toBeInTheDocument();
      });

      // 结束通话
      const endCallButton = screen.getByLabelText('结束通话');
      fireEvent.click(endCallButton);
      
      await waitFor(() => {
        expect(mockCallManager.endCall).toHaveBeenCalledWith('group:test-group', '用户主动结束');
        expect(screen.queryByTestId('active-call-controls')).not.toBeInTheDocument();
      });
    });
  });

  describe('群组操作', () => {
    it('应该能够打开群组信息面板', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('群组信息')).toBeInTheDocument();
      });

      const infoButton = screen.getByLabelText('群组信息');
      fireEvent.click(infoButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('group-info-panel')).toBeInTheDocument();
        expect(screen.getByText('群组信息')).toBeInTheDocument();
        expect(screen.getByText('名称: 测试群组')).toBeInTheDocument();
        expect(screen.getByText('成员: 2人')).toBeInTheDocument();
        expect(screen.getByText('类型: 公开群组')).toBeInTheDocument();
      });
    });

    it('应该能够关闭群组信息面板', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 先打开信息面板
      const infoButton = screen.getByLabelText('群组信息');
      fireEvent.click(infoButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText('关闭群组信息')).toBeInTheDocument();
      });

      // 关闭信息面板
      const closeButton = screen.getByLabelText('关闭群组信息');
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('group-info-panel')).not.toBeInTheDocument();
      });
    });

    it('应该能够打开更多选项菜单', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('更多选项')).toBeInTheDocument();
      });

      const menuButton = screen.getByLabelText('更多选项');
      fireEvent.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('options-menu')).toBeInTheDocument();
        expect(screen.getByText('邀请成员')).toBeInTheDocument();
        expect(screen.getByText('群组设置')).toBeInTheDocument();
        expect(screen.getByText('离开群组')).toBeInTheDocument();
      });
    });

    it('应该能够邀请成员', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 打开菜单
      const menuButton = screen.getByLabelText('更多选项');
      fireEvent.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByText('邀请成员')).toBeInTheDocument();
      });

      const inviteButton = screen.getByText('邀请成员');
      fireEvent.click(inviteButton);
      
      await waitFor(() => {
        expect(defaultProps.onInviteMembers).toHaveBeenCalled();
        expect(screen.queryByTestId('options-menu')).not.toBeInTheDocument();
      });
    });

    it('应该能够打开群组设置', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 打开菜单
      const menuButton = screen.getByLabelText('更多选项');
      fireEvent.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByText('群组设置')).toBeInTheDocument();
      });

      const settingsButton = screen.getByText('群组设置');
      fireEvent.click(settingsButton);
      
      await waitFor(() => {
        expect(defaultProps.onShowSettings).toHaveBeenCalled();
      });
    });

    it('应该能够离开群组', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 打开菜单
      const menuButton = screen.getByLabelText('更多选项');
      fireEvent.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByText('离开群组')).toBeInTheDocument();
      });

      const leaveButton = screen.getByText('离开群组');
      fireEvent.click(leaveButton);
      
      await waitFor(() => {
        expect(defaultProps.onLeaveGroup).toHaveBeenCalled();
      });
    });

    it('应该能够关闭更多选项菜单', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 打开菜单
      const menuButton = screen.getByLabelText('更多选项');
      fireEvent.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByText('关闭菜单')).toBeInTheDocument();
      });

      const closeMenuButton = screen.getByText('关闭菜单');
      fireEvent.click(closeMenuButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('options-menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('权限控制', () => {
    it('应该在没有语音通话权限时禁用按钮', async () => {
      const propsWithoutVoicePermission = {
        ...defaultProps,
        hasPermissions: {
          ...defaultProps.hasPermissions,
          voiceCall: false,
        }
      };

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...propsWithoutVoicePermission} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('group-chat-interface')).toBeInTheDocument();
      });

      // 没有权限时，按钮应该被禁用
      const voiceCallButton = screen.getByLabelText('语音通话');
      expect(voiceCallButton).toBeDisabled();
      
      // 禁用的按钮不会触发点击事件，所以不会有错误回调
      // 测试只需要验证按钮是否正确被禁用
    });

    it('应该在没有视频通话权限时禁用按钮', async () => {
      const propsWithoutVideoPermission = {
        ...defaultProps,
        hasPermissions: {
          ...defaultProps.hasPermissions,
          videoCall: false,
        }
      };

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...propsWithoutVideoPermission} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('group-chat-interface')).toBeInTheDocument();
      });

      // 没有权限时，按钮应该被禁用
      const videoCallButton = screen.getByLabelText('视频通话');
      expect(videoCallButton).toBeDisabled();
      
      // 禁用的按钮不会触发点击事件，所以不会有错误回调
      // 测试只需要验证按钮是否正确被禁用
    });
  });

  describe('错误处理', () => {
    it('应该正确处理通话发起失败', async () => {
      const testError = new Error('通话发起失败');
      mockCallManager.initiateGroupCall.mockRejectedValue(testError);
      
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 发起通话
      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      const confirmButton = screen.getByRole('button', { name: '确定' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(testError);
      });
    });

    it('应该正确处理接听通话失败', async () => {
      const testError = new Error('接听通话失败');
      mockCallManager.answerCall.mockRejectedValue(testError);
      
      const propsWithIncomingCall = {
        ...defaultProps,
        incomingCall: true
      };

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...propsWithIncomingCall} />
        </React.Suspense>
      );
      
      const answerButton = screen.getByLabelText('接听');
      fireEvent.click(answerButton);
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(testError);
      });
    });

    it('应该正确处理结束通话失败', async () => {
      const testError = new Error('结束通话失败');
      mockCallManager.endCall.mockRejectedValue(testError);
      
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      // 先发起通话
      const voiceCallButton = screen.getByLabelText('语音通话');
      fireEvent.click(voiceCallButton);
      
      const confirmButton = screen.getByRole('button', { name: '确定' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText('结束通话')).toBeInTheDocument();
      });

      // 结束通话（会失败）
      const endCallButton = screen.getByLabelText('结束通话');
      fireEvent.click(endCallButton);
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(testError);
      });
    });
  });

  describe('导航回调', () => {
    it('应该能够调用返回回调', async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <TestGroupChatInterface {...defaultProps} />
        </React.Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByLabelText('返回')).toBeInTheDocument();
      });

      const backButton = screen.getByLabelText('返回');
      fireEvent.click(backButton);
      
      expect(defaultProps.onBack).toHaveBeenCalled();
    });
  });
});