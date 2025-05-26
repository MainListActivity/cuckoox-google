import React from 'react';
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
  IconButton,
  Stack,
  SvgIcon,
} from '@mui/material';
import { mdiAccountPlusOutline, mdiPrinterOutline, mdiPencilOutline, mdiDeleteOutline } from '@mdi/js';

// Mock data, replace with API call relevant to a selected case
const mockCreditors = [
  { id: 'cred001', type: '组织', name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000' },
  { id: 'cred002', type: '个人', name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000' },
];

const CreditorListPage: React.FC = () => {
  // TODO: Fetch creditors for the selected case from API
  // TODO: Implement creditor creation, editing, filtering, pagination
  // TODO: Implement "一键打印债权人通知快递单"
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>债权人管理</Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        {/* Placeholder for potential search/filter elements on the left if added later */}
        <Box /> 
        <Stack direction="row" spacing={2}>
          <Button variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiAccountPlusOutline} /></SvgIcon>}>
            新增债权人
          </Button>
          <Button variant="contained" color="secondary" startIcon={<SvgIcon><path d={mdiPrinterOutline} /></SvgIcon>}>
            一键打印通知
          </Button>
        </Stack>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="creditor list table">
            <TableHead>
              <TableRow>
                <TableCell>类别</TableCell>
                <TableCell>姓名/名称</TableCell>
                <TableCell>ID/统一码</TableCell>
                <TableCell>联系人</TableCell>
                <TableCell>联系方式</TableCell>
                <TableCell align="right">操作</TableCell> {/* Align actions to the right */}
              </TableRow>
            </TableHead>
            <TableBody>
              {mockCreditors.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center"><Typography sx={{p:2}}>暂无债权人数据</Typography></TableCell></TableRow>
              )}
              {mockCreditors.map((creditor) => (
                <TableRow hover key={creditor.id}>
                  <TableCell>{creditor.type}</TableCell>
                  <TableCell component="th" scope="row">{creditor.name}</TableCell>
                  <TableCell>{creditor.identifier}</TableCell>
                  <TableCell>{creditor.contact_person_name}</TableCell>
                  <TableCell>{creditor.contact_person_phone}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton color="primary" size="small" aria-label="edit creditor">
                        <SvgIcon fontSize="small"><path d={mdiPencilOutline} /></SvgIcon>
                      </IconButton>
                      <IconButton color="error" size="small" aria-label="delete creditor">
                        <SvgIcon fontSize="small"><path d={mdiDeleteOutline} /></SvgIcon>
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        债权人管理页面。当案件处于立案阶段且用户有权限时，将自动进入此菜单。
        支持录入债权人信息和一键打印债权人通知快递单。
      </Typography>
    </Box>
  );
};

export default CreditorListPage;