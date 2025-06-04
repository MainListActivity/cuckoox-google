// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Verify this claimId belongs to the logged-in creditor.
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
} from '@mui/material';
import PageContainer from '@/src/components/PageContainer';
import RichTextEditor, { QuillDelta } from '@/src/components/RichTextEditor';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { Delta } from 'quill/core';

const ClaimAttachmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const [editorContent, setEditorContent] = useState<QuillDelta>(new Delta());

  // Placeholder claim data - in a real app, this would come from state or API
  const placeholderClaimData = {
    totalAmount: '¥10,560.00', // TODO: Fetch based on claimId
    currency: 'CNY', // TODO: Fetch based on claimId
    nature: '普通债权', // TODO: Fetch based on claimId
  };

  // TODO: Get actual userId and userName from auth context
  const currentUserId = 'placeholder-user-id'; // Placeholder for userId
  const currentUserName = 'Placeholder User'; // Placeholder for userName


  const handleSaveDraft = () => {
    // Simulate API call
    const isSuccess = Math.random() > 0.1; // 90% success rate
    if (isSuccess) {
      console.log(`Saving draft for claim ID: ${claimId} with content:`, JSON.stringify(editorContent.ops));
      showSuccess('草稿已成功保存。');
    } else {
      console.error(`Failed to save draft for claim ID: ${claimId}.`);
      showError('保存草稿失败，请稍后重试。');
    }
  };

  const handleSubmitClaim = () => {
    // Simulate API call
    const isSuccess = Math.random() > 0.1; // 90% success rate
    if (isSuccess) {
      console.log(`Submitting claim ID: ${claimId} with content:`, JSON.stringify(editorContent.ops));
      showSuccess('债权申报已成功提交。');
      navigate(`/my-claims/${claimId}/submitted`); 
    } else {
      console.error(`Failed to submit claim ID: ${claimId}.`);
      showError('提交申报失败，请检查网络或稍后重试。');
    }
  };

  return (
    <PageContainer>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          编辑附件材料
        </Typography>

        {/* Basic Claim Information Section */}
        <Paper sx={{ mb: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            债权基本信息 (参考)
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                申报ID:
              </Typography>
              <Typography variant="body1">
                {claimId}
              </Typography>
            </Grid>
            {/* TODO: Fetch and display actual basic claim info based on claimId */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                债权性质:
              </Typography>
              <Typography variant="body1">
                {placeholderClaimData.nature}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                申报金额:
              </Typography>
              <Typography variant="body1">
                {placeholderClaimData.totalAmount} ({placeholderClaimData.currency})
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Rich Text Editor Section */}
        <Paper sx={{ mb: 3, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            详细说明及附件上传:
          </Typography>
          <Box sx={{ 
            border: 1, 
            borderColor: 'divider', 
            borderRadius: 1, 
            overflow: 'hidden',
            mb: 2
          }}>
            {/* TODO: Configure RichTextEditor for image uploads to MinIO (via backend service). */}
            {/* TODO: Configure RichTextEditor for other file attachments (links/icons, via backend service). */}
            <RichTextEditor
              value={editorContent}
              onChange={setEditorContent}
              documentId={`claim-attachment-${claimId}`}
              userId={currentUserId}
              userName={currentUserName}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            请在此处详细说明债权情况，并上传相关证明文件（如合同、发票、银行流水、判决书等）。支持图片、PDF、Word、Excel等文件格式。
          </Typography>
        </Paper>

        {/* Action Buttons Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 2,
          flexWrap: 'wrap'
        }}>
          <Button 
            variant="outlined"
            onClick={() => navigate(`/claims/submit/${claimId}`)}
          >
            返回修改基本信息
          </Button>
          <Button 
            variant="contained"
            color="warning"
            onClick={handleSaveDraft}
          >
            保存草稿
          </Button>
          <Button 
            variant="contained"
            color="success"
            onClick={handleSubmitClaim}
          >
            提交申报
          </Button>
        </Box>
        {/* TODO: Workflow - After submission, the claim should become read-only for the creditor unless explicitly rejected by an admin. */}
      </Box>
    </PageContainer>
  );
};

export default ClaimAttachmentPage;
