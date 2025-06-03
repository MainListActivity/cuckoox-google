import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Card,
  CardContent,
  Checkbox,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Search,
  FilterList,
  CheckCircle,
  Cancel,
  Edit,
  Visibility,
  AttachMoney,
  Description,
  Comment,
  Save,
  Send,
  ArrowBack,
  Download,
  Print,
  HighlightOff,
} from '@mui/icons-material';

// 模拟债权数据
const mockClaims = [
  {
    id: '1',
    claimNumber: 'CLM-2024-001',
    creditor: {
      type: '组织',
      name: '深圳市建筑材料有限公司',
      id: '91440300MA5G8N9X4R',
      contact: '张经理',
      phone: '13800138001',
    },
    submitTime: '2024-03-15 10:30',
    claimNature: '普通债权',
    claimedAmount: {
      principal: 1000000,
      interest: 50000,
      other: 10000,
      total: 1060000,
    },
    status: 'pending',
    statusText: '待审核',
    attachments: 3,
  },
  {
    id: '2',
    claimNumber: 'CLM-2024-002',
    creditor: {
      type: '个人',
      name: '李四',
      id: '440301199001011234',
      contact: '李四',
      phone: '13900139001',
    },
    submitTime: '2024-03-16 14:20',
    claimNature: '劳动报酬',
    claimedAmount: {
      principal: 280000,
      interest: 0,
      other: 0,
      total: 280000,
    },
    status: 'approved',
    statusText: '审核通过',
    approvedAmount: {
      principal: 280000,
      interest: 0,
      other: 0,
      total: 280000,
    },
    reviewer: '王审核员',
    reviewTime: '2024-03-17 09:30',
    reviewComment: '材料齐全，审核通过',
    attachments: 2,
  },
  {
    id: '3',
    claimNumber: 'CLM-2024-003',
    creditor: {
      type: '组织',
      name: '广州市贸易有限公司',
      id: '91440100MA5H3P8X2A',
      contact: '陈总',
      phone: '13700137001',
    },
    submitTime: '2024-03-18 09:15',
    claimNature: '有财产担保债权',
    claimedAmount: {
      principal: 3500000,
      interest: 150000,
      other: 50000,
      total: 3700000,
    },
    status: 'rejected',
    statusText: '已驳回',
    reviewer: '王审核员',
    reviewTime: '2024-03-19 11:20',
    reviewComment: '担保合同缺失关键条款，请补充完整的担保合同',
    attachments: 5,
  },
];

// 审核状态选项
const reviewStatuses = [
  { value: 'approved', label: '审核通过', color: 'success' },
  { value: 'partial', label: '部分通过', color: 'warning' },
  { value: 'rejected', label: '驳回', color: 'error' },
  { value: 'supplement', label: '要求补充材料', color: 'info' },
];

export const ClaimReview: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [batchRejectDialogOpen, setBatchRejectDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);

  // 审核表单数据
  const [reviewForm, setReviewForm] = useState({
    status: '',
    nature: '',
    principal: '',
    interest: '',
    other: '',
    comment: '',
  });

  // 批量驳回原因
  const [batchRejectReason, setBatchRejectReason] = useState('');

  // 处理选择
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = mockClaims
        .filter(claim => claim.status === 'pending')
        .map(claim => claim.id);
      setSelectedClaims(newSelected);
    } else {
      setSelectedClaims([]);
    }
  };

  const handleSelectOne = (id: string) => {
    const selectedIndex = selectedClaims.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedClaims, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedClaims.slice(1));
    } else if (selectedIndex === selectedClaims.length - 1) {
      newSelected = newSelected.concat(selectedClaims.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedClaims.slice(0, selectedIndex),
        selectedClaims.slice(selectedIndex + 1),
      );
    }

    setSelectedClaims(newSelected);
  };

  // 打开审核对话框
  const handleOpenReview = (claim: any) => {
    setSelectedClaim(claim);
    setReviewForm({
      status: '',
      nature: claim.claimNature,
      principal: claim.claimedAmount.principal.toString(),
      interest: claim.claimedAmount.interest.toString(),
      other: claim.claimedAmount.other.toString(),
      comment: '',
    });
    setReviewDialogOpen(true);
  };

  // 提交审核
  const handleSubmitReview = () => {
    console.log('提交审核', { claim: selectedClaim, form: reviewForm });
    setReviewDialogOpen(false);
  };

  // 批量驳回
  const handleBatchReject = () => {
    console.log('批量驳回', { claims: selectedClaims, reason: batchRejectReason });
    setBatchRejectDialogOpen(false);
    setSelectedClaims([]);
    setBatchRejectReason('');
  };

  // 计算审核认定总额
  const calculateReviewTotal = () => {
    const principal = parseFloat(reviewForm.principal) || 0;
    const interest = parseFloat(reviewForm.interest) || 0;
    const other = parseFloat(reviewForm.other) || 0;
    return principal + interest + other;
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

  // 统计数据
  const statistics = {
    total: mockClaims.length,
    pending: mockClaims.filter(c => c.status === 'pending').length,
    approved: mockClaims.filter(c => c.status === 'approved').length,
    rejected: mockClaims.filter(c => c.status === 'rejected').length,
  };

  return (
    <Box>
      {/* 页面标题和统计 */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          债权审核
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: 2,
            mt: 2,
          }}
        >
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                总申报
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {statistics.total}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                待审核
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="warning.main">
                {statistics.pending}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                已通过
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">
                {statistics.approved}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                已驳回
              </Typography>
              <Typography variant="h5" fontWeight="bold" color="error.main">
                {statistics.rejected}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* 搜索和筛选 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { sm: 'center' },
          }}
        >
          <TextField
            placeholder="搜索债权人名称、债权编号、联系人等"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>状态筛选</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="状态筛选"
              size="small"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="pending">待审核</MenuItem>
              <MenuItem value="approved">已通过</MenuItem>
              <MenuItem value="rejected">已驳回</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Search />}>
            搜索
          </Button>
        </Box>
      </Paper>

      {/* 操作按钮 */}
      {selectedClaims.length > 0 && (
        <Box mb={2}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={() => setBatchRejectDialogOpen(true)}
          >
            批量驳回 ({selectedClaims.length})
          </Button>
        </Box>
      )}

      {/* 债权列表 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedClaims.length > 0 && selectedClaims.length < mockClaims.filter(c => c.status === 'pending').length}
                  checked={mockClaims.filter(c => c.status === 'pending').length > 0 && selectedClaims.length === mockClaims.filter(c => c.status === 'pending').length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>债权编号</TableCell>
              <TableCell>债权人信息</TableCell>
              <TableCell>联系人</TableCell>
              <TableCell>债权性质</TableCell>
              <TableCell align="right">主张债权总额</TableCell>
              <TableCell align="right">认定债权总额</TableCell>
              <TableCell>审核状态</TableCell>
              <TableCell>审核人</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockClaims.map((claim) => {
              const isSelected = selectedClaims.indexOf(claim.id) !== -1;
              return (
                <TableRow
                  key={claim.id}
                  selected={isSelected}
                  hover
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleSelectOne(claim.id)}
                      disabled={claim.status !== 'pending'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {claim.claimNumber}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {claim.submitTime}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {claim.creditor.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {claim.creditor.type} | {claim.creditor.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {claim.creditor.contact}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {claim.creditor.phone}
                    </Typography>
                  </TableCell>
                  <TableCell>{claim.claimNature}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      ¥{claim.claimedAmount.total.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      本金: {claim.claimedAmount.principal.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {claim.approvedAmount ? (
                      <>
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          ¥{claim.approvedAmount.total.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          本金: {claim.approvedAmount.principal.toLocaleString()}
                        </Typography>
                      </>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={claim.statusText}
                      color={getStatusColor(claim.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {claim.reviewer ? (
                      <>
                        <Typography variant="body2">
                          {claim.reviewer}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {claim.reviewTime}
                        </Typography>
                      </>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="查看附件">
                      <IconButton size="small">
                        <Description />
                      </IconButton>
                    </Tooltip>
                    {claim.status === 'pending' && (
                      <Tooltip title="审核">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenReview(claim)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    )}
                    {claim.status !== 'pending' && (
                      <Tooltip title="查看详情">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenReview(claim)}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 审核对话框 */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              债权审核 - {selectedClaim?.claimNumber}
            </Typography>
            <IconButton onClick={() => setReviewDialogOpen(false)}>
              <HighlightOff />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedClaim && (
            <Box>
              {/* 标签页 */}
              <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 3 }}>
                <Tab label="基本信息" />
                <Tab label="附件材料" />
                <Tab label="审核记录" />
              </Tabs>

              {/* 基本信息 */}
              {activeTab === 0 && (
                <Box>
                  {/* 债权人信息 */}
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        债权人信息
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            债权人名称
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.creditor.name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            证件号码
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.creditor.id}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            联系人
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.creditor.contact}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            联系方式
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.creditor.phone}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* 主张债权信息 */}
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        主张债权信息
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            债权性质
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.claimNature}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            债权总额
                          </Typography>
                          <Typography variant="h6" color="primary">
                            ¥{selectedClaim.claimedAmount.total.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            本金
                          </Typography>
                          <Typography variant="body1">
                            ¥{selectedClaim.claimedAmount.principal.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            利息
                          </Typography>
                          <Typography variant="body1">
                            ¥{selectedClaim.claimedAmount.interest.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* 审核表单 */}
                  {selectedClaim.status === 'pending' && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          审核认定
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                            gap: 2,
                            mb: 2,
                          }}
                        >
                          <FormControl fullWidth required>
                            <InputLabel>审核状态</InputLabel>
                            <Select
                              value={reviewForm.status}
                              onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                              label="审核状态"
                            >
                              {reviewStatuses.map((status) => (
                                <MenuItem key={status.value} value={status.value}>
                                  {status.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl fullWidth required>
                            <InputLabel>认定债权性质</InputLabel>
                            <Select
                              value={reviewForm.nature}
                              onChange={(e) => setReviewForm({ ...reviewForm, nature: e.target.value })}
                              label="认定债权性质"
                            >
                              <MenuItem value="普通债权">普通债权</MenuItem>
                              <MenuItem value="有财产担保债权">有财产担保债权</MenuItem>
                              <MenuItem value="劳动报酬">劳动报酬</MenuItem>
                              <MenuItem value="税款债权">税款债权</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                            gap: 2,
                            mb: 2,
                          }}
                        >
                          <TextField
                            fullWidth
                            required
                            label="认定本金"
                            type="number"
                            value={reviewForm.principal}
                            onChange={(e) => setReviewForm({ ...reviewForm, principal: e.target.value })}
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
                            label="认定利息"
                            type="number"
                            value={reviewForm.interest}
                            onChange={(e) => setReviewForm({ ...reviewForm, interest: e.target.value })}
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
                            label="认定其他费用"
                            type="number"
                            value={reviewForm.other}
                            onChange={(e) => setReviewForm({ ...reviewForm, other: e.target.value })}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <AttachMoney />
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Box>

                        <Alert severity="info" sx={{ mb: 2 }}>
                          认定债权总额：<strong>¥{calculateReviewTotal().toLocaleString()}</strong>
                        </Alert>

                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          label="审核意见"
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                          placeholder="请输入审核意见或备注"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* 已审核信息 */}
                  {selectedClaim.status !== 'pending' && (
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          审核结果
                        </Typography>
                        <Box mb={2}>
                          <Chip
                            label={selectedClaim.statusText}
                            color={getStatusColor(selectedClaim.status) as any}
                          />
                        </Box>
                        {selectedClaim.approvedAmount && (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                              gap: 2,
                              mb: 2,
                            }}
                          >
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                认定债权总额
                              </Typography>
                              <Typography variant="h6" color="primary">
                                ¥{selectedClaim.approvedAmount.total.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                认定本金
                              </Typography>
                              <Typography variant="body1">
                                ¥{selectedClaim.approvedAmount.principal.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            审核意见
                          </Typography>
                          <Typography variant="body1">
                            {selectedClaim.reviewComment}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Box>
              )}

              {/* 附件材料 */}
              {activeTab === 1 && (
                <Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    共 {selectedClaim.attachments} 个附件
                  </Alert>
                  <Paper variant="outlined" sx={{ p: 3, minHeight: 400 }}>
                    <Typography variant="body1" color="textSecondary" align="center">
                      附件材料查看区域（集成QuillJS文档查看器）
                    </Typography>
                  </Paper>
                </Box>
              )}

              {/* 审核记录 */}
              {activeTab === 2 && (
                <Box>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="债权人提交申报"
                        secondary={selectedClaim.submitTime}
                      />
                    </ListItem>
                    {selectedClaim.reviewer && (
                      <ListItem>
                        <ListItemText
                          primary={`${selectedClaim.reviewer} ${selectedClaim.statusText}`}
                          secondary={selectedClaim.reviewTime}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        {selectedClaim?.status === 'pending' && (
          <DialogActions>
            <Button onClick={() => setReviewDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitReview}
              disabled={!reviewForm.status || !reviewForm.principal}
            >
              提交审核
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* 批量驳回对话框 */}
      <Dialog
        open={batchRejectDialogOpen}
        onClose={() => setBatchRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>批量驳回债权申请</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            您将驳回 {selectedClaims.length} 个债权申请，请输入驳回理由
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="驳回理由"
            value={batchRejectReason}
            onChange={(e) => setBatchRejectReason(e.target.value)}
            placeholder="请输入驳回理由，该理由将发送给所有被驳回的债权人"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchRejectDialogOpen(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBatchReject}
            disabled={!batchRejectReason}
          >
            确认驳回
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClaimReview;
