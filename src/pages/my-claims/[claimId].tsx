// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Verify this claimId belongs to the logged-in creditor OR if an admin is viewing, different rules might apply (though this page is creditor-focused).
// Workflow: This page displays a read-only view of the claim as per product requirements.
import React, { useState, useEffect } from 'react';
import ClaimDetailView from '@/src/components/claim/ClaimDetailView';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from '@/src/components/PageContainer';
import { 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip, 
  Divider,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import GlobalLoader from '@/src/components/GlobalLoader';
import { useTranslation } from 'react-i18next';

// Import mobile components
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { 
  mdiFileDocumentOutline, 
  mdiCurrencyUsd, 
  mdiCalendar, 
  mdiInformation,
  mdiAttachment 
} from '@mdi/js';
import { SvgIcon } from '@mui/material';

// Define the structure for ClaimData, matching ClaimDetailView's expected props
// This interface should ideally be shared if it's used across multiple files.
interface ClaimData {
  id: string;
  claimNature: string;
  principal: string | number;
  interest: string | number;
  otherFees: string | number;
  totalAmount: string | number;
  currency: string;
  briefDescription?: string;
  attachmentsContent: string;
  reviewStatus: string;
  submissionDate: string;
}

// Initial placeholder claim data (will be overridden by mock fetch)
const initialPlaceholderClaim: ClaimData = {
  id: 'LOADING...',
  claimNature: '普通债权',
  principal: 10000,
  interest: 500,
  otherFees: 60,
  totalAmount: 10560,
  currency: 'CNY',
  briefDescription: '这是关于一项未付服务费用的债权。服务已提供，但款项逾期未付。已多次尝试沟通，未果。',
  attachmentsContent: `
    <h3>附件列表</h3>
    <p>以下是本次申报提交的附件材料：</p>
    <ul>
      <li><a href="#" target="_blank" rel="noopener noreferrer">合同扫描件.pdf</a> (模拟链接)</li>
      <li><a href="#" target="_blank" rel="noopener noreferrer">发票截图.png</a> (模拟链接)</li>
      <li><a href="#" target="_blank" rel="noopener noreferrer">沟通邮件记录.docx</a> (模拟链接)</li>
    </ul>
    <p><strong>详细说明：</strong></p>
    <p>合同签订于2023年1月15日，约定服务期为3个月，总金额10000元。服务按时完成，有验收记录。
    利息按合同约定年化5%计算，其他费用为催收通讯费60元。</p>
    <img src="https://via.placeholder.com/400x200.png?text=Sample+Chart+Placeholder" alt="Sample Chart" style="margin-top: 10px; max-width: 100%; border-radius: 4px;" />
  `,
  reviewStatus: '待审核',
  submissionDate: '2023-10-27',
};


const SubmittedClaimDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();

  const [claimToView, setClaimToView] = useState<ClaimData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (claimId) {
      setIsLoading(true);
      setError(null);
      console.log(`Fetching details for claim ID: ${claimId}`);
      // Simulate API call
      setTimeout(() => {
        // In a real app, you'd fetch from an API. Here, we'll use the placeholder and update its ID.
        const mockFetchedClaim: ClaimData = {
          ...initialPlaceholderClaim, // Use the defined placeholder
          id: claimId,
          submissionDate: '2023-11-05', // Example of potentially dynamic data
          // Potentially add more dynamic elements based on claimId if needed for demo
        };
        setClaimToView(mockFetchedClaim);
        setIsLoading(false);
      }, 500);
    } else {
      setError("No claim ID provided.");
      setIsLoading(false);
    }
  }, [claimId]);

  if (isLoading) {
    return <GlobalLoader message="Loading claim details..." />;
  }

  if (error) {
    return (
      <PageContainer>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
          <Typography variant="body1" color="error">
            Error: {error}
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!claimToView) {
    return (
      <PageContainer>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
          <Typography variant="body1" color="text.secondary">
            Claim not found.
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  // Format currency for display
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(num);
  };

  // Get status color for chips
  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case '待审核': return 'warning';
      case '审核通过': return 'success';
      case '需要补充': return 'info';
      case '审核不通过': return 'error';
      default: return 'default';
    }
  };

  // Mobile rendering
  if (isMobile) {
    return (
      <MobileOptimizedLayout
        title={`债权详情 - ${claimToView?.id || claimId}`}
        showBackButton={true}
        onBackClick={() => navigate('/my-claims')}
      >
        <Box sx={{ p: 2 }}>
          {/* Mobile Claim Status Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="h6" fontWeight="600">
                  债权申报详情
                </Typography>
                <Chip 
                  label={claimToView!.reviewStatus} 
                  color={getStatusColor(claimToView!.reviewStatus)}
                  size="small"
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                申报编号：{claimToView!.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                提交日期：{claimToView!.submissionDate}
              </Typography>
            </CardContent>
          </Card>

          {/* Mobile Basic Information Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SvgIcon sx={{ mr: 1, color: 'primary.main' }}>
                  <path d={mdiInformation} />
                </SvgIcon>
                <Typography variant="h6" fontWeight="600">
                  基本信息
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      债权性质
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {claimToView!.claimNature}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      币种
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {claimToView!.currency}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Mobile Amount Breakdown Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SvgIcon sx={{ mr: 1, color: 'success.main' }}>
                  <path d={mdiCurrencyUsd} />
                </SvgIcon>
                <Typography variant="h6" fontWeight="600">
                  金额详情
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      本金
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {formatCurrency(claimToView!.principal)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      利息
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {formatCurrency(claimToView!.interest)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      其他费用
                    </Typography>
                    <Typography variant="body2" fontWeight="500">
                      {formatCurrency(claimToView!.otherFees)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      债权总额
                    </Typography>
                    <Typography 
                      variant="h6" 
                      fontWeight="700" 
                      color="primary.main"
                    >
                      {formatCurrency(claimToView!.totalAmount)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Mobile Brief Description Card */}
          {claimToView!.briefDescription && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="600" gutterBottom>
                  简要说明
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {claimToView!.briefDescription}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Mobile Attachments and Details Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SvgIcon sx={{ mr: 1, color: 'info.main' }}>
                  <path d={mdiAttachment} />
                </SvgIcon>
                <Typography variant="h6" fontWeight="600">
                  详细说明及附件
                </Typography>
              </Box>
              <Paper 
                sx={{ 
                  p: 2, 
                  backgroundColor: alpha(theme.palette.grey[100], 0.5),
                  border: `1px solid ${alpha(theme.palette.grey[300], 0.5)}`,
                  borderRadius: 2
                }}
              >
                <Box 
                  sx={{ 
                    '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
                    '& a': { color: 'primary.main', textDecoration: 'underline' },
                    '& ul': { pl: 2 },
                    '& p': { mb: 1 },
                    '& h3': { mb: 1, fontWeight: 600 }
                  }}
                  dangerouslySetInnerHTML={{ __html: claimToView!.attachmentsContent }}
                />
              </Paper>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                以上为申报人提供的详细说明和上传的附件列表（如有）。
              </Typography>
            </CardContent>
          </Card>

          {/* Mobile Action Button */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => navigate('/my-claims')}
              sx={{ minHeight: 48 }}
            >
              返回我的申报列表
            </Button>
          </Box>
        </Box>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
  return (
    <PageContainer>
      <Box sx={{ p: 3, maxWidth: '896px', mx: 'auto' }}>
        <ClaimDetailView claim={claimToView} />
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/my-claims')}
          >
            返回我的申报列表
          </Button>
        </Box>
      </Box>
    </PageContainer>
  );
};

export default SubmittedClaimDetailPage;
