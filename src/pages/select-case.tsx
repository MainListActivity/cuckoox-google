import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { Case } from '@/src/contexts/AuthContext'; // Import Case interface
import { useTranslation } from 'react-i18next';
import { useDataService } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import GlobalLoader from '@/src/components/GlobalLoader';
import PageContainer from '@/src/components/PageContainer';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Alert,
  Stack,
  SvgIcon,
  Chip,
  Skeleton,
  alpha,
  useTheme,
  Fade,
  Card,
  CardContent,
} from '@mui/material';
import { 
  mdiCheckCircle, 
  mdiBriefcaseOutline,
  mdiCalendarClock,
  mdiAccountTie,
  mdiAlertCircle,
} from '@mdi/js';

// Extended Case interface with additional fields from database
interface ExtendedCase extends Case {
  case_procedure?: string;
  procedure_phase?: string;
  acceptance_date?: string;
  case_manager_name?: string;
  created_at?: string;
  updated_at?: string;
}

const CaseSelectionPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showError } = useSnackbar();
  const { 
    user, 
    selectCase, 
    selectedCaseId, 
    isLoading: isAuthLoading, 
    isCaseLoading,
    isLoggedIn,
    refreshUserCasesAndRoles,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dataService = useDataService();

  // Local state for cases with extended information
  const [cases, setCases] = useState<ExtendedCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's cases from SurrealDB
  useEffect(() => {
    const fetchUserCases = async () => {
      if (!user || !user.id) {
        setIsLoadingCases(false);
        return;
      }

      setIsLoadingCases(true);
      setError(null);

      try {
        // Query to get all accessible cases directly
        const query = `
          SELECT 
            id,
            name,
            case_number,
            case_procedure,
            procedure_phase,
            acceptance_date,
            case_manager_name,
            created_at,
            updated_at
          FROM case;
        `;

        // Execute query using DataService
        const rows = await dataService.query<ExtendedCase[]>(query);

        if (Array.isArray(rows)) {
          // Ensure name has fallback and deduplicate by id
          const uniqueCases = Array.from(
            new Map<string, ExtendedCase>(
              rows.map((c) => [c.id.toString(), { ...c, name: c.name ?? '未命名案件' }])
            ).values()
          );

          setCases(uniqueCases);
        } else {
          setCases([]);
        }
      } catch (err) {
        console.error('Error fetching user cases:', err);
        const errorMessage = '加载案件列表失败';
        setError(errorMessage);
      } finally {
        setIsLoadingCases(false);
      }
    };

    fetchUserCases();
  }, [dataService, user]);

  // Handle case selection
  const handleCaseSelect = async (caseToSelect: ExtendedCase) => {
    if (!caseToSelect || !caseToSelect.id) return;
    
    try {
      await selectCase(caseToSelect.id);
      // The line below was removed as per instruction to fix redirect issue
      // await refreshUserCasesAndRoles();
      
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error selecting case:", error);
      showError(t('error_selecting_case', '选择案件失败，请重试'));
    }
  };

  // Get status color based on procedure phase
  const getStatusColor = (phase?: string) => {
    if (!phase) return { color: theme.palette.text.secondary, bgColor: theme.palette.action.hover };
    
    switch (phase) {
      case '立案':
        return { color: '#1976D2', bgColor: alpha('#1976D2', 0.1) };
      case '公告':
        return { color: '#00897B', bgColor: alpha('#00897B', 0.1) };
      case '债权申报':
        return { color: '#00ACC1', bgColor: alpha('#00ACC1', 0.1) };
      case '债权人第一次会议':
      case '债权人第二次会议':
        return { color: '#7B1FA2', bgColor: alpha('#7B1FA2', 0.1) };
      case '裁定重整':
      case '提交重整计划':
        return { color: '#9C27B0', bgColor: alpha('#9C27B0', 0.1) };
      case '破产清算':
        return { color: '#F57C00', bgColor: alpha('#F57C00', 0.1) };
      case '结案':
        return { color: '#388E3C', bgColor: alpha('#388E3C', 0.1) };
      default:
        return { color: theme.palette.text.secondary, bgColor: theme.palette.action.hover };
    }
  };

  // Loading state
  if (isAuthLoading || isCaseLoading || isLoadingCases) {
    return <GlobalLoader message={t('loading_cases', '正在加载案件列表...')} />;
  }

  // Not logged in
  if (!isLoggedIn || !user) {
    navigate('/login', { replace: true });
    return null;
  }

  // Error state
  if (error) {
    return (
      <PageContainer>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            p: 2,
          }}
        >
          <Alert severity="error" sx={{ maxWidth: 600 }}>
            <Typography variant="body1">{error}</Typography>
            <Button 
              onClick={() => window.location.reload()} 
              sx={{ mt: 2 }}
              variant="outlined"
              size="small"
            >
              {t('retry', '重试')}
            </Button>
          </Alert>
        </Box>
      </PageContainer>
    );
  }
  
  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          p: 2,
          flex: 1,
        }}
      >
        <Fade in timeout={500}>
          <Paper 
            elevation={6} 
            sx={{ 
              p: { xs: 4, sm: 6, md: 8 }, 
              width: '100%', 
              maxWidth: 800,
              textAlign: 'center',
              borderRadius: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <SvgIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }}>
                <path d={mdiBriefcaseOutline} />
              </SvgIcon>
              <Typography variant="h3" component="h1" color="primary" fontWeight={700}>
                {t('case_selection_title', '选择案件')}
              </Typography>
            </Box>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {t('case_selection_welcome', { name: user.name })}
            </Typography>

            {cases.length === 0 ? (
              <Alert 
                severity="warning" 
                sx={{ 
                  textAlign: 'left',
                  borderRadius: 2,
                }}
                icon={<SvgIcon><path d={mdiAlertCircle} /></SvgIcon>}
              >
                <Typography variant="body1" fontWeight="medium">
                  {t('case_selection_no_cases', '您还没有被分配到任何案件')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('case_selection_no_cases_contact_support', '请联系系统管理员为您分配案件权限。')}
                </Typography>
              </Alert>
            ) : (
              <Stack spacing={2}>
                {cases.map((caseItem) => {
                  const statusStyle = getStatusColor(caseItem.procedure_phase);
                  const isSelected = selectedCaseId === caseItem.id;
                  
                  return (
                    <Card
                      key={caseItem.id.toString()}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        border: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4,
                          borderColor: 'primary.main',
                        },
                      }}
                      onClick={() => handleCaseSelect(caseItem)}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ textAlign: 'left', flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="h6" component="div" fontWeight={600}>
                                {caseItem.name}
                              </Typography>
                              {isSelected && (
                                <SvgIcon sx={{ ml: 1, color: 'primary.main' }} data-testid="selected-check-icon">
                                  <path d={mdiCheckCircle} />
                                </SvgIcon>
                              )}
                            </Box>
                            
                            {caseItem.case_number && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {t('case_number', '案件编号')}: {caseItem.case_number}
                              </Typography>
                            )}
                            
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                              {caseItem.case_procedure && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <SvgIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }}>
                                    <path d={mdiBriefcaseOutline} />
                                  </SvgIcon>
                                  <Typography variant="caption" color="text.secondary">
                                    {caseItem.case_procedure}
                                  </Typography>
                                </Box>
                              )}
                              
                              {caseItem.case_manager_name && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <SvgIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }}>
                                    <path d={mdiAccountTie} />
                                  </SvgIcon>
                                  <Typography variant="caption" color="text.secondary">
                                    {caseItem.case_manager_name}
                                  </Typography>
                                </Box>
                              )}
                              
                              {caseItem.acceptance_date && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <SvgIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }}>
                                    <path d={mdiCalendarClock} />
                                  </SvgIcon>
                                  <Typography variant="caption" color="text.secondary">
                                    {new Date(caseItem.acceptance_date).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                          
                          {caseItem.procedure_phase && (
                            <Chip
                              label={caseItem.procedure_phase}
                              size="small"
                              sx={{
                                backgroundColor: statusStyle.bgColor,
                                color: statusStyle.color,
                                fontWeight: 500,
                                borderRadius: 2,
                                ml: 2,
                              }}
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Fade>
        
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mt: 4, textAlign: 'center' }}
        >
          {t('copyright_platform', { year: new Date().getFullYear() })}
        </Typography>
      </Box>
    </PageContainer>
  );
};

export default CaseSelectionPage;
