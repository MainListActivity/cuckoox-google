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
  alpha,
  useTheme,
} from '@mui/material';
import {
  mdiEye,
  mdiUndo,
  mdiPencil,
  mdiChevronDown,
  mdiChevronUp,
  mdiCurrencyUsd,
  mdiCalendar,
  mdiFileDocument,
  mdiGavel,
} from '@mdi/js';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

export interface Claim {
  id: string;
  claimNumber: string;
  submissionDate: string;
  claimNature: string;
  totalAmount: number;
  currency: string;
  reviewStatus: '待审核' | '审核通过' | '已驳回' | '审核不通过' | '需要补充' | '部分通过';
  reviewOpinion?: string;
  canWithdraw: boolean;
  canEdit: boolean;
  approvedAmount?: number;
}

interface MyClaimsMobileCardProps {
  claim: Claim;
  onViewDetails: (claimId: string) => void;
  onWithdraw: (claimId: string, claim: Claim) => void;
  onEdit: (claimId: string) => void;
  formatCurrencyDisplay: (amount: number, currency: string) => string;
  canEditClaim: boolean;
}

/**
 * 我的债权移动端卡片组件
 * 提供债权信息的简洁展示和操作功能
 */
const MyClaimsMobileCard: React.FC<MyClaimsMobileCardProps> = ({
  claim,
  onViewDetails,
  onWithdraw,
  onEdit,
  formatCurrencyDisplay,
  canEditClaim,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusChipProps = (status: Claim['reviewStatus']) => {
    switch (status) {
      case '待审核':
        return { 
          color: 'warning' as const, 
          variant: 'outlined' as const,
          bgcolor: alpha(theme.palette.warning.main, 0.1),
        };
      case '审核通过':
        return { 
          color: 'success' as const, 
          variant: 'outlined' as const,
          bgcolor: alpha(theme.palette.success.main, 0.1),
        };
      case '已驳回':
      case '审核不通过':
        return { 
          color: 'error' as const, 
          variant: 'outlined' as const,
          bgcolor: alpha(theme.palette.error.main, 0.1),
        };
      case '需要补充':
        return { 
          color: 'info' as const, 
          variant: 'outlined' as const,
          bgcolor: alpha(theme.palette.info.main, 0.1),
        };
      case '部分通过':
        return { 
          color: 'warning' as const, 
          variant: 'filled' as const,
          bgcolor: alpha(theme.palette.warning.main, 0.2),
        };
      default:
        return { 
          color: 'default' as const, 
          variant: 'outlined' as const,
          bgcolor: alpha(theme.palette.grey[500], 0.1),
        };
    }
  };

  const statusProps = getStatusChipProps(claim.reviewStatus);
  const hasApprovedAmount = claim.approvedAmount !== undefined;

  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: `4px solid ${theme.palette[statusProps.color]?.main || theme.palette.grey[500]}`,
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease-in-out',
      }}
      data-testid={`claim-card-${claim.id}`}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, mr: 1 }}>
            <Typography variant="subtitle1" fontWeight="600" color="primary" gutterBottom>
              {claim.claimNumber}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiCalendar} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary">
                {claim.submissionDate}
              </Typography>
            </Box>
          </Box>
          
          <Chip
            label={claim.reviewStatus}
            size="small"
            sx={{
              ...statusProps,
              minHeight: 28,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>

        {/* Main Info */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
              <path d={mdiFileDocument} />
            </SvgIcon>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              性质:
            </Typography>
            <Typography variant="body2" fontWeight="500">
              {claim.claimNature}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
              <path d={mdiCurrencyUsd} />
            </SvgIcon>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              主张金额:
            </Typography>
            <Typography variant="body1" fontWeight="600" color="primary">
              {formatCurrencyDisplay(claim.totalAmount, claim.currency)}
            </Typography>
          </Box>
        </Box>

        {/* Expanded Content */}
        <Collapse in={isExpanded}>
          <Divider sx={{ mb: 2 }} />
          
          {hasApprovedAmount && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'success.main' }}>
                <path d={mdiGavel} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                认定金额:
              </Typography>
              <Typography variant="body1" fontWeight="600" color="success.main">
                {formatCurrencyDisplay(claim.approvedAmount!, claim.currency)}
              </Typography>
            </Box>
          )}

          {claim.reviewOpinion && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                审核意见:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  bgcolor: alpha(theme.palette.grey[500], 0.1),
                  p: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                }}
              >
                {claim.reviewOpinion}
              </Typography>
            </Box>
          )}
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
            <Tooltip title="查看详情">
              <IconButton
                color="primary"
                onClick={() => onViewDetails(claim.id)}
                sx={touchFriendlyIconButtonSx}
                data-testid="view-details-button"
                aria-label="查看详情"
              >
                <SvgIcon>
                  <path d={mdiEye} />
                </SvgIcon>
              </IconButton>
            </Tooltip>
            
            {claim.canWithdraw && (
              <Tooltip title="撤回">
                <IconButton
                  color="warning"
                  onClick={() => onWithdraw(claim.id, claim)}
                  sx={touchFriendlyIconButtonSx}
                  data-testid="withdraw-button"
                  aria-label="撤回"
                >
                  <SvgIcon>
                    <path d={mdiUndo} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}
            
            {claim.canEdit && canEditClaim && (
              <Tooltip title="编辑">
                <IconButton
                  color="success"
                  onClick={() => onEdit(claim.id)}
                  sx={touchFriendlyIconButtonSx}
                  data-testid="edit-button"
                  aria-label="编辑"
                >
                  <SvgIcon>
                    <path d={mdiPencil} />
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

export default MyClaimsMobileCard;