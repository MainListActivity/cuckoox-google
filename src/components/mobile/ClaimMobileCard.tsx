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
  mdiCurrencyUsd,
  mdiAccount,
  mdiPhone,
  mdiFileDocument,
  mdiPencilOutline,
  mdiEyeOutline,
  mdiGavel,
  mdiCalendar,
} from '@mdi/js';
import { Link } from 'react-router-dom';
import { touchFriendlyIconButtonSx } from '@/src/utils/touchTargetUtils';

export interface Claim {
  id: string;
  creditorName: string;
  creditorType: '组织' | '个人';
  creditorIdentifier: string;
  contactPersonName: string;
  contactPersonPhone: string;
  claim_number: string;
  assertedNature: string;
  assertedPrincipal: number;
  assertedInterest: number;
  assertedOtherFees: number;
  asserted_total: number;
  assertedAttachmentsLink?: string;
  approvedNature: string | null;
  approvedPrincipal: number | null;
  approvedInterest: number | null;
  approvedOtherFees: number | null;
  approved_total: number | null;
  approvedAttachmentsLink?: string | null;
  auditor: string;
  audit_status: '待审核' | '部分通过' | '已驳回' | '审核通过';
  audit_time: string;
  reviewOpinion?: string | null;
}

interface ClaimMobileCardProps {
  claim: Claim;
  isSelected: boolean;
  onSelectionChange: (claimId: string, selected: boolean) => void;
  formatCurrency: (amount: number | null) => string;
  getStatusChipColor: (status: Claim['audit_status']) => "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
}

/**
 * 债权申报管理移动端卡片组件
 * 提供债权信息的简洁展示和管理功能
 */
const ClaimMobileCard: React.FC<ClaimMobileCardProps> = ({
  claim,
  isSelected,
  onSelectionChange,
  formatCurrency,
  getStatusChipColor,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const hasApprovedData = claim.approved_total !== null;

  return (
    <Card 
      sx={{ 
        mb: 2,
        borderLeft: `4px solid ${theme.palette[getStatusChipColor(claim.audit_status)]?.main || theme.palette.grey[500]}`,
        backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.1) : 'background.paper',
        '&:hover': {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-1px)',
        },
        transition: 'all 0.2s ease-in-out',
      }}
      data-testid={`claim-card-${claim.id}`}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header with Selection */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
            <Checkbox
              checked={isSelected}
              onChange={(e) => onSelectionChange(claim.id, e.target.checked)}
              sx={{ mt: -1, mr: 1 }}
              size="small"
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight="600" color="primary" gutterBottom>
                {claim.claim_number}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                  <path d={mdiAccount} />
                </SvgIcon>
                <Typography variant="body2" color="text.secondary">
                  {claim.creditorName} ({claim.creditorType})
                </Typography>
              </Box>
            </Box>
          </Box>
          
          <Chip
            label={claim.audit_status}
            size="small"
            color={getStatusChipColor(claim.audit_status)}
            sx={{
              minHeight: 28,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        </Box>

        {/* Main Info */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              性质:
            </Typography>
            <Typography variant="body2" fontWeight="500">
              {claim.assertedNature}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
              <path d={mdiCurrencyUsd} />
            </SvgIcon>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              主张总额:
            </Typography>
            <Typography variant="body1" fontWeight="600" color="primary">
              {formatCurrency(claim.asserted_total)}
            </Typography>
          </Box>

          {hasApprovedData && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'success.main' }}>
                <path d={mdiGavel} />
              </SvgIcon>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                认定总额:
              </Typography>
              <Typography variant="body1" fontWeight="600" color="success.main">
                {formatCurrency(claim.approved_total)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Expanded Content */}
        <Collapse in={isExpanded}>
          <Divider sx={{ mb: 2 }} />
          
          {/* Contact Info */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="600" gutterBottom>
              联系信息
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiAccount} />
              </SvgIcon>
              <Typography variant="body2">
                联系人: {claim.contactPersonName || '-'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                <path d={mdiPhone} />
              </SvgIcon>
              <Typography variant="body2">
                电话: {claim.contactPersonPhone || '-'}
              </Typography>
            </Box>
            <Typography variant="body2">
              证件号: {claim.creditorIdentifier}
            </Typography>
          </Box>

          {/* Detailed Amounts */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="600" gutterBottom>
              金额明细
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              主张本金: {formatCurrency(claim.assertedPrincipal)}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              主张利息: {formatCurrency(claim.assertedInterest)}
            </Typography>
            <Typography variant="body2">
              主张其他: {formatCurrency(claim.assertedOtherFees)}
            </Typography>
          </Box>

          {/* Audit Info */}
          {claim.auditor && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                审核信息
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                  <path d={mdiAccount} />
                </SvgIcon>
                <Typography variant="body2">
                  审核人: {claim.auditor}
                </Typography>
              </Box>
              {claim.audit_time && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SvgIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }}>
                    <path d={mdiCalendar} />
                  </SvgIcon>
                  <Typography variant="body2">
                    审核时间: {claim.audit_time}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Review Opinion */}
          {claim.reviewOpinion && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                审核意见
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

          {/* Attachments */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {claim.assertedAttachmentsLink && (
              <Tooltip title="查看主张附件">
                <IconButton
                  component="a"
                  href={claim.assertedAttachmentsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ ...touchFriendlyIconButtonSx, color: 'info.main' }}
                  aria-label="查看主张附件"
                >
                  <SvgIcon>
                    <path d={mdiFileDocument} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}

            {claim.approvedAttachmentsLink && (
              <Tooltip title="查看认定附件">
                <IconButton
                  component="a"
                  href={claim.approvedAttachmentsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ ...touchFriendlyIconButtonSx, color: 'success.main' }}
                  aria-label="查看认定附件"
                >
                  <SvgIcon>
                    <path d={mdiFileDocument} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Action Button */}
          <Tooltip title={claim.audit_status === '待审核' ? "审核债权" : "查看详情"}>
            <IconButton
              component={Link}
              to={`/claims/${claim.id}/review`}
              sx={{
                ...touchFriendlyIconButtonSx,
                color: claim.audit_status === '待审核' ? 'warning.main' : 'primary.main',
              }}
              aria-label={claim.audit_status === '待审核' ? "审核债权" : "查看详情"}
            >
              <SvgIcon>
                <path d={claim.audit_status === '待审核' ? mdiPencilOutline : mdiEyeOutline} />
              </SvgIcon>
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ClaimMobileCard;