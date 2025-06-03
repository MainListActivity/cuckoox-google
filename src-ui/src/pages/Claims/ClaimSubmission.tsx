import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Alert,
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
  useTheme,
  useMediaQuery,
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

export const ClaimSubmission: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);
  const [showClaimList, setShowClaimList] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    nature: '',
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
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData({
      nature: '',
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
                      color={getStatusColor(claim.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{claim.reviewComment || '-'}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="查看详情">
                      <IconButton
                        size="small"
                        onClick={() => handleViewClaim(claim)}
                      >
                        <Description />
                      </IconButton>
                    </Tooltip>
                    {claim.status === 'rejected' && (
                      <Tooltip title="重新编辑">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditClaim(claim)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  // 债权申报表单视图
  return (
    <Box>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => setShowClaimList(true)}
        >
          返回列表
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          {selectedClaim ? '编辑债权申报' : '新增债权申报'}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* 步骤1：填写债权信息 */}
        {activeStep === 0 && (
          <Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, 1fr)',
                },
                gap: 3,
                mb: 3,
              }}
            >
              <FormControl fullWidth required>
                <InputLabel>债权性质</InputLabel>
                <Select
                  value={formData.nature}
                  onChange={(e) => handleFormChange('nature', e.target.value)}
                  label="债权性质"
                >
                  {claimNatures.map((nature) => (
                    <MenuItem key={nature.value} value={nature.value}>
                      {nature.label}
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
                  {currencies.map((currency) => (
                    <MenuItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(3, 1fr)',
                },
                gap: 3,
                mb: 3,
              }}
            >
              <TextField
                fullWidth
                required
                label="本金"
                type="number"
                value={formData.principal}
                onChange={(e) => handleFormChange('principal', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="利息"
                type="number"
                value={formData.interest}
                onChange={(e) => handleFormChange('interest', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="其他费用"
                type="number"
                value={formData.otherFees}
                onChange={(e) => handleFormChange('otherFees', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                }}
                helperText="如违约金、损害赔偿金等"
              />
            </Box>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" color="primary">
                  债权总额
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  ¥{calculateTotal().toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  本金 + 利息 + 其他费用
                </Typography>
              </CardContent>
            </Card>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="简要说明"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder="请简要说明债权产生的原因、依据等"
            />
          </Box>
        )}

        {/* 步骤2：编辑附件材料 */}
        {activeStep === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              请详细陈述债权事实、理由，并上传相关证明材料。支持上传图片、PDF、Word、Excel等文件。
            </Alert>

            {/* 这里应该集成富文本编辑器 */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, minHeight: 400 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                富文本编辑器区域（集成QuillJS）
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={15}
                placeholder="请详细陈述债权事实、理由..."
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                variant="standard"
              />
            </Paper>

            {/* 附件上传区域 */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                附件材料
              </Typography>
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                component="label"
                sx={{ mb: 2 }}
              >
                上传文件
                <input type="file" hidden multiple />
              </Button>

              {/* 模拟已上传文件 */}
              <Box display="flex" flexWrap="wrap" gap={2}>
                <Card variant="outlined" sx={{ width: 150 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <ImageIcon color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="caption" display="block">
                      合同扫描件.jpg
                    </Typography>
                    <IconButton size="small" color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ width: 150 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <InsertDriveFile color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="caption" display="block">
                      债权证明.pdf
                    </Typography>
                    <IconButton size="small" color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        )}

        {/* 步骤3：确认提交 */}
        {activeStep === 2 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              请仔细核对债权信息，提交后将无法修改，除非被管理人驳回。
            </Alert>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  债权信息确认
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                    },
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      债权性质
                    </Typography>
                    <Typography variant="body1">
                      {claimNatures.find(n => n.value === formData.nature)?.label}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      币种
                    </Typography>
                    <Typography variant="body1">
                      {currencies.find(c => c.value === formData.currency)?.label}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(3, 1fr)',
                    },
                    gap: 2,
                    mt: 2,
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      本金
                    </Typography>
                    <Typography variant="body1">
                      ¥{parseFloat(formData.principal || '0').toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      利息
                    </Typography>
                    <Typography variant="body1">
                      ¥{parseFloat(formData.interest || '0').toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      其他费用
                    </Typography>
                    <Typography variant="body1">
                      ¥{parseFloat(formData.otherFees || '0').toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Box mt={3}>
                  <Typography variant="body2" color="textSecondary">
                    债权总额
                  </Typography>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    ¥{calculateTotal().toLocaleString()}
                  </Typography>
                </Box>

                <Box mt={3}>
                  <Typography variant="body2" color="textSecondary">
                    简要说明
                  </Typography>
                  <Typography variant="body1">
                    {formData.description || '无'}
                  </Typography>
                </Box>

                <Box mt={3}>
                  <Typography variant="body2" color="textSecondary">
                    附件材料
                  </Typography>
                  <Typography variant="body1">
                    已上传 2 个文件
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* 操作按钮 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
          >
            上一步
          </Button>
          <Box>
            {activeStep < steps.length - 1 && (
              <Button
                variant="outlined"
                onClick={() => {
                  // 保存草稿逻辑
                  console.log('保存草稿');
                }}
                startIcon={<Save />}
                sx={{ mr: 1 }}
              >
                保存草稿
              </Button>
            )}
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                startIcon={<Send />}
              >
                提交申报
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ArrowForward />}
              >
                下一步
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* 确认提交对话框 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>确认提交债权申报</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            请再次确认债权金额及信息后提交
          </Alert>
          <Typography variant="h6" align="center" color="primary">
            债权总额：¥{calculateTotal().toLocaleString()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button onClick={handleConfirmSubmit} variant="contained">
            确认提交
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClaimSubmission;
