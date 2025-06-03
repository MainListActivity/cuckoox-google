import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  Dashboard,
  Business,
  People,
  Assignment,
  AssignmentTurnedIn,
  Event,
  Message,
  AdminPanelSettings,
  VerifiedUser,
  ChevronLeft,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useNavigate, Outlet } from 'react-router-dom';

interface MainLayoutProps {
  toggleTheme: () => void;
  isDarkMode: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  path: string;
  minCaseStatus?: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: '数据大屏', icon: <Dashboard />, path: '/dashboard' },
  { id: 'cases', label: '案件管理', icon: <Business />, path: '/cases' },
  { id: 'creditors', label: '债权人管理', icon: <People />, path: '/creditors' },
  { id: 'claims', label: '债权申报', icon: <Assignment />, path: '/claims', minCaseStatus: '债权申报' },
  { id: 'reviews', label: '债权审核', icon: <AssignmentTurnedIn />, path: '/reviews', minCaseStatus: '债权申报' },
  { id: 'meetings', label: '在线会议', icon: <Event />, path: '/meetings' },
  { id: 'messages', label: '消息中心', icon: <Message />, path: '/messages' },
  { id: 'roles', label: '身份管理', icon: <AdminPanelSettings />, path: '/roles' },
  { id: 'statuses', label: '审核状态管理', icon: <VerifiedUser />, path: '/statuses' },
];

const drawerWidth = 240;
const drawerWidthMobile = 200;

export const MainLayout: React.FC<MainLayoutProps> = ({ toggleTheme, isDarkMode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // TODO: 实现登出逻辑
    handleProfileMenuClose();
  };

  const drawer = (
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
            onClick={handleDrawerToggle}
            sx={{ color: 'white' }}
          >
            <ChevronLeft />
          </IconButton>
        )}
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
      <List sx={{ flex: 1, px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleMenuClick(item.path)}
              sx={{
                borderRadius: 1,
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.24)',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label} 
                primaryTypographyProps={{
                  fontSize: isMobile ? '0.875rem' : '1rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${isTablet ? drawerWidthMobile : drawerWidth}px)` },
          ml: { sm: isTablet ? drawerWidthMobile : drawerWidth },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {/* 动态显示当前页面标题 */}
          </Typography>
          
          <Tooltip title="切换主题">
            <IconButton onClick={toggleTheme} color="inherit">
              {isDarkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="用户菜单">
            <IconButton
              onClick={handleProfileMenuOpen}
              color="inherit"
              sx={{ ml: 1 }}
            >
              <AccountCircle />
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
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
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              个人信息
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ 
          width: { sm: isTablet ? drawerWidthMobile : drawerWidth }, 
          flexShrink: { sm: 0 } 
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidthMobile,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: isTablet ? drawerWidthMobile : drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${isTablet ? drawerWidthMobile : drawerWidth}px)` },
          mt: { xs: 7, sm: 8 },
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};
