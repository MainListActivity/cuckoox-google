import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  CircularProgress,
  Alert,
  Toolbar,
  Tooltip,
  useTheme,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  getNotificationRules,
  deleteNotificationRule,
  NotificationRule,
  // NotificationRuleInput, // Not used directly in this file's save handler
} from '@/src/services/adminNotificationRuleService'; // Adjusted import path
import CreateEditNotificationRuleDialog from '@/src/components/admin/notifications/CreateEditNotificationRuleDialog'; // Adjusted import path
import ConfirmDeleteDialog from '@/src/components/common/ConfirmDeleteDialog'; // Adjusted import path

const NotificationRuleManagementPage: React.FC = () => {
  const theme = useTheme();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Mock case statuses and date fields for the dialog - these might come from a config or context in a real app
  const MOCK_CASE_STATUSES = ['立案', '公告', '债权申报', '债权审核', '破产清算', '重整', '和解'];
  const MOCK_CASE_DATE_FIELDS = ['受理时间', '公告时间', '债权申报截止时间', '首次会议时间'];


  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRules = await getNotificationRules();
      setRules(fetchedRules);
    } catch (err) {
      setError('Failed to fetch notification rules.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleOpenCreateDialog = () => {
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (rule: NotificationRule) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
  };

  const handleSaveRule = async () => {
    // The actual save logic (create/update) is within CreateEditNotificationRuleDialog.
    // This parent component just needs to refresh its list of rules after a save.
    fetchRules(); 
    // Dialog will close itself upon successful save, or user can cancel.
    // Forcing close here might be premature if save fails in dialog.
    // handleCloseDialog(); 
  };
  
  const handleOpenDeleteDialog = (ruleId: string) => {
    setDeletingRuleId(ruleId);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeletingRuleId(null);
    setIsDeleteDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (deletingRuleId) {
      try {
        await deleteNotificationRule(deletingRuleId);
        fetchRules(); // Refetch after delete
      } catch (err) {
        setError('Failed to delete rule.');
        console.error(err);
      } finally {
        handleCloseDeleteDialog();
      }
    }
  };
  
  const ruleToDelete = rules.find(r => r.id === deletingRuleId);

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
          >
            创建新规则
          </Button>
        </Toolbar>

        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>}
        
        {!isLoading && !error && (
          <TableContainer>
            <Table sx={{ minWidth: 750 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Case Status Trigger</TableCell>
                  <TableCell>Timing Condition</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.description}</TableCell>
                    <TableCell>{rule.caseStatusTrigger}</TableCell>
                    <TableCell>{`${rule.timingCondition.triggerType} (DateField: ${rule.timingCondition.caseDateField || 'N/A'}, Offset: ${rule.timingCondition.offsetDays === undefined ? 'N/A' : rule.timingCondition.offsetDays})`}</TableCell>
                    <TableCell>{rule.frequencyDescription}</TableCell>
                    <TableCell>
                      <Switch checked={rule.isEnabled} disabled /> {/* Actual toggle logic would be in update service call */}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Rule">
                        <IconButton size="small" onClick={() => handleOpenEditDialog(rule)} sx={{ mr: 0.5 }}>
                          <EditIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Rule">
                        <IconButton size="small" onClick={() => handleOpenDeleteDialog(rule.id)}>
                          <DeleteOutlineIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!isLoading && rules.length === 0 && !error && (
          <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
            No notification rules configured.
          </Typography>
        )}
      </Paper>

      {/* Ensure CreateEditNotificationRuleDialog receives all necessary props including caseStatuses and caseDateFields */}
      <CreateEditNotificationRuleDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveRule} 
        initialData={editingRule}
        caseStatuses={MOCK_CASE_STATUSES} 
        caseDateFields={MOCK_CASE_DATE_FIELDS}
      />
      
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete Rule"
        contentText={ruleToDelete ? `Are you sure you want to delete the rule "${ruleToDelete.name}"?` : "Are you sure?"}
      />
    </Box>
  );
};

export default NotificationRuleManagementPage;
