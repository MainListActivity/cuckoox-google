import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  IconButton,
  Slide,
  Fade,
  useTheme,
  useMediaQuery,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert
} from '@mui/material';
import {
  mdiClose,
  mdiDownload,
  mdiCellphone,
  mdiTablet,
  mdiMonitor,
  mdiApple,
  mdiGoogle,
  mdiMicrosoftEdge,
  mdiFirefox,
  mdiCheckCircle,
  mdiArrowRight,
  mdiShare,
  mdiPlus,
  mdiMenu,
  mdiRocket,
  mdiOfflinePin,
  mdiBell,
  mdiSpeedometer,
  mdiStar,
  mdiTrendingUp
} from '@mdi/js';
import Icon from '@mdi/react';
import { TransitionProps } from '@mui/material/transitions';
import { 
  mobilePWADetector, 
  DeviceInfo, 
  PWAInstallState, 
  InstallGuidance,
  getDeviceInfo,
  shouldShowInstallPrompt
} from '@/src/utils/mobilePWADetector';
import { pwaManager } from '@/src/utils/pwaUtils';
import { 
  getInstallGuide, 
  BrowserInstallGuide,
  InstallStepDetail,
  getInstallSuccessRate,
  getRecommendedInstallMethod
} from '@/src/utils/pwaInstallGuides';

interface MobilePWAInstallGuideProps {
  open: boolean;
  onClose: () => void;
  autoTrigger?: boolean;
  showBenefits?: boolean;
  compact?: boolean;
}

// 过渡动画组件
const SlideTransition = React.forwardRef<unknown, TransitionProps & { children: React.ReactElement }>(
  function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
  }
);

const MobilePWAInstallGuide: React.FC<MobilePWAInstallGuideProps> = ({
  open,
  onClose,
  autoTrigger = false,
  showBenefits = true,
  compact = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [installState, setInstallState] = useState<PWAInstallState | null>(null);
  const [installGuidance, setInstallGuidance] = useState<InstallGuidance | null>(null);
  const [browserGuide, setBrowserGuide] = useState<BrowserInstallGuide | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [viewStartTime, setViewStartTime] = useState<number>(0);
  const [installSuccessRate, setInstallSuccessRate] = useState<number>(0);
  const [recommendedMethod, setRecommendedMethod] = useState<'native' | 'manual' | 'unsupported'>('unsupported');

  // 初始化数据
  useEffect(() => {
    const device = getDeviceInfo();
    const state = mobilePWADetector.getInstallState();
    const guidance = mobilePWADetector.getInstallGuidance();
    
    // 获取详细的浏览器安装指引
    const detailedGuide = getInstallGuide(
      device.platform,
      device.browser,
      device.isTablet ? 'tablet' : 'phone'
    );
    
    // 获取安装成功率和推荐方法
    const successRate = getInstallSuccessRate(device.platform, device.browser);
    const method = getRecommendedInstallMethod(device.platform, device.browser);

    setDeviceInfo(device);
    setInstallState(state);
    setInstallGuidance(guidance);
    setBrowserGuide(detailedGuide);
    setInstallSuccessRate(successRate);
    setRecommendedMethod(method);

    if (open) {
      setViewStartTime(Date.now());
      mobilePWADetector.markPromptShown();
    }
  }, [open]);

  // 监听安装状态变化
  useEffect(() => {
    const unsubscribe = mobilePWADetector.subscribe((newState) => {
      setInstallState(newState);
      if (newState.isInstalled && !showSuccess) {
        setShowSuccess(true);
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    });

    return unsubscribe;
  }, [onClose, showSuccess]);

  // 获取设备图标
  const getDeviceIcon = useCallback(() => {
    if (!deviceInfo) return mdiCellphone;
    
    switch (deviceInfo.platform) {
      case 'ios':
        return deviceInfo.deviceName === 'iPad' ? mdiTablet : mdiCellphone;
      case 'android':
        return mdiCellphone;
      default:
        return mdiMonitor;
    }
  }, [deviceInfo]);

  // 获取浏览器图标
  const getBrowserIcon = useCallback(() => {
    if (!deviceInfo) return mdiGoogle;
    
    switch (deviceInfo.browser) {
      case 'safari':
        return mdiApple;
      case 'chrome':
        return mdiGoogle;
      case 'edge':
        return mdiMicrosoftEdge;
      case 'firefox':
        return mdiFirefox;
      default:
        return mdiGoogle;
    }
  }, [deviceInfo]);

  // 处理原生安装
  const handleNativeInstall = useCallback(async () => {
    if (!deviceInfo?.supportsNativeInstall) return;

    setIsInstalling(true);
    try {
      const result = await pwaManager.showInstallPrompt();
      if (result) {
        mobilePWADetector.markInstallAccepted();
        setShowSuccess(true);
        // 3秒后自动关闭
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        mobilePWADetector.markInstallDismissed();
      }
    } catch (error) {
      console.error('安装失败:', error);
    } finally {
      setIsInstalling(false);
    }
  }, [deviceInfo, onClose]);

  // 处理手动安装指导
  const handleManualGuide = useCallback(() => {
    // 展开到第一步
    setActiveStep(0);
  }, []);

  // 处理关闭
  const handleClose = useCallback(() => {
    const viewDuration = Date.now() - viewStartTime;
    
    // 记录用户行为（如果观看时间很短，可能是误触）
    if (viewDuration < 3000) {
      // 观看时间少于3秒，可能是误触
      mobilePWADetector.markInstallDismissed();
    } else if (viewDuration > 10000) {
      // 观看时间超过10秒，说明用户有兴趣
      const currentState = mobilePWADetector.getInstallState();
      if (currentState.userInteractionLevel === 'viewed') {
        // 提升交互级别
        currentState.userInteractionLevel = 'engaged';
      }
    }
    
    onClose();
  }, [onClose, viewStartTime]);

  // 获取安装优势列表
  const getInstallBenefits = useCallback(() => {
    const benefits = [
      {
        icon: mdiRocket,
        title: '启动更快',
        description: '比网页版快3倍的启动速度'
      },
      {
        icon: mdiOfflinePin,
        title: '离线使用',
        description: '无网络时也能查看缓存数据'
      },
      {
        icon: mdiBell,
        title: '推送通知',
        description: '及时接收重要案件提醒'
      },
      {
        icon: mdiSpeedometer,
        title: '性能优化',
        description: '专为移动设备优化的流畅体验'
      }
    ];

    return benefits;
  }, []);

  // 渲染安装步骤
  const renderInstallSteps = () => {
    // 优先使用详细的浏览器指引
    const stepsToRender = browserGuide?.steps || installGuidance?.steps;
    if (!stepsToRender) return null;

    return (
      <Stepper 
        activeStep={activeStep} 
        orientation="vertical"
        sx={{ mt: 2 }}
      >
        {stepsToRender.map((step, index) => {
          // 处理不同类型的步骤数据
          const stepData = 'id' in step ? step as InstallStepDetail : {
            id: `step-${index}`,
            title: step.title,
            description: step.description,
            detailedDescription: step.description,
            icon: step.icon || 'help',
            imageUrl: (step as any).image,
            imageAlt: step.title,
            isInteractive: (step as any).isInteractive || false,
            commonMistakes: [],
            alternativeMethod: (step as any).alternativeMethod
          } as InstallStepDetail;

          return (
            <Step key={stepData.id}>
              <StepLabel
                onClick={() => setActiveStep(index)}
                sx={{ cursor: 'pointer' }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {stepData.title}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ py: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {stepData.description}
                  </Typography>
                  
                  {/* 详细描述 */}
                  {stepData.detailedDescription && stepData.detailedDescription !== stepData.description && (
                    <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                      {stepData.detailedDescription}
                    </Typography>
                  )}
                  
                  {/* 步骤图片 */}
                  {stepData.imageUrl && (
                    <Box
                      component="img"
                      src={stepData.imageUrl}
                      alt={stepData.imageAlt || stepData.title}
                      sx={{
                        width: '100%',
                        maxWidth: 250,
                        height: 'auto',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        mb: 1,
                        bgcolor: 'grey.50'
                      }}
                      onError={(e) => {
                        // 图片加载失败时隐藏
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  
                  {/* 交互式步骤提示 */}
                  {stepData.isInteractive && (
                    <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                      <Typography variant="body2">
                        请按照上述说明操作您的{deviceInfo?.deviceName || '设备'}
                        {stepData.expectedText && (
                          <>，查找"{stepData.expectedText}"</>
                        )}
                      </Typography>
                    </Alert>
                  )}

                  {/* 常见错误提示 */}
                  {stepData.commonMistakes && stepData.commonMistakes.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        ⚠️ 避免这些常见错误：
                      </Typography>
                      {stepData.commonMistakes.map((mistake, mistakeIndex) => (
                        <Typography key={mistakeIndex} variant="body2" sx={{ mb: 0.5 }}>
                          • {mistake}
                        </Typography>
                      ))}
                    </Alert>
                  )}

                  {/* 替代方法 */}
                  {stepData.alternativeMethod && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        💡 替代方法：
                      </Typography>
                      <Typography variant="body2">
                        {stepData.alternativeMethod}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </StepContent>
            </Step>
          )
        })}
      </Stepper>
    );
  };

  // 渲染设备信息卡片
  const renderDeviceInfo = () => {
    if (!deviceInfo || compact) return null;

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <Icon path={getDeviceIcon()} size={1} color="white" />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {deviceInfo.deviceName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Icon path={getBrowserIcon()} size={0.7} />
                <Typography variant="body2" color="text.secondary">
                  {deviceInfo.browser} {deviceInfo.browserVersion}
                </Typography>
                {deviceInfo.supportsNativeInstall && (
                  <Chip 
                    label="支持一键安装" 
                    size="small" 
                    color="success"
                    variant="outlined"
                  />
                )}
              </Box>
              {/* 安装成功率显示 */}
              {installSuccessRate > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Icon path={mdiTrendingUp} size={0.6} color={theme.palette.success.main} />
                  <Typography variant="caption" color="success.main">
                    安装成功率: {Math.round(installSuccessRate * 100)}%
                  </Typography>
                  {recommendedMethod === 'native' && (
                    <Chip 
                      label="推荐" 
                      size="small" 
                      color="primary"
                      variant="filled"
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // 渲染安装优势
  const renderBenefits = () => {
    if (!showBenefits || compact) return null;

    const benefits = getInstallBenefits();

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon path={mdiStar} size={1} color={theme.palette.primary.main} />
          安装后的优势
        </Typography>
        <List dense>
          {benefits.map((benefit, index) => (
            <ListItem key={index} sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon 
                  path={benefit.icon} 
                  size={0.8} 
                  color={theme.palette.primary.main} 
                />
              </ListItemIcon>
              <ListItemText
                primary={benefit.title}
                secondary={benefit.description}
                primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600 }}
                secondaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  // 渲染成功状态
  const renderSuccessState = () => (
    <Fade in={showSuccess}>
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Avatar 
          sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'success.main', 
            mx: 'auto', 
            mb: 2 
          }}
        >
          <Icon path={mdiCheckCircle} size={2} color="white" />
        </Avatar>
        <Typography variant="h6" sx={{ mb: 1, color: 'success.main' }}>
          安装成功！
        </Typography>
        <Typography variant="body2" color="text.secondary">
          CuckooX 已添加到您的设备，现在可以像原生应用一样使用了。
        </Typography>
      </Box>
    </Fade>
  );

  // 如果已安装或不应该显示，不渲染组件
  if (installState?.isInstalled || (autoTrigger && !shouldShowInstallPrompt())) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isSmallScreen}
      TransitionComponent={SlideTransition}
      PaperProps={{
        sx: {
          borderRadius: isSmallScreen ? 0 : 2,
          maxHeight: isSmallScreen ? '100vh' : '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon path={mdiDownload} size={1} color={theme.palette.primary.main} />
          <Typography variant="h6" component="div">
            {installGuidance?.title || '安装应用'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Icon path={mdiClose} size={0.8} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {showSuccess ? renderSuccessState() : (
          <>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {installGuidance?.description || '将CuckooX安装到您的设备，享受更好的使用体验'}
            </Typography>

            {renderDeviceInfo()}
            {renderBenefits()}

            {/* 浏览器警告信息 */}
            {(installGuidance?.warnings || browserGuide?.warnings) && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  ⚠️ 重要提示
                </Typography>
                {(browserGuide?.warnings || installGuidance?.warnings || []).map((warning, index) => (
                  <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                    • {warning}
                  </Typography>
                ))}
              </Alert>
            )}

            {/* 原生安装按钮 */}
            {deviceInfo?.supportsNativeInstall && pwaManager.canInstall() && (
              <Card 
                variant="outlined" 
                sx={{ 
                  mb: 2, 
                  border: '2px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50'
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    🚀 一键安装
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    您的浏览器支持直接安装，点击下方按钮即可完成
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleNativeInstall}
                    disabled={isInstalling}
                    startIcon={<Icon path={mdiDownload} size={0.8} />}
                    sx={{ minWidth: 140 }}
                  >
                    {isInstalling ? '安装中...' : '立即安装'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 手动安装指导 */}
            {(!deviceInfo?.supportsNativeInstall || !pwaManager.canInstall()) && (
              <Box>
                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    安装步骤
                  </Typography>
                </Divider>
                {renderInstallSteps()}
              </Box>
            )}

            {/* 提示信息 */}
            {(installGuidance?.tips || browserGuide?.tips) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  💡 小提示
                </Typography>
                {(browserGuide?.tips || installGuidance?.tips || []).map((tip, index) => (
                  <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                    • {tip}
                  </Typography>
                ))}
              </Alert>
            )}

            {/* 故障排除信息 */}
            {browserGuide?.troubleshooting && browserGuide.troubleshooting.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  🔧 遇到问题？
                </Typography>
                {browserGuide.troubleshooting
                  .sort((a, b) => a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0)
                  .slice(0, 3) // 只显示前3个最重要的问题
                  .map((item, index) => (
                    <Box key={index} sx={{ mb: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        问题: {item.problem}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        解决: {item.solution}
                      </Typography>
                    </Box>
                  ))}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      {!showSuccess && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit">
            稍后安装
          </Button>
          {!deviceInfo?.supportsNativeInstall && (
            <Button 
              onClick={handleManualGuide}
              variant="outlined"
              startIcon={<Icon path={mdiArrowRight} size={0.7} />}
            >
              查看步骤
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default MobilePWAInstallGuide;