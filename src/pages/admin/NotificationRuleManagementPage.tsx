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
  Switch,
  Chip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import CreateEditNotificationRuleDialog from '../../components/admin/notifications/CreateEditNotificationRuleDialog';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

import {
  NotificationRule,
  NotificationRuleInput, // Import this type for onSave
  getNotificationRules,
  updateNotificationRule,
  deleteNotificationRule,
  createNotificationRule, 
} from '../../services/adminNotificationRuleService';

// Mock case statuses for display and potentially for the dialog later
const MOCK_CASE_STATUSES = ['立案', '公告', '债权申报', '债权审核', '破产清算', '重整', '和解'];
// Mock case date fields for display and potentially for the dialog later
const MOCK_CASE_DATE_FIELDS = ['受理时间', '公告时间', '债权申报截止时间', '首次会议时间'];


const NotificationRuleManagementPage: React.FC = () => {
  const theme = useTheme();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false); // For Create/Edit dialog
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRules = await getNotificationRules();
      setRules(fetchedRules);
    } catch (err) {
      console.error("Failed to fetch notification rules:", err);
      setError(`获取通知规则失败: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleOpenCreateDialog = () => {
    setEditingRule(null);
    setIsRuleDialogOpen(true);
  };

  const handleOpenEditDialog = (rule: NotificationRule) => {
    setEditingRule(rule);
    setIsRuleDialogOpen(true);
  };
  
  const handleToggleEnable = async (ruleId: string, currentStatus: boolean) => {
    setError(null);
    try {
        const updatedRule = await updateNotificationRule(ruleId, { isEnabled: !currentStatus });
        setRules(prevRules => prevRules.map(r => r.id === ruleId ? updatedRule : r));
    } catch (err) {
        console.error("Failed to toggle rule enable status:", err);
        setError(`更新规则状态失败: ${err instanceof Error ? err.message : "Unknown error"}`);
        // Revert UI change on error if desired, or refetch
    }
  };


  const handleCloseRuleDialog = useCallback(() => {
    setIsRuleDialogOpen(false);
    setEditingRule(null);
  }, []);

  const handleSaveRule = useCallback(async (ruleData: NotificationRuleInput) => {
    setError(null);
    setIsLoading(true); // Potentially set a specific loading state for save operation
    try {
      if (editingRule && editingRule.id) { // Check editingRule.id for update
        const updated = await updateNotificationRule(editingRule.id, ruleData);
        setRules(prevRules => prevRules.map(r => r.id === updated.id ? updated : r));
      } else {
        const newRule = await createNotificationRule(ruleData);
        setRules(prevRules => [...prevRules, newRule]);
      }
      handleCloseRuleDialog();
    } catch (err) {
        console.error("Failed to save rule:", err);
        setError(`保存规则失败: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
        setIsLoading(false); // Reset general loading or specific save loading state
    }
  }, [fetchRules, handleCloseRuleDialog, editingRule]);

  const handleOpenDeleteConfirm = (ruleId: string) => {
    setDeletingRuleId(ruleId);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingRuleId(null);
  }, []);

  const handleConfirmDeleteRule = useCallback(async () => {
    if (!deletingRuleId) return;
    // Optimistically remove from UI or set loading state
    // For now, just call service and refetch/filter
    setError(null);
    try {
      await deleteNotificationRule(deletingRuleId);
      setRules(prevRules => prevRules.filter(r => r.id !== deletingRuleId));
      handleCloseDeleteConfirm();
    } catch (err) {
      console.error("Failed to delete rule:", err);
      setError(`删除规则失败: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [deletingRuleId, handleCloseDeleteConfirm]);

  const ruleToDeleteDetails = rules.find(r => r.id === deletingRuleId);

  const formatTimingCondition = (condition: NotificationRule['timingCondition']): string => {
    if (condition.triggerType === 'on_status_change') {
      return '状态变更时触发';
    }
    let parts: string[] = [];
    if (condition.caseDateField) {
      parts.push(`基于 "${condition.caseDateField}"`);
    }
    if (condition.offsetDays !== undefined) {
      parts.push(`${condition.offsetDays > 0 ? '+' : ''}${condition.offsetDays}天`);
    }
    if (condition.comparisonOperator && condition.comparisonValue !== undefined) {
      parts.push(`当剩余天数 ${condition.comparisonOperator} ${condition.comparisonValue}`);
    }
    return parts.join(', ') || '未指定条件';
  };
  
  if (isLoading && rules.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ml: 2}}>加载通知规则...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        案件通知规则配置
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1} sx={{ backgroundColor: theme.palette.background.paper }}>
        <Toolbar sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateDialog}
            disabled={isLoading} // Disable while loading initially
          >
            创建新规则
          </Button>
          {isLoading && <CircularProgress size={24} sx={{ml: 2}}/>}
        </Toolbar>

        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label="notification rules table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>规则名称</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>触发状态</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: '200px' }}>触发条件</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>执行频率</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>启用</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow
                  key={rule.id}
                  hover
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="subtitle2">{rule.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                        {rule.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={rule.caseStatusTrigger} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{fontSize: '0.8rem'}}>{formatTimingCondition(rule.timingCondition)}</TableCell>
                  <TableCell>{rule.frequencyDescription}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.isEnabled}
                      onChange={() => handleToggleEnable(rule.id, rule.isEnabled)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="编辑规则">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEditDialog(rule)}
                        sx={{ mr: 0.5, color: 'info.main' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除规则">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteConfirm(rule.id)}
                        sx={{ color: 'error.main' }}
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
        {!isLoading && rules.length === 0 && !error && (
          <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
            暂无通知规则。
          </Typography>
        )}
      </Paper>

      {isRuleDialogOpen && (
        <CreateEditNotificationRuleDialog
          open={isRuleDialogOpen}
          onClose={handleCloseRuleDialog}
          onSave={handleSaveRule}
          initialData={editingRule}
          caseStatuses={MOCK_CASE_STATUSES}
          caseDateFields={MOCK_CASE_DATE_FIELDS}
        />
      )}

      <ConfirmDeleteDialog
        open={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDeleteRule}
        title="确认删除规则"
        contentText={
          deletingRuleId && ruleToDeleteDetails
            ? `您确定要删除通知规则 "${ruleToDeleteDetails.name}" 吗？此操作无法撤销。`
            : "您确定要删除此通知规则吗？此操作无法撤销。"
        }
      />
    </Box>
  );
};

export default NotificationRuleManagementPage;
