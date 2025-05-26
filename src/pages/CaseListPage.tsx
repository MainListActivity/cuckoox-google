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
} from '@mui/material';
import { mdiPlusCircleOutline, mdiEyeOutline } from '@mdi/js';

// Mock data, replace with API call
const mockCases = [
  { id: 'case001', case_number: 'BK-2023-001', case_lead_name: 'Alice Manager', current_stage: '债权申报', acceptance_date: '2023-01-15' },
  { id: 'case002', case_number: 'BK-2023-002', case_lead_name: 'Bob Admin', current_stage: '立案', acceptance_date: '2023-02-20' },
  { id: 'case003', case_number: 'BK-2023-003', case_lead_name: 'Carol Handler', current_stage: '债权人第一次会议', acceptance_date: '2023-03-10' },
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
                <TableCell>案件负责人</TableCell>
                <TableCell>受理时间</TableCell>
                <TableCell>程序进程</TableCell>
                <TableCell align="right">操作</TableCell> {/* Align actions to the right */}
              </TableRow>
            </TableHead>
            <TableBody>
              {mockCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography sx={{ p: 2 }}>暂无案件数据</Typography>
                  </TableCell>
                </TableRow>
              )}
              {mockCases.map((caseItem) => (
                <TableRow hover key={caseItem.id}>
                  <TableCell component="th" scope="row">
                    {caseItem.case_number}
                  </TableCell>
                  <TableCell>{caseItem.case_lead_name}</TableCell>
                  <TableCell>{caseItem.acceptance_date}</TableCell>
                  <TableCell>
                    <Chip label={caseItem.current_stage} color="primary" size="small" />
                    {/* You can add logic here to change chip color based on stage */}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined" // Or "text"
                      size="small"
                      component={Link}
                      to={`/cases/${caseItem.id}`}
                      startIcon={<SvgIcon><path d={mdiEyeOutline} /></SvgIcon>} // Optional icon
                    >
                      查看详情
                    </Button>
                    {/* Add other action buttons/icons here later */}
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