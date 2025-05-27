import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Grid,
  Chip,
} from '@mui/material';
import RichTextEditor, { QuillDelta } from '../RichTextEditor'; // Assuming path
import Delta from 'quill-delta';

// Define valid case statuses - should match product documentation
export type CaseStatus = 
  | '立案' 
  | '公告' 
  | '债权申报' 
  | '债权人第一次会议' 
  | '破产清算' 
  | '裁定重整' 
  | '提交重整计划' 
  | '延迟提交重整计划'
  | '重整计划（草案）投票'
  | '重整计划（草案）通过或未通过'
  | '批准重整计划'
  | '终止重整计划'
  | '和解' 
  | '结案';

// State transition map based on product documentation (section 3.1.4)
const stateTransitions: Record<CaseStatus, CaseStatus[]> = {
  '立案': ['公告', '结案'],
  '公告': ['债权申报', '结案'],
  '债权申报': ['债权人第一次会议', '结案'],
  '债权人第一次会议': ['破产清算', '裁定重整', '和解', '结案'],
  '破产清算': ['结案'], // Assuming direct to结案
  '裁定重整': ['提交重整计划', '结案'],
  '提交重整计划': ['延迟提交重整计划', '重整计划（草案）投票', '结案'],
  '延迟提交重整计划': ['提交重整计划', '结案'], // Can resubmit or end
  '重整计划（草案）投票': ['重整计划（草案）通过或未通过', '结案'],
  '重整计划（草案）通过或未通过': ['批准重整计划', '终止重整计划', '结案'], // Depends on vote outcome
  '批准重整计划': ['结案'], // Or execution phase, then结案
  '终止重整计划': ['破产清算', '结案'], // Or other paths based on why it's terminated
  '和解': ['结案'], // Assuming direct to结案
  '结案': [], // Terminal state
};

interface CaseInfo {
  id: string;
  current_status: CaseStatus; // Or use a more generic field like program_stage
  // other case details if needed
}

interface ModifyCaseStatusDialogProps {
  open: boolean;
  onClose: () => void;
  currentCase: CaseInfo | null;
}

const ModifyCaseStatusDialog: React.FC<ModifyCaseStatusDialogProps> = ({
  open,
  onClose,
  currentCase,
}) => {
  const { t } = useTranslation();
  const [selectedNextStatus, setSelectedNextStatus] = useState<CaseStatus | ''>('');
  const [availableNextStatuses, setAvailableNextStatuses] = useState<CaseStatus[]>([]);

  // Date fields
  const [announcementDate, setAnnouncementDate] = useState<string>('');
  const [claimStartDate, setClaimStartDate] = useState<string>('');
  const [claimEndDate, setClaimEndDate] = useState<string>('');
  const [restructuringDecisionDate, setRestructuringDecisionDate] = useState<string>('');
  const [planSubmissionDate, setPlanSubmissionDate] = useState<string>('');
  const [delayedPlanSubmissionDate, setDelayedPlanSubmissionDate] = useState<string>('');
  const [closingDate, setClosingDate] = useState<string>('');

  // RichTextEditor content
  const [restructuringAnnouncementDelta, setRestructuringAnnouncementDelta] = useState<QuillDelta>(new Delta());
  const [restructuringPlanDelta, setRestructuringPlanDelta] = useState<QuillDelta>(new Delta());

  useEffect(() => {
    if (currentCase) {
      const possibleStatuses = stateTransitions[currentCase.current_status] || [];
      // Always allow '结案' if not already in '结案' state
      if (currentCase.current_status !== '结案' && !possibleStatuses.includes('结案')) {
        setAvailableNextStatuses([...possibleStatuses, '结案']);
      } else {
        setAvailableNextStatuses(possibleStatuses);
      }
      setSelectedNextStatus(''); // Reset selected status when case changes
      // Reset all conditional fields
      setAnnouncementDate('');
      setClaimStartDate('');
      setClaimEndDate('');
      setRestructuringDecisionDate('');
      setPlanSubmissionDate('');
      setDelayedPlanSubmissionDate('');
      setClosingDate('');
      setRestructuringAnnouncementDelta(new Delta());
      setRestructuringPlanDelta(new Delta());
    } else {
      setAvailableNextStatuses([]);
      setSelectedNextStatus('');
    }
  }, [currentCase, open]); // Rerun when dialog opens or case changes

  const handleStatusChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedNextStatus(event.target.value as CaseStatus);
  };

  const handleSubmit = () => {
    console.log('Submitting new status:', selectedNextStatus);
    console.log('Current Case ID:', currentCase?.id);
    // Log conditional data
    if (selectedNextStatus === '公告') console.log('Announcement Date:', announcementDate);
    if (selectedNextStatus === '债权申报') console.log('Claim Start Date:', claimStartDate);
    if (selectedNextStatus === '债权人第一次会议') console.log('Claim End Date:', claimEndDate);
    if (selectedNextStatus === '裁定重整') {
      console.log('Restructuring Decision Date:', restructuringDecisionDate);
      console.log('Restructuring Announcement Content:', JSON.stringify(restructuringAnnouncementDelta.ops));
    }
    if (selectedNextStatus === '提交重整计划') {
      console.log('Restructuring Plan Submission Date:', planSubmissionDate);
      console.log('Restructuring Plan Content:', JSON.stringify(restructuringPlanDelta.ops));
    }
    if (selectedNextStatus === '延迟提交重整计划') console.log('Delayed Plan Submission Date:', delayedPlanSubmissionDate);
    if (selectedNextStatus === '结案') console.log('Closing Date:', closingDate);
    
    // TODO: Implement actual API call to update status and save data/documents
    onClose(); // Close dialog after submission
  };

  if (!currentCase) return null;

  const renderConditionalFields = () => {
    switch (selectedNextStatus) {
      case '公告':
        return (
          <TextField
            margin="dense"
            id="announcementDate"
            label={t('modify_status_announcement_date', '公告时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={announcementDate}
            onChange={(e) => setAnnouncementDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      case '债权申报':
        return (
          <TextField
            margin="dense"
            id="claimStartDate"
            label={t('modify_status_claim_start_date', '债权申报开始时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={claimStartDate}
            onChange={(e) => setClaimStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      case '债权人第一次会议':
        return (
          <TextField
            margin="dense"
            id="claimEndDate"
            label={t('modify_status_claim_end_date', '债权申报截止时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={claimEndDate}
            onChange={(e) => setClaimEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      case '裁定重整':
        return (
          <>
            <TextField
              margin="dense"
              id="restructuringDecisionDate"
              label={t('modify_status_restructuring_decision_date', '裁定重整时间')}
              type="date"
              fullWidth
              variant="outlined"
              value={restructuringDecisionDate}
              onChange={(e) => setRestructuringDecisionDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <Typography variant="subtitle2" gutterBottom sx={{mt:1}}>
              {t('modify_status_restructuring_announcement_doc', '裁定重整公告')}
            </Typography>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, minHeight: '200px' }}>
              <RichTextEditor
                value={restructuringAnnouncementDelta}
                onTextChange={(delta) => setRestructuringAnnouncementDelta(delta)}
                placeholder={t('modify_status_restructuring_announcement_placeholder', '请输入公告内容...')}
              />
            </Box>
          </>
        );
      case '提交重整计划':
        return (
          <>
            <TextField
              margin="dense"
              id="planSubmissionDate"
              label={t('modify_status_plan_submission_date', '重整计划提交时间')}
              type="date"
              fullWidth
              variant="outlined"
              value={planSubmissionDate}
              onChange={(e) => setPlanSubmissionDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <Typography variant="subtitle2" gutterBottom sx={{mt:1}}>
              {t('modify_status_restructuring_plan_doc', '重整计划')}
            </Typography>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, minHeight: '200px' }}>
              <RichTextEditor
                value={restructuringPlanDelta}
                onTextChange={(delta) => setRestructuringPlanDelta(delta)}
                placeholder={t('modify_status_restructuring_plan_placeholder', '请输入计划内容...')}
              />
            </Box>
          </>
        );
      case '延迟提交重整计划':
        return (
          <TextField
            margin="dense"
            id="delayedPlanSubmissionDate"
            label={t('modify_status_delayed_plan_date', '延迟提交重整计划时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={delayedPlanSubmissionDate}
            onChange={(e) => setDelayedPlanSubmissionDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      case '结案':
         return (
          <TextField
            margin="dense"
            id="closingDate"
            label={t('modify_status_closing_date', '结案时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('modify_status_dialog_title', '修改案件状态')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold' }}>
            {t('modify_status_current_status_label', '当前状态')}:{' '}
          </Typography>
          <Chip label={currentCase.current_status} color="primary" />
        </Box>

        <FormControl fullWidth margin="normal">
          <InputLabel id="next-status-select-label">{t('modify_status_select_next_status_label', '选择新的状态')}</InputLabel>
          <Select
            labelId="next-status-select-label"
            id="nextStatus"
            value={selectedNextStatus}
            label={t('modify_status_select_next_status_label', '选择新的状态')}
            onChange={handleStatusChange}
            disabled={availableNextStatuses.length === 0}
          >
            <MenuItem value="" disabled>
              <em>{t('modify_status_select_placeholder', '请选择...')}</em>
            </MenuItem>
            {availableNextStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {t(`case_status_${status.toLowerCase().replace(/\s+/g, '_')}`, status)} 
                {/* Assuming you have i18n keys like case_status_立案 */}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedNextStatus && (
          <Box mt={2} p={2} border={1} borderColor="divider" borderRadius={1}>
            <Typography variant="h6" gutterBottom>
              {t('modify_status_required_info_title', '所需信息')}
            </Typography>
            {renderConditionalFields()}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel_button', '取消')}</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={!selectedNextStatus} // Disable if no next status is selected
        >
          {t('submit_button', '提交')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModifyCaseStatusDialog;
