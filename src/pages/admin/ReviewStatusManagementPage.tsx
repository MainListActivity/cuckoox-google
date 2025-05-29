import React, { useState, useCallback, useEffect } from 'react';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import AddEditStatusDialog, { StatusData } from '../../components/admin/review_statuses/AddEditStatusDialog';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

import {
  ReviewStatus,
  getReviewStatuses,
  createReviewStatus,
  updateReviewStatus,
  deleteReviewStatus,
} from '../../services/adminReviewStatusService';


const ReviewStatusManagementPage: React.FC = () => {
  const theme = useTheme();
  const [reviewStatuses, setReviewStatuses] = useState<ReviewStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [editingStatusData, setEditingStatusData] = useState<StatusData | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingStatusId, setDeletingStatusId] = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statuses = await getReviewStatuses();
      setReviewStatuses(statuses);
    } catch (err) {
      console.error("Failed to fetch review statuses:", err);
      setError(`获取审核状态失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleOpenCreateStatusDialog = () => {
    setEditingStatusData(null);
    setIsStatusDialogOpen(true);
  };

  const handleOpenEditStatusDialog = (statusId: string) => {
    const statusToEdit = reviewStatuses.find(status => status.id === statusId);
    if (statusToEdit) {
      setEditingStatusData(statusToEdit); // StatusData is compatible with ReviewStatus
      setIsStatusDialogOpen(true);
    }
  };

  const handleCloseStatusDialog = useCallback(() => {
    setIsStatusDialogOpen(false);
    setEditingStatusData(null);
  }, []);

  const handleSaveStatus = useCallback(async (statusData: StatusData) => {
    setIsLoading(true);
    setError(null);
    try {
      if (statusData.id) { // Editing existing status
        const updatedStatus = await updateReviewStatus(statusData.id, { label: statusData.label, description: statusData.description });
        setReviewStatuses(prevStatuses =>
          prevStatuses.map(s => s.id === updatedStatus.id ? updatedStatus : s)
        );
      } else { // Creating new status
        const newStatus = await createReviewStatus({ label: statusData.label, description: statusData.description });
        setReviewStatuses(prevStatuses => [...prevStatuses, newStatus]);
      }
      handleCloseStatusDialog();
    } catch (err) {
      console.error("Failed to save status:", err);
      setError(`保存状态失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [handleCloseStatusDialog]);

  const handleOpenDeleteConfirm = (statusId: string) => {
    setDeletingStatusId(statusId);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingStatusId(null);
  }, []);

  const handleConfirmDeleteStatus = useCallback(async () => {
    if (!deletingStatusId) return;
    setIsLoading(true);
    setError(null);
    try {
      await deleteReviewStatus(deletingStatusId);
      setReviewStatuses(prevStatuses => prevStatuses.filter(s => s.id !== deletingStatusId));
      if (editingStatusData?.id === deletingStatusId) {
        handleCloseStatusDialog();
      }
      handleCloseDeleteConfirm();
    } catch (err) {
      console.error("Failed to delete status:", err);
      setError(`删除状态失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [deletingStatusId, editingStatusData?.id, handleCloseStatusDialog, handleCloseDeleteConfirm]);

  const statusToDeleteDetails = reviewStatuses.find(s => s.id === deletingStatusId);
  
  if (isLoading && reviewStatuses.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ml: 2}}>加载审核状态...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        审核状态管理
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1} sx={{ backgroundColor: theme.palette.background.paper }}>
        <Toolbar sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateStatusDialog}
            disabled={isLoading}
          >
            添加状态
          </Button>
          {isLoading && <CircularProgress size={24} sx={{ml: 2}}/>}
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
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                  }}
                >
                  <TableCell component="th" scope="row" sx={{ color: theme.palette.text.primary }}>
                    {status.label}
                  </TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {status.description}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="编辑状态">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditStatusDialog(status.id!)}
                        disabled={isLoading}
                        sx={{ mr: 0.5, color: theme.palette.info.main, '&:hover': { backgroundColor: theme.palette.action.focus } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除状态">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteConfirm(status.id!)}
                        disabled={isLoading}
                        sx={{ color: theme.palette.error.main, '&:hover': { backgroundColor: theme.palette.action.focus } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!isLoading && reviewStatuses.length === 0 && !error && (
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
