import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Toolbar, 
  Tooltip,
  useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Import AddEditStatusDialog and its StatusData type
import AddEditStatusDialog, { StatusData } from '../../components/admin/review_statuses/AddEditStatusDialog';
// Import ConfirmDeleteDialog
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

// ReviewStatus interface now uses StatusData structure directly
interface ReviewStatus extends StatusData {
  // id is already optional in StatusData, label and description are required
}

const initialMockReviewStatuses: ReviewStatus[] = [
  { id: 's1', label: '审核通过', description: '债权已完全审核通过, 无任何疑问或需要补充的材料。符合所有法定及程序要求。' },
  { id: 's2', label: '信息不全驳回', description: '因提交的核心信息不完整或关键字段缺失而被驳回。债权人需核对并补全信息后重新提交。' },
  { id: 's3', label: '要求补充材料', description: '当前提交材料不足以支撑债权主张, 需要债权人补充额外证明文件或详细说明。' },
  { id: 's4', label: '待审核', description: '债权申报已提交, 等待管理人进行初步审核。此为默认初始状态。'},
  { id: 's5', label: '审核中', description: '管理人正在对债权材料进行详细审查与核实。'},
  { id: 's6', label: '部分通过', description: '债权的部分金额或内容得到认可, 另一部分可能存在争议或未被确认。'},
];

const ReviewStatusManagementPage: React.FC = () => {
  const theme = useTheme();
  const [reviewStatuses, setReviewStatuses] = useState<ReviewStatus[]>(initialMockReviewStatuses);
  
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [editingStatusData, setEditingStatusData] = useState<StatusData | null>(null);

  // State for Delete Confirmation Dialog
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);


  const handleOpenCreateStatusDialog = () => {
    setEditingStatusData(null); 
    setIsStatusDialogOpen(true);
  };

  const handleOpenEditStatusDialog = (statusId: string) => {
    const statusToEdit = reviewStatuses.find(status => status.id === statusId);
    if (statusToEdit) {
      setEditingStatusData(statusToEdit);
      setIsStatusDialogOpen(true);
    }
  };

  const handleCloseStatusDialog = useCallback(() => {
    setIsStatusDialogOpen(false);
    setEditingStatusData(null);
  }, []);

  const handleSaveStatus = useCallback((statusData: StatusData) => {
    setReviewStatuses(prevStatuses => {
      if (statusData.id) { 
        return prevStatuses.map(status => 
          status.id === statusData.id ? { ...status, ...statusData } : status
        );
      } else { 
        const newStatus: ReviewStatus = {
          ...statusData,
          id: Date.now().toString(), 
        };
        return [...prevStatuses, newStatus];
      }
    });
    handleCloseStatusDialog();
  }, [handleCloseStatusDialog]);

  // Delete Status Handlers
  const handleOpenDeleteConfirm = (statusId: string) => {
    setDeletingStatusId(statusId);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingStatusId(null);
  }, []);

  const handleConfirmDeleteStatus = useCallback(() => {
    if (deletingStatusId) {
      setReviewStatuses(prevStatuses => prevStatuses.filter(status => status.id !== deletingStatusId));
      
      // If the status being edited is the one deleted, close the edit dialog
      if (editingStatusData?.id === deletingStatusId) {
        handleCloseStatusDialog();
      }
    }
    handleCloseDeleteConfirm();
  }, [deletingStatusId, editingStatusData?.id, handleCloseStatusDialog, handleCloseDeleteConfirm]);

  // Find the status to delete for the dialog's content text
  const statusToDeleteDetails = reviewStatuses.find(s => s.id === deletingStatusId);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        审核状态管理
      </Typography>

      <Paper 
        elevation={1} 
        sx={{ 
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Toolbar 
          sx={{ 
            p: { xs: 1.5, sm: 2 }, 
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateStatusDialog} 
          >
            添加状态
          </Button>
        </Toolbar>

        <TableContainer>
          <Table sx={{ minWidth: 650 }} aria-label="review statuses table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: theme.palette.text.primary, width: '25%' }}>状态标签</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>描述</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.primary, width: '15%' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviewStatuses.map((status) => (
                <TableRow
                  key={status.id}
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    }
                  }}
                >
                  <TableCell component="th" scope="row" sx={{color: theme.palette.text.primary}}>
                    {status.label}
                  </TableCell>
                  <TableCell sx={{color: theme.palette.text.secondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                    {status.description}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="编辑状态">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenEditStatusDialog(status.id!)} 
                        sx={{ mr: 0.5, color: theme.palette.info.main, '&:hover': {backgroundColor: theme.palette.action.focus} }}
                      >
                        <EditIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除状态">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenDeleteConfirm(status.id!)} // Updated onClick
                        sx={{ color: theme.palette.error.main, '&:hover': {backgroundColor: theme.palette.action.focus} }}
                      >
                        <DeleteOutlineIcon fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {reviewStatuses.length === 0 && (
            <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
                暂无审核状态信息。
            </Typography>
        )}
      </Paper>

      <AddEditStatusDialog
        open={isStatusDialogOpen}
        onClose={handleCloseStatusDialog}
        onSave={handleSaveStatus}
        initialData={editingStatusData}
      />

      <ConfirmDeleteDialog
        open={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDeleteStatus}
        title="确认删除状态"
        contentText={
          deletingStatusId && statusToDeleteDetails
          ? `您确定要删除状态 "${statusToDeleteDetails.label}" 吗？此操作无法撤销。`
          : "您确定要删除此状态吗？此操作无法撤销。"
        }
      />
    </Box>
  );
};

export default ReviewStatusManagementPage;
