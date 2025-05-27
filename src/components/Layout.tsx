import React, { useState, ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  // useTheme as useMuiTheme, // Renamed to avoid conflict with our useTheme
  styled,
  Theme as MuiTheme, // Renamed Mui Theme to avoid conflict
  CSSObject,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from '../contexts/ThemeContext'; // Import our useTheme
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
} from '@mdi/js';

interface LayoutProps {
  children: ReactNode;
}

const drawerWidthOpen = 240; // theme.spacing(28) would be 224, using 240 for a bit more space
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
  const muiTheme = useTheme(); // This is now our custom theme context
  const { mode, toggleMode, currentTheme } = muiTheme; // Destructure mode and toggleMode
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: t('nav_dashboard'), icon: mdiViewDashboard, mdi: true },
    { path: '/cases', label: t('nav_case_management'), icon: mdiBriefcase, mdi: true },
    { path: '/creditors', label: t('nav_creditor_management'), icon: mdiAccountGroup, mdi: true },
    { path: '/claims', label: t('nav_claim_management'), icon: mdiFileDocumentOutline, mdi: true },
    { path: '/claim-dashboard', label: t('nav_claim_dashboard'), icon: mdiChartBar, mdi: true },
    { path: '/online-meetings', label: t('nav_online_meetings'), icon: mdiVideo, mdi: true },
    { path: '/messages', label: t('nav_message_center'), icon: mdiMessageTextOutline, mdi: true },
    { path: '/admin', label: t('nav_system_management'), icon: mdiCog, adminOnly: true, mdi: true },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{ // Pass theme to sx to access palette
          zIndex: (theme: MuiTheme) => theme.zIndex.drawer + 1, // Explicitly type theme here
          background: `linear-gradient(to right, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`, // Using context theme
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
          <IconButton onClick={toggleMode} color="inherit">
            <SvgIcon>
              <path d={mode === 'dark' ? mdiWeatherNight : mdiWeatherSunny} />
            </SvgIcon>
          </IconButton>
          <Switch
            checked={mode === 'dark'}
            onChange={toggleMode}
            color="secondary" // Or any color that fits your theme
          />
          {user && <Typography sx={{ mr: 2 }}>{t('layout_header_welcome', { name: user.name })}</Typography>}
        </Toolbar>
      </AppBar>

      <StyledDrawer variant="permanent" open={drawerOpen}>
        <Toolbar /> {/* Necessary to make the content below app bar */}
        <Divider />
        <List sx={{ flexGrow: 1 }}>
          {navItems.map((item) =>
            (!item.adminOnly || (item.adminOnly && hasRole('admin'))) && (
              <ListItemButton
                key={item.path}
                component={RouterLink}
                to={item.path}
                sx={{
                  minHeight: 48,
                  justifyContent: drawerOpen ? 'initial' : 'center',
                  px: 2.5,
                }}
                title={item.label}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: drawerOpen ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.mdi && <SvgIcon><path d={item.icon} /></SvgIcon>}
                </ListItemIcon>
                <ListItemText primary={item.label} sx={{ opacity: drawerOpen ? 1 : 0 }} />
              </ListItemButton>
            )
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
            }}
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

      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: currentTheme.colors.background }}>
        <Toolbar /> {/* This is important to offset content below the AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;