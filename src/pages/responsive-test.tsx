import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  SvgIcon,
  Chip,
  Avatar,
} from '@mui/material';
import {
  mdiBriefcaseOutline,
  mdiProgressClock,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiEyeOutline,
  mdiPencilOutline,
  mdiDeleteOutline,
  mdiPlusCircleOutline,
} from '@mdi/js';

// 导入响应式组件
import ResponsiveContainer from '@/src/components/common/ResponsiveContainer';
import ResponsiveTable, { ResponsiveTableColumn, ResponsiveTableAction } from '@/src/components/common/ResponsiveTable';
import ResponsiveStatsCards, { StatCardData } from '@/src/components/common/ResponsiveStatsCards';
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import MobileSearchFilter, { FilterOption } from '@/src/components/mobile/MobileSearchFilter';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

// 模拟数据
const mockStats: StatCardData[] = [
  {
    id: 'total',
    label: '总案件数',
    value: 156,
    icon: mdiBriefcaseOutline,
    color: '#00897B',
    bgColor: 'rgba(0, 137, 123, 0.1)',
  },
  {
    id: 'active',
    label: '进行中',
    value: 89,
    icon: mdiProgressClock,
    color: '#00ACC1',
    bgColor: 'rgba(0, 172, 193, 0.1)',
  },
  {
    id: 'completed',
    label: '已完成',
    value: 45,
    icon: mdiCheckCircle,
    color: '#43A047',
    bgColor: 'rgba(67, 160, 71, 0.1)',
  },
  {
    id: 'pending',
    label: '待审核',
    value: 22,
    icon: mdiAlertCircle,
    color: '#FB8C00',
    bgColor: 'rgba(251, 140, 0, 0.1)',
  },
];

const mockTableData = [
  {
    id: '1',
    case_number: 'BK-2024-001',
    case_lead_name: '张律师',
    case_procedure: '破产清算',
    creator_name: '李管理员',
    acceptance_date: '2024-01-15',
    current_stage: '债权申报',
  },
  {
    id: '2',
    case_number: 'BK-2024-002',
    case_lead_name: '王律师',
    case_procedure: '破产重整',
    creator_name: '陈管理员',
    acceptance_date: '2024-01-20',
    current_stage: '立案',
  },
  {
    id: '3',
    case_number: 'BK-2024-003',
    case_lead_name: '刘律师',
    case_procedure: '破产和解',
    creator_name: '赵管理员',
    acceptance_date: '2024-02-01',
    current_stage: '终结',
  },
];

/**
 * 响应式组件测试页面
 * 用于验证各种响应式组件的功能和显示效果
 */
const ResponsiveTestPage: React.FC = () => {
  const { isMobile, deviceType, screenSize } = useResponsiveLayout();
  const [searchValue, setSearchValue] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 表格列定义
  const columns: ResponsiveTableColumn[] = [
    {
      id: 'case_number',
      label: '案件编号',
      priority: 'high',
      format: (value) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'case_procedure',
      label: '案件程序',
      priority: 'medium',
      hideOnMobile: true,
    },
    {
      id: 'case_lead_name',
      label: '负责人',
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
      label: '创建人',
      priority: 'low',
      hideOnMobile: true,
    },
    {
      id: 'acceptance_date',
      label: '受理时间',
      priority: 'medium',
      hideOnMobile: true,
    },
    {
      id: 'current_stage',
      label: '当前阶段',
      priority: 'high',
      format: (value) => (
        <Chip
          label={value}
          size="small"
          color={value === '终结' ? 'success' : 'primary'}
          variant="outlined"
        />
      ),
    },
  ];

  // 表格操作
  const actions: ResponsiveTableAction[] = [
    {
      icon: mdiEyeOutline,
      label: '查看',
      onClick: (row) => console.log('查看', row),
      color: 'primary',
    },
    {
      icon: mdiPencilOutline,
      label: '编辑',
      onClick: (row) => console.log('编辑', row),
      color: 'secondary',
      hideOnMobile: true,
    },
    {
      icon: mdiDeleteOutline,
      label: '删除',
      onClick: (row) => console.log('删除', row),
      color: 'error',
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
        { value: '终结', label: '终结' },
      ],
    },
  ];

  const handleFilterChange = (filterId: string, value: any) => {
    if (filterId === 'status') {
      setFilterStatus(value);
    }
  };

  const handleClearFilters = () => {
    setFilterStatus('');
  };

  const activeFilterCount = filterStatus ? 1 : 0;

  const content = (
    <ResponsiveContainer variant="mobile-optimized">
      {/* 设备信息显示 */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          当前设备信息
        </Typography>
        <Typography variant="body2">
          设备类型: {deviceType} | 屏幕尺寸: {screenSize} | 是否移动端: {isMobile ? '是' : '否'}
        </Typography>
      </Box>

      {/* 统计卡片测试 */}
      <Typography variant="h6" gutterBottom>
        统计卡片组件测试
      </Typography>
      <ResponsiveStatsCards
        stats={mockStats}
        variant={isMobile ? 'compact' : 'default'}
        columns={{ xs: 2, sm: 2, md: 4, lg: 4 }}
      />

      {/* 搜索筛选测试 */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        搜索筛选组件测试
      </Typography>
      <MobileSearchFilter
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="搜索案件..."
        filters={filterOptions}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 响应式表格测试 */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        响应式表格组件测试
      </Typography>
      <ResponsiveTable
        columns={columns}
        data={mockTableData}
        actions={actions}
        mobileCardVariant="detailed"
        showRowNumbers={!isMobile}
        onRowClick={(row) => console.log('点击行', row)}
      />

      {/* 桌面端创建按钮 */}
      {!isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
            onClick={() => console.log('创建新项目')}
          >
            创建新项目
          </Button>
        </Box>
      )}
    </ResponsiveContainer>
  );

  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title="响应式组件测试"
        subtitle="验证各种响应式组件"
        showFab={true}
        onFabClick={() => console.log('FAB点击')}
        fabLabel="创建"
      >
        {content}
      </MobileOptimizedLayout>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
        响应式组件测试页面
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        测试和验证各种响应式组件的功能和显示效果
      </Typography>
      {content}
    </Box>
  );
};

export default ResponsiveTestPage;