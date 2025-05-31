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
const drawerWidthClosed = (theme: MuiTheme) => theme.spacing(7);

const openedMixin = (theme: MuiTheme): CSSObject => ({
  width: drawerWidthOpen,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: MuiTheme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: drawerWidthClosed(theme),
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
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const { themeMode, toggleThemeMode, muiTheme:currentTheme } = muiTheme;
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { user, logout, navMenuItems, isMenuLoading, selectedCaseId, userCases, selectCase } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoNavigatedRef = useRef(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
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
    <>
      {isMobile && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          backgroundColor: alpha(currentTheme.palette.primary.main, 0.1),
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            CuckooX
          </Typography>
          <IconButton onClick={handleMobileDrawerClose}>
            <SvgIcon><path d={mdiClose} /></SvgIcon>
          </IconButton>
        </Box>
      )}
      {!isMobile && <Toolbar />}
      <Divider sx={{ borderColor: alpha(currentTheme.palette.primary.main, 0.2) }} />
      <List sx={{ flexGrow: 1 }}>
        {isMenuLoading ? (
          <ListItemButton sx={{ justifyContent: drawerOpen || isMobile ? 'initial' : 'center', px: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: drawerOpen || isMobile ? 3 : 'auto', justifyContent: 'center' }}>
              <CircularProgress size={24} />
            </ListItemIcon>
            {(drawerOpen || isMobile) && <ListItemText primary={t('loading_menu', 'Loading menu...')} />}
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
                minHeight: 48,
                justifyContent: drawerOpen || isMobile ? 'initial' : 'center',
                px: 2.5,
                '&.active': {
                  backgroundColor: alpha(currentTheme.palette.primary.main, 0.3),
                  color: currentTheme.palette.primary.main,
                  borderLeft: `4px solid ${currentTheme.palette.primary.main}`,
                  '& .MuiSvgIcon-root': {
                    color: currentTheme.palette.primary.main,
                  },
                },
                '&:hover': {
                  backgroundColor: alpha(currentTheme.palette.primary.main, 0.15),
                },
              }}
              title={t(item.labelKey)}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: drawerOpen || isMobile ? 3 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {iconMap[item.iconName] ? (
                  <SvgIcon><path d={iconMap[item.iconName]} /></SvgIcon>
                ) : null}
              </ListItemIcon>
              <ListItemText primary={t(item.labelKey)} sx={{ opacity: drawerOpen || isMobile ? 1 : 0 }} />
            </ListItemButton>
          ))
        ) : (
          <ListItemButton sx={{ justifyContent: drawerOpen || isMobile ? 'initial' : 'center', px: 2.5 }}>
            <ListItemText 
              primary={t('no_menu_items', 'No accessible items')} 
              sx={{ opacity: drawerOpen || isMobile ? 1 : 0 , textAlign: drawerOpen || isMobile ? 'left' : 'center' }} 
            />
          </ListItemButton>
        )}
      </List>
      <Divider sx={{ borderColor: alpha(currentTheme.palette.primary.main, 0.2) }} />
      {user && (drawerOpen || isMobile) && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: currentTheme.palette.text.secondary }}>
            {user.name}
          </Typography>
        </Box>
      )}
      <Box sx={{ p: drawerOpen || isMobile ? 2 : 0.5, display: 'flex', justifyContent: 'center' }}>
        <Button
          onClick={handleLogout}
          variant="contained"
          color="primary"
          fullWidth={drawerOpen || isMobile}
          sx={(theme: MuiTheme) => ({
              minWidth: drawerOpen || isMobile ? 'auto' : theme.spacing(5),
              width: drawerOpen || isMobile ? 'auto' : theme.spacing(5),
              height: theme.spacing(5),
              p: drawerOpen || isMobile ? 1 : 0,
          })}
          title={t('layout_logout_button')}
        >
          <ListItemIcon sx={{ 
              justifyContent: 'center', 
              minWidth: 0, 
              color: 'inherit',
              mr: drawerOpen || isMobile ? 1 : 0
          }}>
            <SvgIcon>
              <path d={mdiLogout} />
            </SvgIcon>
          </ListItemIcon>
          {(drawerOpen || isMobile) && <ListItemText primary={t('layout_logout_button')} sx={{flexGrow: 0}}/>}
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1,
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
              marginRight: 2,
              color: currentTheme.palette.text.primary,
            }}
          >
            <SvgIcon>
              <path d={isMobile ? mdiMenu : (drawerOpen ? mdiMenuOpen : mdiMenu)} />
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
            CuckooX
          </Typography>

          {/* Case Switcher Button and Menu - Hide text on mobile */}
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

          {/* Theme Toggle - Show icon only on mobile */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              onClick={toggleThemeMode} 
              sx={{ 
                color: currentTheme.palette.text.primary,
                display: { xs: 'inline-flex', sm: 'none' },
              }}
            >
              <SvgIcon>
                <path d={themeMode === 'dark' ? mdiWeatherNight : mdiWeatherSunny} />
              </SvgIcon>
            </IconButton>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <IconButton onClick={toggleThemeMode} sx={{ color: currentTheme.palette.text.primary }}>
                <SvgIcon>
                  <path d={themeMode === 'dark' ? mdiWeatherNight : mdiWeatherSunny} />
                </SvgIcon>
              </IconButton>
              <Switch
                checked={themeMode === 'dark'}
                onChange={toggleThemeMode}
                color="secondary"
              />
            </Box>
          </Box>
          
          {/* User welcome - Hide on mobile */}
          {user && (
            <Typography 
              sx={{ 
                mr: 2, 
                color: currentTheme.palette.text.primary,
                display: { xs: 'none', md: 'block' },
              }}
            >
              {t('layout_header_welcome', { name: user.name })}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {/* Desktop Drawer */}
      {!isMobile && (
        <StyledDrawer 
          variant="permanent" 
          open={drawerOpen}
          sx={{
            '& .MuiDrawer-paper': {
              backgroundColor: themeMode === 'dark' 
                ? alpha(currentTheme.palette.primary.dark, 0.15)
                : alpha(currentTheme.palette.primary.light, 0.08),
              borderRight: `1px solid ${alpha(currentTheme.palette.primary.main, 0.2)}`,
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
              width: drawerWidthOpen,
              backgroundColor: currentTheme.palette.background.paper,
              borderRight: `1px solid ${alpha(currentTheme.palette.primary.main, 0.2)}`,
            },
            '& .MuiBackdrop-root': {
              backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色背景
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
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        <Box sx={{ 
          flexGrow: 1, 
          p: { xs: 2, sm: 3 },
          overflow: 'auto',
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
