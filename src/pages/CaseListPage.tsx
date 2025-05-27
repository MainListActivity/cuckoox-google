import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
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
  Tooltip, // Added for icon buttons
  IconButton, // Added for icon buttons
} from '@mui/material';
import { 
  mdiPlusCircleOutline, 
  mdiEyeOutline, 
  mdiFileDocumentOutline, // Added icon
  mdiFileEditOutline,   // Added icon
  mdiCalendarEdit,      // Added icon
} from '@mdi/js';

// Mock data, replace with API call
const mockCases = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice Manager', case_procedure: '破产清算', creator_name: '系统管理员', current_stage: '债权申报', acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob Admin', case_procedure: '破产和解', creator_name: '张三', current_stage: '立案', acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol Handler', case_procedure: '破产重整', creator_name: '李四', current_stage: '债权人第一次会议', acceptance_date: '2023-03-10' },
];

const CaseListPage: React.FC = () => {
  // TODO: Fetch cases from API
  // TODO: Implement case creation, filtering, pagination
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">案件列表</Typography>
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
                  <TableCell align="center" sx={{whiteSpace: 'nowrap'}}> {/* Center align and prevent wrapping */}
                    <Tooltip title="查看详情">
                      <IconButton component={Link} to={`/cases/${caseItem.id}`} size="small" color="primary">
                        <SvgIcon fontSize="small"><path d={mdiEyeOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="查看材料">
                      <IconButton component={Link} to={`#`} size="small" color="secondary"> {/* Placeholder link */}
                        <SvgIcon fontSize="small"><path d={mdiFileDocumentOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="修改状态">
                      <IconButton component={Link} to={`#`} size="small"> {/* Placeholder link */}
                        <SvgIcon fontSize="small"><path d={mdiFileEditOutline} /></SvgIcon>
                      </IconButton>
                    </Tooltip>
                    {caseItem.current_stage === '债权人第一次会议' && (
                       <Tooltip title="会议纪要">
                        <IconButton component={Link} to={`#`} size="small"> {/* Placeholder link */}
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
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>案件管理页面，将包含创建、编辑、查看案件详情、修改案件状态等功能。案件的展示和操作将根据用户权限和案件当前进程进行控制。</Typography>
    </Box>
  );
};

export default CaseListPage;