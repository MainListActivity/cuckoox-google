// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Module access (new submission) should typically be conditional on Case Status being '债权申报'. This check might be done in higher-level routing.
// TODO: Access Control - If loaded with a claimId (for editing): Verify this claimId belongs to the logged-in creditor and is in an editable status ('草稿', '已驳回', '需要补充').
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import PageContainer from '@/src/components/PageContainer';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  FormHelperText,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  AttachMoney,
  Description,
  CheckCircle,
  Edit,
  Delete,
  Add,
  Save,
  Send,
  ArrowBack,
  ArrowForward,
  CloudUpload,
  InsertDriveFile,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import ClaimService, { ClaimData, CaseData } from '@/src/services/claimService';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { Delta } from 'quill/core';

// 步骤定义
const steps = ['填写债权信息', '编辑附件材料', '确认提交'];

// 债权性质选项
const claimNatures = [
  { value: 'ordinary', label: '普通债权' },
  { value: 'secured', label: '有财产担保债权' },
  { value: 'labor', label: '劳动报酬' },
  { value: 'tax', label: '税款债权' },
];

// 币种选项
const currencies = [
  { value: 'CNY', label: '人民币' },
  { value: 'USD', label: '美元' },
  { value: 'EUR', label: '欧元' },
  { value: 'HKD', label: '港币' },
];

// Helper function to get status text
const getStatusText = (status: string) => {
  switch (status) {
    case 'approved':
      return '审核通过';
    case 'submitted':
      return '待审核';
    case 'rejected':
      return '已驳回';
    case 'draft':
      return '草稿';
    default:
      return '未知';
  }
};

// Helper function to get nature text
const getNatureText = (nature: string) => {
  const found = claimNatures.find(n => n.value === nature);
  return found ? found.label : nature;
};

const ClaimSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  const { user } = useAuth();
  const { t } = useTranslation();
  const surreal = useSurrealClient();
  const claimService = useMemo(() => new ClaimService(surreal), [surreal]);

  const [activeStep, setActiveStep] = useState(0);
  const [isListView, setIsListView] = useState(true);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [cases, setCases] = useState<CaseData[]>([]);
  const [editingClaim, setEditingClaim] = useState<ClaimData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    case_id: '',
    nature: 'ordinary',
    principal: '',
    interest: '',
    otherFees: '',
    currency: 'CNY',
    description: '',
    has_guarantee: false,
  });

  // 附件材料（模拟）
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [myClaims, myCases] = await Promise.all([
          claimService.getClaimsByCreditor(user.id.toString()),
          claimService.getCreditorCases(user.id.toString()),
        ]);
        setClaims(myClaims);
        setCases(myCases);
      } catch (error) {
        showError((error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, claimService, showError]);

  // 计算总额
  const calculateTotal = () => {
    const principal = parseFloat(formData.principal) || 0;
    const interest = parseFloat(formData.interest) || 0;
    const otherFees = parseFloat(formData.otherFees) || 0;
    return principal + interest + otherFees;
  };

  // Handle form change
  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      if (!formData.case_id || !formData.principal) {
        showError('请填写所有必填项');
        return;
      }
      try {
        // Create or update draft claim
        const claimToSave = {
          case_id: formData.case_id,
          creditor_id: user?.id.toString() || '',
          asserted_claim_details: {
            nature: formData.nature,
            principal: parseFloat(formData.principal) || 0,
            interest: parseFloat(formData.interest) || 0,
            other_amount: parseFloat(formData.otherFees) || 0,
            total_asserted_amount: calculateTotal(),
            currency: formData.currency,
            brief_description: formData.description,
          },
          review_status: 'draft' as const,
        };

        if (editingClaim) {
          const updatedClaim = await claimService.updateClaimBasicInfo(editingClaim.id!, claimToSave.asserted_claim_details);
          setEditingClaim(updatedClaim);
        } else {
          const newClaim = await claimService.createClaim(claimToSave);
          setEditingClaim(newClaim);
        }
      } catch (error) {
        showError((error as Error).message);
        return; // Stop progression if save fails
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setEditingClaim(null);
    setFormData({
      case_id: '',
      nature: 'ordinary',
      principal: '',
      interest: '',
      otherFees: '',
      currency: 'CNY',
      description: '',
      has_guarantee: false,
    });
    setAttachments([]);
    setEditorContent('');
  };

  const handleSubmit = () => {
    setOpenDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (!editingClaim) {
        showError('没有可提交的债权申报');
        return;
    }
    try {
        const emptyDelta = new Delta();
        await claimService.submitClaim(editingClaim.id!, emptyDelta);
        showSuccess('债权申报提交成功！');
        setOpenDialog(false);
        setIsListView(true);
        handleReset();
        // Refresh list data
        if (user) setClaims(await claimService.getClaimsByCreditor(user.id.toString()));
    } catch (error) {
        showError(`提交失败: ${(error as Error).message}`);
    }
  };

  const handleEditClaim = (claim: ClaimData) => {
    setEditingClaim(claim);
    setFormData({
      case_id: claim.case_id,
      nature: claim.asserted_claim_details?.nature || '',
      principal: String(claim.asserted_claim_details?.principal || 0),
      interest: String(claim.asserted_claim_details?.interest || 0),
      otherFees: String(claim.asserted_claim_details?.other_amount || 0),
      currency: claim.asserted_claim_details?.currency || 'CNY',
      description: claim.asserted_claim_details?.brief_description || '',
      has_guarantee: false, // This field doesn't exist in ClaimData, so default to false
    });
    setIsListView(false);
    setActiveStep(0);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'submitted':
        return 'warning';
      case 'rejected':
        return 'error';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  // 债权列表视图
  if (isListView) {
    return (
      <PageContainer>
        <Box>
          <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight="bold">
              我的债权申报
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setIsListView(false)}
              size="large"
            >
              新增申报
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>债权编号</TableCell>
                  <TableCell>申报时间</TableCell>
                  <TableCell>债权性质</TableCell>
                  <TableCell>申报金额</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>{claim.claim_number}</TableCell>
                    <TableCell>{claim.created_at ? new Date(claim.created_at).toLocaleString('zh-CN') : '-'}</TableCell>
                    <TableCell>{claim.asserted_claim_details ? getNatureText(claim.asserted_claim_details.nature) : '-'}</TableCell>
                    <TableCell>¥{claim.asserted_claim_details ? claim.asserted_claim_details.total_asserted_amount.toLocaleString() : '0'}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(claim.review_status)}
                        color={getStatusColor(claim.review_status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" justifyContent="center">
                        <Tooltip title="查看详情">
                          <IconButton size="small" onClick={() => handleEditClaim(claim)}>
                            <Description fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {claim.review_status === 'rejected' && (
                          <Tooltip title="编辑重新提交">
                            <IconButton size="small" onClick={() => handleEditClaim(claim)} aria-label="编辑重新提交">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </PageContainer>
    );
  }

  // 表单视图
  return (
    <PageContainer>
      <Box>
        <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setIsListView(true)}
            sx={{ mb: 2 }}
          >
            返回列表
          </Button>
          <Typography variant="h4" fontWeight="bold">
            债权申报
          </Typography>
          <Box />
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              债权基本信息
            </Typography>
            {isLoading ? (
              <Typography>加载中...</Typography>
            ) : (
              <>
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="case-select-label">关联案件</InputLabel>
              <Select
                labelId="case-select-label"
                id="case_id"
                name="case_id"
                value={formData.case_id}
                label="关联案件"
                onChange={(e) => handleFormChange('case_id', e.target.value)}
              >
                {cases.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} ({c.case_number})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="本金"
              name="principal"
              value={formData.principal}
              onChange={(e) => handleFormChange('principal', e.target.value)}
              required
              fullWidth
              margin="normal"
              type="number"
            />
            <TextField
              label="利息"
              name="interest"
              value={formData.interest}
              onChange={(e) => handleFormChange('interest', e.target.value)}
              fullWidth
              margin="normal"
              type="number"
            />
            <TextField
              label="其他费用"
              name="otherFees"
              value={formData.otherFees}
              onChange={(e) => handleFormChange('otherFees', e.target.value)}
              fullWidth
              margin="normal"
              type="number"
            />
            <TextField
              label="债权总额"
              value={calculateTotal().toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
              InputProps={{
                readOnly: true,
              }}
              fullWidth
              margin="normal"
              disabled
            />
            <TextField
              label="币种"
              name="currency"
              value={formData.currency}
              onChange={(e) => handleFormChange('currency', e.target.value)}
              fullWidth
              margin="normal"
              select
            >
              {currencies.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="债权说明"
              name="description"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              fullWidth
              margin="normal"
              multiline
              rows={4}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ArrowForward />}
              >
                下一步
              </Button>
            </Box>
            </>
            )}
          </Paper>
        )}

        {activeStep === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              编辑附件材料
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                component="label"
              >
                上传文件
                <input type="file" hidden />
              </Button>

              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                已上传附件
              </Typography>

              {attachments.length > 0 ? (
                attachments.map((file, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <InsertDriveFile sx={{ mr: 1 }} />
                    <Typography variant="body2">{file.name}</Typography>
                    <IconButton size="small" sx={{ ml: 'auto' }}>
                      <Delete />
                    </IconButton>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  暂无附件
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack} startIcon={<ArrowBack />}>
                上一步
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ArrowForward />}
              >
                下一步
              </Button>
            </Box>
          </Paper>
        )}

        {activeStep === 2 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              确认并提交
            </Typography>

            <Alert severity="warning" sx={{ mb: 3 }}>
              提交后将无法修改，请仔细核对信息。
            </Alert>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                债权基本信息
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Typography variant="body2">
                  <strong>债权性质：</strong> {claimNatures.find(n => n.value === formData.nature)?.label}
                </Typography>
                <Typography variant="body2">
                  <strong>币种：</strong> {currencies.find(c => c.value === formData.currency)?.label}
                </Typography>
                <Typography variant="body2">
                  <strong>本金：</strong> ¥{parseFloat(formData.principal || '0').toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>利息：</strong> ¥{parseFloat(formData.interest || '0').toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>其他费用：</strong> ¥{parseFloat(formData.otherFees || '0').toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>债权总额：</strong> ¥{calculateTotal().toLocaleString()}
                </Typography>
              </Box>
              {formData.description && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    债权说明：
                  </Typography>
                  <Typography variant="body2">{formData.description}</Typography>
                </>
              )}
            </Box>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                附件材料
              </Typography>
              {attachments.length > 0 ? (
                attachments.map((file, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <InsertDriveFile sx={{ mr: 1 }} />
                    <Typography variant="body2">{file.name}</Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  暂无附件
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleBack} startIcon={<ArrowBack />}>
                上一步
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                endIcon={<Send />}
              >
                确认提交
              </Button>
            </Box>
          </Paper>
        )}

        {/* 确认对话框 */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>确认提交</DialogTitle>
          <DialogContent>
            <Typography>
              您确定要提交此债权申报吗？提交后将无法修改。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmSubmit} variant="contained" color="primary">
              确认提交
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PageContainer>
  );
};

export default ClaimSubmissionPage;
