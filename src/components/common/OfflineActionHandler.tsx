import React, { createContext, useContext, ReactNode } from 'react';
import { Button, IconButton, Fab, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNetworkState } from '../hooks/useNetworkState';

interface OfflineActionContextType {
  isOnline: boolean;
  shouldDisableAction: (actionType: 'create' | 'edit' | 'delete' | 'sync') => boolean;
  getOfflineMessage: (actionType: string) => string;
}

const OfflineActionContext = createContext<OfflineActionContextType | null>(null);

interface OfflineActionProviderProps {
  children: ReactNode;
}

/**
 * 离线操作上下文提供者
 * 
 * 提供离线状态下的操作控制和用户提示
 */
export const OfflineActionProvider: React.FC<OfflineActionProviderProps> = ({ children }) => {
  const { isOnline } = useNetworkState();

  const shouldDisableAction = (actionType: 'create' | 'edit' | 'delete' | 'sync'): boolean => {
    if (isOnline) return false;

    // 离线时禁用所有写操作
    const writeActions = ['create', 'edit', 'delete', 'sync'];
    return writeActions.includes(actionType);
  };

  const getOfflineMessage = (actionType: string): string => {
    const messages = {
      create: '离线状态下无法创建新内容，请连接网络后重试',
      edit: '离线状态下无法编辑内容，请连接网络后重试',
      delete: '离线状态下无法删除内容，请连接网络后重试',
      sync: '离线状态下无法同步数据，请连接网络后重试',
      default: '此操作需要网络连接，请检查网络设置后重试'
    };

    return messages[actionType as keyof typeof messages] || messages.default;
  };

  const contextValue: OfflineActionContextType = {
    isOnline,
    shouldDisableAction,
    getOfflineMessage
  };

  return (
    <OfflineActionContext.Provider value={contextValue}>
      {children}
    </OfflineActionContext.Provider>
  );
};

/**
 * 使用离线操作上下文的 Hook
 */
export const useOfflineAction = () => {
  const context = useContext(OfflineActionContext);
  if (!context) {
    throw new Error('useOfflineAction must be used within an OfflineActionProvider');
  }
  return context;
};

// 样式化的离线禁用组件
const OfflineDisabledWrapper = styled('div')<{ disabled: boolean }>(({ theme, disabled }) => ({
  position: 'relative',
  display: 'inline-block',
  opacity: disabled ? 0.6 : 1,
  pointerEvents: disabled ? 'none' : 'auto',
  '&::after': disabled ? {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: theme.shape.borderRadius,
    zIndex: 1
  } : {}
}));

interface OfflineAwareButtonProps {
  children: ReactNode;
  actionType?: 'create' | 'edit' | 'delete' | 'sync';
  onClick?: () => void;
  disabled?: boolean;
  showTooltip?: boolean;
  component?: 'button' | 'iconButton' | 'fab';
  [key: string]: any; // 其他 MUI 组件 props
}

/**
 * 离线感知按钮组件
 * 
 * 自动根据网络状态禁用写操作按钮并显示提示
 */
export const OfflineAwareButton: React.FC<OfflineAwareButtonProps> = ({
  children,
  actionType = 'edit',
  onClick,
  disabled = false,
  showTooltip = true,
  component = 'button',
  ...props
}) => {
  const { shouldDisableAction, getOfflineMessage } = useOfflineAction();

  const isOfflineDisabled = shouldDisableAction(actionType);
  const isDisabled = disabled || isOfflineDisabled;
  const tooltipMessage = isOfflineDisabled ? getOfflineMessage(actionType) : '';

  const handleClick = () => {
    if (!isOfflineDisabled && onClick) {
      onClick();
    }
  };

  const buttonProps = {
    ...props,
    disabled: isDisabled,
    onClick: handleClick
  };

  const renderButton = () => {
    switch (component) {
      case 'iconButton':
        return <IconButton {...buttonProps}>{children}</IconButton>;
      case 'fab':
        return <Fab {...buttonProps}>{children}</Fab>;
      default:
        return <Button {...buttonProps}>{children}</Button>;
    }
  };

  const button = renderButton();

  if (showTooltip && isOfflineDisabled) {
    return (
      <Tooltip title={tooltipMessage} arrow>
        <OfflineDisabledWrapper disabled={isOfflineDisabled}>
          {button}
        </OfflineDisabledWrapper>
      </Tooltip>
    );
  }

  return isOfflineDisabled ? (
    <OfflineDisabledWrapper disabled={isOfflineDisabled}>
      {button}
    </OfflineDisabledWrapper>
  ) : button;
};

interface OfflineAwareFormProps {
  children: ReactNode;
  onSubmit?: (event: React.FormEvent) => void;
  actionType?: 'create' | 'edit';
  className?: string;
}

/**
 * 离线感知表单组件
 * 
 * 在离线状态下禁用表单提交并显示提示
 */
export const OfflineAwareForm: React.FC<OfflineAwareFormProps> = ({
  children,
  onSubmit,
  actionType = 'edit',
  className
}) => {
  const { shouldDisableAction, getOfflineMessage } = useOfflineAction();

  const isOfflineDisabled = shouldDisableAction(actionType);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (isOfflineDisabled) {
      // 可以在这里显示 toast 或其他提示
      console.warn(getOfflineMessage(actionType));
      return;
    }

    if (onSubmit) {
      onSubmit(event);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <OfflineDisabledWrapper disabled={isOfflineDisabled}>
        {children}
      </OfflineDisabledWrapper>
    </form>
  );
};

interface OfflineGuardProps {
  children: ReactNode;
  actionType?: 'create' | 'edit' | 'delete' | 'sync';
  fallback?: ReactNode;
  showMessage?: boolean;
}

/**
 * 离线守卫组件
 * 
 * 在离线状态下隐藏或替换需要网络的内容
 */
export const OfflineGuard: React.FC<OfflineGuardProps> = ({
  children,
  actionType = 'edit',
  fallback,
  showMessage = false
}) => {
  const { shouldDisableAction, getOfflineMessage } = useOfflineAction();

  const isOfflineDisabled = shouldDisableAction(actionType);

  if (isOfflineDisabled) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showMessage) {
      return (
        <div style={{ 
          padding: '16px', 
          textAlign: 'center', 
          color: 'rgba(0, 0, 0, 0.6)',
          fontStyle: 'italic'
        }}>
          {getOfflineMessage(actionType)}
        </div>
      );
    }
    
    return null;
  }

  return <>{children}</>;
};

export default {
  OfflineActionProvider,
  OfflineAwareButton,
  OfflineAwareForm,
  OfflineGuard,
  useOfflineAction
};