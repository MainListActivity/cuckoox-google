import React, { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  SvgIcon,
  Drawer,
  Typography,
  Button,
  Stack,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  mdiMagnify,
  mdiFilterVariant,
  mdiClose,
  mdiCheck,
  mdiChevronDown,
  mdiChevronUp,
} from '@mdi/js';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

export interface FilterOption {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange';
  options?: { value: string; label: string }[];
  value?: any;
  placeholder?: string;
}

interface MobileSearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  filterOptions?: FilterOption[]; // backward compatibility
  onFilterChange?: (filterId: string, value: any) => void;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  showSearchBar?: boolean;
  compact?: boolean;
}

/**
 * 移动端优化的搜索和筛选组件
 * 在移动端提供抽屉式筛选界面，桌面端显示内联筛选
 */
const MobileSearchFilter: React.FC<MobileSearchFilterProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = '搜索...',
  filters = [],
  filterOptions = [], // backward compatibility
  onFilterChange,
  onClearFilters,
  activeFilterCount = 0,
  showSearchBar = true,
  compact = false,
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());

  // Merge filters and filterOptions for backward compatibility
  const allFilters = filters.length > 0 ? filters : filterOptions;

  const handleFilterChange = (filterId: string, value: any) => {
    onFilterChange?.(filterId, value);
  };

  const renderFilterControl = (filter: FilterOption) => {
    switch (filter.type) {
      case 'select':
        return (
          <FormControl fullWidth size="small" key={filter.id}>
            <InputLabel>{filter.label}</InputLabel>
            <Select
              value={filter.value || ''}
              label={filter.label}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            >
              <MenuItem value="">
                <em>全部</em>
              </MenuItem>
              {filter.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        return (
          <Box key={filter.id}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {filter.label}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {filter.options?.map((option) => {
                const isSelected = Array.isArray(filter.value) && filter.value.includes(option.value);
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color={isSelected ? 'primary' : 'default'}
                    size="small"
                    onClick={() => {
                      const currentValues = Array.isArray(filter.value) ? filter.value : [];
                      const newValues = isSelected
                        ? currentValues.filter(v => v !== option.value)
                        : [...currentValues, option.value];
                      handleFilterChange(filter.id, newValues);
                    }}
                    icon={isSelected ? <SvgIcon fontSize="small"><path d={mdiCheck} /></SvgIcon> : undefined}
                  />
                );
              })}
            </Stack>
          </Box>
        );

      case 'date':
        return (
          <TextField
            key={filter.id}
            fullWidth
            size="small"
            type="date"
            label={filter.label}
            value={filter.value || ''}
            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );

      default:
        return null;
    }
  };

  // 移动端筛选抽屉
  const renderMobileFilterDrawer = () => (
    <Drawer
      anchor="bottom"
      open={filterDrawerOpen}
      onClose={() => setFilterDrawerOpen(false)}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* 抽屉头部 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">筛选条件</Typography>
          <IconButton 
            onClick={() => setFilterDrawerOpen(false)}
            sx={touchFriendlyIconButtonSx}
            aria-label="关闭"
          >
            <SvgIcon>
              <path d={mdiClose} />
            </SvgIcon>
          </IconButton>
        </Box>

        {/* 筛选控件 */}
        <Stack spacing={3}>
          {allFilters.map((filter) => renderFilterControl(filter))}
        </Stack>

        {/* 底部操作按钮 */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => {
              onClearFilters?.();
              setFilterDrawerOpen(false);
            }}
          >
            清除筛选
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={() => setFilterDrawerOpen(false)}
          >
            确定
          </Button>
        </Box>
      </Box>
    </Drawer>
  );

  // 桌面端内联筛选
  const renderDesktopFilters = () => (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {allFilters.slice(0, compact ? 2 : 4).map((filter) => (
          <Box key={filter.id} sx={{ minWidth: 200 }}>
            {renderFilterControl(filter)}
          </Box>
        ))}
        
        {allFilters.length > (compact ? 2 : 4) && (
          <Button
            variant="outlined"
            startIcon={
              <SvgIcon>
                <path d={expandedFilters.size > 0 ? mdiChevronUp : mdiChevronDown} />
              </SvgIcon>
            }
            onClick={() => {
              if (expandedFilters.size > 0) {
                setExpandedFilters(new Set());
              } else {
                setExpandedFilters(new Set(allFilters.map(f => f.id)));
              }
            }}
          >
            更多筛选
          </Button>
        )}
      </Stack>

      {/* 展开的额外筛选项 */}
      <Collapse in={expandedFilters.size > 0}>
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {allFilters.slice(compact ? 2 : 4).map((filter) => (
              <Box key={filter.id} sx={{ minWidth: 200 }}>
                {renderFilterControl(filter)}
              </Box>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );

  return (
    <Box>
      {/* 搜索栏 */}
      {showSearchBar && (
        <Box sx={{ mb: isMobile ? 1 : 2 }}>
          <TextField
            fullWidth
            size={isMobile ? 'medium' : 'small'}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SvgIcon color="action">
                    <path d={mdiMagnify} />
                  </SvgIcon>
                </InputAdornment>
              ),
              endAdornment: isMobile && allFilters.length > 0 && (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setFilterDrawerOpen(true)}
                    color={activeFilterCount > 0 ? 'primary' : 'default'}
                    sx={touchFriendlyIconButtonSx}
                    aria-label="筛选"
                  >
                    <SvgIcon>
                      <path d={mdiFilterVariant} />
                    </SvgIcon>
                  </IconButton>
                  {activeFilterCount > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.primary.main,
                      }}
                    />
                  )}
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: isMobile ? 2 : 1,
              },
            }}
          />
        </Box>
      )}

      {/* 活跃筛选标签 */}
      {activeFilterCount > 0 && (
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              已应用 {activeFilterCount} 个筛选条件
            </Typography>
            <Button
              size="small"
              onClick={onClearFilters}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              清除
            </Button>
          </Stack>
        </Box>
      )}

      {/* 筛选控件 */}
      {allFilters.length > 0 && (
        <>
          {isMobile ? renderMobileFilterDrawer() : renderDesktopFilters()}
        </>
      )}
    </Box>
  );
};

export default MobileSearchFilter;