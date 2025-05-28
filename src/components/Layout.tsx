import React, { useState, ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth, NavItemType } from '../contexts/AuthContext'; // Import NavItemType
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Button,
  Drawer as MuiDrawer,
  IconButton,
  Switch, // Added Switch
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  CircularProgress, // Added for loading indicator
  styled,
  Theme as MuiTheme,
  CSSObject,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from '../contexts/ThemeContext';
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
  // mdiFileDocumentSearchOutline, // Added
  mdiFileUploadOutline, // Added
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
  // 'mdiFileDocumentSearchOutline': mdiFileDocumentSearchOutline,
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
  const { user, logout, navMenuItems, isMenuLoading } = useAuth(); // Get menu items and loading state
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Hardcoded navItems is now removed

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ // Pass theme to sx to access palette
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1, // Explicitly type theme here
          // background: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`, // Using context theme
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
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
          <IconButton onClick={toggleThemeMode} color="inherit">
            <SvgIcon>
              <path d={themeMode === 'dark' ? mdiWeatherNight : mdiWeatherSunny} />
            </SvgIcon>
          </IconButton>
          <Switch
            checked={themeMode === 'dark'}
            onChange={toggleThemeMode}
            color="secondary" // Or any color that fits your theme
          />
          {user && <Typography sx={{ mr: 2 }}>{t('layout_header_welcome', { name: user.name })}</Typography>}
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
                component={RouterLink}
                to={item.path}
                sx={{
                  minHeight: 48,
                  justifyContent: drawerOpen ? 'initial' : 'center',
                  px: 2.5,
                }}
                title={t(item.labelKey)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: drawerOpen ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {iconMap[item.iconName] ? (
                    <SvgIcon><path d={iconMap[item.iconName]} /></SvgIcon>
                  ) : null} {/* Render nothing if icon not found, or a default icon */}
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

      <Box component="main" sx={{ flexGrow: 1, p: 3, }}>
        <Toolbar /> {/* This is important to offset content below the AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;