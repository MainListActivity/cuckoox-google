import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  Typography,
  IconButton,
  SvgIcon,
  Chip,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { mdiClose, mdiMagnify, mdiFilterOutline } from '@mdi/js';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhCN } from 'date-fns/locale';

export interface AdvancedSearchCriteria {
  // 全文检索选项
  useFullTextSearch?: boolean;
  fullTextSearch?: string;
  // 字段特定搜索
  creditorName?: string;
  claimNumber?: string;
  assertedAmountMin?: number;
  assertedAmountMax?: number;
  approvedAmountMin?: number;
  approvedAmountMax?: number;
  submissionDateStart?: string;
  submissionDateEnd?: string;
  reviewDateStart?: string;
  reviewDateEnd?: string;
  claimNature?: string;
  // 审核状态筛选
  reviewStatus?: string;
}

export interface AdvancedSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSearch: (criteria: AdvancedSearchCriteria) => void;
  onClear: () => void;
  initialCriteria?: Partial<AdvancedSearchCriteria>;
}

const defaultCriteria: AdvancedSearchCriteria = {
  useFullTextSearch: false,
  fullTextSearch: '',
  creditorName: '',
  claimNumber: '',
  assertedAmountMin: undefined,
  assertedAmountMax: undefined,
  approvedAmountMin: undefined,
  approvedAmountMax: undefined,
  submissionDateStart: '',
  submissionDateEnd: '',
  reviewDateStart: '',
  reviewDateEnd: '',
  claimNature: '',
  reviewStatus: '',
};

const AdvancedSearchDialog: React.FC<AdvancedSearchDialogProps> = ({
  open,
  onClose,
  onSearch,
  onClear,
  initialCriteria = {},
}) => {
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<AdvancedSearchCriteria>({
    ...defaultCriteria,
    ...initialCriteria,
  });

  // 重置表单
  const handleReset = () => {
    setCriteria(defaultCriteria);
  };

  // 执行搜索
  const handleSearch = () => {
    onSearch(criteria);
    onClose();
  };

  // 清除搜索条件
  const handleClear = () => {
    setCriteria(defaultCriteria);
    onClear();
    onClose();
  };

  // 检查是否有搜索条件
  const hasSearchCriteria = () => {
    return Object.entries(criteria).some(([key, value]) => {
      if (key === 'useFullTextSearch') return false; // 不考虑布尔值作为搜索条件
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number') return value !== undefined;
      return false;
    });
  };

  // 生成当前搜索条件的摘要
  const getSearchSummary = () => {
    const summary: string[] = [];
    
    if (criteria.useFullTextSearch && criteria.fullTextSearch) {
      summary.push(`全文搜索: "${criteria.fullTextSearch}"`);
    } else {
      if (criteria.creditorName) summary.push(`债权人: "${criteria.creditorName}"`);
      if (criteria.claimNumber) summary.push(`债权编号: "${criteria.claimNumber}"`);
      if (criteria.claimNature) summary.push(`债权性质: "${criteria.claimNature}"`);
    }
    
    if (criteria.reviewStatus) {
      summary.push(`审核状态: ${criteria.reviewStatus}`);
    }
    
    if (criteria.assertedAmountMin !== undefined || criteria.assertedAmountMax !== undefined) {
      const range = [
        criteria.assertedAmountMin ? `≥${criteria.assertedAmountMin}元` : '',
        criteria.assertedAmountMax ? `≤${criteria.assertedAmountMax}元` : '',
      ].filter(Boolean).join(' 且 ');
      summary.push(`主张金额: ${range}`);
    }

    if (criteria.approvedAmountMin !== undefined || criteria.approvedAmountMax !== undefined) {
      const range = [
        criteria.approvedAmountMin ? `≥${criteria.approvedAmountMin}元` : '',
        criteria.approvedAmountMax ? `≤${criteria.approvedAmountMax}元` : '',
      ].filter(Boolean).join(' 且 ');
      summary.push(`认定金额: ${range}`);
    }
    
    if (criteria.submissionDateStart || criteria.submissionDateEnd) {
      const dateRange = [
        criteria.submissionDateStart ? `从${new Date(criteria.submissionDateStart).toLocaleDateString()}` : '',
        criteria.submissionDateEnd ? `到${new Date(criteria.submissionDateEnd).toLocaleDateString()}` : '',
      ].filter(Boolean).join(' ');
      summary.push(`申报时间: ${dateRange}`);
    }
    
    return summary;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhCN}>
      <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SvgIcon color="primary">
              <path d={mdiFilterOutline} />
            </SvgIcon>
            <Typography variant="h6" component="div">
              债权高级搜索
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <SvgIcon fontSize="small">
              <path d={mdiClose} />
            </SvgIcon>
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 3 }}>
            {/* 全文搜索开关 */}
            <FormControlLabel
              control={
                <Switch
                  checked={criteria.useFullTextSearch}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    useFullTextSearch: e.target.checked,
                    // 如果切换到全文搜索，清除其他字段
                    ...(e.target.checked ? {
                      creditorName: '',
                      claimNumber: '',
                      claimNature: '',
                    } : { fullTextSearch: '' })
                  }))}
                  color="primary"
                />
              }
              label="使用全文搜索（推荐）"
              sx={{ mb: 2 }}
            />

            {criteria.useFullTextSearch ? (
              // 全文搜索模式
              <TextField
                fullWidth
                label="输入关键词进行全文搜索"
                value={criteria.fullTextSearch}
                onChange={(e) => setCriteria(prev => ({ ...prev, fullTextSearch: e.target.value }))}
                placeholder="可搜索债权编号、债权性质、债权描述等信息"
                InputProps={{
                  startAdornment: (
                    <SvgIcon sx={{ mr: 1 }} color="action">
                      <path d={mdiMagnify} />
                    </SvgIcon>
                  ),
                }}
                helperText="全文搜索支持中文分词，搜索速度更快"
              />
            ) : (
              // 字段搜索模式
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="债权人名称"
                    value={criteria.creditorName}
                    onChange={(e) => setCriteria(prev => ({ ...prev, creditorName: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="债权编号"
                    value={criteria.claimNumber}
                    onChange={(e) => setCriteria(prev => ({ ...prev, claimNumber: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="债权性质"
                    value={criteria.claimNature}
                    onChange={(e) => setCriteria(prev => ({ ...prev, claimNature: e.target.value }))}
                    size="small"
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 筛选条件 */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            筛选条件
          </Typography>

          <Grid container spacing={2}>
            {/* 审核状态 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>审核状态</InputLabel>
                <Select
                  value={criteria.reviewStatus}
                  label="审核状态"
                  onChange={(e) => setCriteria(prev => ({ ...prev, reviewStatus: e.target.value }))}
                >
                  <MenuItem value="">全部状态</MenuItem>
                  <MenuItem value="待审核">待审核</MenuItem>
                  <MenuItem value="审核通过">审核通过</MenuItem>
                  <MenuItem value="已驳回">已驳回</MenuItem>
                  <MenuItem value="需要补充">需要补充</MenuItem>
                  <MenuItem value="部分通过">部分通过</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 主张金额范围 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                主张金额范围（元）
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  type="number"
                  placeholder="最小值"
                  value={criteria.assertedAmountMin || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    assertedAmountMin: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>至</Typography>
                <TextField
                  type="number"
                  placeholder="最大值"
                  value={criteria.assertedAmountMax || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    assertedAmountMax: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Box>
            </Grid>

            {/* 认定金额范围 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                认定金额范围（元）
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  type="number"
                  placeholder="最小值"
                  value={criteria.approvedAmountMin || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    approvedAmountMin: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>至</Typography>
                <TextField
                  type="number"
                  placeholder="最大值"
                  value={criteria.approvedAmountMax || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    approvedAmountMax: e.target.value ? Number(e.target.value) : undefined 
                  }))}
                  size="small"
                  sx={{ flex: 1 }}
                />
              </Box>
            </Grid>

            {/* 申报日期范围 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                申报日期范围
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <DatePicker
                  label="开始日期"
                  value={criteria.submissionDateStart ? new Date(criteria.submissionDateStart) : null}
                  onChange={(date) => setCriteria(prev => ({ 
                    ...prev, 
                    submissionDateStart: date ? date.toISOString().split('T')[0] : '' 
                  }))}
                  slotProps={{ textField: { size: 'small', sx: { flex: 1 } } }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>至</Typography>
                <DatePicker
                  label="结束日期"
                  value={criteria.submissionDateEnd ? new Date(criteria.submissionDateEnd) : null}
                  onChange={(date) => setCriteria(prev => ({ 
                    ...prev, 
                    submissionDateEnd: date ? date.toISOString().split('T')[0] : '' 
                  }))}
                  slotProps={{ textField: { size: 'small', sx: { flex: 1 } } }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* 搜索条件摘要 */}
          {hasSearchCriteria() && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                当前搜索条件
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {getSearchSummary().map((item, index) => (
                  <Chip
                    key={index}
                    label={item}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleReset} color="inherit">
            重置
          </Button>
          <Button onClick={handleClear} color="inherit">
            清除并关闭
          </Button>
          <Button 
            onClick={handleSearch} 
            variant="contained" 
            startIcon={
              <SvgIcon fontSize="small">
                <path d={mdiMagnify} />
              </SvgIcon>
            }
            disabled={!hasSearchCriteria()}
          >
            搜索
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AdvancedSearchDialog;