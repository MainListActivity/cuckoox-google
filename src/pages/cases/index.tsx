import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import {
  Box,
  TextField,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  SvgIcon,
  Tooltip,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  useTheme,
  alpha,
  Fade,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Avatar,
  CircularProgress,
  Alert,
  TablePagination,
  useMediaQuery,
  Skeleton,
} from '@mui/material';
import {
  mdiPlusCircleOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiFileEditOutline,
  mdiCalendarEdit,
  mdiFilterVariant,
  mdiMagnify,
  mdiDotsVertical,
  mdiBriefcaseOutline,
  mdiAccountOutline,
  mdiCalendarClock,
  mdiCheckCircle,
  mdiProgressClock,
  mdiAlertCircle,
  mdiDownload,
  mdiPrinter,
} from '@mdi/js';

// Import Dialogs
import ModifyCaseStatusDialog, { CaseStatus } from '@/src/components/case/ModifyCaseStatusDialog';
import MeetingMinutesDialog from '@/src/components/case/MeetingMinutesDialog';
import { QuillDelta } from '@/src/components/RichTextEditor';

// Define interfaces based on SurrealDB schema
interface Case {
  id: RecordId;
  name: string;
  case_number: string;
  case_manager_name: string;
  case_procedure: string;
  acceptance_date: string;
  procedure_phase: string;
  created_by_user: RecordId;
  case_lead_user_id?: RecordId;
  created_at: string;
  updated_at: string;
}

interface User {
  id: RecordId;
  name: string;
  email?: string;
}

// Define a type for our case items with joined user data
interface CaseItem {
  id: string;
  case_number: string;
  case_lead_name: string;
  case_procedure: string;
  creator_name: string;
  current_stage: CaseStatus;
  acceptance_date: string;
}

const CaseListPage: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbar();
  const theme = useTheme();
  const { surreal: client, isSuccess: isConnected } = useSurreal();

  // State for cases data
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for dialogs
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCaseForMenu, setSelectedCaseForMenu] = useState<CaseItem | null>(null);

  // Fetch cases from database
  useEffect(() => {
    const fetchCases = async () => {
      if (!isConnected) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Query cases with related user information
        const query = `
          SELECT 
            id,
            name,
            case_number,
            case_manager_name,
            case_procedure,
            acceptance_date,
            procedure_phase,
            created_by_user,
            case_lead_user_id,
            created_at,
            updated_at,
            created_by_user.name as creator_name,
            case_lead_user_id.name as case_lead_name
          FROM case
          ORDER BY created_at DESC
        `;
        
        const result = await client.query(query);
        
        if (result && result[0]) {
          const casesData = result[0] as any[];
          
          // Transform the data to match our CaseItem interface
          const transformedCases: CaseItem[] = casesData.map(caseData => ({
            id: caseData.id.toString().replace('case:', ''),
            case_number: caseData.case_number || `BK-${caseData.id.toString().slice(-6)}`,
            case_lead_name: caseData.case_lead_name || caseData.case_manager_name || t('unassigned', '未分配'),
            case_procedure: caseData.case_procedure || '破产',
            creator_name: caseData.creator_name || t('system', '系统'),
            current_stage: caseData.procedure_phase as CaseStatus || '立案',
            acceptance_date: caseData.acceptance_date ? new Date(caseData.acceptance_date).toISOString().split('T')[0] : '',
          }));
          
          setCases(transformedCases);
        } else {
          setCases([]);
        }
      } catch (err) {
        console.error('Error fetching cases:', err);
        setError(t('error_fetching_cases', '获取案件列表失败'));
        showError(t('error_fetching_cases', '获取案件列表失败'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();
  }, [isConnected, client, t, showError]);

  // Statistics
  const stats = [
    { 
      label: t('total_cases', '总案件数'), 
      value: cases.length, 
      icon: mdiBriefcaseOutline,
      color: '#00897B',
      bgColor: alpha('#00897B', 0.1),
    },
    { 
      label: t('active_cases', '进行中'), 
      value: cases.filter(c => !['结案', '终结'].includes(c.current_stage)).length, 
      icon: mdiProgressClock,
      color: '#00ACC1',
      bgColor: alpha('#00ACC1', 0.1),
    },
    { 
      label: t('completed_cases', '已完成'), 
      value: cases.filter(c => ['结案', '终结'].includes(c.current_stage)).length, 
      icon: mdiCheckCircle,
      color: '#43A047',
      bgColor: alpha('#43A047', 0.1),
    },
    { 
      label: t('pending_review', '待审核'), 
      value: cases.filter(c => c.current_stage === '债权申报').length, 
      icon: mdiAlertCircle,
      color: '#FB8C00',
      bgColor: alpha('#FB8C00', 0.1),
    },
  ];

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case '立案':
        return { color: '#1976D2', bgColor: alpha('#1976D2', 0.1) };
      case '债权申报':
        return { color: '#00897B', bgColor: alpha('#00897B', 0.1) };
      case '债权人第一次会议':
        return { color: '#7B1FA2', bgColor: alpha('#7B1FA2', 0.1) };
      case '裁定重整':
      case '提交重整计划':
      case '延迟提交重整计划':
        return { color: '#9C27B0', bgColor: alpha('#9C27B0', 0.1) };
      case '破产财产分配':
        return { color: '#F57C00', bgColor: alpha('#F57C00', 0.1) };
      case '终结':
        return { color: '#388E3C', bgColor: alpha('#388E3C', 0.1) };
      default:
        return { color: theme.palette.text.secondary, bgColor: theme.palette.action.hover };
    }
  };

  // Get procedure icon
  const getProcedureIcon = (procedure: string) => {
    switch (procedure) {
      case '破产清算':
        return { icon: mdiFileDocumentOutline, color: '#D32F2F' };
      case '破产和解':
        return { icon: mdiAccountOutline, color: '#1976D2' };
      case '破产重整':
        return { icon: mdiCalendarClock, color: '#388E3C' };
      default:
        return { icon: mdiBriefcaseOutline, color: theme.palette.text.secondary };
    }
  };

  // Handlers
  const handleOpenModifyStatus = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setModifyStatusOpen(true);
  };

  const handleCloseModifyStatus = () => {
    setModifyStatusOpen(false);
  };

  const handleOpenMeetingMinutes = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    let title = '';
    // Check if current_stage matches meeting stages
    if (caseItem.current_stage.includes('债权人') && caseItem.current_stage.includes('会议')) {
      if (caseItem.current_stage.includes('第一次')) {
        title = t('first_creditors_meeting_minutes_title', '第一次债权人会议纪要');
      } else if (caseItem.current_stage.includes('第二次')) {
        title = t('second_creditors_meeting_minutes_title', '第二次债权人会议纪要');
      } else {
        title = t('meeting_minutes_generic_title', '会议纪要');
      }
    } else {
      title = t('meeting_minutes_generic_title', '会议纪要');
    }
    setCurrentMeetingTitle(title);
    setMeetingMinutesOpen(true);
  };

  const handleCloseMeetingMinutes = () => {
    setMeetingMinutesOpen(false);
  };

  const handleSaveMeetingMinutes = (minutesDelta: QuillDelta, meetingTitle: string) => {
    console.log('Saving Meeting Minutes:', selectedCase?.id, meetingTitle, minutesDelta.ops);
    showSuccess(t('meeting_minutes_save_success_mock', '会议纪要已（模拟）保存成功！'));
    handleCloseMeetingMinutes();
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, caseItem: CaseItem) => {
    setAnchorEl(event.currentTarget);
    setSelectedCaseForMenu(caseItem);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCaseForMenu(null);
  };

  return (
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
            {t('case_management', '案件管理')}
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ mb: 4 }}
          >
            {t('case_management_desc', '管理和跟踪所有破产案件的进展情况')}
          </Typography>
        </Box>
      </Fade>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Fade in timeout={500 + index * 100}>
              <Card 
                sx={{ 
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
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
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        backgroundColor: stat.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SvgIcon sx={{ fontSize: 28, color: stat.color }}>
                        <path d={stat.icon} />
                      </SvgIcon>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        ))}
      </Grid>

      {/* Actions Bar */}
      <Fade in timeout={700}>
        <Paper 
          sx={{ 
            p: 2, 
            mb: 3,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <TextField 
                variant="outlined" 
                size="small" 
                placeholder={t('search_cases', '搜索案件...')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                sx={{ 
                  minWidth: 300,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SvgIcon sx={{ color: 'text.secondary' }}>
                        <path d={mdiMagnify} />
                      </SvgIcon>
                    </InputAdornment>
                  ),
                }}
              />
              <Button 
                variant="outlined" 
                startIcon={<SvgIcon><path d={mdiFilterVariant} /></SvgIcon>}
                onClick={() => console.log('Filter button clicked')}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                {t('filter', '筛选')}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<SvgIcon><path d={mdiDownload} /></SvgIcon>}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                {t('export', '导出')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to="/cases/create"
                startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)',
                  boxShadow: '0 4px 12px rgba(0,137,123,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)',
                    boxShadow: '0 6px 16px rgba(0,137,123,0.4)',
                  },
                }}
              >
                {t('create_new_case', '创建新案件')}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Fade>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Cases Table */}
      <Fade in timeout={900}>
        <Paper 
          sx={{ 
            width: '100%', 
            overflow: 'hidden',
            borderRadius: 3,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>{t('loading_cases', '正在加载案件列表...')}</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table stickyHeader aria-label="case list table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('case_number', '案件编号')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('case_procedure', '案件程序')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('case_lead', '案件负责人')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('creator', '创建人')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('acceptance_date', '受理时间')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('current_stage', '程序进程')}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, backgroundColor: '#f6f6f6' }}>
                      {t('actions', '操作')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cases.length === 0 && !error && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Box sx={{ py: 8 }}>
                          <SvgIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}>
                            <path d={mdiBriefcaseOutline} />
                          </SvgIcon>
                          <Typography color="text.secondary">
                            {t('no_cases', '暂无案件数据')}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  {cases.map((caseItem) => {
                  const statusStyle = getStatusColor(caseItem.current_stage);
                  const procedureStyle = getProcedureIcon(caseItem.case_procedure);
                  
                  return (
                    <TableRow 
                      hover 
                      key={caseItem.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <TableCell component="th" scope="row">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {caseItem.case_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SvgIcon sx={{ fontSize: 20, color: procedureStyle.color }}>
                            <path d={procedureStyle.icon} />
                          </SvgIcon>
                          <Typography variant="body2">
                            {caseItem.case_procedure}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                            {caseItem.case_lead_name.charAt(0)}
                          </Avatar>
                          <Typography variant="body2">
                            {caseItem.case_lead_name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{caseItem.creator_name}</TableCell>
                      <TableCell>{caseItem.acceptance_date}</TableCell>
                      <TableCell>
                        <Chip 
                          label={caseItem.current_stage} 
                          size="small"
                          sx={{
                            backgroundColor: statusStyle.bgColor,
                            color: statusStyle.color,
                            fontWeight: 500,
                            borderRadius: 2,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>
                        <Tooltip title={t('view_details', '查看详情')}>
                          <IconButton 
                            component={Link} 
                            to={`/cases/${caseItem.id}`} 
                            size="small" 
                            sx={{ 
                              color: '#00897B',
                              '&:hover': {
                                backgroundColor: alpha('#00897B', 0.08),
                              },
                            }}
                          >
                            <SvgIcon fontSize="small"><path d={mdiEyeOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('view_documents', '查看材料')}>
                          <IconButton 
                            component={Link} 
                            to={`/cases/${caseItem.id}`} 
                            size="small"
                            sx={{ 
                              color: '#00ACC1',
                              '&:hover': {
                                backgroundColor: alpha('#00ACC1', 0.08),
                              },
                            }}
                          >
                            <SvgIcon fontSize="small"><path d={mdiFileDocumentOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('modify_status', '修改状态')}>
                          <IconButton 
                            onClick={() => handleOpenModifyStatus(caseItem)} 
                            size="small"
                            sx={{ 
                              color: '#7B1FA2',
                              '&:hover': {
                                backgroundColor: alpha('#7B1FA2', 0.08),
                              },
                            }}
                          >
                            <SvgIcon fontSize="small"><path d={mdiFileEditOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                        {caseItem.current_stage === '债权人第一次会议' && (
                          <Tooltip title={t('meeting_minutes', '会议纪要')}>
                            <IconButton 
                              onClick={() => handleOpenMeetingMinutes(caseItem)} 
                              size="small"
                              sx={{ 
                                color: '#F57C00',
                                '&:hover': {
                                  backgroundColor: alpha('#F57C00', 0.08),
                                },
                              }}
                            >
                              <SvgIcon fontSize="small"><path d={mdiCalendarEdit} /></SvgIcon>
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton 
                          onClick={(e) => handleMenuClick(e, caseItem)} 
                          size="small"
                        >
                          <SvgIcon fontSize="small"><path d={mdiDotsVertical} /></SvgIcon>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </Paper>
      </Fade>

      {/* More Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          },
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <SvgIcon sx={{ mr: 2, fontSize: 20 }}><path d={mdiPrinter} /></SvgIcon>
          {t('print', '打印')}
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <SvgIcon sx={{ mr: 2, fontSize: 20 }}><path d={mdiDownload} /></SvgIcon>
          {t('download_report', '下载报告')}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          {t('archive_case', '归档案件')}
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      {selectedCase && (
        <ModifyCaseStatusDialog
          open={modifyStatusOpen}
          onClose={handleCloseModifyStatus}
          currentCase={selectedCase ? { id: selectedCase.id, current_status: selectedCase.current_stage } : null}
        />
      )}
      {selectedCase && meetingMinutesOpen && (
        <MeetingMinutesDialog
          open={meetingMinutesOpen}
          onClose={handleCloseMeetingMinutes}
          caseInfo={{ caseId: selectedCase.id, caseName: selectedCase.case_number }}
          meetingTitle={currentMeetingTitle}
          onSave={handleSaveMeetingMinutes}
        />
      )}
    </Box>
  );
};

export default CaseListPage;
