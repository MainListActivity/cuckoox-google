import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Stack,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Upload as UploadIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';

interface Creditor {
  id: string;
  type: 'organization' | 'individual';
  name: string;
  idNumber: string;
  contactName: string;
  contactInfo: string;
  address: string;
}

export const CreditorManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // 表单状态
  const [formData, setFormData] = useState<Partial<Creditor>>({
    type: 'organization',
    name: '',
    idNumber: '',
    contactName: '',
    contactInfo: '',
    address: '',
  });

  useEffect(() => {
    loadCreditors();
  }, []);

  const loadCreditors = async () => {
    setLoading(true);
    try {
      // 模拟数据
      const mockData: Creditor[] = [
        {
          id: '1',
          type: 'organization',
          name: '深圳市科技有限公司',
          idNumber: '91440300MA5G8N9X4M',
          contactName: '张经理',
          contactInfo: '13800138000',
          address: '深圳市南山区科技园',
        },
        {
          id: '2',
          type: 'individual',
          name: '李四',
          idNumber: '440301199001011234',
          contactName: '李四',
          contactInfo: '13900139000',
          address: '深圳市福田区',
        },
      ];
      setCreditors(mockData);
    } catch (error) {
      console.error('加载债权人失败:', error);
      setSnackbar({ open: true, message: '加载债权人数据失败', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCreditor = () => {
    setEditingCreditor(null);
    setFormData({
      type: 'organization',
      name: '',
      idNumber: '',
      contactName: '',
      contactInfo: '',
      address: '',
    });
    setOpenDialog(true);
  };

  const handleEditCreditor = (creditor: Creditor) => {
    setEditingCreditor(creditor);
    setFormData(creditor);
    setOpenDialog(true);
  };

  const handleSaveCreditor = async () => {
    try {
      // TODO: 调用后端API保存债权人
      console.log('保存债权人:', formData);
      setOpenDialog(false);
      setSnackbar({ open: true, message: '保存成功', severity: 'success' });
      loadCreditors();
    } catch (error) {
      console.error('保存债权人失败:', error);
      setSnackbar({ open: true, message: '保存失败', severity: 'error' });
    }
  };

  const handleDeleteCreditor = async (id: string) => {
    if (window.confirm('确定要删除该债权人吗？')) {
      try {
        // TODO: 调用后端API删除债权人
        console.log('删除债权人:', id);
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
        loadCreditors();
      } catch (error) {
        console.error('删除债权人失败:', error);
        setSnackbar({ open: true, message: '删除失败', severity: 'error' });
      }
    }
  };

  const handlePrintLabels = () => {
    if (selectedRows.length === 0) {
      setSnackbar({ open: true, message: '请先选择要打印的债权人', severity: 'error' });
      return;
    }
    // TODO: 实现打印快递单功能
    console.log('打印快递单:', selectedRows);
    setSnackbar({ open: true, message: `已选择${selectedRows.length}个债权人进行打印`, severity: 'success' });
  };

  const handleImport = () => {
    // TODO: 实现导入功能
    console.log('导入债权人');
  };

  const handleDownloadTemplate = () => {
    // TODO: 下载导入模板
    console.log('下载模板');
  };

  const filteredCreditors = creditors.filter(creditor =>
    creditor.name.toLowerCase().includes(searchText.toLowerCase()) ||
    creditor.idNumber.includes(searchText) ||
    creditor.contactName.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: GridColDef[] = [
    {
      field: 'type',
      headerName: '类别',
      width: 80,
      renderCell: (params) => (
        <Tooltip title={params.value === 'organization' ? '组织' : '个人'}>
          <IconButton size="small">
            {params.value === 'organization' ? <BusinessIcon /> : <PersonIcon />}
          </IconButton>
        </Tooltip>
      ),
    },
    {
      field: 'name',
      headerName: '名称',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'idNumber',
      headerName: 'ID',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'contactName',
      headerName: '联系人',
      width: 120,
    },
    {
      field: 'contactInfo',
      headerName: '联系方式',
      width: 130,
    },
    {
      field: 'address',
      headerName: '地址',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton
            size="small"
            onClick={() => handleEditCreditor(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteCreditor(params.row.id)}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  // 移动端列配置
  const mobileColumns: GridColDef[] = [
    {
      field: 'name',
      headerName: '名称',
      flex: 1,
    },
    {
      field: 'contactInfo',
      headerName: '联系方式',
      width: 120,
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 80,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => handleEditCreditor(params.row)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          mb={3}
        >
          <Typography variant="h5" component="h1">
            债权人管理
          </Typography>
          
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddCreditor}
              size={isMobile ? 'small' : 'medium'}
            >
              添加债权人
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={handleImport}
              size={isMobile ? 'small' : 'medium'}
            >
              批量导入
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              size={isMobile ? 'small' : 'medium'}
            >
              下载模板
            </Button>
            {selectedRows.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrintLabels}
                color="primary"
                size={isMobile ? 'small' : 'medium'}
              >
                打印快递单({selectedRows.length})
              </Button>
            )}
          </Stack>
        </Stack>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜索债权人名称、ID或联系人..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ height: isMobile ? 400 : 600, width: '100%' }}>
          <DataGrid
            rows={filteredCreditors}
            columns={isMobile ? mobileColumns : columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection
            disableRowSelectionOnClick
            loading={loading}
            onRowSelectionModelChange={(ids: GridRowSelectionModel) => setSelectedRows(ids as string[])}
            localeText={{
              noRowsLabel: '暂无数据',
              MuiTablePagination: {
                labelRowsPerPage: '每页行数:',
              },
            }}
          />
        </Box>
      </Paper>

      {/* 添加/编辑债权人对话框 */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingCreditor ? '编辑债权人' : '添加债权人'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="类别"
              select
              fullWidth
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'organization' | 'individual' })}
            >
              <MenuItem value="organization">组织</MenuItem>
              <MenuItem value="individual">个人</MenuItem>
            </TextField>
            
            <TextField
              label="名称"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <TextField
              label={formData.type === 'organization' ? '统一社会信用代码' : '身份证号'}
              fullWidth
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              required
            />
            
            <TextField
              label="联系人姓名"
              fullWidth
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              required
            />
            
            <TextField
              label="联系方式"
              fullWidth
              value={formData.contactInfo}
              onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
              required
              placeholder="电话或邮箱"
            />
            
            <TextField
              label="地址"
              fullWidth
              multiline
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button 
            onClick={handleSaveCreditor} 
            variant="contained"
            disabled={!formData.name || !formData.idNumber || !formData.contactName}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
