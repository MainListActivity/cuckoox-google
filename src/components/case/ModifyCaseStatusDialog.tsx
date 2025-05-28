import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '../../contexts/SnackbarContext'; // Added for showSuccess
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
  // Based on "状态流转逻辑及处理" table in 产品说明文档-jules.md (section 3.1.4)
  // And also considering "程序进程" enum: 立案、公告、债权申报、债权人第一次会议、裁定重整、提交重整计划、延迟提交重整计划、债权人第二次会议、破产清算、结案
  '立案': ['公告', '结案'], // Doc: "立案" -> "公告"
  '公告': ['债权申报', '结案'], // Doc: "公告" -> "债权申报"
  '债权申报': ['债权人第一次会议', '结案'], // Doc: "债权申报" -> "债权人第一次会议"
  '债权人第一次会议': ['破产清算', '裁定重整', '结案'], // Doc: "债权人第一次会议" -> "破产清算" OR "裁定重整". '和解' is a separate procedure, not a direct status change from here in the table.
  '破产清算': ['结案'], // Doc doesn't explicitly state "破产清算" -> "结案" but it's a terminal path before结案.
  '裁定重整': ['提交重整计划', '延迟提交重整计划', '破产清算', '结案'], // Doc: "裁定重整" -> "提交重整计划" OR "延迟提交重整计划". Added "破产清算" for failure scenario.
  '提交重整计划': ['债权人第二次会议', '结案'], // Doc: "提交重整计划" -> "债权人第二次会议"
  '延迟提交重整计划': ['债权人第二次会议', '提交重整计划', '结案'], // Doc: "延迟提交重整计划" -> "债权人第二次会议". Added '提交重整计划' if they recover.
  // Adding '债权人第二次会议' as a current status, as it's in the enum and logically follows '提交重整计划' or '延迟提交重整计划'
  '债权人第二次会议': ['批准重整计划', '终止重整计划', '破产清算', '结案'], // Assuming these are logical next steps after a second meeting. Product doc needs more clarity here.
  // The following statuses '重整计划（草案）投票', '重整计划（草案）通过或未通过', '批准重整计划', '终止重整计划', '和解' are not explicitly in the state transition table as *current* statuses.
  // They seem to be outcomes or sub-processes. For now, sticking to the main documented flowchart.
  // '批准重整计划' would logically lead to '结案' (after execution).
  // '终止重整计划' would logically lead to '破产清算'.
  '批准重整计划': ['结案'],
  '终止重整计划': ['破产清算', '结案'],
  '和解': ['结案'], // '和解' is a procedure type, if it's a status, it leads to结案.
  '结案': [], // Terminal state
};

// These statuses are from the provided code's CaseStatus type, 
// but not all are in the product doc's state transition table as *current* states.
// '重整计划（草案）投票'
// '重整计划（草案）通过或未通过'

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
  const { showSuccess } = useSnackbar(); // Added
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
  const [firstCreditorMeetingDate, setFirstCreditorMeetingDate] = useState<string>(''); // Added for '破产清算' or '裁定重整' from '债权人第一次会议'

  // RichTextEditor content
  const [restructuringAnnouncementDelta, setRestructuringAnnouncementDelta] = useState<QuillDelta>(new Delta());
  const [restructuringPlanDelta, setRestructuringPlanDelta] = useState<QuillDelta>(new Delta());

  useEffect(() => {
    if (currentCase) {
      let possibleStatuses = stateTransitions[currentCase.current_status] || [];
      // Ensure '结案' is always an option unless already '结案'
      if (currentCase.current_status !== '结案' && !possibleStatuses.includes('结案')) {
        possibleStatuses = [...possibleStatuses, '结案'];
      }
      setAvailableNextStatuses(possibleStatuses);
      setSelectedNextStatus(''); 
      
      // Reset all conditional fields
      setAnnouncementDate('');
      setClaimStartDate('');
      setClaimEndDate('');
      setRestructuringDecisionDate('');
      setPlanSubmissionDate('');
      setDelayedPlanSubmissionDate('');
      setClosingDate('');
      setFirstCreditorMeetingDate(''); // Reset new field
      setRestructuringAnnouncementDelta(new Delta());
      setRestructuringPlanDelta(new Delta());
    } else {
      setAvailableNextStatuses([]);
      setSelectedNextStatus('');
    }
  }, [currentCase, open]);

  const handleStatusChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedNextStatus(event.target.value as CaseStatus);
  };

  const handleSubmit = () => {
    if (!currentCase || !selectedNextStatus) return;

    const submissionData: any = {
      caseId: currentCase.id,
      newStatus: selectedNextStatus,
      currentStatus: currentCase.current_status,
    };

    // Add conditional data based on selectedNextStatus and product documentation
    switch (selectedNextStatus) {
      case '公告':
        submissionData.announcementDate = announcementDate; // Doc: "记录/更新案件的“公告时间”"
        break;
      case '债权申报':
        submissionData.claimStartDate = claimStartDate; // Doc: "记录/更新“债权申报开始时间”"
        break;
      case '债权人第一次会议':
        submissionData.claimEndDate = claimEndDate; // Doc: "记录/更新“债权申报截止时间”"
        break;
      case '破产清算':
        // Doc: "记录“债权人第一次会议时间”" when transitioning from '债权人第一次会议'
        if (currentCase.current_status === '债权人第一次会议') {
          submissionData.firstCreditorMeetingDate = firstCreditorMeetingDate;
        }
        // No specific date for '破产清算' itself, but might need related dates if coming from other statuses.
        break;
      case '裁定重整':
        // Doc: "记录“债权人第一次会议时间”" when transitioning from '债权人第一次会议'
        if (currentCase.current_status === '债权人第一次会议') {
          submissionData.firstCreditorMeetingDate = firstCreditorMeetingDate;
        }
        submissionData.restructuringDecisionDate = restructuringDecisionDate; // Doc: "记录“裁定重整时间”"
        submissionData.restructuringAnnouncementContent = JSON.stringify(restructuringAnnouncementDelta.ops); // Doc: "需在页面提交“裁定重整公告”"
        break;
      case '提交重整计划':
        submissionData.planSubmissionDate = planSubmissionDate; // Doc: "记录“重整计划提交时间”"
        submissionData.restructuringPlanContent = JSON.stringify(restructuringPlanDelta.ops); // Doc: "需在页面提交“重整计划”"
        break;
      case '延迟提交重整计划':
        submissionData.delayedPlanSubmissionDate = delayedPlanSubmissionDate; // Doc: "记录“延迟提交重整计划时间”"
        break;
      case '债权人第二次会议':
        // No specific date mentioned for transitioning TO this state in the table.
        // Dates would be recorded when transitioning FROM this state.
        break;
      case '结案':
        submissionData.closingDate = closingDate; // Doc: "并需设置结案时间"
        break;
      // Add other cases as per documentation if new transitions are added.
    }

    console.log("Submitting Case Status Update:", submissionData);
    showSuccess(t('modify_status_success_message', '案件状态已成功（模拟）更新！')); // Added success message
    
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
      case '债权人第一次会议': // Transitioning TO '债权人第一次会议'
        return (
          <TextField
            margin="dense"
            id="claimEndDate" // This is the date for when claim submission (previous phase) ends
            label={t('modify_status_claim_end_date', '债权申报截止时间')}
            type="date"
            fullWidth
            variant="outlined"
            value={claimEndDate}
            onChange={(e) => setClaimEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        );
      case '破产清算':
      case '裁定重整':
        if (currentCase.current_status === '债权人第一次会议') {
          return (
            <>
              <TextField
                margin="dense"
                id="firstCreditorMeetingDate"
                label={t('modify_status_first_creditor_meeting_date', '债权人第一次会议时间')}
                type="date"
                fullWidth
                variant="outlined"
                value={firstCreditorMeetingDate}
                onChange={(e) => setFirstCreditorMeetingDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: selectedNextStatus === '裁定重整' ? 2 : 0 }}
              />
              {selectedNextStatus === '裁定重整' && (
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
              )}
            </>
          );
        } else if (selectedNextStatus === '裁定重整') { // e.g. from '延迟提交重整计划' directly to '裁定重整' (if logic allows)
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
        }
        return null; // Or other default fields if needed for '破产清算' from other states
      // case '裁定重整': // This is now part of the above combined case
      //   return (
      //     <>
      //       <TextField
      //         margin="dense"
      //         id="restructuringDecisionDate"
      //         label={t('modify_status_restructuring_decision_date', '裁定重整时间')}
      //         type="date"
      //         fullWidth
      //         variant="outlined"
      //         value={restructuringDecisionDate}
      //         onChange={(e) => setRestructuringDecisionDate(e.target.value)}
      //         InputLabelProps={{ shrink: true }}
      //         sx={{ mb: 2 }}
      //       />
      //       <Typography variant="subtitle2" gutterBottom sx={{mt:1}}>
      //         {t('modify_status_restructuring_announcement_doc', '裁定重整公告')}
      //       </Typography>
      //       <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1, minHeight: '200px' }}>
      //         <RichTextEditor
      //           value={restructuringAnnouncementDelta}
      //           onTextChange={(delta) => setRestructuringAnnouncementDelta(delta)}
      //           placeholder={t('modify_status_restructuring_announcement_placeholder', '请输入公告内容...')}
      //         />
      //       </Box>
      //     </>
      //   );
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
      case '债权人第二次会议': // No specific fields when transitioning TO this according to table.
        return null;
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
