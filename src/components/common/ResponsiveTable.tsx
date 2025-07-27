import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  useTheme,
  useMediaQuery,
  Stack,
  Divider,
  SvgIcon,
  Tooltip,
} from '@mui/material';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiEyeOutline,
  mdiPencilOutline,
  mdiDeleteOutline,
} from '@mdi/js';

export interface ResponsiveTableColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string | React.ReactNode;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  priority?: 'high' | 'medium' | 'low'; // 用于移动端显示优先级
}

export interface ResponsiveTableAction {
  icon: string;
  label: string;
  onClick: (row: any) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: (row: any) => boolean;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps {
  columns: ResponsiveTableColumn[];
  data: any[];
  actions?: ResponsiveTableAction[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  size?: 'small' | 'medium';
  mobileCardVariant?: 'compact' | 'detailed';
  showRowNumbers?: boolean;
}

/**
 * 响应式表格组件
 * 在桌面端显示为传统表格，在移动端显示为卡片列表
 */
const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  data,
  actions = [],
  onRowClick,
  loading = false,
  emptyMessage = '暂无数据',
  stickyHeader = true,
  size = 'medium',
  mobileCardVariant = 'detailed',
  showRowNumbers = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // 根据设备类型过滤列
  const getVisibleColumns = () => {
    return columns.filter(column => {
      if (isMobile && column.hideOnMobile) return false;
      if (isTablet && column.hideOnTablet) return false;
      return true;
    });
  };

  // 获取移动端显示的主要信息列
  const getPrimaryColumns = () => {
    return columns.filter(col => col.priority === 'high').slice(0, 2);
  };

  // 获取移动端次要信息列
  const getSecondaryColumns = () => {
    return columns.filter(col => col.priority === 'medium' || col.priority === 'low');
  };

  // 渲染移动端卡片
  const renderMobileCard = (row: any, index: number) => {
    const primaryColumns = getPrimaryColumns();
    const secondaryColumns = getSecondaryColumns();
    const isExpanded = expandedRows.has(index);
    const visibleActions = actions.filter(action => !action.hideOnMobile);

    return (
      <Card
        key={index}
        sx={{
          mb: 1,
          cursor: onRowClick ? 'pointer' : 'default',
          '&:hover': onRowClick ? {
            boxShadow: theme.shadows[4],
          } : {},
        }}
        onClick={() => onRowClick?.(row)}
      >
        <CardContent sx={{ pb: mobileCardVariant === 'compact' ? 2 : 1 }}>
          {/* 主要信息 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              {showRowNumbers && (
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  #{index + 1}
                </Typography>
              )}
              {primaryColumns.map((column, colIndex) => (
                <Box key={column.id} sx={{ mb: colIndex === primaryColumns.length - 1 ? 0 : 0.5 }}>
                  <Typography
                    variant={colIndex === 0 ? 'subtitle1' : 'body2'}
                    sx={{
                      fontWeight: colIndex === 0 ? 600 : 400,
                      color: colIndex === 0 ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* 操作按钮 */}
            {visibleActions.length > 0 && (
              <Stack direction="row" spacing={0.5}>
                {visibleActions.slice(0, 2).map((action, actionIndex) => (
                  <Tooltip key={actionIndex} title={action.label}>
                    <IconButton
                      size="small"
                      color={action.color || 'default'}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick(row);
                      }}
                      disabled={action.disabled?.(row)}
                    >
                      <SvgIcon fontSize="small">
                        <path d={action.icon} />
                      </SvgIcon>
                    </IconButton>
                  </Tooltip>
                ))}
                {(secondaryColumns.length > 0 || visibleActions.length > 2) && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRowExpansion(index);
                    }}
                  >
                    <SvgIcon fontSize="small">
                      <path d={isExpanded ? mdiChevronUp : mdiChevronDown} />
                    </SvgIcon>
                  </IconButton>
                )}
              </Stack>
            )}
          </Box>

          {/* 展开的详细信息 */}
          {mobileCardVariant === 'detailed' && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={1}>
                {secondaryColumns.map((column) => (
                  <Box key={column.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      {column.label}:
                    </Typography>
                    <Typography variant="body2">
                      {column.format ? column.format(row[column.id]) : row[column.id] || '-'}
                    </Typography>
                  </Box>
                ))}
                
                {/* 额外的操作按钮 */}
                {visibleActions.length > 2 && (
                  <Box sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {visibleActions.slice(2).map((action, actionIndex) => (
                        <Tooltip key={actionIndex} title={action.label}>
                          <IconButton
                            size="small"
                            color={action.color || 'default'}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                            disabled={action.disabled?.(row)}
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

  // 渲染桌面端表格
  const renderDesktopTable = () => {
    const visibleColumns = getVisibleColumns();

    return (
      <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader={stickyHeader} size={size}>
          <TableHead>
            <TableRow>
              {showRowNumbers && (
                <TableCell sx={{ width: 60, fontWeight: 600 }}>序号</TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sx={{ fontWeight: 600 }}
                >
                  {column.label}
                </TableCell>
              ))}
              {actions.length > 0 && (
                <TableCell align="center" sx={{ fontWeight: 600, width: actions.length * 50 }}>
                  操作
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (showRowNumbers ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <Typography>加载中...</Typography>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (showRowNumbers ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  align="center"
                  sx={{ py: 4 }}
                >
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow
                  hover
                  key={index}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {showRowNumbers && (
                    <TableCell>{index + 1}</TableCell>
                  )}
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id} align={column.align}>
                      {column.format ? column.format(row[column.id]) : row[column.id]}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {actions.map((action, actionIndex) => (
                          <Tooltip key={actionIndex} title={action.label}>
                            <IconButton
                              size="small"
                              color={action.color || 'default'}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                              }}
                              disabled={action.disabled?.(row)}
                            >
                              <SvgIcon fontSize="small">
                                <path d={action.icon} />
                              </SvgIcon>
                            </IconButton>
                          </Tooltip>
                        ))}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (isMobile) {
    return (
      <Box>
        {loading ? (
          <Card>
            <CardContent>
              <Typography align="center">加载中...</Typography>
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <CardContent>
              <Typography align="center" color="text.secondary">
                {emptyMessage}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          data.map((row, index) => renderMobileCard(row, index))
        )}
      </Box>
    );
  }

  return renderDesktopTable();
};

export default ResponsiveTable;