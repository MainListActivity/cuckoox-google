import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { ParseResult, ParsedField } from '@/src/types/pdfParser';
import { useFieldUpdate } from '@/src/hooks/usePDFParser';

interface ParseResultComponentProps {
  parseResult: ParseResult | null;
  onFieldEdit?: (field: ParsedField) => void;
  onFieldClick?: (fieldName: string) => void;
  readonly?: boolean;
  showSearch?: boolean;
  showFilter?: boolean;
  showSort?: boolean;
  highlightLowConfidence?: boolean;
  confidenceThreshold?: number;
  onFieldHighlight?: (field: ParsedField) => void;
}

type SortField = 'name' | 'confidence' | 'pageNumber' | 'dataType';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'modified' | 'lowConfidence' | 'errors';

const ParseResultComponent: React.FC<ParseResultComponentProps> = ({
  parseResult,
  onFieldEdit,
  onFieldClick,
  readonly = false,
  showSearch = true,
  showFilter = true,
  showSort = true,
  highlightLowConfidence = true,
  confidenceThreshold = 0.8,
  onFieldHighlight,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('confidence');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  const { isPending: isUpdating } = useFieldUpdate();

  // 筛选和排序字段
  const filteredAndSortedFields = useMemo(() => {
    if (!parseResult?.fields) return [];

    let filtered = parseResult.fields;

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        field => 
          field.displayName.toLowerCase().includes(term) ||
          field.name.toLowerCase().includes(term) ||
          String(field.value).toLowerCase().includes(term)
      );
    }

    // 类型过滤
    switch (filter) {
      case 'modified':
        filtered = filtered.filter(field => field.isModified);
        break;
      case 'lowConfidence':
        filtered = filtered.filter(field => field.confidence < confidenceThreshold);
        break;
      case 'errors':
        filtered = filtered.filter(field => field.confidence < 0.5);
        break;
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name') {
        aValue = a.displayName.toLowerCase();
        bValue = b.displayName.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [parseResult?.fields, searchTerm, filter, sortField, sortOrder, confidenceThreshold]);

  // 处理字段点击
  const handleFieldClick = useCallback((field: ParsedField) => {
    onFieldClick?.(field.name);
    onFieldHighlight?.(field);
  }, [onFieldClick, onFieldHighlight]);

  // 处理字段编辑
  const handleFieldEdit = useCallback((field: ParsedField, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!readonly) {
      onFieldEdit?.(field);
    }
  }, [readonly, onFieldEdit]);

  // 切换字段详情展开状态
  const toggleFieldExpansion = useCallback((fieldName: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  }, []);

  // 获取置信度颜色
  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.8) return 'primary';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  }, []);

  // 获取置信度图标
  const getConfidenceIcon = useCallback((confidence: number) => {
    if (confidence >= 0.8) return <CheckCircleIcon color="success" fontSize="small" />;
    if (confidence >= 0.6) return <WarningIcon color="warning" fontSize="small" />;
    return <ErrorIcon color="error" fontSize="small" />;
  }, []);

  // 格式化字段值显示
  const formatFieldValue = useCallback((field: ParsedField) => {
    if (field.value === null || field.value === undefined) {
      return <Typography variant="body2" color="text.disabled">未识别</Typography>;
    }

    switch (field.dataType) {
      case 'date':
        try {
          const date = new Date(field.value);
          return date.toLocaleDateString();
        } catch {
          return String(field.value);
        }
      case 'currency':
        return `¥${Number(field.value).toLocaleString()}`;
      case 'percentage':
        return `${(Number(field.value) * 100).toFixed(2)}%`;
      case 'number':
        return Number(field.value).toLocaleString();
      default:
        return String(field.value);
    }
  }, []);

  // 渲染工具栏
  const renderToolbar = () => {
    return (
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            解析结果
            {parseResult && (
              <Chip
                label={`${filteredAndSortedFields.length} 个字段`}
                size="small"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>

          {showSearch && (
            <TextField
              size="small"
              placeholder="搜索字段..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 200 }}
            />
          )}

          {showFilter && (
            <>
              <Tooltip title="筛选">
                <IconButton
                  onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                  color={filter !== 'all' ? 'primary' : 'default'}
                >
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={filterMenuAnchor}
                open={Boolean(filterMenuAnchor)}
                onClose={() => setFilterMenuAnchor(null)}
              >
                <MenuItem
                  selected={filter === 'all'}
                  onClick={() => { setFilter('all'); setFilterMenuAnchor(null); }}
                >
                  全部字段
                </MenuItem>
                <MenuItem
                  selected={filter === 'modified'}
                  onClick={() => { setFilter('modified'); setFilterMenuAnchor(null); }}
                >
                  已修正字段
                </MenuItem>
                <MenuItem
                  selected={filter === 'lowConfidence'}
                  onClick={() => { setFilter('lowConfidence'); setFilterMenuAnchor(null); }}
                >
                  低置信度字段
                </MenuItem>
                <MenuItem
                  selected={filter === 'errors'}
                  onClick={() => { setFilter('errors'); setFilterMenuAnchor(null); }}
                >
                  错误字段
                </MenuItem>
              </Menu>
            </>
          )}

          {showSort && (
            <>
              <Tooltip title="排序">
                <IconButton
                  onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                >
                  <SortIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={sortMenuAnchor}
                open={Boolean(sortMenuAnchor)}
                onClose={() => setSortMenuAnchor(null)}
              >
                <MenuItem
                  selected={sortField === 'name'}
                  onClick={() => { 
                    setSortField('name'); 
                    setSortOrder(sortField === 'name' && sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortMenuAnchor(null); 
                  }}
                >
                  按字段名称
                </MenuItem>
                <MenuItem
                  selected={sortField === 'confidence'}
                  onClick={() => { 
                    setSortField('confidence'); 
                    setSortOrder(sortField === 'confidence' && sortOrder === 'desc' ? 'asc' : 'desc');
                    setSortMenuAnchor(null); 
                  }}
                >
                  按置信度
                </MenuItem>
                <MenuItem
                  selected={sortField === 'pageNumber'}
                  onClick={() => { 
                    setSortField('pageNumber'); 
                    setSortOrder(sortField === 'pageNumber' && sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortMenuAnchor(null); 
                  }}
                >
                  按页码
                </MenuItem>
                <MenuItem
                  selected={sortField === 'dataType'}
                  onClick={() => { 
                    setSortField('dataType'); 
                    setSortOrder(sortField === 'dataType' && sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortMenuAnchor(null); 
                  }}
                >
                  按数据类型
                </MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Box>
    );
  };

  // 渲染字段详情
  const renderFieldDetails = (field: ParsedField) => {
    return (
      <Collapse in={expandedFields.has(field.name)}>
        <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>原始识别值:</strong> {field.originalValue || field.value}
            </Typography>
            <Typography variant="body2">
              <strong>来源文本:</strong> {field.sourceText}
            </Typography>
            <Typography variant="body2">
              <strong>数据类型:</strong> {field.dataType}
            </Typography>
            {field.isModified && (
              <>
                <Typography variant="body2">
                  <strong>修正人:</strong> {field.modifiedBy}
                </Typography>
                <Typography variant="body2">
                  <strong>修正时间:</strong> {field.modifiedAt?.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>修正原因:</strong> {field.modificationReason}
                </Typography>
              </>
            )}
          </Stack>
        </Box>
      </Collapse>
    );
  };

  // 如果没有解析结果
  if (!parseResult) {
    return (
      <Paper>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            暂无解析结果
          </Typography>
        </Box>
      </Paper>
    );
  }

  // 如果解析失败
  if (parseResult.status === 'failed') {
    return (
      <Paper>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            解析失败: {parseResult.error || '未知错误'}
          </Alert>
        </Box>
      </Paper>
    );
  }

  // 如果正在处理
  if (parseResult.status === 'processing') {
    return (
      <Paper>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            正在解析PDF文档...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderToolbar()}

      <TableContainer sx={{ flex: 1 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>字段名称</TableCell>
              <TableCell>识别值</TableCell>
              <TableCell align="center">置信度</TableCell>
              <TableCell align="center">页码</TableCell>
              <TableCell align="center">状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedFields.map((field) => (
              <React.Fragment key={field.name}>
                <TableRow
                  hover
                  onClick={() => handleFieldClick(field)}
                  sx={{
                    cursor: 'pointer',
                    ...(highlightLowConfidence && field.confidence < confidenceThreshold && {
                      backgroundColor: 'warning.light',
                    }),
                  }}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFieldExpansion(field.name);
                        }}
                      >
                        {expandedFields.has(field.name) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {field.displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {field.name}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Box>
                      {formatFieldValue(field)}
                      {field.isModified && (
                        <Chip
                          label="已修正"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                      {getConfidenceIcon(field.confidence)}
                      <Box sx={{ width: 60 }}>
                        <LinearProgress
                          variant="determinate"
                          value={field.confidence * 100}
                          color={getConfidenceColor(field.confidence)}
                        />
                      </Box>
                      <Typography variant="caption">
                        {Math.round(field.confidence * 100)}%
                      </Typography>
                    </Stack>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={`第${field.pageNumber}页`}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={field.dataType}
                      size="small"
                      color="default"
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFieldExpansion(field.name);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>

                      {!readonly && (
                        <Tooltip title="编辑字段">
                          <IconButton
                            size="small"
                            onClick={(e) => handleFieldEdit(field, e)}
                            disabled={isUpdating}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}

                      {field.isModified && (
                        <Tooltip title="查看修正历史">
                          <IconButton size="small">
                            <HistoryIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0 }}>
                    {renderFieldDetails(field)}
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredAndSortedFields.length === 0 && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            没有找到匹配的字段
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ParseResultComponent;