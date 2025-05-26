import React, { useState, ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Button,
  Drawer as MuiDrawer, // Renamed to avoid conflict with potential local 'Drawer' variable
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  styled,
  Theme,
  CSSObject,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import {
  mdiMenu,
  mdiMenuOpen,
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
const drawerWidthClosed = (theme: Theme) => theme.spacing(7); // MUI default is 7 for closed mini drawer

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidthOpen,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
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
  const theme = useTheme();
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
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
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
          {user && <Typography sx={{ mr: 2 }}>{t('layout_header_welcome', { name: user.name })}</Typography>}
        </Toolbar>
      </AppBar>

      <StyledDrawer variant="permanent" open={drawerOpen}>
        <Toolbar> {/* Necessary to make the content below app bar */}
            {/* Could add a logo or title here if drawer is separate from AppBar */}
        </Toolbar>
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
            color="secondary" // Or "error" or "primary" based on theme design
            fullWidth={drawerOpen}
            sx={{
                minWidth: drawerOpen ? 'auto' : theme.spacing(5), // Ensure button is small when drawer is closed
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

      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: 'background.default' }}>
        <Toolbar /> {/* This is important to offset content below the AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;