// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Verify this claimId belongs to the logged-in creditor.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Alert,
} from '@mui/material';
import GlobalLoader from '@/src/components/GlobalLoader';
import PageContainer from '@/src/components/PageContainer';
import FullscreenRichTextEditor from '@/src/components/FullscreenRichTextEditor';
import { QuillDelta } from '@/src/components/RichTextEditor';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import ClaimService, { ClaimData } from '@/src/services/claimService';
import { Delta } from 'quill/core';

const ClaimAttachmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const { showSuccess, showError } = useSnackbar();
  const { user, hasRole } = useAuth();
  const { surreal } = useSurreal();
  
  const [editorContent, setEditorContent] = useState<QuillDelta>(new Delta());
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const claimService = useMemo(() => new ClaimService(surreal), [surreal]);

  // 加载债权数据和权限检查
  useEffect(() => {
    const loadClaimData = async () => {
      // 权限检查
      if (!hasRole('creditor_representative')) {
        setError('您没有权限访问此页面');
        setIsLoading(false);
        return;
      }

      if (!claimId || !user) {
        setError('缺少必要参数');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null); // 清除之前的错误
        const claim = await claimService.getClaimById(`claim:${claimId}`);
        
        if (!claim) {
          setError('债权不存在');
          return;
        }

        // 验证债权是否属于当前用户
        if (claim.created_by !== user.id.toString()) {
          setError('您没有权限编辑此债权');
          return;
        }

        // 检查债权是否可编辑
        if (!claimService.isClaimEditable(claim)) {
          setError(`债权状态为"${claimService.getStatusText(claim.review_status)}"，无法编辑`);
          return;
        }

        setClaimData(claim);
        
        // 加载已保存的附件内容
        if (claim.asserted_claim_details.attachment_content) {
          setEditorContent(claim.asserted_claim_details.attachment_content);
        }
        
      } catch (err) {
        console.error('加载债权数据失败:', err);
        setError(err instanceof Error ? err.message : '加载债权数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadClaimData();
  }, [claimId, user, surreal, hasRole, claimService]);

  const currentUserId = user?.id?.toString() || 'unknown-user';
  const currentUserName = user?.name || user?.email || 'Unknown User';


  const handleSaveDraft = async () => {
    if (!claimId || !claimData) {
      showError('缺少必要参数');
      return;
    }

    try {
      setIsSaving(true);
      await claimService.saveAttachmentDraft(`claim:${claimId}`, editorContent);
      showSuccess('草稿已成功保存');
    } catch (error) {
      console.error('保存草稿失败:', error);
      showError(error instanceof Error ? error.message : '保存草稿失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimId || !claimData) {
      showError('缺少必要参数');
      return;
    }

    try {
      setIsSubmitting(true);
      await claimService.submitClaim(`claim:${claimId}`, editorContent);
      showSuccess('债权申报已成功提交');
      navigate(`/my-claims/${claimId}`);
    } catch (error) {
      console.error('提交申报失败:', error);
      showError(error instanceof Error ? error.message : '提交申报失败，请检查网络或稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return <GlobalLoader message="加载债权信息中..." />;
  }

  // 错误状态
  if (error) {
    return (
      <PageContainer>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </PageContainer>
    );
  }

  // 数据不存在
  if (!claimData) {
    return (
      <PageContainer>
        <Alert severity="warning" sx={{ mt: 2 }}>
          债权数据不存在
        </Alert>
      </PageContainer>
    );
  }

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
                {claimData.claim_number || claimId}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                债权性质:
              </Typography>
              <Typography variant="body1">
                {claimData.asserted_claim_details.nature}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">
                申报金额:
              </Typography>
              <Typography variant="body1">
                {claimService.formatCurrency(
                  claimData.asserted_claim_details.total_asserted_amount,
                  claimData.asserted_claim_details.currency
                )}
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
            <FullscreenRichTextEditor
              value={editorContent}
              onChange={setEditorContent}
              documentId={`claim-attachment-${claimId}`}
              userId={currentUserId}
              userName={currentUserName}
              contextInfo={{
                title: `债权申报 - ${claimId}`,
                subtitle: '附件材料编辑',
                avatar: {
                  text: '债',
                  color: '#1976d2'
                },
                details: [
                  {
                    label: '申报金额',
                    value: claimService.formatCurrency(
                      claimData.asserted_claim_details.total_asserted_amount,
                      claimData.asserted_claim_details.currency
                    ),
                    icon: 'M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z'
                  },
                  {
                    label: '债权性质',
                    value: claimData.asserted_claim_details.nature,
                    icon: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z'
                  },
                  {
                    label: '申报时间',
                    value: new Date().toLocaleDateString('zh-CN'),
                    icon: 'M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z'
                  }
                ]
              }}
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
            disabled={isSubmitting || isSaving}
          >
            返回修改基本信息
          </Button>
          <Button 
            variant="contained"
            color="warning"
            onClick={handleSaveDraft}
            disabled={isSubmitting || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          >
            {isSaving ? '保存中...' : '保存草稿'}
          </Button>
          <Button 
            variant="contained"
            color="success"
            onClick={handleSubmitClaim}
            disabled={isSubmitting || isSaving}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
          >
            {isSubmitting ? '提交中...' : '提交申报'}
          </Button>
        </Box>
        {/* TODO: Workflow - After submission, the claim should become read-only for the creditor unless explicitly rejected by an admin. */}
      </Box>
    </PageContainer>
  );
};

export default ClaimAttachmentPage;
