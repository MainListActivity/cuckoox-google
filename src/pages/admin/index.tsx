import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  SvgIcon,
  Stack,
} from '@mui/material';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import {
  mdiAccountGroupOutline,
  mdiSecurity,
  mdiPlaylistCheck,
  mdiBellRingOutline,
  mdiCogOutline,
  mdiCog,
  mdiAccountGroup,
} from '@mdi/js'; // Using @mdi/js for path data
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const adminSections = [
  { title: '用户管理', description: '管理系统用户账户、分配全局角色。', buttonText: '管理用户', icon: mdiAccountGroupOutline },
  { title: '身份与权限管理', description: '定义用户身份（角色）及其可操作的菜单和功能权限。', buttonText: '管理身份权限', icon: mdiSecurity },
  { title: '审核状态维护', description: '配置债权审核时可选的审核状态列表。', buttonText: '维护审核状态', icon: mdiPlaylistCheck },
  { title: '案件通知规则', description: '配置案件机器人基于案件阶段发送通知的规则和模板。', buttonText: '配置通知规则', icon: mdiBellRingOutline },
  { title: '系统配置', description: '管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。', buttonText: '系统配置', icon: mdiCogOutline },
];

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();

  // TODO: Implement admin functionalities:
  // - User management
  // - Role management (defining roles and their menu/action permissions)
  // - System configuration (e.g., SurrealDB connection if exposed, OIDC settings)
  // - Audit status management (for claim reviews)
  // - Case stage notification rule configuration
  return (
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        component="h1" 
        gutterBottom
        sx={{ mb: isMobile ? 2 : 3 }}
      >
        系统管理
      </Typography>
      
      <Grid container spacing={isMobile ? 2 : 3}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SvgIcon sx={{ mr: 1, color: 'primary.main' }}>
                  <path d={mdiCog} />
                </SvgIcon>
                <Typography variant="h6">{t('admin.systemSettings', '系统设置')}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('admin.systemSettingsDesc', '配置系统参数、主题和其他全局设置')}
              </Typography>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={() => navigate('/admin/theme')}
                sx={isMobile ? { minHeight: '44px' } : {}}
              >
                {t('admin.themeSettings', '主题设置')}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SvgIcon sx={{ mr: 1, color: 'primary.main' }}>
                  <path d={mdiAccountGroup} />
                </SvgIcon>
                <Typography variant="h6">{t('admin.userManagement', '用户管理')}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                {t('admin.userManagementDesc', '管理系统用户、角色和权限分配')}
              </Typography>
              <Stack spacing={1}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => navigate('/admin/manage/roles')}
                  sx={isMobile ? { minHeight: '44px' } : {}}
                >
                  {t('admin.roleManagement', '角色管理')}
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => navigate('/admin/manage/permissions')}
                  sx={isMobile ? { minHeight: '44px' } : {}}
                >
                  {t('admin.permissionManagement', '权限管理')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {adminSections.map((section, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
            <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <SvgIcon component="svg" sx={{ mr: 1.5, fontSize: '2.2rem', color: 'primary.main' }}>
                    <path d={section.icon} />
                  </SvgIcon>
                  <Typography variant="h5" component="h2" sx={{color: 'primary.dark'}}>
                    {section.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {section.description}
                </Typography>
              </CardContent>
              <Box sx={{ p: 2, pt: 0 }}>
                <Button 
                  variant="contained" 
                  size="medium" 
                  color="primary" 
                  fullWidth
                  sx={isMobile ? { minHeight: '44px' } : {}}
                >
                  {section.buttonText}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        系统管理页面，仅限管理员访问。用于配置和维护应用的核心参数和元数据。
      </Typography>
    </Box>
  );
};

export default AdminPage;
