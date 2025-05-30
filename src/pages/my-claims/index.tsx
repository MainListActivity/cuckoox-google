// TODO: Ensure routing for /my-claims/:claimId/submitted is set up in App.tsx to render SubmittedClaimDetailPage.tsx
// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Data - API should only return claims belonging to the logged-in creditor.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import PageContainer from '@/src/components/PageContainer';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import {
  mdiEye,
  mdiUndo,
  mdiPencil,
} from '@mdi/js';

interface Claim {
  id: string;
  submissionDate: string;
  claimNature: string;
  totalAmount: number;
  currency: string;
  reviewStatus: '待审核' | '审核通过' | '已驳回' | '审核不通过' | '需要补充';
  reviewOpinion?: string;
}

const MyClaimsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showWarning } = useSnackbar();

  // TODO: Fetch claims specific to the logged-in creditor from an API.
  const claimsData: Claim[] = [
    { id: 'CLAIM-001', submissionDate: '2023-10-26', claimNature: '普通债权', totalAmount: 15000, currency: 'CNY', reviewStatus: '待审核', reviewOpinion: '' },
    { id: 'CLAIM-002', submissionDate: '2023-10-20', claimNature: '有财产担保债权', totalAmount: 125000, currency: 'CNY', reviewStatus: '审核通过', reviewOpinion: '符合要求' },
    { id: 'CLAIM-003', submissionDate: '2023-09-15', claimNature: '劳动报酬', totalAmount: 8000, currency: 'CNY', reviewStatus: '已驳回', reviewOpinion: '材料不足，请补充合同和工资流水。' },
    { id: 'CLAIM-004', submissionDate: '2023-11-01', claimNature: '普通债权', totalAmount: 22000, currency: 'USD', reviewStatus: '需要补充', reviewOpinion: '请提供债权发生时间的证明。' },
  ];

  const formatCurrencyDisplay = (amount: number, currency: string) => {
    return amount.toLocaleString('en-US', { 
      style: 'currency', 
      currency: currency, 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const getStatusChipProps = (status: Claim['reviewStatus']) => {
    switch (status) {
      case '待审核':
        return { color: 'warning' as const, variant: 'outlined' as const };
      case '审核通过':
        return { color: 'success' as const, variant: 'outlined' as const };
      case '已驳回':
      case '审核不通过':
        return { color: 'error' as const, variant: 'outlined' as const };
      case '需要补充':
        return { color: 'info' as const, variant: 'outlined' as const };
      default:
        return { color: 'default' as const, variant: 'outlined' as const };
    }
  };
  
  const handleWithdraw = (claimId: string, status: Claim['reviewStatus']) => {
    if (status !== '待审核') {
      showWarning('只有"待审核"状态的债权才能撤回。');
      return;
    }
    console.log(`Withdraw claim ID: ${claimId}`);
    showSuccess(`债权 ${claimId} 已成功撤回 (模拟)。`);
  };

  const isWithdrawDisabled = (status: Claim['reviewStatus']) => status !== '待审核';
  const isEditDisabled = (status: Claim['reviewStatus']) => !['已驳回', '需要补充'].includes(status);

  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Box sx={{ 
          mb: 3, 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2
        }}>
          <Typography variant="h4" component="h1">
            我的债权申报
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/claims/submit')}
          >
            发起新的债权申报
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>债权编号</TableCell>
                <TableCell>申报时间</TableCell>
                <TableCell>债权性质</TableCell>
                <TableCell>主张债权总额</TableCell>
                <TableCell>审核状态</TableCell>
                <TableCell>审核意见</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claimsData.map((claim) => (
                <TableRow
                  key={claim.id}
                  sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <TableCell component="th" scope="row">
                    {claim.id}
                  </TableCell>
                  <TableCell>{claim.submissionDate}</TableCell>
                  <TableCell>{claim.claimNature}</TableCell>
                  <TableCell>{formatCurrencyDisplay(claim.totalAmount, claim.currency)}</TableCell>
                  <TableCell>
                    <Chip
                      label={claim.reviewStatus}
                      size="small"
                      {...getStatusChipProps(claim.reviewStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={claim.reviewOpinion || '-'}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {claim.reviewOpinion || '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/my-claims/${claim.id}/submitted`)}
                        >
                          <SvgIcon fontSize="small">
                            <path d={mdiEye} />
                          </SvgIcon>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="撤回">
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleWithdraw(claim.id, claim.reviewStatus)}
                            disabled={isWithdrawDisabled(claim.reviewStatus)}
                          >
                            <SvgIcon fontSize="small">
                              <path d={mdiUndo} />
                            </SvgIcon>
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <span>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => navigate(`/claims/submit/${claim.id}`)}
                            disabled={isEditDisabled(claim.reviewStatus)}
                          >
                            <SvgIcon fontSize="small">
                              <path d={mdiPencil} />
                            </SvgIcon>
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {claimsData.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body1" color="text.secondary">
                您目前没有已提交的债权申报。
              </Typography>
            </Box>
          )}
        </TableContainer>
      </Box>
    </PageContainer>
  );
};

export default MyClaimsPage;
