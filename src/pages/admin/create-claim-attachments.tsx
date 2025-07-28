// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should only be accessible to users with an 'admin' or relevant management role.
// TODO: Access Control - Verify this tempClaimId is valid and was initiated by this admin user.
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    Container,
    Paper,
    Grid,
    AppBar,
    Toolbar,
    Stack,
} from '@mui/material';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useTranslation } from 'react-i18next';
import RichTextEditor, { QuillDelta } from '@/src/components/RichTextEditor';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { Delta } from 'quill/core';

const AdminCreateClaimAttachmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { tempClaimId } = useParams<{ tempClaimId: string }>();
    const { showSnackbar } = useSnackbar();
    const { isMobile } = useResponsiveLayout();

    const [editorContent, setEditorContent] = useState<QuillDelta>(new Delta());

    // TODO: Fetch basic info for tempClaimId if needed for display.
    // For now, using placeholder based on what might have been entered in the previous step.
    const placeholderBasicInfo = {
        creditorName: "示例债权人 (来自上一步)",
        assertedTotal: "10,000.00 CNY (来自上一步)",
    };

    const handleSaveDraft = () => {
        console.log(`Admin: Saving draft attachments for claim ID: ${tempClaimId}`, editorContent.ops);
        showSnackbar(t('admin_attachments_draft_saved_success', '附件草稿已保存 (模拟)'), 'success');
    };

    const handleCompleteAndSubmit = () => {
        console.log(`Admin: Completing and submitting claim ID: ${tempClaimId} with attachments:`, editorContent.ops);
        // TODO: Actual API call to create the claim with basic info + attachments.
        // This would involve combining the temporarily stored basic info with editorContent.
        showSnackbar(t('admin_claim_submitted_success', `管理员录入债权 ${tempClaimId} 已成功提交 (模拟)`), 'success');
        navigate('/admin/claims'); // Navigate to the admin claim list page
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <AppBar position="sticky">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        {t('admin_create_claim_attachments_title', '创建债权 (管理员代报) - 编辑附件材料')}
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ flexGrow: 1, py: isMobile ? 2 : 3, display: 'flex', flexDirection: 'column' }}>
                <Paper elevation={3} sx={{ p: isMobile ? 1.5 : 2, mb: 2 }}>
                    <Typography variant="h5" gutterBottom>
                        {t('admin_claim_id_label', '临时债权 ID')}: {tempClaimId}
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle1">
                                {t('creditor_label', '债权人')}: {placeholderBasicInfo.creditorName}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle1">
                                {t('asserted_amount_label', '申报金额')}: {placeholderBasicInfo.assertedTotal}
                            </Typography>
                        </Grid>
                    </Grid>
                    <Typography variant="caption" color="text.secondary" sx={{mt:1, display:'block'}}>
                        {t('admin_attachments_note', '以上信息为上一步录入的基本信息参考。')}
                    </Typography>
                </Paper>

                <Paper elevation={3} sx={{ p: isMobile ? 1.5 : 2, flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: isMobile ? '50vh' : '60vh' }}>
                    <Typography variant="h6" gutterBottom>
                        {t('detailed_explanation_and_attachments_label', '详细说明及附件上传:')}
                    </Typography>
                    {/* // TODO: Configure RichTextEditor for image uploads to MinIO (via backend service). */}
                    {/* // TODO: Configure RichTextEditor for other file attachments (links/icons, via backend service). */}
                    <Box sx={{ flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: '400px', '& .ql-container': {minHeight: 'calc(100% - 42px)'} }}>
                        <RichTextEditor value={editorContent} onChange={setEditorContent} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        {t('admin_attachments_instructions', '请在此处详细说明债权情况，并上传相关证明文件（如合同、发票、银行流水、判决书等）。')}
                    </Typography>
                </Paper>

                <Paper elevation={3} sx={{ p: isMobile ? 1.5 : 2, mt: 2, position: 'sticky', bottom: 0, zIndex: 1000 }}>
                    <Stack 
                        direction={isMobile ? "column" : "row"} 
                        spacing={2} 
                        justifyContent="flex-end"
                    >
                        <Button
                            variant="outlined"
                            onClick={() => navigate(-1)} // Or navigate(`/admin/create-claim/${tempClaimId}/edit-basic`)
                            sx={isMobile ? { minHeight: '44px' } : {}}
                        >
                            {t('back_to_edit_basic_info_button', '返回修改基本信息')}
                        </Button>
                        <Button 
                            variant="outlined" 
                            color="secondary" 
                            onClick={handleSaveDraft}
                            sx={isMobile ? { minHeight: '44px' } : {}}
                        >
                            {t('save_draft_button', '保存草稿')}
                        </Button>
                        {/* // TODO: Access Control - Ensure user has permission to finalize claim creation. */}
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleCompleteAndSubmit}
                            sx={isMobile ? { minHeight: '44px' } : {}}
                        >
                            {t('complete_and_submit_claim_button', '完成并提交债权')}
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
};

export default AdminCreateClaimAttachmentsPage;
