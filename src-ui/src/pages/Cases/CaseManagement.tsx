import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  useTheme,
  useMediaQuery,
  Stack,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Description as DocumentIcon,
  LocalShipping as ShippingIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams, GridRowSelectionModel } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

interface Case {
  id: string;
  caseNumber: string;
  manager: string;
  procedure: string;
  acceptanceDate: string;
  processStatus: string;
  creator: string;
  materials?: string;
  announcementDate?: string;
  claimStartDate?: string;
  claimEndDate?: string;
}

const procedureOptions = ['破产', '重整', '和解'];
const statusOptions = [
  '立案',
  '公告',
  '债权申报',
  '债权人第一次会议',
  '裁定重整',
  '提交重整计划',
  '延迟提交重整计划',
  '债权人第二次会议',
  '破产清算',
  '结案',
];

export const CaseManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  
  // 表单状态
  const [formData, setFormData] = useState({
    manager: '',
    procedure: '破产',
    acceptanceDate: dayjs(),
    announcementDate: dayjs().add(25, 'day'),
    claimStartDate: dayjs().add(55, 'day'),
    claimEndDate: dayjs().add(3, 'month').add(25, 'day'),
  });

  useEffect(() => {
    // TODO: 从后端加载案件数据
    loadCases();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    try {
      // 模拟数据
      const mockData: Case[] = [
        {
          id: '1',
          caseNumber: '(2024)粤03破1号',
          manager: '张三',
          procedure: '破产',
          acceptanceDate: '2024-01-15',
          processStatus: '债权申报',
          creator: '李四',
          materials: '/materials/1',
        },
        {
          id: '2',
          caseNumber: '(2024)粤03破2号',
          manager: '王五',
          procedure: '重整',
          acceptanceDate: '2024-02-20',
          processStatus: '立案',
          creator: '赵六',
          materials: '/materials/2',
        },
      ];
      setCases(mockData);
    } catch (error) {
      console.error('加载案件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = () => {
    setEditingCase(null);
    setFormData({
      manager: '',
      procedure: '破产',
      acceptanceDate: dayjs(),
      announcementDate: dayjs().add(25, 'day'),
      claimStartDate: dayjs().add(55, 'day'),
      claimEndDate: dayjs().add(3, 'month').add(25, 'day'),
    });
    setOpenDialog(true);
  };

  const handleSaveCase = async () => {
    try {
      // TODO: 调用后端API保存案件
      console.log('保存案件:', formData);
      setOpenDialog(false);
      loadCases();
    } catch (error) {
      console.error('保存案件失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, any> = {
      '立案': 'info',
      '公告': 'warning',
      '债权申报': 'primary',
      '债权人第一次会议': 'secondary',
      '裁定重整': 'warning',
      '提交重整计划': 'info',
      '延迟提交重整计划': 'warning',
      '债权人第二次会议': 'secondary',
      '破产清算': 'error',
      '结案': 'success',
    };
    return statusColors[status] || 'default';
  };

  const columns: GridColDef[] = [
    {
      field: 'caseNumber',
      headerName: '案件编号',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'manager',
      headerName: '案件负责人',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'procedure',
      headerName: '案件程序',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" />
      ),
    },
    {
      field: 'acceptanceDate',
      headerName: '受理时间',
      width: 120,
      valueFormatter: (value) => dayjs(value).format('YYYY-MM-DD'),
    },
    {
      field: 'processStatus',
      headerName: '程序进程',
      width: 140,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'creator',
      headerName: '创建人',
      width: 100,
    },
    {
      field: 'materials',
      headerName: '立案材料',
      width: 100,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={() => window.open(params.value, '_blank')}
          disabled={!params.value}
        >
          <DocumentIcon />
        </IconButton>
      ),
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="查看详情">
            <IconButton size="small">
              <ViewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="修改状态">
            <IconButton size="small">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="更多操作">
            <IconButton size="small">
              <MoreIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // 移动端列配置
  const mobileColumns: GridColDef[] = [
    {
      field: 'caseNumber',
      headerName: '案件编号',
      flex: 1,
    },
    {
      field: 'processStatus',
      headerName: '状态',
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 80,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton size="small">
          <MoreIcon />
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
            案件管理
          </Typography>
          
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateCase}
              fullWidth={isMobile}
            >
              创建案件
            </Button>
            {selectedRows.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<ShippingIcon />}
                fullWidth={isMobile}
              >
                打印快递单
              </Button>
            )}
          </Stack>
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          提示：案件创建后，系统将自动创建案件机器人账号，用于发送案件进程提醒。
        </Alert>

        <Box sx={{ height: isMobile ? 400 : 600, width: '100%' }}>
          <DataGrid
            rows={cases}
            columns={isMobile ? mobileColumns : columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection={!isMobile}
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

      {/* 创建/编辑案件对话框 */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingCase ? '编辑案件' : '创建案件'}
        </DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-cn">
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="案件负责人"
                fullWidth
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                required
              />
              
              <TextField
                label="案件程序"
                select
                fullWidth
                value={formData.procedure}
                onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
              >
                {procedureOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              
              <DatePicker
                label="受理时间"
                value={formData.acceptanceDate}
                onChange={(newValue) => {
                  if (newValue && dayjs.isDayjs(newValue)) {
                    setFormData({ ...formData, acceptanceDate: newValue });
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
              
              {formData.procedure === '破产' && (
                <>
                  <DatePicker
                    label="公告时间"
                    value={formData.announcementDate}
                    onChange={(newValue) => {
                      if (newValue && dayjs.isDayjs(newValue)) {
                        setFormData({ ...formData, announcementDate: newValue });
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "最迟受理破产申请之日起25日",
                      },
                    }}
                  />
                  
                  <DatePicker
                    label="债权申报开始时间"
                    value={formData.claimStartDate}
                    onChange={(newValue) => {
                      if (newValue && dayjs.isDayjs(newValue)) {
                        setFormData({ ...formData, claimStartDate: newValue });
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "最早发布受理破产申请公告之日30日",
                      },
                    }}
                  />
                  
                  <DatePicker
                    label="债权申报截止时间"
                    value={formData.claimEndDate}
                    onChange={(newValue) => {
                      if (newValue && dayjs.isDayjs(newValue)) {
                        setFormData({ ...formData, claimEndDate: newValue });
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: "最迟发布受理破产申请公告之日3个月",
                      },
                    }}
                  />
                </>
              )}
            </Stack>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>取消</Button>
          <Button onClick={handleSaveCase} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
