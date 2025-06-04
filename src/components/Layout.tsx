import React, { useState, ReactNode, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, NavItemType } from '@/src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Button,
  Drawer as MuiDrawer,
  SwipeableDrawer,
  IconButton,
  Switch,
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
  Avatar,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  mdiMenu,
  mdiMenuOpen,
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
  mdiClose,
  mdiChevronLeft,
  mdiAccount,
} from '@mdi/js';

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
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { user, logout, navMenuItems, isMenuLoading, selectedCaseId, userCases, selectCase } = useAuth();
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

  const handleCaseSelect = async (caseId: string) => {
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
      setDrawerOpen(!drawerOpen);
    }
  };

  const handleMobileDrawerClose = () => {
    setMobileDrawerOpen(false);
  };

  const handleMobileDrawerOpen = () => {
    setMobileDrawerOpen(true);
  };

  // Update drawer state when screen size changes
  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  // Drawer content component to reuse for both desktop and mobile
  const DrawerContent = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ 
        minHeight: { xs: 56, sm: 64 },
        px: 2,
        justifyContent: 'space-between',
      }}>
        <Typography variant="h6" noWrap sx={{ color: 'white' }}>
          破产管理系统
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
      <List sx={{ flex: 1, px: 1, overflowY: 'auto' }}>
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
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1,
          width: { 
            xs: '100%',
            sm: `calc(100% - ${currentDrawerWidth}px)`
          },
          ml: { 
            xs: 0,
            sm: currentDrawerWidth
          },
          backgroundColor: currentTheme.palette.background.default,
          color: currentTheme.palette.text.primary,
          borderBottom: `1px solid ${alpha(currentTheme.palette.divider, 0.1)}`,
        }}
      >
        <Toolbar sx={{ px: { xs: 1, sm: 3 } }}>
          <IconButton
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ 
              mr: 2,
              display: { sm: 'none' },
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
          {userCases && userCases.length > 1 && (
            <>
              <Button
                id="case-switcher-button"
                aria-controls={anchorEl ? 'case-switcher-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={anchorEl ? 'true' : undefined}
                onClick={handleClick}
                color="inherit"
                sx={{ 
                  textTransform: 'none',
                  minWidth: { xs: 'auto', sm: 'auto' },
                  px: { xs: 1, sm: 2 },
                }}
                startIcon={<SvgIcon><path d={mdiBriefcaseSearchOutline} /></SvgIcon>}
              >
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {selectedCaseId ? userCases.find(c => c.id.toString() === selectedCaseId)?.name : t('select_case_button', 'Select Case')}
                </Box>
              </Button>
              <Menu
                id="case-switcher-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                MenuListProps={{ 'aria-labelledby': 'case-switcher-button' }}
              >
                {userCases.map((caseItem) => (
                  <MenuItem
                    key={caseItem.id.toString()}
                    selected={caseItem.id.toString() === selectedCaseId}
                    onClick={() => handleCaseSelect(caseItem.id.toString())}
                  >
                    {caseItem.name || caseItem.case_number || caseItem.id.toString()}
                  </MenuItem>
                ))}
              </Menu>
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

      {/* Desktop Drawer */}
      {!isMobile && (
        <StyledDrawer 
          variant="permanent" 
          open={drawerOpen}
          sx={{
            width: currentDrawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              backgroundColor: theme.palette.primary.dark,
              color: theme.palette.primary.contrastText,
              borderRight: 'none',
              overflowX: 'hidden',
              height: '100vh',
            }
          }}
        >
          <DrawerContent />
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
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidthMobile,
              backgroundColor: theme.palette.primary.dark,
              color: theme.palette.primary.contrastText,
              borderRight: 'none',
              height: '100vh',
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
          minHeight: '100vh',
          p: { xs: 2, sm: 3 },
          width: { 
            xs: '100%',
            sm: `calc(100% - ${currentDrawerWidth}px)`
          },
          mt: { xs: 7, sm: 8 },
          overflowX: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
