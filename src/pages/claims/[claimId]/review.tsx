// STYLING: This page currently uses Tailwind CSS. Per 规范.md, consider migration to MUI components.
// TODO: Access Control - This page should be accessible only to users with 'admin' or specific claim review roles.
// TODO: Access Control - Data loaded should be verified against case access permissions.
import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom'; // Removed useNavigate
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Container,
  AppBar,
  Toolbar,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  FormHelperText,
  // Link as MuiLink, // Removed unused import
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  SvgIcon,
  IconButton,
  Stack,
} from '@mui/material';
import GlobalLoader from '@/src/components/GlobalLoader';
import {
  mdiArrowLeft,
  mdiPencilOutline, // For "开始审核" / "修改审核结果" FAB
  mdiCheckDecagramOutline, // For "提交审核" button in modal
  // mdiCommentTextOutline, // Removed unused import
  // mdiFileDocumentOutline, // Removed unused import
} from '@mdi/js';
import { useTranslation } from 'react-i18next';
import RichTextEditor, { QuillDelta } from '@/src/components/RichTextEditor'; // Assuming QuillDelta is exported
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { Delta } from 'quill/core'; // For initializing editor content
import { useAuth } from '@/src/contexts/AuthContext'; // Added useAuth import

// Define a type for the claim data structure for better type safety
interface AssertedDetails {
  nature: string;
  currency: string;
  principal: number;
  interest: number;
  other: number;
  total: number;
  briefDescription: string;
  attachments_content: QuillDelta; // Changed to QuillDelta
}

interface ApprovedDetails {
  nature: string | null;
  principal: number | null;
  interest: number | null;
  other: number | null;
}

interface ClaimDataType {
  id: string;
  creditorName: string;
  creditorType: '组织' | '个人';
  creditorId: string;
  claim_number: string;
  contact: { name: string; phone: string; email?: string };
  submissionDate: string;
  asserted_details: AssertedDetails;
  approved_details: ApprovedDetails;
  audit_status: '待审核' | '审核通过' | '部分通过' | '已驳回' | '要求补充材料';
  auditor: string;
  audit_time: string;
  reviewOpinion: string;
  admin_attachments_content?: QuillDelta; // Changed to QuillDelta
}

const initialMockClaimData: ClaimDataType = {
  id: 'claim001',
  creditorName: 'Acme Corp',
  creditorType: '组织',
  creditorId: '91310000MA1FL000XQ',
  claim_number: 'CL-2023-001',
  contact: { name: 'John Doe', phone: '13800138000', email: 'john.doe@acme.com' },
  submissionDate: '2023-10-15',
  asserted_details: {
    nature: '货款',
    currency: 'CNY',
    principal: 120000,
    interest: 30000,
    other: 0,
    total: 150000,
    briefDescription: '合同编号 XYZ-2022，供应原材料A，款项逾期未付。',
    attachments_content: new Delta([
      { insert: '附件材料说明\n', attributes: { header: 2 } },
      { insert: '这是债权人提交的关于债权 ' },
      { insert: 'CL-2023-001', attributes: { bold: true } },
      { insert: ' 的详细说明和附件列表。\n' },
      { insert: '合同文件：' },
      { insert: 'Contract_XYZ-2022.pdf', attributes: { link: '#' } },
      { insert: ' (模拟链接)\n' },
      { insert: '相关发票：' },
      { insert: 'Invoice_INV001.pdf', attributes: { link: '#' } },
      { insert: ', ' },
      { insert: 'Invoice_INV002.pdf', attributes: { link: '#' } },
      { insert: ' (模拟链接)\n' },
      { insert: '请注意：以上链接均为模拟，实际应用中应指向真实文件。\n', attributes: { italic: true } },
    ])
  },
  approved_details: {
    nature: null,
    principal: null,
    interest: null,
    other: null,
  },
  audit_status: '待审核',
  auditor: '',
  audit_time: '',
  reviewOpinion: '',
  admin_attachments_content: new Delta(),
};


const ClaimReviewDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id: claimIdFromParams } = useParams<{ id: string }>();
  // const navigate = useNavigate(); // Removed unused variable
  const { showSuccess, showError } = useSnackbar();
  const { user } = useAuth(); // Get user from AuthContext

  // TODO: Fetch actual claim data based on claimIdFromParams
  const [claimData, setClaimData] = useState<ClaimDataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Modal specific states
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [modalApprovedNature, setModalApprovedNature] = useState<string>('');
  const [modalApprovedPrincipal, setModalApprovedPrincipal] = useState<string>(''); // Use string for TextField
  const [modalApprovedInterest, setModalApprovedInterest] = useState<string>(''); // Use string for TextField
  const [modalApprovedOther, setModalApprovedOther] = useState<string>(''); // Use string for TextField
  const [modalAuditStatus, setModalAuditStatus] = useState<ClaimDataType['audit_status'] | ''>('');
  const [modalReviewOpinion, setModalReviewOpinion] = useState<string>('');
  const [modalAdminSupplementalAttachmentsContent, setModalAdminSupplementalAttachmentsContent] = useState<QuillDelta>(new Delta());
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  const [adminInternalNotes, setAdminInternalNotes] = useState<QuillDelta>(new Delta());


  useEffect(() => {
    // Simulate fetching data
    setLoading(true);
    setTimeout(() => {
      if (claimIdFromParams) {
        setClaimData({ ...initialMockClaimData, id: claimIdFromParams, claim_number: `CL-${claimIdFromParams.slice(-5)}` });
        setAdminInternalNotes(new Delta().insert(initialMockClaimData.reviewOpinion || '')); // Initialize internal notes
      } else {
        setError(t('claim_review_error_no_id', '未提供有效的债权ID。'));
      }
      setLoading(false);
    }, 500);
  }, [claimIdFromParams, t]);


  const calculatedModalApprovedTotal =
      (parseFloat(modalApprovedPrincipal) || 0) +
      (parseFloat(modalApprovedInterest) || 0) +
      (parseFloat(modalApprovedOther) || 0);


  const formatCurrencyDisplay = (amount: number | null, currency: string = 'CNY') => {
    if (amount === null || typeof amount === 'undefined') return '-';
    return `${amount.toLocaleString('zh-CN', { style: 'currency', currency: currency })}`;
  };

  const handleOpenAuditModal = () => {
    if (!claimData) return;
    setModalErrors({});
    if (claimData.audit_status === '待审核' || claimData.approved_details.principal === null) {
      setModalApprovedNature(claimData.asserted_details.nature);
      setModalApprovedPrincipal(String(claimData.asserted_details.principal));
      setModalApprovedInterest(String(claimData.asserted_details.interest));
      setModalApprovedOther(String(claimData.asserted_details.other));
      setModalAuditStatus('');
      setModalReviewOpinion('');
      setModalAdminSupplementalAttachmentsContent(new Delta());
    } else {
      setModalApprovedNature(claimData.approved_details.nature || claimData.asserted_details.nature);
      setModalApprovedPrincipal(String(claimData.approved_details.principal ?? ''));
      setModalApprovedInterest(String(claimData.approved_details.interest ?? ''));
      setModalApprovedOther(String(claimData.approved_details.other ?? ''));
      setModalAuditStatus(claimData.audit_status);
      setModalReviewOpinion(claimData.reviewOpinion);
      setModalAdminSupplementalAttachmentsContent(claimData.admin_attachments_content || new Delta());
    }
    setAuditModalOpen(true);
  };

  const validateModalForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!modalApprovedNature) errors.modalApprovedNature = t('validation_required_approved_nature', '审核认定债权性质不能为空。');
    if (!modalApprovedPrincipal.trim() || parseFloat(modalApprovedPrincipal) < 0) errors.modalApprovedPrincipal = t('validation_invalid_approved_principal', '审核认定本金不能为空且必须大于等于0。');
    if (!modalApprovedInterest.trim() || parseFloat(modalApprovedInterest) < 0) errors.modalApprovedInterest = t('validation_invalid_approved_interest', '审核认定利息不能为空且必须大于等于0。');
    if (modalApprovedOther.trim() && parseFloat(modalApprovedOther) < 0) errors.modalApprovedOther = t('validation_invalid_approved_other', '审核认定其他费用必须大于等于0（如果填写）。');
    if (!modalAuditStatus) errors.modalAuditStatus = t('validation_required_audit_status', '审核状态不能为空。');
    if (!modalReviewOpinion.trim()) errors.modalReviewOpinion = t('validation_required_review_opinion', '审核意见/备注不能为空。');
    setModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitReview = () => {
    if (!validateModalForm() || !claimData) {
      showError(t('claim_review_error_form_invalid', '请修正审核表单中的错误。'));
      return;
    }

    // Using MUI's Dialog for confirmation would be more consistent than window.confirm
    // For now, keeping window.confirm as per original logic structure
    if (window.confirm(t('claim_review_confirm_submission', '请再次确认认定的债权金额及信息后提交。\n审核认定债权总额: {{totalAmount}}', { totalAmount: formatCurrencyDisplay(calculatedModalApprovedTotal, claimData.asserted_details.currency) }))) {
      const updatedClaimData: ClaimDataType = {
        ...claimData,
        approved_details: {
          nature: modalApprovedNature,
          principal: parseFloat(modalApprovedPrincipal) || 0,
          interest: parseFloat(modalApprovedInterest) || 0,
          other: parseFloat(modalApprovedOther) || 0,
        },
        audit_status: modalAuditStatus as ClaimDataType['audit_status'],
        reviewOpinion: modalReviewOpinion,
        admin_attachments_content: modalAdminSupplementalAttachmentsContent,
        auditor: 'CurrentAdminUser', // TODO: Replace with actual admin user
        audit_time: new Date().toISOString().split('T')[0],
      };
      setClaimData(updatedClaimData);
      setAdminInternalNotes(new Delta().insert(modalReviewOpinion)); // Update internal notes as well if it's tied to official opinion

      showSuccess(t('claim_review_submit_success_mock', '审核意见已提交 (模拟)'));
      setAuditModalOpen(false);
    }
  };

  const getStatusChipColor = (status: ClaimDataType['audit_status']): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case '待审核': return 'info';
      case '部分通过': return 'warning';
      case '已驳回': return 'error';
      case '审核通过': return 'success';
      case '要求补充材料': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return <GlobalLoader message={t('loading_claim_details', '加载债权详情中...')} />;
  }

  if (error) {
    return (
        <Container>
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        </Container>
    );
  }

  if (!claimData) {
    return (
        <Container>
          <Alert severity="warning" sx={{ mt: 2 }}>{t('claim_not_found', '未找到指定的债权信息。')}</Alert>
        </Container>
    );
  }

  const editorUserId = user?.id ? String(user.id) : "unknown-user";
  const editorUserName = (user as any)?.name || user?.email || "Unknown User";


  return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <AppBar position="sticky">
          <Toolbar>
            <IconButton edge="start" color="inherit" component={RouterLink} to="/admin/claims" aria-label="back to claims list" sx={{ mr: 2 }}>
              <SvgIcon><path d={mdiArrowLeft} /></SvgIcon>
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {t('claim_review_page_title', '审核债权')}: {claimData.claim_number}
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
          <Grid container spacing={3}>
            {/* Left Panel: Creditor's Submitted Information */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h5" gutterBottom>{t('creditor_submitted_info_title', '债权人申报信息')}</Typography>
                <List dense>
                  <ListItem><ListItemText primary={t('creditor_name_label', '债权人')} secondary={`${claimData.creditorName} (${claimData.creditorType})`} /></ListItem>
                  <ListItem><ListItemText primary={claimData.creditorType === '组织' ? t('org_code_label', '统一社会信用代码') : t('id_number_label', '身份证号')} secondary={claimData.creditorId} /></ListItem>
                  <ListItem><ListItemText primary={t('submission_date_label', '提交日期')} secondary={claimData.submissionDate} /></ListItem>
                  <Divider sx={{ my: 1 }} />
                  <ListItem><ListItemText primary={t('contact_person_label', '联系人')} secondary={claimData.contact.name} /></ListItem>
                  <ListItem><ListItemText primary={t('contact_phone_label', '联系电话')} secondary={claimData.contact.phone} /></ListItem>
                  <ListItem><ListItemText primary={t('contact_email_label', '联系邮箱')} secondary={claimData.contact.email || '-'} /></ListItem>
                  <Divider sx={{ my: 1 }} />
                  <ListItem><ListItemText primary={t('asserted_claim_nature_label', '主张债权性质')} secondary={claimData.asserted_details.nature} /></ListItem>
                  <ListItem><ListItemText primary={t('currency_label', '币种')} secondary={claimData.asserted_details.currency} /></ListItem>
                  <ListItem><ListItemText primary={t('asserted_principal_label', '主张本金')} secondary={formatCurrencyDisplay(claimData.asserted_details.principal, claimData.asserted_details.currency)} /></ListItem>
                  <ListItem><ListItemText primary={t('asserted_interest_label', '主张利息')} secondary={formatCurrencyDisplay(claimData.asserted_details.interest, claimData.asserted_details.currency)} /></ListItem>
                  <ListItem><ListItemText primary={t('asserted_other_fees_label', '主张其他费用')} secondary={formatCurrencyDisplay(claimData.asserted_details.other, claimData.asserted_details.currency)} /></ListItem>
                  <ListItem>
                    <ListItemText
                        primary={<Typography variant="subtitle1" color="primary">{t('asserted_total_amount_label', '主张总金额')}</Typography>}
                        secondary={<Typography variant="h6" color="primary">{formatCurrencyDisplay(claimData.asserted_details.total, claimData.asserted_details.currency)}</Typography>}
                        secondaryTypographyProps={{ component: 'div' }} // Use div for secondary if it contains block-like elements like Typography h6
                    />
                  </ListItem>
                  {claimData.asserted_details.briefDescription && (
                      <ListItem sx={{flexDirection: 'column', alignItems: 'flex-start'}}><Typography variant="caption" color="text.secondary">{t('brief_description_label', '简要说明')}:</Typography> <Typography variant="body2" sx={{whiteSpace: 'pre-wrap'}}>{claimData.asserted_details.briefDescription}</Typography></ListItem>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" sx={{mt:1, ml:2}}>{t('current_audit_status_title', '当前审核状态')}</Typography>
                  <ListItem><ListItemText primary={t('status_label', '状态')} secondary={<Chip label={claimData.audit_status} color={getStatusChipColor(claimData.audit_status)} size="small" />} secondaryTypographyProps={{ component: 'span' }} /></ListItem>
                  <ListItem><ListItemText primary={t('auditor_label', '审核人')} secondary={claimData.auditor || '-'} /></ListItem>
                  <ListItem><ListItemText primary={t('audit_time_label', '审核时间')} secondary={claimData.audit_time || '-'} /></ListItem>
                  <ListItem sx={{flexDirection: 'column', alignItems: 'flex-start'}}><Typography variant="caption" color="text.secondary">{t('official_review_opinion_label', '官方审核意见')}:</Typography> <Typography variant="body2" sx={{whiteSpace: 'pre-wrap'}}>{claimData.reviewOpinion || '-'}</Typography></ListItem>
                  {claimData.admin_attachments_content && claimData.admin_attachments_content.length() > 0 && (
                      <ListItem sx={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <Typography variant="caption" color="text.secondary">{t('admin_supplemental_material_label', '管理人补充材料')}:</Typography>
                        <Box sx={{ mt:1, p:1, border: '1px solid', borderColor: 'divider', borderRadius:1, width:'100%', maxHeight:150, overflowY:'auto'}}>
                          <RichTextEditor
                            value={claimData.admin_attachments_content}
                            readOnly={true}
                            documentId={`claim-${claimData.id}-admin-attachments-readonly`}
                            userId={editorUserId}
                            userName={editorUserName}
                          />
                        </Box>
                      </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Right Panel: Attachments & Review Area */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={3}>
                <Paper elevation={3} sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h5">{t('creditor_submitted_attachments_title', '债权人提交的附件材料')}</Typography>
                    <Button size="small" disabled>{t('view_history_button_placeholder', '查看历史版本 (未来功能)')}</Button>
                  </Stack>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 250, p: 1, bgcolor: 'action.hover' }}>
                    <RichTextEditor
                      value={claimData.asserted_details.attachments_content}
                      readOnly={true}
                      documentId={`claim-${claimData.id}-asserted-attachments-readonly`}
                      userId={editorUserId}
                      userName={editorUserName}
                    />
                  </Box>
                </Paper>

                <Paper elevation={3} sx={{ p: 2 }}>
                  <Typography variant="h5" gutterBottom>{t('admin_internal_notes_title', '管理员内部审核备注')}</Typography>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 200, p: 1 }}>
                    <RichTextEditor
                        value={adminInternalNotes}
                        onChange={setAdminInternalNotes}
                        placeholder={t('admin_internal_notes_placeholder', '输入内部审核备注，此内容对债权人不可见...')}
                        documentId={`claim-${claimData.id}-internal-notes`}
                        userId={editorUserId}
                        userName={editorUserName}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{mt:1, display:'block'}}>{t('admin_internal_notes_disclaimer', '此备注仅为管理员内部记录，不作为官方审核意见的一部分。')}</Typography>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Container>

        {/* Floating Audit Button */}
        {/* // TODO: Access Control - This button's visibility/enabled state should depend on user permissions and if the claim is in a reviewable state. */}
        {!auditModalOpen && (
            <Fab
                color="primary"
                aria-label="audit claim"
                onClick={handleOpenAuditModal}
                sx={{ position: 'fixed', bottom: 24, right: 24 }}
            >
              <SvgIcon><path d={mdiPencilOutline} /></SvgIcon>
            </Fab>
        )}

        {/* Audit Modal/Form */}
        <Dialog open={auditModalOpen} onClose={() => setAuditModalOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
          <DialogTitle>{t('fill_review_opinion_and_amount_title', '填写审核意见与认定金额')}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{pt:1}}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!modalErrors.modalApprovedNature}>
                  <InputLabel id="modalApprovedNature-label">{t('approved_claim_nature_label', '审核认定债权性质')}*</InputLabel>
                  <Select
                      labelId="modalApprovedNature-label"
                      value={modalApprovedNature}
                      label={t('approved_claim_nature_label', '审核认定债权性质') + "*"}
                      onChange={e => { setModalApprovedNature(e.target.value); setModalErrors(p => ({...p, modalApprovedNature: ''}));}}
                  >
                    {/* TODO: Fetch from admin config */}
                    <MenuItem value="货款">{t('claim_nature_goods_payment', '货款')}</MenuItem>
                    <MenuItem value="服务费">{t('claim_nature_service_fee', '服务费')}</MenuItem>
                    <MenuItem value="劳动报酬">{t('claim_nature_labor_remuneration', '劳动报酬')}</MenuItem>
                    <MenuItem value="其他">{t('claim_nature_other', '其他')}</MenuItem>
                  </Select>
                  {modalErrors.modalApprovedNature && <FormHelperText>{modalErrors.modalApprovedNature}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth error={!!modalErrors.modalAuditStatus}>
                  <InputLabel id="modalAuditStatus-label">{t('audit_status_label', '审核状态')}*</InputLabel>
                  <Select
                      labelId="modalAuditStatus-label"
                      value={modalAuditStatus}
                      label={t('audit_status_label', '审核状态') + "*"}
                      onChange={e => { setModalAuditStatus(e.target.value as ClaimDataType['audit_status'] | ''); setModalErrors(p => ({...p, modalAuditStatus: ''}));}}
                  >
                    {/* TODO: Fetch from admin config */}
                    <MenuItem value="审核通过">{t('status_approved', '审核通过')}</MenuItem>
                    <MenuItem value="部分通过">{t('status_partially_approved', '部分通过')}</MenuItem>
                    <MenuItem value="已驳回">{t('status_rejected', '已驳回')}</MenuItem>
                    <MenuItem value="要求补充材料">{t('status_needs_supplement', '要求补充材料')}</MenuItem>
                  </Select>
                  {modalErrors.modalAuditStatus && <FormHelperText>{modalErrors.modalAuditStatus}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                    label={t('approved_principal_label', '审核认定本金') + ` (${claimData.asserted_details.currency})*`}
                    type="number"
                    fullWidth
                    value={modalApprovedPrincipal}
                    onChange={e => { setModalApprovedPrincipal(e.target.value); setModalErrors(p => ({...p, modalApprovedPrincipal: ''}));}}
                    error={!!modalErrors.modalApprovedPrincipal}
                    helperText={modalErrors.modalApprovedPrincipal}
                    InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                    label={t('approved_interest_label', '审核认定利息') + ` (${claimData.asserted_details.currency})*`}
                    type="number"
                    fullWidth
                    value={modalApprovedInterest}
                    onChange={e => { setModalApprovedInterest(e.target.value); setModalErrors(p => ({...p, modalApprovedInterest: ''}));}}
                    error={!!modalErrors.modalApprovedInterest}
                    helperText={modalErrors.modalApprovedInterest}
                    InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                <TextField
                    label={t('approved_other_fees_label', '审核认定其他费用') + ` (${claimData.asserted_details.currency})`}
                    type="number"
                    fullWidth
                    value={modalApprovedOther}
                    onChange={e => { setModalApprovedOther(e.target.value); setModalErrors(p => ({...p, modalApprovedOther: ''}));}}
                    error={!!modalErrors.modalApprovedOther}
                    helperText={modalErrors.modalApprovedOther}
                    InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                    label={t('review_opinion_label', '审核意见/备注')}
                    multiline
                    rows={4}
                    fullWidth
                    value={modalReviewOpinion}
                    onChange={e => { setModalReviewOpinion(e.target.value); setModalErrors(p => ({...p, modalReviewOpinion: ''}));}}
                    error={!!modalErrors.modalReviewOpinion}
                    helperText={modalErrors.modalReviewOpinion}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" gutterBottom>{t('admin_supplemental_attachments_modal_label', '管理人补充附件材料 (可选)')}</Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 200, p:1 }}>
                  <RichTextEditor
                      value={modalAdminSupplementalAttachmentsContent}
                      onChange={setModalAdminSupplementalAttachmentsContent}
                      documentId={`claim-${claimData.id}-modal-supplemental`}
                      userId={editorUserId}
                      userName={editorUserName}
                  />
                </Box>
              </Grid>
            </Grid>
            <Box sx={{mt:2, textAlign:'right'}}>
              <Typography variant="h6" color="error">
                {t('approved_total_amount_modal_label', '审核认定债权总额')}: {formatCurrencyDisplay(calculatedModalApprovedTotal, claimData.asserted_details.currency)}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{p: '16px 24px'}}>
            <Button onClick={() => setAuditModalOpen(false)}>{t('cancel_button', '取消')}</Button>
            {/* // TODO: Access Control - Ensure user has permission to submit/modify a claim review. */}
            <Button onClick={handleSubmitReview} variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiCheckDecagramOutline}/></SvgIcon>}>
              {t('submit_review_button', '提交审核')}
            </Button>
          </DialogActions>
        </Dialog>

        <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 4 }}>
          {t('claim_review_footer_note', '管理员审核页面。左侧为债权人申报信息，右侧为附件材料和内部审核备注。')}
        </Typography>
      </Box>
  );
};

export default ClaimReviewDetailPage;
