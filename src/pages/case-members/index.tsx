import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { useOperationPermissions } from '@/src/hooks/useOperationPermission';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Card,
  CardContent,
  Grid,
  useTheme,
  alpha,
  Fade,
  Divider,
  Skeleton,
} from '@mui/material';
import GlobalLoader from '@/src/components/GlobalLoader';
import {
  mdiAccountGroup,
  mdiAccountMultiple,
  mdiAccountKey,
  mdiAccountEdit,
} from '@mdi/js';

// Import mobile components
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import PageContainer from '@/src/components/PageContainer';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

// Import the case member management component
import CaseMemberTab from '@/src/components/case/CaseMemberTab';

// Define interfaces
interface CaseMemberStats {
  totalMembers: number;
  ownerCount: number;
  memberCount: number;
  activeMembers: number;
}

const CaseMemberManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const theme = useTheme();
  const { client, isConnected } = useSurreal();
  const { selectedCaseId } = useAuth();
  const { isMobile } = useResponsiveLayout();

  // Check operation permissions
  const { permissions, isLoading: isPermissionsLoading } = useOperationPermissions([
    'case_manage_members',
    'case_member_list_view',
    'case_member_add',
    'case_member_remove',
    'case_member_change_owner'
  ]);

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CaseMemberStats>({
    totalMembers: 0,
    ownerCount: 0,
    memberCount: 0,
    activeMembers: 0,
  });
  const [caseInfo, setCaseInfo] = useState<{
    case_number: string;
    name?: string;
    case_procedure?: string;
  } | null>(null);

  // Load case information and member statistics
  useEffect(() => {
    const fetchCaseData = async () => {
      if (!selectedCaseId || !isConnected) {
        setIsLoading(false);
        if (!selectedCaseId) {
          setError(t('error_no_case_selected', '请先选择一个案件。'));
        }
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch case information
        const caseQuery = `
          SELECT 
            case_number,
            name,
            case_procedure
          FROM case
          WHERE id = $caseId
        `;
        
        const caseResult = await client!.query<[{
          case_number?: string;
          name?: string;
          case_procedure?: string;
        }]>(caseQuery, { caseId: selectedCaseId });
        
        if (caseResult && caseResult[0]) {
          const caseData = caseResult[0];
          setCaseInfo({
            case_number: caseData.case_number || `BK-${selectedCaseId.toString().slice(-6)}`,
            name: caseData.name,
            case_procedure: caseData.case_procedure || '破产',
          });
        }

        // Fetch member statistics
        const statsQuery = `
          SELECT 
            count() as total_members,
            count(role_id.name = 'owner') as owner_count,
            count(role_id.name = 'member') as member_count,
            count() as active_members
          FROM user_case_role
          WHERE case_id = $caseId
          GROUP ALL
        `;
        
        const statsResult = await client!.query<[{
          total_members?: number;
          owner_count?: number;
          member_count?: number;
          active_members?: number;
        }]>(statsQuery, { caseId: selectedCaseId });
        
        if (statsResult && statsResult[0]) {
          const statsData = statsResult[0];
          setStats({
            totalMembers: statsData.total_members || 0,
            ownerCount: statsData.owner_count || 0,
            memberCount: statsData.member_count || 0,
            activeMembers: statsData.active_members || 0,
          });
        } else {
          setStats({
            totalMembers: 0,
            ownerCount: 0,
            memberCount: 0,
            activeMembers: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching case data:', err);
        setError(t('error_fetching_case_data', '获取案件数据失败'));
        showError(t('error_fetching_case_data', '获取案件数据失败'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseData();
  }, [selectedCaseId, isConnected, client, t, showError]);

  // Statistics data for ResponsiveStatsCards
  const statisticsData = [
    {
      id: 'total_members',
      label: t('total_members', '总成员数'),
      value: stats.totalMembers,
      icon: mdiAccountGroup,
      color: '#00897B',
      bgColor: alpha('#00897B', 0.1),
      loading: isLoading,
    },
    {
      id: 'case_owners',
      label: t('case_owners', '案件负责人'),
      value: stats.ownerCount,
      icon: mdiAccountKey,
      color: '#1976D2',
      bgColor: alpha('#1976D2', 0.1),
      loading: isLoading,
    },
    {
      id: 'case_members',
      label: t('case_members', '案件成员'),
      value: stats.memberCount,
      icon: mdiAccountMultiple,
      color: '#7B1FA2',
      bgColor: alpha('#7B1FA2', 0.1),
      loading: isLoading,
    },
    {
      id: 'active_members',
      label: t('active_members', '活跃成员'),
      value: stats.activeMembers,
      icon: mdiAccountEdit,
      color: '#388E3C',
      bgColor: alpha('#388E3C', 0.1),
      loading: isLoading,
    },
  ];

  // Check permissions
  if (isPermissionsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={40} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!permissions['case_manage_members'] && !permissions['case_member_list_view']) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {t('no_permission', '您没有权限访问此功能')}
        </Alert>
      </Box>
    );
  }

  // Handle no case selected
  if (!selectedCaseId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          {t('error_no_case_selected', '请先选择一个案件。')}
        </Alert>
      </Box>
    );
  }

  // Handle loading state
  if (isLoading) {
    return <GlobalLoader message={t('loading_case_members', '正在加载案件成员数据...')} />;
  }

  // Handle error state
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  // Mobile rendering
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title="案件成员管理"
        showBackButton={false}
      >
        <Box sx={{ p: 2 }}>
          {/* Mobile Case Info */}
          {caseInfo && (
            <Box sx={{ mb: 3 }}>
              <Paper 
                sx={{ 
                  p: 2, 
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                }}
              >
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  当前案件
                </Typography>
                <Typography variant="subtitle1" fontWeight="600" color="primary">
                  {caseInfo.case_number} - {caseInfo.case_procedure}
                </Typography>
                {caseInfo.name && (
                  <Typography variant="body2" color="text.secondary">
                    {caseInfo.name}
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {/* Mobile Statistics */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              {statisticsData.map((stat, index) => (
                <Grid size={{ xs: 6, sm: 6 }} key={index}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.5,
                            backgroundColor: stat.bgColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 1.5,
                          }}
                        >
                          <Box
                            component="svg"
                            sx={{ fontSize: 18, color: stat.color }}
                            viewBox="0 0 24 24"
                            width={18}
                            height={18}
                          >
                            <path d={stat.icon} />
                          </Box>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color, mb: 0.5 }}>
                          {stat.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {stat.label}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Mobile Case Member Management */}
          <Paper 
            sx={{ 
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                案件成员
              </Typography>
              <Typography variant="body2" color="text.secondary">
                管理当前案件的团队成员，分配角色和权限
              </Typography>
            </Box>
            <CaseMemberTab caseId={selectedCaseId} />
          </Paper>
        </Box>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Fade in timeout={500}>
          <Box>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 700,
                color: theme.palette.text.primary,
                mb: 1,
              }}
            >
              {t('case_member_management', '案件成员管理')}
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary" 
              sx={{ mb: 1 }}
            >
              {t('case_member_management_desc', '管理和维护案件团队成员的角色和权限')}
            </Typography>
            {caseInfo && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontWeight: 500,
                  mb: 4,
                  px: 2,
                  py: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              >
                {t('current_case', '当前案件')}: {caseInfo.case_number} - {caseInfo.case_procedure}
                {caseInfo.name && ` (${caseInfo.name})`}
              </Typography>
            )}
          </Box>
        </Fade>

        {/* Statistics Cards */}
        <Fade in timeout={600}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statisticsData.map((stat, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: stat.color }}>
                          {stat.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {stat.label}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          backgroundColor: stat.bgColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box
                          component="svg"
                          sx={{ fontSize: 24, color: stat.color }}
                          viewBox="0 0 24 24"
                          width={24}
                          height={24}
                        >
                          <path d={stat.icon} />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Fade>

        {/* Case Member Management */}
        <Fade in timeout={800}>
          <Paper 
            sx={{ 
              borderRadius: 3,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('case_members', '案件成员')}
                {caseInfo && ` - ${caseInfo.case_number}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('manage_case_members_desc', '管理当前案件的团队成员，分配角色和权限')}
              </Typography>
            </Box>
            <Divider />
            <CaseMemberTab caseId={selectedCaseId} />
          </Paper>
        </Fade>
      </Box>
    </PageContainer>
  );
};

export default CaseMemberManagementPage; 