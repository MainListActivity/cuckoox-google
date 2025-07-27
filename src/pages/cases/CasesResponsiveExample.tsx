import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurrealClient, AuthenticationRequiredError } from '@/src/contexts/SurrealProvider';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { RecordId } from 'surrealdb';
import { useOperationPermissions } from '@/src/hooks/useOperationPermission';
import {
  Box,
  Button,
  SvgIcon,
  Chip,
  Avatar,
  Typography,
  useTheme,
  alpha,
  TablePagination,
} from '@mui/material';
import {
  mdiPlusCircleOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiFileEditOutline,
  mdiCalendarEdit,
  mdiBriefcaseOutline,
  mdiProgressClock,
  mdiCheckCircle,
  mdiAlertCircle,
} from '@mdi/js';

// 导入新的响应式组件
import ResponsiveContainer from '@/src/components/common/ResponsiveContainer';
import ResponsiveTable, { ResponsiveTableColumn, ResponsiveTableAction } from '@/src/components/common/ResponsiveTable';
import ResponsiveStatsCards, { StatCardData } from '@/src/components/common/ResponsiveStatsCards';
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import MobileSearchFilter, { FilterOption } from '@/src/components/mobile/MobileSearchFilter';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

// 导入对话框组件
import ModifyCaseStatusDialog, { CaseStatus } from '@/src/components/case/ModifyCaseStatusDialog';
import MeetingMinutesDialog from '@/src/components/case/MeetingMinutesDialog';
import CreateCaseDialog from '@/src/components/case/CreateCaseDialog';
import { QuillDelta } from '@/src/components/RichTextEditor';

// 数据接口
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

interface CaseItem {
  id: string;
  case_number: string;
  case_lead_name: string;
  case_procedure: string;
  creator_name: string;
  current_stage: CaseStatus;
  acceptance_date: string;
}

/**
 * 响应式案件列表页面示例
 * 展示如何使用新的响应式组件优化移动端体验
 */
const CasesResponsiveExample: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbar();
  const theme = useTheme();
  const client = useSurrealClient();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();

  // 权限检查
  const { permissions, isLoading: isPermissionsLoading } = useOperationPermissions([
    'case_list_view',
    'case_create',
    'case_view_detail',
    'case_edit',
    'case_modify_status',
    'case_manage_members'
  ]);

  // 状态管理
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProcedure, setFilterProcedure] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 10 : 25);

  // 对话框状态
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [createCaseOpen, setCreateCaseOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);

  // 获取案件数据
  useEffect(() => {
    const fetchCases = async () => {
      if (!client) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
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
          
          const transformedCases: CaseItem[] = casesData
            .filter(caseData => caseData.id != null)
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
        
        if (err instanceof AuthenticationRequiredError) {
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

  // 统计数据
  const stats: StatCardData[] = [
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

  // 筛选选项
  const filterOptions: FilterOption[] = [
    {
      id: 'status',
      label: '案件状态',
      type: 'select',
      value: filterStatus,
      options: [
        { value: '立案', label: '立案' },
        { value: '债权申报', label: '债权申报' },
        { value: '债权人第一次会议', label: '债权人第一次会议' },
        { value: '裁定重整', label: '裁定重整' },
        { value: '破产财产分配', label: '破产财产分配' },
        { value: '终结', label: '终结' },
      ],
    },
    {
      id: 'procedure',
      label: '案件程序',
      type: 'select',
      value: filterProcedure,
      options: [
        { value: '破产清算', label: '破产清算' },
        { value: '破产和解', label: '破产和解' },
        { value: '破产重整', label: '破产重整' },
      ],
    },
  ];

  // 表格列定义
  const columns: ResponsiveTableColumn[] = [
    {
      id: 'case_number',
      label: t('case_number', '案件编号'),
      priority: 'high',
      format: (value) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'case_procedure',
      label: t('case_procedure', '案件程序'),
      priority: 'medium',
      hideOnMobile: true,
    },
    {
      id: 'case_lead_name',
      label: t('case_lead', '案件负责人'),
      priority: 'high',
      format: (value) => (
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
      hideOnMobile: true,
    },
    {
      id: 'acceptance_date',
      label: t('acceptance_date', '受理时间'),
      priority: 'medium',
      hideOnMobile: true,
    },
    {
      id: 'current_stage',
      label: t('current_stage', '程序进程'),
      priority: 'high',
      format: (value) => {
        const getStatusColor = (status: string) => {
          switch (status) {
            case '立案':
              return { color: '#1976D2', bgColor: alpha('#1976D2', 0.1) };
            case '债权申报':
              return { color: '#00897B', bgColor: alpha('#00897B', 0.1) };
            case '债权人第一次会议':
              return { color: '#7B1FA2', bgColor: alpha('#7B1FA2', 0.1) };
            case '终结':
              return { color: '#388E3C', bgColor: alpha('#388E3C', 0.1) };
            default:
              return { color: theme.palette.text.secondary, bgColor: theme.palette.action.hover };
          }
        };
        
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

  // 表格操作
  const actions: ResponsiveTableAction[] = [
    {
      icon: mdiEyeOutline,
      label: t('view_details', '查看详情'),
      onClick: (row) => navigate(`/cases/${row.id}`),
      color: 'primary',
      disabled: () => !permissions['case_view_detail'],
    },
    {
      icon: mdiFileDocumentOutline,
      label: t('view_documents', '查看材料'),
      onClick: (row) => navigate(`/cases/${row.id}`),
      color: 'info',
      disabled: () => !permissions['case_view_detail'],
      hideOnMobile: true,
    },
    {
      icon: mdiFileEditOutline,
      label: t('modify_status', '修改状态'),
      onClick: (row) => {
        setSelectedCase(row);
        setModifyStatusOpen(true);
      },
      color: 'secondary',
      disabled: () => !permissions['case_modify_status'],
    },
  ];

  // 处理筛选变化
  const handleFilterChange = (filterId: string, value: any) => {
    switch (filterId) {
      case 'status':
        setFilterStatus(value);
        break;
      case 'procedure':
        setFilterProcedure(value);
        break;
    }
  };

  // 清除筛选
  const handleClearFilters = () => {
    setFilterStatus('');
    setFilterProcedure('');
  };

  // 计算活跃筛选数量
  const activeFilterCount = [filterStatus, filterProcedure].filter(Boolean).length;

  // 筛选数据
  const filteredCases = cases.filter(caseItem => {
    if (searchValue && !caseItem.case_number.toLowerCase().includes(searchValue.toLowerCase()) &&
        !caseItem.case_lead_name.toLowerCase().includes(searchValue.toLowerCase())) {
      return false;
    }
    if (filterStatus && caseItem.current_stage !== filterStatus) {
      return false;
    }
    if (filterProcedure && caseItem.case_procedure !== filterProcedure) {
      return false;
    }
    return true;
  });

  // 分页数据
  const paginatedCases = filteredCases.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const content = (
    <ResponsiveContainer variant="mobile-optimized">
      {/* 统计卡片 */}
      <ResponsiveStatsCards
        stats={stats}
        loading={isLoading}
        variant={isMobile ? 'compact' : 'default'}
        columns={{ xs: 2, sm: 2, md: 4, lg: 4 }}
      />

      {/* 搜索和筛选 */}
      <MobileSearchFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={t('search_cases', '搜索案件...')}
        filters={filterOptions}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 创建按钮（桌面端） */}
      {!isMobile && permissions['case_create'] && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
            onClick={() => setCreateCaseOpen(true)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)',
            }}
          >
            {t('create_new_case', '创建新案件')}
          </Button>
        </Box>
      )}

      {/* 响应式表格 */}
      <ResponsiveTable
        columns={columns}
        data={paginatedCases}
        actions={actions}
        loading={isLoading}
        emptyMessage={t('no_cases', '暂无案件数据')}
        mobileCardVariant="detailed"
        showRowNumbers={!isMobile}
      />

      {/* 分页 */}
      {filteredCases.length > 0 && (
        <TablePagination
          component="div"
          count={filteredCases.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={isMobile ? [10, 25] : [10, 25, 50]}
          labelRowsPerPage={t('rows_per_page', '每页行数')}
          sx={{
            mt: 2,
            '& .MuiTablePagination-toolbar': {
              px: isMobile ? 1 : 2,
            },
          }}
        />
      )}

      {/* 对话框 */}
      {selectedCase && (
        <ModifyCaseStatusDialog
          open={modifyStatusOpen}
          onClose={() => setModifyStatusOpen(false)}
          currentCase={{ id: selectedCase.id, current_status: selectedCase.current_stage }}
        />
      )}
      
      <CreateCaseDialog
        open={createCaseOpen}
        onClose={() => setCreateCaseOpen(false)}
        onCaseCreated={(caseId, caseName) => {
          showSuccess(`案件"${caseName}"创建成功！`);
          setCreateCaseOpen(false);
          // 刷新数据
        }}
      />
    </ResponsiveContainer>
  );

  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title={t('case_management', '案件管理')}
        subtitle={`${filteredCases.length} 个案件`}
        showFab={permissions['case_create']}
        onFabClick={() => setCreateCaseOpen(true)}
        fabLabel={t('create_new_case', '创建新案件')}
      >
        {content}
      </MobileOptimizedLayout>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
        {t('case_management', '案件管理')}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('case_management_desc', '管理和跟踪所有破产案件的进展情况')}
      </Typography>
      {content}
    </Box>
  );
};

export default CasesResponsiveExample;