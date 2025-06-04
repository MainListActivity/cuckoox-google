// TODO: Access Control - This page should only be accessible to users with a 'creditor' role.
// TODO: Access Control - Module access (new submission) should typically be conditional on Case Status being '债权申报'. This check might be done in higher-level routing.
// TODO: Access Control - If loaded with a claimId (for editing): Verify this claimId belongs to the logged-in creditor and is in an editable status ('草稿', '已驳回', '需要补充').
import React, { useState, useEffect } from 'react';
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
// TODO: import { useAuth } from '@/src/contexts/AuthContext'; // To get logged-in creditor info

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

// 模拟已有债权数据
const mockClaims = [
  {
    id: '1',
    claimNumber: 'CLM-2024-001',
    submitTime: '2024-03-15 10:30',
    nature: '普通债权',
    totalAmount: 1250000,
    status: 'approved',
    statusText: '审核通过',
    reviewComment: '材料齐全，审核通过',
  },
  {
    id: '2',
    claimNumber: 'CLM-2024-002',
    submitTime: '2024-03-20 14:20',
    nature: '有财产担保债权',
    totalAmount: 3500000,
    status: 'pending',
    statusText: '待审核',
    reviewComment: '',
  },
  {
    id: '3',
    claimNumber: 'CLM-2024-003',
    submitTime: '2024-03-22 09:15',
    nature: '劳动报酬',
    totalAmount: 280000,
    status: 'rejected',
    statusText: '已驳回',
    reviewComment: '请补充劳动合同相关证明材料',
  },
];

const ClaimSubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  // const { user } = useAuth(); // TODO: Use this to get creditor details

  const [activeStep, setActiveStep] = useState(0);
  const [showClaimList, setShowClaimList] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nature: '普通债权',
    principal: '',
    interest: '',
    otherFees: '',
    currency: 'CNY',
    description: '',
  });

  // 附件材料（模拟）
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editorContent, setEditorContent] = useState('');

  // 计算总额
  const calculateTotal = () => {
    const principal = parseFloat(formData.principal) || 0;
    const interest = parseFloat(formData.interest) || 0;
    const otherFees = parseFloat(formData.otherFees) || 0;
    return principal + interest + otherFees;
  };

  // 处理表单变化
  const handleFormChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  // 处理步骤
  const handleNext = () => {
    if (activeStep === 0) {
      // 验证第一步表单
      if (!formData.nature || !formData.principal) {
        showError('请填写必填项');
        return;
      }
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData({
      nature: '普通债权',
      principal: '',
      interest: '',
      otherFees: '',
      currency: 'CNY',
      description: '',
    });
    setAttachments([]);
    setEditorContent('');
  };

  // 处理提交
  const handleSubmit = () => {
    setOpenDialog(true);
  };

  const handleConfirmSubmit = () => {
    // 这里处理实际提交逻辑
    console.log('提交债权申报', { formData, attachments, editorContent });
    setOpenDialog(false);
    setShowClaimList(true);
    handleReset();
    showSuccess('债权申报已提交成功！');
  };

  // 查看债权详情
  const handleViewClaim = (claim: any) => {
    setSelectedClaim(claim);
    // 这里可以加载债权详情
  };

  // 编辑被驳回的债权
  const handleEditClaim = (claim: any) => {
    setSelectedClaim(claim);
    setShowClaimList(false);
    // 加载债权数据到表单
    setFormData({
      nature: 'ordinary',
      principal: '1000000',
      interest: '50000',
      otherFees: '10000',
      currency: 'CNY',
      description: '债权说明...',
    });
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  // 债权列表视图
  if (showClaimList) {
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
              onClick={() => setShowClaimList(false)}
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
                  <TableCell align="right">债权总额</TableCell>
                  <TableCell>审核状态</TableCell>
                  <TableCell>审核意见</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>{claim.claimNumber}</TableCell>
                    <TableCell>{claim.submitTime}</TableCell>
                    <TableCell>{claim.nature}</TableCell>
                    <TableCell align="right">
                      ¥{claim.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={claim.statusText}
                        color={getStatusColor(claim.status) as "success" | "warning" | "error" | "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{claim.reviewComment}</TableCell>
                    <TableCell align="center">
                      <Box display="flex" justifyContent="center">
                        <Tooltip title="查看详情">
                          <IconButton size="small" onClick={() => handleViewClaim(claim)}>
                            <Description fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {claim.status === 'rejected' && (
                          <Tooltip title="编辑重新提交">
                            <IconButton size="small" onClick={() => handleEditClaim(claim)}>
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

  return (
    <PageContainer>
      <Box>
        <Box mb={4}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setShowClaimList(true)}
            sx={{ mb: 2 }}
          >
            返回列表
          </Button>
          <Typography variant="h4" fontWeight="bold">
            债权申报
          </Typography>
          <Stepper activeStep={activeStep} sx={{ mt: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {activeStep === 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              债权基本信息
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>债权性质</InputLabel>
                <Select
                  value={formData.nature}
                  onChange={(e) => handleFormChange('nature', e.target.value)}
                  label="债权性质"
                >
                  {claimNatures.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>币种</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => handleFormChange('currency', e.target.value)}
                  label="币种"
                >
                  {currencies.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                required
                label="本金"
                type="number"
                value={formData.principal}
                onChange={(e) => handleFormChange('principal', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="利息"
                type="number"
                value={formData.interest}
                onChange={(e) => handleFormChange('interest', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="其他费用"
                type="number"
                value={formData.otherFees}
                onChange={(e) => handleFormChange('otherFees', e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="债权总额"
                value={calculateTotal().toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
                InputProps={{
                  readOnly: true,
                  startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                }}
                disabled
              />

              <TextField
                fullWidth
                label="债权说明"
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                sx={{ gridColumn: { md: 'span 2' } }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={handleNext}
              >
                下一步
              </Button>
            </Box>
          </Paper>
        )}

        {activeStep === 1 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              编辑附件材料
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              请上传债权证明材料，如合同、发票、收据等。
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {attachments.map((attachment, index) => (
                    <Card key={index} sx={{ width: 200 }}>
                      <CardContent>
                        <InsertDriveFile />
                        <Typography variant="body2">{attachment.name}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
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
              确认提交
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {attachments.map((attachment, index) => (
                    <Chip
                      key={index}
                      label={attachment.name}
                      icon={<InsertDriveFile />}
                      variant="outlined"
                    />
                  ))}
                </Box>
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
                提交债权申报
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
            <Button onClick={() => setOpenDialog(false)}>取消</Button>
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
