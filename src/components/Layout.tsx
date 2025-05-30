import React, { useState, ReactNode, useEffect, useRef } from 'react'; // Added useEffect, useRef
import { NavLink, useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { useAuth, NavItemType } from '@/src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Button,
  Drawer as MuiDrawer,
  IconButton,
  Switch,
  List,
  ListItemButton,
  Menu, // Added Menu
  MenuItem, // Added MenuItem
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  CircularProgress,
  styled,
  Theme as MuiTheme,
  CSSObject,
  alpha, // Added alpha
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  mdiMenu,
  mdiMenuOpen,
  mdiWeatherSunny, // Added icons for theme toggle
  mdiWeatherNight, // Added icons for theme toggle
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
  mdiBriefcaseSearchOutline, // Added for case switcher
} from '@mdi/js';

// Icon map for dynamic menu items
const iconMap: { [key: string]: string } = {
  'mdiViewDashboard': mdiViewDashboard,
  'mdiBriefcase': mdiBriefcase, // This is also used for the case switcher icon for consistency if desired
  'mdiAccountGroup': mdiAccountGroup, // Example icon
  'mdiFileDocumentOutline': mdiFileDocumentOutline, // Example icon
  'mdiChartBar': mdiChartBar, // Example icon
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
const drawerWidthClosed = (theme: MuiTheme) => theme.spacing(7); // MUI default is 7 for closed mini drawer

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
    width: theme.spacing(9), // Slightly wider on sm screens when closed
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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { user, logout, navMenuItems, isMenuLoading, selectedCaseId, userCases, selectCase } = useAuth(); // Added userCases, selectCase
  const navigate = useNavigate();
  const location = useLocation();
  const hasAutoNavigatedRef = useRef(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // State for Menu anchor

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCaseSelect = async (caseId: string) => {
    if (caseId !== selectedCaseId) {
      await selectCase(caseId);
      // Auto-navigation logic in another useEffect will handle redirection if needed
      // Resetting hasAutoNavigatedRef is handled by the selectedCaseId dependency in its own useEffect
    }
    handleClose();
  };

  useEffect(() => {
    hasAutoNavigatedRef.current = false;
  }, [selectedCaseId]);

  useEffect(() => {
    if (!isMenuLoading && navMenuItems && navMenuItems.length > 0 && !hasAutoNavigatedRef.current) {
      const firstItemPath = navMenuItems[0].path;
      // Only navigate if currently at a root/generic path and it's not the target,
      // or if on select-case (though ideally should not happen if menu is loaded).
      // This prevents redirecting if user is already on a valid, specific page.
      if (firstItemPath && (location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/select-case') && location.pathname !== firstItemPath) {
        console.log(`Auto-navigating to first menu item: ${firstItemPath}`);
        navigate(firstItemPath, { replace: true });
        hasAutoNavigatedRef.current = true;
      } else if (firstItemPath && location.pathname === firstItemPath) {
        // If already on the first item path, still mark as navigated to prevent future attempts for this load.
        hasAutoNavigatedRef.current = true;
      }
    }
  }, [isMenuLoading, navMenuItems, location.pathname, navigate, selectedCaseId]);


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Hardcoded navItems is now removed

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1,
          background: `linear-gradient(to right, ${currentTheme.palette.primary}, ${currentTheme.palette.secondary})`, // Using context theme
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ marginRight: 2 }}
          >
            <SvgIcon>
              <path d={drawerOpen ? mdiMenuOpen : mdiMenu} />
            </SvgIcon>
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            CuckooX
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
                color="inherit" // Inherits textPrimary from AppBar's context or explicit color
                sx={{ textTransform: 'none' }}
                startIcon={<SvgIcon><path d={mdiBriefcaseSearchOutline} /></SvgIcon>}
              >
                {selectedCaseId ? userCases.find(c => c.id.toString() === selectedCaseId)?.name : t('select_case_button', 'Select Case')}
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
          {/* End Case Switcher */}

          <IconButton onClick={toggleThemeMode} sx={{ color: currentTheme.palette.common.white }}>
            <SvgIcon>
              <path d={themeMode === 'dark' ? mdiWeatherNight : mdiWeatherSunny} />
            </SvgIcon>
          </IconButton>
          <Switch
            checked={themeMode === 'dark'}
            onChange={toggleThemeMode}
            color="secondary"
          />
          {user && <Typography sx={{ mr: 2, color: currentTheme.palette.common.white }}>{t('layout_header_welcome', { name: user.name })}</Typography>}
        </Toolbar>
      </AppBar>

      <StyledDrawer variant="permanent" open={drawerOpen}>
        <Toolbar /> {/* Necessary to make the content below app bar */}
        <Divider />
        <List sx={{ flexGrow: 1 }}>
          {isMenuLoading ? (
            <ListItemButton sx={{ justifyContent: drawerOpen ? 'initial' : 'center', px: 2.5 }}>
              <ListItemIcon sx={{ minWidth: 0, mr: drawerOpen ? 3 : 'auto', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </ListItemIcon>
              {drawerOpen && <ListItemText primary={t('loading_menu', 'Loading menu...')} />}
            </ListItemButton>
          ) : navMenuItems && navMenuItems.length > 0 ? (
            navMenuItems.map((item: NavItemType) => (
              <ListItemButton
                key={item.id}
                component={NavLink} // Changed to NavLink
                to={item.path}
                end={item.path === '/dashboard' || item.path === '/'} // Added end prop
                sx={{
                  minHeight: 48,
                  justifyContent: drawerOpen ? 'initial' : 'center',
                  px: 2.5,
                  '&.active': {
                    backgroundColor: alpha(currentTheme.palette.primary.main, 0.2),
                    color: currentTheme.palette.primary.main,
                    '& .MuiSvgIcon-root': {
                      color: currentTheme.palette.primary.main,
                    },
                  },
                  '&:hover': {
                    backgroundColor: alpha(currentTheme.palette.primary.main, 0.1),
                  },
                }}
                title={t(item.labelKey)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: drawerOpen ? 3 : 'auto',
                    justifyContent: 'center',
                    // Active state for icon color is handled by parent's sx '&.active .MuiSvgIcon-root'
                  }}
                >
                  {iconMap[item.iconName] ? (
                    <SvgIcon><path d={iconMap[item.iconName]} /></SvgIcon>
                  ) : null}
                </ListItemIcon>
                <ListItemText primary={t(item.labelKey)} sx={{ opacity: drawerOpen ? 1 : 0 }} />
              </ListItemButton>
            ))
          ) : (
            <ListItemButton sx={{ justifyContent: drawerOpen ? 'initial' : 'center', px: 2.5 }}>
              <ListItemText 
                primary={t('no_menu_items', 'No accessible items')} 
                sx={{ opacity: drawerOpen ? 1 : 0 , textAlign: drawerOpen? 'left' : 'center' }} 
              />
            </ListItemButton>
          )}
        </List>
        <Divider />
        {user && drawerOpen && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2">{user.name}</Typography>
            {/* Removed user.role display */}
          </Box>
        )}
        <Box sx={{ p: drawerOpen ? 2 : 0.5, display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={handleLogout}
            variant="contained"
            color="secondary" 
            fullWidth={drawerOpen}
            sx={(theme: MuiTheme) => ({ // Explicitly type theme here
                minWidth: drawerOpen ? 'auto' : theme.spacing(5),
                width: drawerOpen ? 'auto' : theme.spacing(5),
                height: theme.spacing(5),
                p: drawerOpen ? 1 : 0,
            })}
            title={t('layout_logout_button')}
          >
            <ListItemIcon sx={{ 
                justifyContent: 'center', 
                minWidth: 0, 
                color: 'inherit', // Ensure icon inherits button text color
                mr: drawerOpen ? 1 : 0
            }}>
              <SvgIcon>
                <path d={mdiLogout} />
              </SvgIcon>
            </ListItemIcon>
            {drawerOpen && <ListItemText primary={t('layout_logout_button')} sx={{flexGrow: 0}}/>}
          </Button>
        </Box>
      </StyledDrawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: currentTheme.palette.background.default }}>
        <Toolbar /> {/* This is important to offset content below the AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
