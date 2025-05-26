import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Checkbox,
  SvgIcon,
} from '@mui/material';
import { mdiMagnify, mdiPlusCircleOutline, mdiCloseCircleOutline, mdiPencil, mdiEyeOutline } from '@mdi/js';

// Mock data, replace with API call relevant to a selected case
const mockClaims = [
  { id: 'claim001', creditorName: 'Acme Corp (组织)', claim_number: 'CL-2023-001', asserted_total: 150000, approved_total: 145000, auditor: 'Reviewer A', audit_status: '部分通过', audit_time: '2023-04-10' },
  { id: 'claim002', creditorName: 'Jane Smith (个人)', claim_number: 'CL-2023-002', asserted_total: 75000, approved_total: 0, auditor: 'Reviewer B', audit_status: '已驳回', audit_time: '2023-04-12' },
  { id: 'claim003', creditorName: 'Beta LLC (组织)', claim_number: 'CL-2023-003', asserted_total: 220000, approved_total: null, auditor: '', audit_status: '待审核', audit_time: '' },
];

const ClaimListPage: React.FC = () => {
  // TODO: Fetch claims for the selected case from API
  // TODO: Implement claim creation, filtering, pagination, search
  // TODO: Implement "批量驳回"
  const [selected, setSelected] = useState<readonly string[]>([]);

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = mockClaims.map((n) => n.id);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: readonly string[] = [];
    
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      );
    }
    setSelected(newSelected);
  };
  const isSelected = (id: string) => selected.indexOf(id) !== -1;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>债权申报与审核</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField size="small" variant="outlined" placeholder="关键字搜索..." />
          <Button variant="outlined" startIcon={<SvgIcon><path d={mdiMagnify} /></SvgIcon>}>搜索</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" component={Link} to="/claims/submit" startIcon={<SvgIcon><path d={mdiPlusCircleOutline} /></SvgIcon>}>
            创建债权
          </Button>
          <Button variant="outlined" color="error" startIcon={<SvgIcon><path d={mdiCloseCircleOutline} /></SvgIcon>} disabled={selected.length === 0}>
            批量驳回 (选中)
          </Button>
        </Box>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < mockClaims.length}
                    checked={mockClaims.length > 0 && selected.length === mockClaims.length}
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': 'select all claims' }}
                  />
                </TableCell>
                <TableCell>债权人 (类别)</TableCell>
                <TableCell>债权编号</TableCell>
                <TableCell align="right">主张债权总额</TableCell>
                <TableCell align="right">认定债权总额</TableCell>
                <TableCell>审核状态</TableCell>
                <TableCell>审核人</TableCell>
                <TableCell>审核时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockClaims.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center"><Typography sx={{p:2}}>暂无债权数据</Typography></TableCell></TableRow>
              )}
              {mockClaims.map((claim) => {
                const isItemSelected = isSelected(claim.id);
                const labelId = `enhanced-table-checkbox-${claim.id}`;
                let chipColor: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" = "default";
                if (claim.audit_status === '部分通过') chipColor = 'warning';
                else if (claim.audit_status === '已驳回') chipColor = 'error';
                else if (claim.audit_status === '待审核') chipColor = 'info';

                return (
                  <TableRow
                    hover
                    onClick={(event) => handleClick(event, claim.id)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={claim.id}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox"><Checkbox color="primary" checked={isItemSelected} inputProps={{ 'aria-labelledby': labelId }} /></TableCell>
                    <TableCell component="th" id={labelId} scope="row">{claim.creditorName}</TableCell>
                    <TableCell>{claim.claim_number}</TableCell>
                    <TableCell align="right">{claim.asserted_total.toLocaleString()}</TableCell>
                    <TableCell align="right">{claim.approved_total !== null ? claim.approved_total.toLocaleString() : '-'}</TableCell>
                    <TableCell><Chip label={claim.audit_status} size="small" color={chipColor} /></TableCell>
                    <TableCell>{claim.auditor || '-'}</TableCell>
                    <TableCell>{claim.audit_time || '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        component={Link}
                        to={`/claims/${claim.id}/review`}
                        startIcon={<SvgIcon><path d={claim.audit_status === '待审核' ? mdiPencil : mdiEyeOutline} /></SvgIcon>}
                        onClick={(e) => e.stopPropagation()} // Prevent row click when clicking button
                      >
                        {claim.audit_status === '待审核' ? '审核债权' : '查看详情'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        债权申报与审核页面。当案件进入债权申报阶段且用户有权限时，将自动进入此菜单。
        支持创建债权、批量驳回、全文检索、审核债权。附件材料将使用QuillJS进行实时在线编辑。
      </Typography>
    </Box>
  );
};

export default ClaimListPage;