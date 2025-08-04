import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurrealClient, AuthenticationRequiredError } from '@/src/contexts/SurrealProvider';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { RecordId } from 'surrealdb';
import { useOperationPermissions } from '@/src/hooks/useOperationPermission';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import {
  Box,
  Typography,
  Button,
  Paper,
  SvgIcon,
  useTheme,
  alpha,
  Fade,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Alert,
  Skeleton,
  Chip,
} from '@mui/material';

// Import responsive components
import ResponsiveTable, { ResponsiveTableColumn, ResponsiveTableAction } from '@/src/components/common/ResponsiveTable';
import ResponsiveStatsCards, { StatCardData } from '@/src/components/common/ResponsiveStatsCards';
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import MobileSearchFilter, { FilterOption } from '@/src/components/mobile/MobileSearchFilter';
import {
  mdiPlusCircleOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiFileEditOutline,
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
import CreateCaseDialog from '@/src/components/case/CreateCaseDialog';
import { QuillDelta } from '@/src/components/RichTextEditor';

// Define interfaces based on SurrealDB schema
// Interface for the direct output of the SurrealDB query in fetchCases
interface RawCaseData {
  id: RecordId;
  name?: string;
  case_number?: string;
  case_manager_name?: string;
  case_procedure?: string;
  acceptance_date?: string;
  procedure_phase?: string;
  created_by_user: RecordId;
  case_lead_user_id?: RecordId;
  created_at?: string;
  updated_at?: string;
  creator_name?: string;
  case_lead_name?: string;
}

// Interface 'Case' might be redundant if CaseItem and RawCaseData cover needs,
// or could represent a more canonical model of a case if needed elsewhere.
// (Interface Case removed as it's unused after ESLint check)

// (Interface User removed as it's unused after ESLint check)

// Define a type for our case items displayed in the table (after transformation)
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
  const client = useSurrealClient();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();

  // Check operation permissions
  const { permissions, isLoading: isPermissionsLoading } = useOperationPermissions([
    'case_list_view',
    'case_create',
    'case_view_detail',
    'case_edit',
    'case_modify_status',
    'case_manage_members'
  ]);

  // State for cases data
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for dialogs
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [createCaseOpen, setCreateCaseOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [_selectedCaseForMenu, setSelectedCaseForMenu] = useState<CaseItem | null>(null);

  // 移动端搜索筛选状态
  const [filterOptions] = useState<FilterOption[]>([
    {
      id: 'status',
      label: '程序进程',
      type: 'select',
      options: [
        { value: '立案', label: '立案' },
        { value: '债权申报', label: '债权申报' },
        { value: '债权人第一次会议', label: '债权人第一次会议' },
        { value: '终结', label: '终结' },
      ],
    },
    {
      id: 'procedure',
      label: '案件程序',
      type: 'select',
      options: [
        { value: '破产清算', label: '破产清算' },
        { value: '破产和解', label: '破产和解' },
        { value: '破产重整', label: '破产重整' },
      ],
    },
    {
      id: 'dateRange',
      label: '受理时间',
      type: 'daterange',
    },
  ]);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [filteredCases, setFilteredCases] = useState<CaseItem[]>([]);

  // Fetch cases from database
  useEffect(() => {
    const fetchCases = async () => {
      if (!client) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // 首次加载时清除可能有问题的缓存数据
        const shouldClearCache = !sessionStorage.getItem('case_cache_initialized');
        if (shouldClearCache) {
          console.log('CaseList: Clearing cache on first load');
          // Note: clearTableCache method not available, using session storage flag instead
          sessionStorage.setItem('case_cache_initialized', 'true');
        }
        
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
        
        const result = await queryWithAuth<RawCaseData[]>(client, query);
        
        if (Array.isArray(result)) {
          const casesData = result as RawCaseData[];
          
          // Transform the data to match our CaseItem interface, filter out items without id
          const transformedCases: CaseItem[] = casesData
            .filter(caseData => caseData.id != null) // 过滤掉没有 id 的数据
            .map(caseData => {
              const idString = caseData.id.toString();
              const caseId = idString.replace('case:', '');
              
              return {
                id: caseId,
                case_number: caseData.case_number || `BK-${caseId.slice(-6)}`,
                case_lead_name: caseData.case_lead_name || caseData.case_manager_name || t('unassigned', '未分配'),
                case_procedure: caseData.case_procedure || '破产',
                creator_name: caseData.creator_name || t('system', '系统'),
                current_stage: caseData.procedure_phase as CaseStatus || '立案',
                acceptance_date: caseData.acceptance_date ? new Date(caseData.acceptance_date).toISOString().split('T')[0] : '',
              };
            });
          
          setCases(transformedCases);
        } else {
          setCases([]);
        }
      } catch (err) {
        console.error('Error fetching cases:', err);
        
        // Check if it's an authentication error
        if (err instanceof AuthenticationRequiredError) {
          // Navigate to login page
          navigate('/login');
          return;
        }
        
        setError(t('error_fetching_cases', '获取案件列表失败'));
        showError(t('error_fetching_cases', '获取案件列表失败'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();
  }, [client, t, showError, navigate]);

  // 处理搜索和筛选
  useEffect(() => {
    let filtered = [...cases];

    // 搜索过滤
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(caseItem => 
        caseItem.case_number.toLowerCase().includes(searchLower) ||
        caseItem.case_procedure.toLowerCase().includes(searchLower) ||
        caseItem.case_lead_name.toLowerCase().includes(searchLower) ||
        caseItem.creator_name.toLowerCase().includes(searchLower)
      );
    }

    // 筛选过滤
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        switch (key) {
          case 'status':
            filtered = filtered.filter(caseItem => caseItem.current_stage === value);
            break;
          case 'procedure':
            filtered = filtered.filter(caseItem => caseItem.case_procedure === value);
            break;
          default:
            break;
        }
      }
    });

    setFilteredCases(filtered);
  }, [cases, searchValue, activeFilters]);

  // Statistics for ResponsiveStatsCards
  const statsData: StatCardData[] = [
    { 
      id: 'total',
      label: t('total_cases', '总案件数'), 
      value: cases.length, 
      icon: mdiBriefcaseOutline,
      color: '#00897B',
      bgColor: alpha('#00897B', 0.1),
    },
    { 
      id: 'active',
      label: t('active_cases', '进行中'), 
      value: cases.filter(c => !['结案', '终结'].includes(c.current_stage)).length, 
      icon: mdiProgressClock,
      color: '#00ACC1',
      bgColor: alpha('#00ACC1', 0.1),
    },
    { 
      id: 'completed',
      label: t('completed_cases', '已完成'), 
      value: cases.filter(c => ['结案', '终结'].includes(c.current_stage)).length, 
      icon: mdiCheckCircle,
      color: '#43A047',
      bgColor: alpha('#43A047', 0.1),
    },
    { 
      id: 'pending',
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


  // ResponsiveTable 列配置
  const tableColumns: ResponsiveTableColumn[] = [
    {
      id: 'case_number',
      label: t('case_number', '案件编号'),
      priority: 'high',
      format: (value: string) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'case_procedure',
      label: t('case_procedure', '案件程序'),
      priority: 'high',
      format: (value: string) => {
        const procedureStyle = getProcedureIcon(value);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SvgIcon sx={{ fontSize: 20, color: procedureStyle.color }}>
              <path d={procedureStyle.icon} />
            </SvgIcon>
            <Typography variant="body2">{value}</Typography>
          </Box>
        );
      },
    },
    {
      id: 'case_lead_name',
      label: t('case_lead', '案件负责人'),
      priority: 'medium',
      format: (value: string) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
            {value.charAt(0)}
          </Avatar>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ),
    },
    {
      id: 'creator_name',
      label: t('creator', '创建人'),
      priority: 'low',
    },
    {
      id: 'acceptance_date',
      label: t('acceptance_date', '受理时间'),
      priority: 'medium',
    },
    {
      id: 'current_stage',
      label: t('current_stage', '程序进程'),
      priority: 'high',
      format: (value: string) => {
        const statusStyle = getStatusColor(value);
        return (
          <Chip 
            label={value} 
            size="small"
            sx={{
              backgroundColor: statusStyle.bgColor,
              color: statusStyle.color,
              fontWeight: 500,
              borderRadius: 2,
            }}
          />
        );
      },
    },
  ];

  // ResponsiveTable 操作配置 - 包含所有可能的操作
  const tableActions: ResponsiveTableAction[] = [
    {
      icon: mdiEyeOutline,
      label: t('view_details', '查看详情'),
      onClick: (row: CaseItem) => navigate(`/cases/${row.id}`),
      color: 'primary',
      disabled: () => !permissions['case_view_detail'],
    },
    {
      icon: mdiFileDocumentOutline,
      label: t('view_documents', '查看材料'),
      onClick: (row: CaseItem) => navigate(`/cases/${row.id}`),
      color: 'info',
      disabled: () => !permissions['case_view_detail'],
    },
    {
      icon: mdiFileEditOutline,
      label: t('modify_status', '修改状态'),
      onClick: (row: CaseItem) => handleOpenModifyStatus(row),
      color: 'secondary',
      disabled: () => !permissions['case_modify_status'],
    },
    {
      icon: mdiFileDocumentOutline,
      label: t('meeting_minutes', '会议纪要'),
      onClick: (row: CaseItem) => {
        setSelectedCase(row);
        setMeetingMinutesOpen(true);
      },
      color: 'primary',
      disabled: () => !permissions['case_view_detail'],
      hideForRow: (row: CaseItem) => row.current_stage !== '债权人第一次会议',
    },
  ];

  // 生成会议纪要标题
  const getMeetingMinutesTitle = (caseStage: string) => {
    if (caseStage === '债权人第一次会议') {
      return t('first_creditors_meeting_minutes_title', '第一次债权人会议纪要');
    }
    if (caseStage === '债权人第二次会议') {
      return t('second_creditors_meeting_minutes_title', '第二次债权人会议纪要');
    }
    return t('meeting_minutes_generic_title', '会议纪要');
  };

  // 筛选处理函数
  const handleFilterChange = (filterId: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: value,
    }));
  };

  const handleClearFilters = () => {
    setActiveFilters({});
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters).filter(value => 
      value !== undefined && value !== null && value !== ''
    ).length;
  };

  // Handlers
  const handleOpenModifyStatus = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setModifyStatusOpen(true);
  };

  const handleCloseModifyStatus = () => {
    setModifyStatusOpen(false);
  };

  const handleCloseMeetingMinutes = () => {
    setMeetingMinutesOpen(false);
  };

  const handleSaveMeetingMinutes = (minutesDelta: QuillDelta, meetingTitle: string) => {
    console.log('Saving Meeting Minutes:', selectedCase?.id, meetingTitle, minutesDelta.ops);
    showSuccess(t('meeting_minutes_save_success_mock', '会议纪要已（模拟）保存成功！'));
    handleCloseMeetingMinutes();
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCaseForMenu(null);
  };

  // Handle create case dialog
  const handleOpenCreateCase = () => {
    setCreateCaseOpen(true);
  };

  const handleCloseCreateCase = () => {
    setCreateCaseOpen(false);
  };

  const handleCaseCreated = (_caseId: string, caseName: string) => {
    // Show success message
    showSuccess(`案件"${caseName}"创建成功！您可以在案件详情页面编辑立案材料。`);
    
    // Refresh cases list to show the new case
    const fetchCases = async () => {
      if (!client) return;
      
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
        
        const result = await queryWithAuth<RawCaseData[]>(client, query);
        
        if (Array.isArray(result)) {
          const casesData = result as RawCaseData[];
          
          // Transform the data to match our CaseItem interface, filter out items without id
          const transformedCases: CaseItem[] = casesData
            .filter(caseData => caseData.id != null) // 过滤掉没有 id 的数据
            .map(caseData => {
              const idString = caseData.id.toString();
              const caseId = idString.replace('case:', '');
              
              return {
                id: caseId,
                case_number: caseData.case_number || `BK-${caseId.slice(-6)}`,
                case_lead_name: caseData.case_lead_name || caseData.case_manager_name || t('unassigned', '未分配'),
                case_procedure: caseData.case_procedure || '破产',
                creator_name: caseData.creator_name || t('system', '系统'),
                current_stage: caseData.procedure_phase as CaseStatus || '立案',
                acceptance_date: caseData.acceptance_date ? new Date(caseData.acceptance_date).toISOString().split('T')[0] : '',
              };
            });
          
          setCases(transformedCases);
        } else {
          setCases([]);
        }
      } catch (err) {
        console.error('Error fetching cases:', err);
        
        // Check if it's an authentication error
        if (err instanceof AuthenticationRequiredError) {
          // Navigate to login page
          navigate('/login');
          return;
        }
        
        setError(t('error_fetching_cases', '获取案件列表失败'));
        showError(t('error_fetching_cases', '获取案件列表失败'));
      } finally {
        setIsLoading(false);
      }
    };

    setTimeout(() => {
      fetchCases();
    }, 500);
  };

  const pageContent = (
    <Box sx={{ p: isMobile ? 0 : 3 }}>
      {/* Header - 桌面端显示 */}
      {!isMobile && (
        <Fade in timeout={500}>
          <Box sx={{ mb: 4 }}>
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
            >
              {t('case_management_desc', '管理和跟踪所有破产案件的进展情况')}
            </Typography>
          </Box>
        </Fade>
      )}

      {/* Statistics Cards - 使用 ResponsiveStatsCards */}
      <Fade in timeout={600}>
        <Box sx={{ mb: isMobile ? 2 : 4 }}>
          <ResponsiveStatsCards
            stats={statsData}
            loading={isLoading}
            variant={isMobile ? 'compact' : 'default'}
            columns={{ xs: 2, sm: 2, md: 4, lg: 4, xl: 4 }}
            showTrend={false}
          />
        </Box>
      </Fade>

      {/* Search and Filter - 使用 MobileSearchFilter */}
      <Fade in timeout={700}>
        <Box sx={{ mb: isMobile ? 2 : 3, px: isMobile ? 2 : 0 }}>
          <MobileSearchFilter
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder={t('search_cases', '搜索案件...')}
            filters={filterOptions}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            activeFilterCount={getActiveFilterCount()}
            showSearchBar={true}
          />
        </Box>
      </Fade>

      {/* Actions Bar - 桌面端显示 */}
      {!isMobile && (
        <Fade in timeout={750}>
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3,
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
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
              {isPermissionsLoading ? (
                <Skeleton variant="rectangular" width={140} height={36} sx={{ borderRadius: 2 }} />
              ) : permissions['case_create'] ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenCreateCase}
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
              ) : null}
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, mx: isMobile ? 2 : 0 }}>
          {error}
        </Alert>
      )}

      {/* Cases Table/Cards - 使用 ResponsiveTable */}
      <Fade in timeout={800}>
        <Box sx={{ px: isMobile ? 2 : 0 }}>
          <ResponsiveTable
            columns={tableColumns}
            data={filteredCases}
            actions={tableActions}
            onRowClick={(row: CaseItem) => navigate(`/cases/${row.id}`)}
            loading={isLoading}
            emptyMessage={t('no_cases', '暂无案件数据')}
            stickyHeader={true}
            size="medium"
            mobileCardVariant="detailed"
            showRowNumbers={!isMobile}
          />
        </Box>
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
          meetingTitle={getMeetingMinutesTitle(selectedCase.current_stage)}
          onSave={handleSaveMeetingMinutes}
        />
      )}
      <CreateCaseDialog
        open={createCaseOpen}
        onClose={handleCloseCreateCase}
        onCaseCreated={handleCaseCreated}
      />
    </Box>
  );

  // 移动端使用 MobileOptimizedLayout，桌面端直接显示内容
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title={t('case_management', '案件管理')}
        subtitle={`${filteredCases.length} ${t('cases', '个案件')}`}
        showFab={permissions['case_create'] || false}
        fabIcon={mdiPlusCircleOutline}
        onFabClick={handleOpenCreateCase}
        fabLabel={t('create_new_case', '创建新案件')}
      >
        {pageContent}
      </MobileOptimizedLayout>
    );
  }

  return pageContent;
};

export default CaseListPage;
