// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Verify this claimId belongs to the logged-in creditor OR if an admin is viewing, different rules might apply (though this page is creditor-focused).
// Workflow: This page displays a read-only view of the claim as per product requirements.
import React, { useState, useEffect } from 'react';
import ClaimDetailView from '@/src/components/claim/ClaimDetailView';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from '@/src/components/PageContainer';
import { Box, Button, Typography } from '@mui/material';
import GlobalLoader from '@/src/components/GlobalLoader';

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
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();

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
