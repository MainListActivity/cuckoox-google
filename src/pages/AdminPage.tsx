import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  SvgIcon,
} from '@mui/material';
import {
  mdiAccountGroupOutline,
  mdiSecurity,
  mdiPlaylistCheck,
  mdiBellRingOutline,
  mdiCogOutline,
} from '@mdi/js'; // Using @mdi/js for path data

const adminSections = [
  { title: '用户管理', description: '管理系统用户账户、分配全局角色。', buttonText: '管理用户', icon: mdiAccountGroupOutline, color: 'primary' as const },
  { title: '身份与权限管理', description: '定义用户身份（角色）及其可操作的菜单和功能权限。', buttonText: '管理身份权限', icon: mdiSecurity, color: 'success' as const },
  { title: '审核状态维护', description: '配置债权审核时可选的审核状态列表。', buttonText: '维护审核状态', icon: mdiPlaylistCheck, color: 'warning' as const },
  { title: '案件通知规则', description: '配置案件机器人基于案件阶段发送通知的规则和模板。', buttonText: '配置通知规则', icon: mdiBellRingOutline, color: 'info' as const },
  { title: '系统配置', description: '管理系统级参数，如数据库连接（概念性）、OIDC客户端设置等。', buttonText: '系统配置', icon: mdiCogOutline, color: 'error' as const },
];

const AdminPage: React.FC = () => {
  // TODO: Implement admin functionalities:
  // - User management
  // - Role management (defining roles and their menu/action permissions)
  // - System configuration (e.g., SurrealDB connection if exposed, OIDC settings)
  // - Audit status management (for claim reviews)
  // - Case stage notification rule configuration
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>系统管理</Typography>
      
      <Grid container spacing={3}>
        {adminSections.map((section, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <SvgIcon component="svg" sx={{ mr: 1.5, fontSize: '2.2rem', color: `${section.color}.main` }}>
                    <path d={section.icon} />
                  </SvgIcon>
                  <Typography variant="h5" component="h2" sx={{color: `${section.color}.dark`}}>
                    {section.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {section.description}
                </Typography>
              </CardContent>
              <Box sx={{ p: 2, pt: 0 }}>
                <Button variant="contained" size="medium" color={section.color} fullWidth>
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