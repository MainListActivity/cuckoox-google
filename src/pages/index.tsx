import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  Paper,
  Stack,
  Fade,
  Grow,
  SvgIcon,
  Chip,
  AppBar,
  Toolbar,
  alpha,
} from '@mui/material';
import {
  mdiFileDocumentMultiple,
  mdiAccountGroup,
  mdiClipboardTextClock,
  mdiChartLine,
  mdiArrowRight,
  mdiShieldCheck,
  mdiLightningBolt,
  mdiCloudSync,
  mdiCheckCircle,
  mdiTrendingUp,
  mdiSecurity,
  mdiFormatQuoteClose,
  mdiStar,
  mdiLogin,
  mdiViewDashboard,
} from '@mdi/js';
import Logo from '../components/Logo';

const HomePage: React.FC = () => {
  const { isLoggedIn, user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // 自动重定向已登录用户到仪表盘
  useEffect(() => {
    // 如果需要自动重定向已登录用户，取消下面的注释
    // if (isLoggedIn) {
    //   navigate('/dashboard');
    // }
  }, [isLoggedIn, navigate]);

  const features = [
    {
      icon: mdiFileDocumentMultiple,
      title: t('feature_case_management', 'Case Management'),
      description: t('feature_case_management_desc', 'Efficiently manage bankruptcy cases with comprehensive tracking and documentation'),
      color: '#00897B', // Teal 600
      gradient: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)',
    },
    {
      icon: mdiAccountGroup,
      title: t('feature_creditor_info', 'Creditor Information'),
      description: t('feature_creditor_info_desc', 'Centralized database for all creditor details and communications'),
      color: '#00ACC1', // Cyan 600
      gradient: 'linear-gradient(135deg, #00ACC1 0%, #0097A7 100%)',
    },
    {
      icon: mdiClipboardTextClock,
      title: t('feature_claims_processing', 'Claims Processing'),
      description: t('feature_claims_processing_desc', 'Streamlined workflow for claim submissions and reviews'),
      color: '#43A047', // Green 600
      gradient: 'linear-gradient(135deg, #43A047 0%, #388E3C 100%)',
    },
    {
      icon: mdiChartLine,
      title: t('feature_analytics', 'Analytics & Reports'),
      description: t('feature_analytics_desc', 'Real-time insights and comprehensive reporting capabilities'),
      color: '#FB8C00', // Orange 600
      gradient: 'linear-gradient(135deg, #FB8C00 0%, #F57C00 100%)',
    },
  ];

  const benefits = [
    {
      icon: mdiShieldCheck,
      title: t('benefit_secure', 'Secure & Compliant'),
      description: t('benefit_secure_desc', 'Enterprise-grade security with full regulatory compliance'),
    },
    {
      icon: mdiLightningBolt,
      title: t('benefit_efficient', 'Fast & Efficient'),
      description: t('benefit_efficient_desc', 'Automate workflows and reduce processing time by up to 70%'),
    },
    {
      icon: mdiCloudSync,
      title: t('benefit_cloud', 'Cloud-Based'),
      description: t('benefit_cloud_desc', 'Access your data anywhere, anytime with automatic backups'),
    },
  ];

  const stats = [
    { value: '10K+', label: t('stat_cases', 'Cases Managed') },
    { value: '50K+', label: t('stat_creditors', 'Creditors') },
    { value: '99.9%', label: t('stat_uptime', 'Uptime') },
    { value: '24/7', label: t('stat_support', 'Support') },
  ];

  const testimonials = [
    {
      quote: t('testimonial_1', 'CuckooX has transformed how we handle bankruptcy cases. The efficiency gains are remarkable.'),
      author: t('testimonial_author_1', 'Sarah Chen'),
      role: t('testimonial_role_1', 'Senior Partner, Chen & Associates'),
      rating: 5,
    },
    {
      quote: t('testimonial_2', 'The best bankruptcy management platform we\'ve used. Intuitive, powerful, and reliable.'),
      author: t('testimonial_author_2', 'Michael Rodriguez'),
      role: t('testimonial_role_2', 'Managing Director, Legal Solutions Inc.'),
      rating: 5,
    },
    {
      quote: t('testimonial_3', 'Outstanding support and continuous improvements. CuckooX truly understands our needs.'),
      author: t('testimonial_author_3', 'Emily Thompson'),
      role: t('testimonial_role_3', 'Chief Legal Officer, Thompson Group'),
      rating: 5,
    },
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: theme.palette.background.default,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 顶部导航栏 */}
      <AppBar 
        position="fixed" 
        color="transparent" 
        elevation={0}
        sx={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <Logo 
              size="large" 
              variant="full" 
              onClick={() => navigate('/')}
            />
          </Box>
          {isLoggedIn ? (
            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/dashboard')} 
                startIcon={<SvgIcon><path d={mdiViewDashboard} /></SvgIcon>}
              >
                {t('go_to_dashboard', '进入仪表盘')}
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => navigate('/cases')}
              >
                {t('view_cases', '查看案件')}
              </Button>
            </Stack>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => navigate('/login')}
              startIcon={<SvgIcon><path d={mdiLogin} /></SvgIcon>}
            >
              {t('login', '登录')}
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Toolbar /> {/* 占位，防止内容被AppBar覆盖 */}

      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)', // Teal gradient
          color: 'white',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            animation: 'float 20s ease-in-out infinite',
          },
          '@keyframes float': {
            '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
            '33%': { transform: 'translate(30px, -30px) rotate(120deg)' },
            '66%': { transform: 'translate(-20px, 20px) rotate(240deg)' },
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Fade in timeout={1000}>
            <Box textAlign="center">
              <Chip
                label={t('hero_badge', 'Trusted by 1000+ Law Firms')}
                sx={{
                  mb: 3,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  backdropFilter: 'blur(10px)',
                }}
              />
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                  fontWeight: 800,
                  mb: 3,
                  textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                {t('welcome_to_cuckoox', 'Welcome to CuckooX')}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  mb: 5,
                  opacity: 0.95,
                  maxWidth: '800px',
                  mx: 'auto',
                  fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
                  lineHeight: 1.6,
                }}
              >
                {t('hero_subtitle', 'The most comprehensive platform for managing bankruptcy cases, creditor information, and claims processing')}
              </Typography>
              
              {isLoggedIn ? (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/dashboard')}
                    sx={{
                      backgroundColor: 'white',
                      color: '#00897B',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 30px rgba(0,0,0,0.2)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    endIcon={<SvgIcon><path d={mdiArrowRight} /></SvgIcon>}
                  >
                    {t('go_to_dashboard', '进入仪表盘')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/cases')}
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      borderWidth: 2,
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {t('view_cases', '查看案件')}
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/login')}
                    sx={{
                      backgroundColor: 'white',
                      color: '#00897B',
                      px: 5,
                      py: 2,
                      fontSize: '1.2rem',
                      fontWeight: 600,
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        transform: 'translateY(-2px) scale(1.02)',
                        boxShadow: '0 6px 30px rgba(0,0,0,0.2)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  endIcon={<SvgIcon><path d={mdiArrowRight} /></SvgIcon>}
                >
                  {t('get_started', '立即开始')}
                </Button>
              )}
            </Box>
          </Fade>
        </Container>
      </Box>

      {/* Stats Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #004D40 0%, #00251A 100%)',
          color: 'white',
          py: { xs: 6, md: 8 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            {stats.map((stat, index) => (
              <Grid size={{ xs: 6, md: 3 }} key={index}>
                <Fade in timeout={1000 + index * 200}>
                  <Box textAlign="center">
                    <Typography
                      variant="h2"
                      sx={{
                        fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                        fontWeight: 800,
                        mb: 1,
                        background: 'linear-gradient(135deg, #4DB6AC 0%, #80CBC4 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </Fade>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              fontWeight: 700,
              mb: 2,
              color: theme.palette.text.primary,
            }}
          >
            {t('powerful_features', 'Powerful Features')}
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: '600px', mx: 'auto' }}
          >
            {t('features_subtitle', 'Everything you need to manage bankruptcy cases efficiently')}
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Grow in timeout={1000 + index * 200}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: theme.palette.background.paper,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                      borderColor: feature.color,
                      '& .feature-icon': {
                        transform: 'scale(1.1) rotate(5deg)',
                      },
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center', p: 4 }}>
                    <Box
                      className="feature-icon"
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: feature.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        position: 'relative',
                        transition: 'transform 0.3s ease',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: -2,
                          borderRadius: '50%',
                          background: feature.gradient,
                          opacity: 0.3,
                          filter: 'blur(10px)',
                        },
                      }}
                    >
                      <SvgIcon sx={{ fontSize: 40, color: 'white', position: 'relative', zIndex: 1 }}>
                        <path d={feature.icon} />
                      </SvgIcon>
                    </Box>
                    <Typography variant="h6" gutterBottom fontWeight={600}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grow>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Benefits Section */}
      <Box sx={{ 
        backgroundColor: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.paper, 0.2)  
          : alpha(theme.palette.primary.light, 0.05),
        py: { xs: 8, md: 12 },
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
      }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                fontWeight: 700,
                mb: 2,
                color: theme.palette.text.primary,
              }}
            >
              {t('why_choose_cuckoox', 'Why Choose CuckooX?')}
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {benefits.map((benefit, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    height: '100%',
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.paper, 0.1)
                      : alpha(theme.palette.background.paper, 0.8),
                    borderRadius: 4,
                    border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1)}`,
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: theme.palette.mode === 'dark'
                      ? `0 4px 20px ${alpha(theme.palette.common.black, 0.2)}`
                      : `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme.palette.mode === 'dark'
                        ? `0 8px 30px ${alpha(theme.palette.common.black, 0.3)}`
                        : `0 8px 30px ${alpha(theme.palette.common.black, 0.1)}`,
                      borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.2),
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                      boxShadow: `0 4px 10px ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  >
                    <SvgIcon sx={{ fontSize: 32, color: 'white' }}>
                      <path d={benefit.icon} />
                    </SvgIcon>
                  </Box>
                  <Typography variant="h5" gutterBottom fontWeight={600}>
                    {benefit.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {benefit.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: theme.palette.background.paper }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                fontWeight: 700,
                mb: 2,
                color: theme.palette.text.primary,
              }}
            >
              {t('testimonials_title', 'What Our Clients Say')}
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: '600px', mx: 'auto' }}
            >
              {t('testimonials_subtitle', 'Trusted by legal professionals worldwide')}
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Grow in timeout={1000 + index * 200}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, p: 4 }}>
                      <Box sx={{ mb: 3 }}>
                        <SvgIcon sx={{ fontSize: 48, color: '#00897B', opacity: 0.2 }}>
                          <path d={mdiFormatQuoteClose} />
                        </SvgIcon>
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{
                          mb: 3,
                          fontStyle: 'italic',
                          lineHeight: 1.8,
                          color: theme.palette.text.secondary,
                        }}
                      >
                        "{testimonial.quote}"
                      </Typography>
                      <Box sx={{ display: 'flex', mb: 2 }}>
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <SvgIcon key={i} sx={{ fontSize: 20, color: '#FFB400' }}>
                            <path d={mdiStar} />
                          </SvgIcon>
                        ))}
                      </Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {testimonial.author}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {testimonial.role}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grow>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #00ACC1 0%, #0097A7 100%)',
          color: 'white',
          py: { xs: 6, md: 8 },
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=20")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
              fontWeight: 700,
              mb: 3,
            }}
          >
            {isLoggedIn 
              ? t('welcome_back', '欢迎回来')
              : t('ready_to_get_started', '准备好开始了吗？')}
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.95 }}>
            {isLoggedIn 
              ? t('continue_to_app', '继续使用CuckooX管理您的破产案件')
              : t('cta_subtitle', '加入数千名使用CuckooX简化破产管理的专业人士')}
          </Typography>
          {isLoggedIn ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/dashboard')}
                sx={{
                  backgroundColor: 'white',
                  color: '#00ACC1',
                  px: 5,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.3s ease',
                }}
                startIcon={<SvgIcon><path d={mdiViewDashboard} /></SvgIcon>}
              >
                {t('go_to_dashboard', '进入仪表盘')}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/cases')}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  px: 5,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                {t('view_cases', '查看案件')}
              </Button>
            </Stack>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                backgroundColor: 'white',
                color: '#00ACC1',
                px: 5,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 3,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  transform: 'scale(1.05)',
                },
                transition: 'all 0.3s ease',
              }}
              startIcon={<SvgIcon><path d={mdiLogin} /></SvgIcon>}
            >
              {t('sign_up_free', '免费注册')}
            </Button>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
