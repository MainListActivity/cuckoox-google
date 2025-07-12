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
  // 基础信息搜索
  name: string;
  identifier: string;
  contactPersonName: string;
  contactPhone: string;
  address: string;
  
  // 类型筛选
  type: 'all' | 'organization' | 'individual';
  
  // 债权金额范围搜索
  minClaimAmount: string;
  maxClaimAmount: string;
  
  // 时间范围搜索
  createdAfter: Date | null;
  createdBefore: Date | null;
  
  // 全文搜索
  fullTextSearch: string;
  useFullTextSearch: boolean;
}

export interface AdvancedSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSearch: (criteria: AdvancedSearchCriteria) => void;
  onClear: () => void;
  initialCriteria?: Partial<AdvancedSearchCriteria>;
}

const defaultCriteria: AdvancedSearchCriteria = {
  name: '',
  identifier: '',
  contactPersonName: '',
  contactPhone: '',
  address: '',
  type: 'all',
  minClaimAmount: '',
  maxClaimAmount: '',
  createdAfter: null,
  createdBefore: null,
  fullTextSearch: '',
  useFullTextSearch: false,
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
      if (key === 'type') return value !== 'all';
      if (typeof value === 'string') return value.trim() !== '';
      if (value instanceof Date) return value !== null;
      if (typeof value === 'boolean') return false; // 不考虑布尔值作为搜索条件
      return false;
    });
  };

  // 生成当前搜索条件的摘要
  const getSearchSummary = () => {
    const summary: string[] = [];
    
    if (criteria.useFullTextSearch && criteria.fullTextSearch) {
      summary.push(`全文搜索: "${criteria.fullTextSearch}"`);
    } else {
      if (criteria.name) summary.push(`姓名: "${criteria.name}"`);
      if (criteria.identifier) summary.push(`证件号: "${criteria.identifier}"`);
      if (criteria.contactPersonName) summary.push(`联系人: "${criteria.contactPersonName}"`);
      if (criteria.contactPhone) summary.push(`电话: "${criteria.contactPhone}"`);
      if (criteria.address) summary.push(`地址: "${criteria.address}"`);
    }
    
    if (criteria.type !== 'all') {
      summary.push(`类型: ${criteria.type === 'organization' ? '组织' : '个人'}`);
    }
    
    if (criteria.minClaimAmount || criteria.maxClaimAmount) {
      const range = [
        criteria.minClaimAmount ? `≥${criteria.minClaimAmount}元` : '',
        criteria.maxClaimAmount ? `≤${criteria.maxClaimAmount}元` : '',
      ].filter(Boolean).join(' 且 ');
      summary.push(`债权金额: ${range}`);
    }
    
    if (criteria.createdAfter || criteria.createdBefore) {
      const dateRange = [
        criteria.createdAfter ? `从${criteria.createdAfter.toLocaleDateString()}` : '',
        criteria.createdBefore ? `到${criteria.createdBefore.toLocaleDateString()}` : '',
      ].filter(Boolean).join(' ');
      summary.push(`创建时间: ${dateRange}`);
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
              {t('advanced_search_title', '高级搜索')}
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
                      name: '',
                      identifier: '',
                      contactPersonName: '',
                      contactPhone: '',
                      address: '',
                    } : { fullTextSearch: '' })
                  }))}
                  color="primary"
                />
              }
              label={t('use_fulltext_search', '使用全文搜索（推荐）')}
              sx={{ mb: 2 }}
            />

            {criteria.useFullTextSearch ? (
              // 全文搜索模式
              <TextField
                fullWidth
                label={t('fulltext_search_placeholder', '输入关键词进行全文搜索')}
                value={criteria.fullTextSearch}
                onChange={(e) => setCriteria(prev => ({ ...prev, fullTextSearch: e.target.value }))}
                placeholder={t('fulltext_search_hint', '可搜索姓名、证件号、联系人、电话、地址等信息')}
                InputProps={{
                  startAdornment: (
                    <SvgIcon sx={{ mr: 1 }} color="action">
                      <path d={mdiMagnify} />
                    </SvgIcon>
                  ),
                }}
                helperText={t('fulltext_search_help', '全文搜索支持中文分词，搜索速度更快')}
              />
            ) : (
              // 字段搜索模式
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('creditor_name', '债权人姓名')}
                    value={criteria.name}
                    onChange={(e) => setCriteria(prev => ({ ...prev, name: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('creditor_identifier', '证件号码')}
                    value={criteria.identifier}
                    onChange={(e) => setCriteria(prev => ({ ...prev, identifier: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('contact_person_name', '联系人姓名')}
                    value={criteria.contactPersonName}
                    onChange={(e) => setCriteria(prev => ({ ...prev, contactPersonName: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('contact_phone', '联系电话')}
                    value={criteria.contactPhone}
                    onChange={(e) => setCriteria(prev => ({ ...prev, contactPhone: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label={t('creditor_address', '联系地址')}
                    value={criteria.address}
                    onChange={(e) => setCriteria(prev => ({ ...prev, address: e.target.value }))}
                    size="small"
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 筛选条件 */}
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            {t('filter_conditions', '筛选条件')}
          </Typography>

          <Grid container spacing={2}>
            {/* 债权人类型 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('creditor_type', '债权人类型')}</InputLabel>
                <Select
                  value={criteria.type}
                  label={t('creditor_type', '债权人类型')}
                  onChange={(e) => setCriteria(prev => ({ ...prev, type: e.target.value as typeof criteria.type }))}
                >
                  <MenuItem value="all">{t('all_types', '全部类型')}</MenuItem>
                  <MenuItem value="organization">{t('organization', '组织')}</MenuItem>
                  <MenuItem value="individual">{t('individual', '个人')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* 债权金额范围 */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label={t('min_claim_amount', '最小债权金额')}
                value={criteria.minClaimAmount}
                onChange={(e) => setCriteria(prev => ({ ...prev, minClaimAmount: e.target.value }))}
                size="small"
                type="number"
                InputProps={{ endAdornment: '元' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label={t('max_claim_amount', '最大债权金额')}
                value={criteria.maxClaimAmount}
                onChange={(e) => setCriteria(prev => ({ ...prev, maxClaimAmount: e.target.value }))}
                size="small"
                type="number"
                InputProps={{ endAdornment: '元' }}
              />
            </Grid>

            {/* 创建时间范围 */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label={t('created_after', '创建时间从')}
                value={criteria.createdAfter}
                onChange={(date) => setCriteria(prev => ({ ...prev, createdAfter: date }))}
                slotProps={{ 
                  textField: { 
                    size: 'small',
                    fullWidth: true 
                  } 
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DatePicker
                label={t('created_before', '创建时间到')}
                value={criteria.createdBefore}
                onChange={(date) => setCriteria(prev => ({ ...prev, createdBefore: date }))}
                slotProps={{ 
                  textField: { 
                    size: 'small',
                    fullWidth: true 
                  } 
                }}
              />
            </Grid>
          </Grid>

          {/* 搜索条件预览 */}
          {hasSearchCriteria() && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('search_preview', '搜索条件预览')}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {getSearchSummary().map((item, index) => (
                  <Chip
                    key={index}
                    label={item}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={handleReset} 
            variant="outlined" 
            color="inherit"
            disabled={!hasSearchCriteria()}
          >
            {t('reset_form', '重置')}
          </Button>
          <Button 
            onClick={handleClear} 
            variant="outlined" 
            color="warning"
          >
            {t('clear_search', '清除搜索')}
          </Button>
          <Button 
            onClick={handleSearch} 
            variant="contained" 
            color="primary"
            startIcon={
              <SvgIcon fontSize="small">
                <path d={mdiMagnify} />
              </SvgIcon>
            }
            disabled={!hasSearchCriteria()}
          >
            {t('start_search', '开始搜索')}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AdvancedSearchDialog;