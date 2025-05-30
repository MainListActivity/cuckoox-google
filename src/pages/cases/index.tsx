import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // Added for t function
import { useSnackbar } from '@/src/contexts/SnackbarContext'; // Added for showSuccess
import {
  Box,
  TextField, // Added TextField for search
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  SvgIcon,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  mdiPlusCircleOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiFileEditOutline,
  mdiCalendarEdit,
  mdiFilterVariant, // Added icon for filter
} from '@mdi/js';

// Import Dialogs
import ModifyCaseStatusDialog, { CaseStatus } from '@/src/components/case/ModifyCaseStatusDialog'; // Corrected path
import MeetingMinutesDialog, { QuillDelta } from '@/src/components/case/MeetingMinutesDialog'; // Corrected path and imported QuillDelta

// Define a type for our case items, you might want to move this to a types file
interface CaseItem {
  id: string;
  case_number: string;
  case_lead_name: string;
  case_procedure: string;
  creator_name: string;
  current_stage: CaseStatus; // Using CaseStatus for consistency
  acceptance_date: string;
}

// Mock data, replace with API call
const mockCases: CaseItem[] = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice Manager', case_procedure: '破产清算', creator_name: '系统管理员', current_stage: '债权申报', acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob Admin', case_procedure: '破产和解', creator_name: '张三', current_stage: '立案', acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol Handler', case_procedure: '破产重整', creator_name: '李四', current_stage: '债权人第一次会议', acceptance_date: '2023-03-10' },
];

const CaseListPage: React.FC = () => {
  const { t } = useTranslation(); // Added for i18n
  const { showSuccess } = useSnackbar(); // Added for snackbar notifications

  // State for dialogs
  const [modifyStatusOpen, setModifyStatusOpen] = useState(false);
  const [meetingMinutesOpen, setMeetingMinutesOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>('');


  // Handlers for dialogs
  const handleOpenModifyStatus = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    setModifyStatusOpen(true);
  };

  const handleCloseModifyStatus = () => {
    setModifyStatusOpen(false);
    // setSelectedCase(null); // Keep selectedCase for MeetingMinutesDialog if it was opened from ModifyStatus context
  };

  const handleOpenMeetingMinutes = (caseItem: CaseItem) => {
    setSelectedCase(caseItem);
    let title = '';
    if (caseItem.current_stage === '债权人第一次会议') {
      title = t('first_creditors_meeting_minutes_title', '第一次债权人会议纪要');
    } else if (caseItem.current_stage === '债权人第二次会议') {
      title = t('second_creditors_meeting_minutes_title', '第二次债权人会议纪要');
    } else {
      // Fallback or generic title if needed, though buttons are conditional
      title = t('meeting_minutes_generic_title', '会议纪要');
    }
    setCurrentMeetingTitle(title);
    setMeetingMinutesOpen(true);
  };

  const handleCloseMeetingMinutes = () => {
    setMeetingMinutesOpen(false);
    // setSelectedCase(null); // Do not nullify if we want to chain dialogs or keep context
  };

  const handleSaveMeetingMinutes = (minutesDelta: QuillDelta, meetingTitle: string) => {
    console.log('Saving Meeting Minutes:');
    console.log('  caseId:', selectedCase?.id);
    console.log('  meetingTitle:', meetingTitle);
    console.log('  minutesContent:', JSON.stringify(minutesDelta.ops));
    
    // TODO: Implement actual API call to save meeting minutes
    showSuccess(t('meeting_minutes_save_success_mock', '会议纪要已（模拟）保存成功！'));
    handleCloseMeetingMinutes();
  };
  
  // TODO: Fetch cases from API
  // TODO: Implement case creation, filtering, pagination
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">案件列表</Typography>
        <Box>
          <TextField 
            variant="outlined" 
            size="small" 
            placeholder="搜索案件..." 
            sx={{ mr: 2 }}
            onChange={(e) => console.log('Search value:', e.target.value)} // Placeholder
          />
          <Button 
            variant="outlined" 
            startIcon={<SvgIcon><path d={mdiFilterVariant} /></SvgIcon>}
            onClick={() => console.log('Filter button clicked')} // Placeholder
            sx={{ mr: 2 }}
          >
            筛选
          </Button>
          {/* // TODO: Access Control - This button should be visible based on user role (e.g., user has 'create_case' permission). */}
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/cases/create"
            startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}
          >
            创建新案件
          </Button>
        </Box>
      </Box>
      
      {/* Placeholder for Search and Filter Controls */}
      {/* <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          // Search input and filter button would go here
      </Box> */}

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer> {/* sx={{ maxHeight: 440 }} if you want a fixed height scrollable table */}
          <Table stickyHeader aria-label="case list table">
            <TableHead>
              <TableRow>
                <TableCell>案件编号</TableCell>
                <TableCell>案件程序</TableCell>
                <TableCell>案件负责人</TableCell>
                <TableCell>创建人</TableCell>
                <TableCell>受理时间</TableCell>
                <TableCell>程序进程</TableCell>
                <TableCell align="center">操作</TableCell> {/* Align actions to the right */}
              </TableRow>
            </TableHead>
            <TableBody>
              {mockCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center"> {/* Updated colSpan */}
                    <Typography sx={{ p: 2 }}>暂无案件数据</Typography>
                  </TableCell>
                </TableRow>
              )}
              {mockCases.map((caseItem) => (
                <TableRow hover key={caseItem.id}>
                  <TableCell component="th" scope="row">
                    {caseItem.case_number}
                  </TableCell>
                  <TableCell>{caseItem.case_procedure}</TableCell>
                  <TableCell>{caseItem.case_lead_name}</TableCell>
                  <TableCell>{caseItem.creator_name}</TableCell>
                  <TableCell>{caseItem.acceptance_date}</TableCell>
                  <TableCell>
                    <Chip label={caseItem.current_stage} variant="outlined" size="small" />
                    {/* Using outlined for better theme adaptability. Color can be added conditionally if needed */}
                  </TableCell>
                  <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>
                    <Tooltip title="查看详情">
                      <IconButton component={Link} to={`/cases/${caseItem.id}`} size="small" color="primary">
                        <SvgIcon fontSize="small"><path d={mdiEyeOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="查看材料">
                      <IconButton component={Link} to={`/cases/${caseItem.id}`} size="small" color="secondary"> {/* Updated link */}
                        <SvgIcon fontSize="small"><path d={mdiFileDocumentOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    {/* // TODO: Access Control - This button's visibility and enabled state should depend on user role and case status specifics. */}
                    <Tooltip title="修改状态">
                      <IconButton onClick={() => handleOpenModifyStatus(caseItem)} size="small">
                        <SvgIcon fontSize="small"><path d={mdiFileEditOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    {/* // TODO: Access Control - Also check user permission for 'manage_meeting_minutes'. */}
                    {(caseItem.current_stage === '债权人第一次会议' || caseItem.current_stage === '债权人第二次会议') && (
                       <Tooltip title="会议纪要">
                        <IconButton onClick={() => handleOpenMeetingMinutes(caseItem)} size="small">
                          <SvgIcon fontSize="small"><path d={mdiCalendarEdit} /></SvgIcon>
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Placeholder for Pagination Controls */}
        {/* <TablePagination 
            // ...props 
        /> */}
      </Paper>

      {/* Dialogs */}
      {selectedCase && (
        <ModifyCaseStatusDialog
          open={modifyStatusOpen}
          onClose={handleCloseModifyStatus}
          currentCase={selectedCase ? { id: selectedCase.id, current_status: selectedCase.current_stage } : null}
          // onSave={handleSaveStatus} // Assuming you'll add a save handler for status
        />
      )}
      {selectedCase && meetingMinutesOpen && ( // Ensure meetingMinutesOpen is also true
        <MeetingMinutesDialog
          open={meetingMinutesOpen}
          onClose={handleCloseMeetingMinutes}
          caseInfo={{ caseId: selectedCase.id, caseName: selectedCase.case_number }} // Pass necessary info
          meetingTitle={currentMeetingTitle}
          onSave={handleSaveMeetingMinutes}
          // existingMinutes can be passed if you fetch them
        />
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>案件管理页面，将包含创建、编辑、查看案件详情、修改案件状态等功能。案件的展示和操作将根据用户权限和案件当前进程进行控制。</Typography>
    </Box>
  );
};

export default CaseListPage;