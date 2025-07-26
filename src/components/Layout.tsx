import React, { useState, ReactNode, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, NavItemType } from '@/src/contexts/AuthContext';
import { useLayout } from '@/src/contexts/LayoutContext';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Button,
  Drawer as MuiDrawer,
  SwipeableDrawer,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  CircularProgress,
  styled,
  Theme as MuiTheme,
  CSSObject,
  alpha,
  useMediaQuery,
  useTheme as useMuiTheme,
  Tooltip,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  mdiMenu,
  mdiWeatherSunny,
  mdiWeatherNight,
  mdiViewDashboard,
  mdiBriefcase,
  mdiAccountGroup,
  mdiFileDocumentOutline,
  mdiChartBar,
  mdiVideo,
  mdiMessageTextOutline,
  mdiCog,
  mdiLogout,
  mdiTextBoxMultipleOutline,
  mdiFileUploadOutline,
  mdiBriefcaseSearchOutline,
  mdiChevronLeft,
  mdiAccount,
} from '@mdi/js';
import Logo from './Logo';
import { RecordId } from 'surrealdb';
import MobilePWAManager from './mobile/MobilePWAManager';

// Icon map for dynamic menu items
const iconMap: { [key: string]: string } = {
  'mdiViewDashboard': mdiViewDashboard,
  'mdiBriefcase': mdiBriefcase,
  'mdiAccountGroup': mdiAccountGroup,
  'mdiFileDocumentOutline': mdiFileDocumentOutline,
  'mdiChartBar': mdiChartBar,
  'mdiVideo': mdiVideo,
  'mdiMessageTextOutline': mdiMessageTextOutline,
  'mdiCog': mdiCog,
  'mdiFileDocumentSearchOutline': mdiTextBoxMultipleOutline,
  'mdiFileUploadOutline': mdiFileUploadOutline,
};

interface LayoutProps {
  children: ReactNode;
}

const drawerWidthOpen = 240;
const drawerWidthMobile = 200;
const drawerWidthClosed = (theme: MuiTheme) => theme.spacing(7);

const openedMixin = (theme: MuiTheme): CSSObject => ({
  width: drawerWidthOpen,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  backgroundColor: theme.palette.primary.dark,
  color: theme.palette.primary.contrastText,
  height: '100vh',
});

const closedMixin = (theme: MuiTheme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: drawerWidthClosed(theme),
  backgroundColor: theme.palette.primary.dark,
  color: theme.palette.primary.contrastText,
  height: '100vh',
  [theme.breakpoints.up('sm')]: {
    width: theme.spacing(9),
  },
});

const StyledDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidthOpen,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': {
        ...openedMixin(theme),
        width: '100%',
      },
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': {
        ...closedMixin(theme),
        width: '100%',
      },
    }),
  }),
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const { themeMode, toggleThemeMode, muiTheme:currentTheme } = muiTheme;
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isMenuCollapsed, toggleMenu, isDocumentCenterMode, isTemporaryMenuOpen } = useLayout();
  const [drawerOpen, setDrawerOpen] = useState(!isMobile && !isMenuCollapsed);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { logout, navMenuItems, isMenuLoading, selectedCaseId, userCases, selectCase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoNavigatedRef = useRef(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);

  // 计算当前抽屉宽度
  const currentDrawerWidth = isMobile 
    ? 0 // 移动设备上抽屉是临时的，不占用主布局空间
    : (drawerOpen ? drawerWidthOpen : theme.spacing(9));

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  const handleCaseSelect = async (caseId: RecordId) => {
    if (caseId !== selectedCaseId) {
      await selectCase(caseId);
    }
    handleClose();
  };

  useEffect(() => {
    hasAutoNavigatedRef.current = false;
  }, [selectedCaseId]);

  useEffect(() => {
    if (!isMenuLoading && navMenuItems && navMenuItems.length > 0 && !hasAutoNavigatedRef.current) {
      const firstItemPath = navMenuItems[0].path;
      if (firstItemPath && (location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/select-case') && location.pathname !== firstItemPath) {
        console.log(`Auto-navigating to first menu item: ${firstItemPath}`);
        navigate(firstItemPath, { replace: true });
        hasAutoNavigatedRef.current = true;
      } else if (firstItemPath && location.pathname === firstItemPath) {
        hasAutoNavigatedRef.current = true;
      }
    }
  }, [isMenuLoading, navMenuItems, location.pathname, navigate, selectedCaseId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileDrawerOpen(!mobileDrawerOpen);
    } else {
      toggleMenu(); // 使用Layout context的方法
    }
  };

  const handleMobileDrawerClose = () => {
    setMobileDrawerOpen(false);
  };

  const handleMobileDrawerOpen = () => {
    setMobileDrawerOpen(true);
  };

  // Update drawer state when screen size changes or layout context changes
  useEffect(() => {
    if (isDocumentCenterMode) {
      // 在文档中心模式下，根据临时菜单状态决定抽屉开关
      setDrawerOpen(!isMobile && isTemporaryMenuOpen);
    } else {
      // 在普通模式下，根据菜单折叠状态决定抽屉开关
      setDrawerOpen(!isMobile && !isMenuCollapsed);
    }
  }, [isMobile, isMenuCollapsed, isDocumentCenterMode, isTemporaryMenuOpen]);

  // 在文档中心模式下，点击菜单外区域时关闭临时菜单
  useEffect(() => {
    if (isDocumentCenterMode && isTemporaryMenuOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (!target.closest('[data-drawer-content]') && !target.closest('[data-menu-button]')) {
          toggleMenu(); // 关闭临时菜单
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isDocumentCenterMode, isTemporaryMenuOpen, toggleMenu]);

  // Drawer content component to reuse for both desktop and mobile
  const DrawerContent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ 
        minHeight: { xs: 56, sm: 64 },
        px: 2,
        justifyContent: 'start',
      }}>
        <Logo 
          size="small" 
          variant="icon" 
          color="white"
        />
        <Typography variant="h6" noWrap sx={{ color: 'white', ml: 1 }}>
          CuckooX
        </Typography>
        {isMobile && (
          <IconButton
            color="inherit"
            aria-label="close drawer"
            edge="end"
            onClick={handleMobileDrawerClose}
            sx={{ color: 'white' }}
          >
            <SvgIcon><path d={mdiChevronLeft} /></SvgIcon>
          </IconButton>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
      <List sx={{ flex: 1, px: 1, overflowY: 'auto',overflowX: 'hidden' }}>
        {isMenuLoading ? (
          <ListItemButton sx={{ justifyContent: 'center', px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: drawerOpen || isMobile ? 3 : 'auto', justifyContent: 'center', color: 'white' }}>
              <CircularProgress size={24} color="inherit" />
            </ListItemIcon>
            {(drawerOpen || isMobile) && <ListItemText primary={t('loading_menu', 'Loading menu...')} sx={{ color: 'white' }} />}
          </ListItemButton>
        ) : navMenuItems && navMenuItems.length > 0 ? (
          navMenuItems.map((item: NavItemType) => (
            <ListItemButton
              key={item.id}
              component={NavLink}
              to={item.path}
              end={item.path === '/dashboard' || item.path === '/'}
              onClick={isMobile ? handleMobileDrawerClose : undefined}
              sx={{
                mb: 0.5,
                minHeight: 48,
                borderRadius: 1,
                justifyContent: drawerOpen || isMobile ? 'initial' : 'center',
                px: 2.5,
                color: 'white',
                '&.active': {
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.24)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
              title={t(item.labelKey)}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  mr: drawerOpen || isMobile ? 3 : 'auto',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                {iconMap[item.iconName] ? (
                  <SvgIcon><path d={iconMap[item.iconName]} /></SvgIcon>
                ) : null}
              </ListItemIcon>
              <ListItemText 
                primary={t(item.labelKey)} 
                sx={{ opacity: drawerOpen || isMobile ? 1 : 0 }}
                primaryTypographyProps={{
                  fontSize: isMobile ? '0.875rem' : '1rem',
                }}
              />
            </ListItemButton>
          ))
        ) : (
          <ListItemButton sx={{ justifyContent: drawerOpen || isMobile ? 'initial' : 'center', px: 2.5, color: 'white' }}>
            <ListItemText 
              primary={t('no_menu_items', 'No accessible items')} 
              sx={{ opacity: drawerOpen || isMobile ? 1 : 0 , textAlign: drawerOpen || isMobile ? 'left' : 'center' }} 
            />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      overflow: 'hidden',
      width: '100vw', // 添加视口宽度限制
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1,
          width: isDocumentCenterMode ? '100%' : {
            xs: '100%',
            sm: `calc(100% - ${currentDrawerWidth}px)`
          },
          ml: isDocumentCenterMode ? 0 : {
            xs: 0,
            sm: currentDrawerWidth
          },
          backgroundColor: currentTheme.palette.background.default,
          color: currentTheme.palette.text.primary,
          borderBottom: `1px solid ${alpha(currentTheme.palette.divider, 0.1)}`,
          height: 64, // 固定工具栏高度
        }}
      >
        <Toolbar sx={{ 
          px: { xs: 1, sm: 3 },
          minHeight: '64px !important', // 确保工具栏高度
        }}>
          <IconButton
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            data-menu-button // 添加标识符用于点击外部检测
            sx={{ 
              mr: 2,
              display: { xs: 'block', sm: isDocumentCenterMode ? 'block' : 'none' },
              color: currentTheme.palette.text.primary,
            }}
          >
            <SvgIcon>
              <path d={mdiMenu} />
            </SvgIcon>
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
            }}
          >
            {/* 动态显示当前页面标题 */}
          </Typography>

          {/* Case Switcher Button and Menu */}
          {userCases && userCases.length > 0 && (
            <>
              <Button
                id="case-switcher-button"
                aria-controls={anchorEl ? 'case-switcher-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={anchorEl ? 'true' : undefined}
                onClick={userCases.length > 1 ? handleClick : undefined}
                color="inherit"
                disabled={userCases.length === 1}
                sx={{ 
                  textTransform: 'none',
                  minWidth: { xs: 'auto', sm: 'auto' },
                  px: { xs: 1, sm: 2 },
                  cursor: userCases.length === 1 ? 'default' : 'pointer',
                  maxWidth: { xs: 120, sm: 200 },
                  '&.Mui-disabled': {
                    color: 'inherit',
                    opacity: 0.8,
                  }
                }}
                startIcon={<SvgIcon><path d={mdiBriefcaseSearchOutline} /></SvgIcon>}
              >
                <Box sx={{ 
                  display: { xs: 'none', sm: 'block' },
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}>
                  {selectedCaseId ? userCases.find(c => c.id === selectedCaseId)?.name : t('select_case_button', '选择案件')}
                </Box>
              </Button>
              {userCases.length > 1 && (
                <Menu
                  id="case-switcher-menu"
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  MenuListProps={{ 'aria-labelledby': 'case-switcher-button' }}
                  PaperProps={{
                    sx: {
                      maxWidth: 300,
                      minWidth: 200,
                    }
                  }}
                >
                  {userCases.map((caseItem) => (
                    <MenuItem
                      key={caseItem.id.toString()}
                      selected={caseItem.id === selectedCaseId}
                      onClick={() => handleCaseSelect(caseItem.id)}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        minHeight: 48,
                        py: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {caseItem.name || caseItem.case_number || caseItem.id.toString()}
                      </Typography>
                      {caseItem.case_number && caseItem.name && (
                        <Typography variant="caption" color="text.secondary">
                          {caseItem.case_number}
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </>
          )}

          {/* Theme Toggle */}
          <Tooltip title="切换主题">
            <IconButton onClick={toggleThemeMode} color="inherit">
              <SvgIcon>
                <path d={themeMode === 'dark' ? mdiWeatherSunny : mdiWeatherNight} />
              </SvgIcon>
            </IconButton>
          </Tooltip>
          
          {/* User Menu */}
          <Tooltip title="用户菜单">
            <IconButton
              onClick={handleProfileMenuOpen}
              color="inherit"
              sx={{ ml: 1 }}
            >
              <SvgIcon><path d={mdiAccount} /></SvgIcon>
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={profileAnchorEl}
            open={Boolean(profileAnchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <SvgIcon fontSize="small"><path d={mdiAccount} /></SvgIcon>
              </ListItemIcon>
              个人信息
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <SvgIcon fontSize="small"><path d={mdiLogout} /></SvgIcon>
              </ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop Drawer - 在文档中心模式下支持临时展开 */}
      {!isMobile && (
        <StyledDrawer 
          variant="permanent" 
          open={drawerOpen}
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            display: isDocumentCenterMode && !isTemporaryMenuOpen ? 'none' : 'block', // 文档模式下完全隐藏，除非临时展开
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              backgroundColor: theme.palette.primary.dark,
              color: theme.palette.primary.contrastText,
              borderRight: 'none',
              overflowX: 'hidden',
              height: '100vh',
              zIndex: isDocumentCenterMode ? 1300 : 1200, // 文档模式下提高层级
            }
          }}
        >
          <div data-drawer-content> {/* 添加标识符用于点击外部检测 */}
            <DrawerContent />
          </div>
        </StyledDrawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <SwipeableDrawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={handleMobileDrawerClose}
          onOpen={handleMobileDrawerOpen}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidthMobile,
              backgroundColor: theme.palette.primary.dark,
              color: theme.palette.primary.contrastText,
              borderRight: 'none',
              height: '100vh',
              zIndex: 1200,
            },
            '& .MuiBackdrop-root': {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }
          }}
        >
          <DrawerContent />
        </SwipeableDrawer>
      )}

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          backgroundColor: currentTheme.palette.background.default,
          p: isDocumentCenterMode ? 0 : { xs: 2, sm: 3 },
          width: isDocumentCenterMode ? '100vw' : {
            xs: '100%',
            sm: `calc(100% - ${currentDrawerWidth}px)`
          },
          ml: isDocumentCenterMode ? 0 : 0,
          mt: 8, // 64px工具栏高度
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </Box>
      
      {/* 移动端PWA安装管理器 */}
      <MobilePWAManager
        showBanner={true}
        bannerDelay={8000}
        bannerPosition="bottom"
        bannerCompact={false}
        bannerAutoHide={15000}
        showGuideOnBannerClick={true}
        triggerOnPageView={true}
        triggerOnUserEngagement={true}
        triggerOnSpecificPages={['/dashboard', '/cases', '/claims']}
        respectUserPreference={true}
        enableAnalytics={true}
      />
    </Box>
  );
};

export default Layout;
