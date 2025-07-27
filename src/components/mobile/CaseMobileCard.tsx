import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Stack,
  Collapse,
  Divider,
  useTheme,
  alpha,
  SvgIcon,
  Tooltip,
} from '@mui/material';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiPencilOutline,
  mdiDotsHorizontal,
  mdiCalendar,
  mdiAccount,
  mdiOfficeBuilding,
} from '@mdi/js';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

// 案件数据接口
export interface CaseData {
  id: string;
  case_no: string;
  name?: string;
  procedure_type: string;
  status: string;
  responsible_person?: string;
  created_at: string;
  updated_at?: string;
  creator?: string;
  description?: string;
  company_name?: string;
  [key: string]: any;
}

// 操作接口
export interface CaseAction {
  icon: string;
  label: string;
  onClick: (caseData: CaseData) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: boolean;
  hideOnMobile?: boolean;
}

interface CaseMobileCardProps {
  case: CaseData;
  actions?: CaseAction[];
  onCardClick?: (caseData: CaseData) => void;
  showActions?: boolean;
  expandable?: boolean;
  compact?: boolean;
  showIndex?: boolean;
  index?: number;
}

// 状态配置
const STATUS_CONFIG = {
  '立案': { color: '#1976D2', bgColor: '#E3F2FD', label: '立案' },
  '进行中': { color: '#F57C00', bgColor: '#FFF3E0', label: '进行中' },
  '已完成': { color: '#388E3C', bgColor: '#E8F5E8', label: '已完成' },
  '终结': { color: '#616161', bgColor: '#F5F5F5', label: '终结' },
  'default': { color: '#757575', bgColor: '#F5F5F5', label: '未知' },
};

/**
 * 案件移动端卡片组件
 * 专为移动端优化的案件信息展示卡片
 */
const CaseMobileCard: React.FC<CaseMobileCardProps> = ({
  case: caseData,
  actions = [],
  onCardClick,
  showActions = true,
  expandable = true,
  compact = false,
  showIndex = false,
  index,
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  const [expanded, setExpanded] = useState(false);

  // 默认操作配置
  const defaultActions: CaseAction[] = [
    {
      icon: mdiEyeOutline,
      label: '查看',
      onClick: (data) => onCardClick?.(data),
      color: 'primary',
    },
    {
      icon: mdiFileDocumentOutline,
      label: '材料',
      onClick: (data) => console.log('查看材料', data.id),
      color: 'info',
    },
    {
      icon: mdiPencilOutline,
      label: '编辑',
      onClick: (data) => console.log('编辑案件', data.id),
      color: 'secondary',
    },
  ];

  const allActions = actions.length > 0 ? actions : defaultActions;
  const visibleActions = showActions ? allActions.filter(action => !action.hideOnMobile) : [];

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.default;
  };

  const statusConfig = getStatusConfig(caseData.status);

  // 格式化时间
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(caseData);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleActionClick = (action: CaseAction, e: React.MouseEvent) => {
    e.stopPropagation();
    action.onClick(caseData);
  };

  return (
    <Card
      sx={{
        mb: 1,
        borderRadius: 3,
        boxShadow: theme.shadows[2],
        cursor: onCardClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onCardClick ? {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-1px)',
        } : {},
      }}
      onClick={handleCardClick}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* 主要信息区域 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          {/* 左侧主要信息 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* 案件编号和序号 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {showIndex && typeof index === 'number' && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ mr: 1, fontWeight: 500 }}
                >
                  #{index + 1}
                </Typography>
              )}
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  fontSize: compact ? '0.9rem' : '1rem',
                }}
                noWrap
              >
                🏢 {caseData.case_no}
              </Typography>
            </Box>

            {/* 程序类型 */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ 
                mb: compact ? 0.5 : 1,
                fontSize: compact ? '0.8rem' : '0.875rem',
              }}
              noWrap
            >
              {caseData.procedure_type}
            </Typography>
          </Box>

          {/* 右侧状态标签 */}
          <Chip
            label={statusConfig.label}
            size="small"
            sx={{
              backgroundColor: statusConfig.bgColor,
              color: statusConfig.color,
              fontWeight: 500,
              fontSize: '0.75rem',
              height: 24,
              ml: 1,
            }}
          />
        </Box>

        {/* 次要信息区域 */}
        {!compact && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            {/* 负责人信息 */}
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <SvgIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }}>
                <path d={mdiAccount} />
              </SvgIcon>
              <Typography variant="caption" color="text.secondary" noWrap>
                {caseData.responsible_person || '未分配'}
              </Typography>
            </Box>

            {/* 时间信息 */}
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
              <SvgIcon sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }}>
                <path d={mdiCalendar} />
              </SvgIcon>
              <Typography variant="caption" color="text.secondary">
                {formatDate(caseData.created_at)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* 操作按钮区域 */}
        {visibleActions.length > 0 && (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mt: 1.5,
              pt: 1.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            {/* 主要操作按钮 */}
            <Stack direction="row" spacing={0.5}>
              {visibleActions.slice(0, 3).map((action, index) => (
                <Tooltip key={index} title={action.label}>
                  <IconButton
                    color={action.color || 'default'}
                    disabled={action.disabled}
                    onClick={(e) => handleActionClick(action, e)}
                    sx={touchFriendlyIconButtonSx}
                  >
                    <SvgIcon fontSize="small">
                      <path d={action.icon} />
                    </SvgIcon>
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>

            {/* 展开按钮和更多操作 */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              {visibleActions.length > 3 && (
                <Tooltip title="更多操作">
                  <IconButton
                    sx={touchFriendlyIconButtonSx}
                  >
                    <SvgIcon fontSize="small">
                      <path d={mdiDotsHorizontal} />
                    </SvgIcon>
                  </IconButton>
                </Tooltip>
              )}
              
              {expandable && (
                <Tooltip title={expanded ? '收起' : '展开详情'}>
                  <IconButton
                    onClick={handleToggleExpand}
                    sx={touchFriendlyIconButtonSx}
                    aria-label={expanded ? '收起' : '展开详情'}
                  >
                    <SvgIcon fontSize="small">
                      <path d={expanded ? mdiChevronUp : mdiChevronDown} />
                    </SvgIcon>
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>
        )}

        {/* 展开的详细信息 */}
        {expandable && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1}>
              {/* 公司名称 */}
              {caseData.company_name && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SvgIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }}>
                    <path d={mdiOfficeBuilding} />
                  </SvgIcon>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                    公司:
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {caseData.company_name}
                  </Typography>
                </Box>
              )}

              {/* 创建人 */}
              {caseData.creator && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    创建人:
                  </Typography>
                  <Typography variant="body2">
                    {caseData.creator}
                  </Typography>
                </Box>
              )}

              {/* 更新时间 */}
              {caseData.updated_at && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    更新时间:
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(caseData.updated_at)}
                  </Typography>
                </Box>
              )}

              {/* 描述信息 */}
              {caseData.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    描述:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {caseData.description}
                  </Typography>
                </Box>
              )}

              {/* 额外操作按钮 */}
              {visibleActions.length > 3 && (
                <Box sx={{ pt: 1 }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {visibleActions.slice(3).map((action, index) => (
                      <Tooltip key={index} title={action.label}>
                        <IconButton
                          color={action.color || 'default'}
                          disabled={action.disabled}
                          onClick={(e) => handleActionClick(action, e)}
                          sx={touchFriendlyIconButtonSx}
                        >
                          <SvgIcon fontSize="small">
                            <path d={action.icon} />
                          </SvgIcon>
                        </IconButton>
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseMobileCard;