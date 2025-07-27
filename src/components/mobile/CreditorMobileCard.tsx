import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  SvgIcon,
  Checkbox,
  alpha,
  useTheme,
} from '@mui/material';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiAccount,
  mdiPhone,
  mdiMapMarker,
  mdiCardAccountDetailsOutline,
  mdiPencilOutline,
  mdiDeleteOutline,
  mdiCurrencyUsd,
  mdiFileDocumentMultipleOutline,
  mdiCalendar,
} from '@mdi/js';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

export interface Creditor {
  id: string;
  name: string;
  identifier: string;
  contact_person_name: string;
  contact_person_phone: string;
  address: string;
  type: '组织' | '个人';
  case_id: string;
  created_at: string;
  updated_at?: string;
  total_claim_amount: number;
  claim_count: number;
}

interface CreditorMobileCardProps {
  creditor: Creditor;
  isSelected: boolean;
  onSelectionChange: (creditorId: string, selected: boolean) => void;
  onEdit?: (creditor: Creditor) => void;
  onDelete?: (creditor: Creditor) => void;
  onViewClaims?: (creditor: Creditor) => void;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * 债权人管理移动端卡片组件
 * 提供债权人信息的简洁展示和管理功能
 */
const CreditorMobileCard: React.FC<CreditorMobileCardProps> = ({
  creditor,
  isSelected,
  onSelectionChange,
  onEdit,
  onDelete,
  onViewClaims,
  canEdit,
  canDelete,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTypeChipColor = (type: string) => {
    return type === '组织' ? 'primary' : 'secondary';
  };

  const hasClaimsData = creditor.claim_count > 0;

  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: `4px solid ${creditor.type === '组织' ? theme.palette.primary.main : theme.palette.secondary.main}`,
        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'background.paper',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease-in-out',
      }}
      data-testid={`creditor-card-${creditor.id}`}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header with Selection */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
            <Checkbox
              checked={isSelected}
              onChange={(e) => onSelectionChange(creditor.id, e.target.checked)}
              sx={{ mt: -1, mr: 1 }}
              size="small"
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight="600" color="primary" gutterBottom>
                {creditor.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                  <path d={mdiCardAccountDetailsOutline} />
                </SvgIcon>
                <Typography variant="body2" color="text.secondary">
                  {creditor.identifier}
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Chip
            label={creditor.type}
            size="small"
            color={getTypeChipColor(creditor.type)}
            sx={{
              minHeight: 28,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>

        {/* Main Info */}
        <Box sx={{ mb: 2 }}>
          {creditor.contact_person_name && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiAccount} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                联系人:
              </Typography>
              <Typography variant="body2" fontWeight="500">
                {creditor.contact_person_name}
              </Typography>
            </Box>
          )}

          {creditor.contact_person_phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiPhone} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                电话:
              </Typography>
              <Typography variant="body2" fontWeight="500">
                {creditor.contact_person_phone}
              </Typography>
            </Box>
          )}

          {/* Claims Summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'success.main' }}>
                <path d={mdiCurrencyUsd} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                债权总额:
              </Typography>
              <Typography variant="body1" fontWeight="600" color="success.main">
                {formatCurrency(creditor.total_claim_amount)}
              </Typography>
            </Box>

            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                cursor: hasClaimsData ? 'pointer' : 'default',
                '&:hover': hasClaimsData ? { 
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  borderRadius: 1,
                  px: 1,
                } : {}
              }}
              onClick={hasClaimsData && onViewClaims ? () => onViewClaims(creditor) : undefined}
            >
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: hasClaimsData ? 'primary.main' : 'text.secondary' }}>
                <path d={mdiFileDocumentMultipleOutline} />
              </SvgIcon>
              <Typography 
                variant="body2" 
                color={hasClaimsData ? 'primary.main' : 'text.secondary'} 
                sx={{ mr: 1 }}
              >
                债权数:
              </Typography>
              <Typography 
                variant="body1" 
                fontWeight="600" 
                color={hasClaimsData ? 'primary.main' : 'text.secondary'}
              >
                {creditor.claim_count}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Expanded Content */}
        <Collapse in={isExpanded}>
          <Divider sx={{ mb: 2 }} />
          
          {/* Address */}
          {creditor.address && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                联系地址
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary', mt: 0.2 }}>
                  <path d={mdiMapMarker} />
                </SvgIcon>
                <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.5 }}>
                  {creditor.address}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Created Time */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="600" gutterBottom>
              创建时间
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiCalendar} />
              </SvgIcon>
              <Typography variant="body2">
                {new Date(creditor.created_at).toLocaleString('zh-CN')}
              </Typography>
            </Box>
          </Box>
        </Collapse>

        {/* Actions */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          pt: 1,
        }}>
          {/* Expand Toggle */}
          <IconButton
            onClick={() => setIsExpanded(!isExpanded)}
            sx={{
              ...touchFriendlyIconButtonSx,
              color: 'text.secondary',
            }}
            aria-label={isExpanded ? "收起详情" : "展开详情"}
          >
            <SvgIcon>
              <path d={isExpanded ? mdiChevronUp : mdiChevronDown} />
            </SvgIcon>
          </IconButton>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canEdit && onEdit && (
              <Tooltip title="编辑债权人">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(creditor);
                  }}
                  sx={{ ...touchFriendlyIconButtonSx, color: 'primary.main' }}
                  aria-label="编辑债权人"
                >
                  <SvgIcon>
                    <path d={mdiPencilOutline} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}

            {canDelete && onDelete && (
              <Tooltip title="删除债权人">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(creditor);
                  }}
                  sx={{ ...touchFriendlyIconButtonSx, color: 'error.main' }}
                  aria-label="删除债权人"
                >
                  <SvgIcon>
                    <path d={mdiDeleteOutline} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CreditorMobileCard;