import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  SxProps,
  Theme
} from '@mui/material';
import Icon from '@mdi/react';
import {
  mdiBell,
  mdiBellOff,
  mdiBellOutline,
  mdiCheck,
  mdiClose,
  mdiAlert,
  mdiInformation,
  mdiTestTube,
  mdiCog,
  mdiAccountGroup,
  mdiGavel,
  mdiMessage,
  mdiMonitor
} from '@mdi/js';
import { PushNotificationUtils, type NotificationPayload, type PushSubscriptionData } from '../../workers/pwa-push-manager';

interface PushNotificationManagerProps {
  /**
   * VAPID公钥
   */
  vapidPublicKey: string;
  
  /**
   * 服务器端点
   */
  serverEndpoint?: string;
  
  /**
   * 用户ID
   */
  userId?: string;
  
  /**
   * 是否显示详细设置
   */
  showSettings?: boolean;
  
  /**
   * 自定义样式
   */
  sx?: SxProps<Theme>;
}

interface NotificationSettings {
  cases: boolean;
  claims: boolean;
  messages: boolean; 
  system: boolean;
}

/**
 * PWA推送通知管理组件
 * 
 * 提供推送通知的权限管理、订阅控制和设置界面
 */
export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  vapidPublicKey,
  serverEndpoint,
  userId,
  showSettings = true,
  sx
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscriptionData | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    cases: true,
    claims: true,
    messages: true,
    system: true
  });

  useEffect(() => {
    checkSupport();
    loadSettings();
  }, []);

  const checkSupport = () => {
    const supported = PushNotificationUtils.isSupported();
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkSubscriptionStatus();
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
        setSubscription(sub);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('pwa-notification-settings');
    if (saved) {
      try {
        setNotificationSettings(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }
  };

  const saveSettings = (settings: NotificationSettings) => {
    localStorage.setItem('pwa-notification-settings', JSON.stringify(settings));
    setNotificationSettings(settings);
  };

  const requestPermission = async () => {
    if (!isSupported) return;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted' && !isSubscribed) {
        await subscribeToNotifications();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToNotifications = async () => {
    if (!isSupported || permission !== 'granted') return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // 发送订阅信息到服务器
      if (serverEndpoint) {
        await sendSubscriptionToServer(sub);
      }

      console.log('Successfully subscribed to push notifications');
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      const success = await subscription.unsubscribe();
      
      if (success) {
        setSubscription(null);
        setIsSubscribed(false);
        
        // 通知服务器
        if (serverEndpoint) {
          await removeSubscriptionFromServer();
        }
        
        console.log('Successfully unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testNotification = async () => {
    if (!isSubscribed) return;

    try {
      const testPayload: NotificationPayload = {
        title: 'CuckooX 测试通知',
        body: '这是一条测试通知，用于验证推送通知功能是否正常工作。',
        icon: '/assets/logo/cuckoo-icon.svg',
        badge: '/assets/logo/favicon.svg',
        tag: 'test-notification',
        data: {
          type: 'test',
          timestamp: Date.now()
        }
      };

      // 发送到Service Worker显示
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          type: 'show_notification',
          payload: testPayload
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const sendSubscriptionToServer = async (sub: PushSubscription) => {
    if (!serverEndpoint) return;

    const subscriptionData = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
        auth: arrayBufferToBase64(sub.getKey('auth')!)
      },
      userId,
      subscriptionTime: Date.now()
    };

    await fetch(`${serverEndpoint}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData)
    });
  };

  const removeSubscriptionFromServer = async () => {
    if (!serverEndpoint || !subscription) return;

    await fetch(`${serverEndpoint}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
  };

  const getPermissionIcon = () => {
    switch (permission) {
      case 'granted': return mdiCheck;
      case 'denied': return mdiClose;
      default: return mdiAlert;
    }
  };

  const getPermissionColor = () => {
    switch (permission) {
      case 'granted': return 'success';
      case 'denied': return 'error';
      default: return 'warning';
    }
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  };

  if (!isSupported) {
    return (
      <Alert severity="warning" sx={sx}>
        <Typography variant="body2">
          您的浏览器不支持推送通知功能
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={sx}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Icon path={mdiBell} size={1.5} />
            <Box flexGrow={1}>
              <Typography variant="h6" gutterBottom>
                推送通知设置
              </Typography>
              <Typography variant="body2" color="text.secondary">
                管理系统通知的接收设置
              </Typography>
            </Box>
            <Chip
              icon={<Icon path={getPermissionIcon()} size={0.7} />}
              label={PushNotificationUtils.getPermissionText(permission)}
              color={getPermissionColor() as 'success' | 'error' | 'warning'}
              size="small"
            />
          </Stack>

          {/* 权限状态 */}
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              权限状态
            </Typography>
            <Alert 
              severity={getPermissionColor() as 'success' | 'error' | 'warning'}
              icon={<Icon path={getPermissionIcon()} size={1} />}
            >
              {permission === 'granted' && (
                <>
                  通知权限已授权，您可以接收系统推送通知
                  {isSubscribed && (
                    <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                      订阅状态：已激活 ✓
                    </Typography>
                  )}
                </>
              )}
              {permission === 'denied' && (
                <>
                  通知权限已被拒绝，无法接收推送通知
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                    您可以在浏览器设置中手动启用通知权限
                  </Typography>
                </>
              )}
              {permission === 'default' && (
                <>
                  尚未设置通知权限，点击下方按钮以启用通知
                </>
              )}
            </Alert>
          </Box>

          {/* 通知类型设置 */}
          {(permission === 'granted' || showSettings) && (
            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                通知类型
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiGavel} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary="案件通知"
                    secondary="新案件分配、状态变更等"
                  />
                  <Switch
                    checked={notificationSettings.cases}
                    onChange={(e) => saveSettings({
                      ...notificationSettings,
                      cases: e.target.checked
                    })}
                    disabled={permission !== 'granted'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiAccountGroup} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary="债权通知"
                    secondary="债权申报、审核结果等"
                  />
                  <Switch
                    checked={notificationSettings.claims}
                    onChange={(e) => saveSettings({
                      ...notificationSettings,
                      claims: e.target.checked
                    })}
                    disabled={permission !== 'granted'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiMessage} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary="消息通知"
                    secondary="协作消息、评论回复等"
                  />
                  <Switch
                    checked={notificationSettings.messages}
                    onChange={(e) => saveSettings({
                      ...notificationSettings,
                      messages: e.target.checked
                    })}
                    disabled={permission !== 'granted'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Icon path={mdiMonitor} size={1} />
                  </ListItemIcon>
                  <ListItemText
                    primary="系统通知"
                    secondary="系统维护、更新提醒等"
                  />
                  <Switch
                    checked={notificationSettings.system}
                    onChange={(e) => saveSettings({
                      ...notificationSettings,
                      system: e.target.checked
                    })}
                    disabled={permission !== 'granted'}
                  />
                </ListItem>
              </List>
            </Box>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Stack direction="row" spacing={1}>
            {permission === 'default' && (
              <Button
                variant="contained"
                onClick={requestPermission}
                disabled={isLoading}
                startIcon={<Icon path={mdiBell} size={0.8} />}
              >
                启用通知
              </Button>
            )}
            
            {permission === 'granted' && !isSubscribed && (
              <Button
                variant="contained"
                onClick={subscribeToNotifications}
                disabled={isLoading}
                startIcon={<Icon path={mdiBell} size={0.8} />}
              >
                订阅通知
              </Button>
            )}
            
            {permission === 'granted' && isSubscribed && (
              <Button
                variant="outlined"
                onClick={unsubscribeFromNotifications}
                disabled={isLoading}
                startIcon={<Icon path={mdiBellOff} size={0.8} />}
              >
                取消订阅
              </Button>
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            {isSubscribed && (
              <Button
                size="small"
                onClick={testNotification}
                startIcon={<Icon path={mdiTestTube} size={0.7} />}
              >
                测试通知
              </Button>
            )}
          </Stack>
        </CardActions>
      </Card>
    </Box>
  );
};

export default PushNotificationManager;