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
  TextField, // Added
  InputAdornment, // Added
  Checkbox, // Added
  Tooltip, // Added for clarity on icon buttons
} from '@mui/material';
import { 
  mdiAccountPlusOutline, 
  mdiPrinterOutline, 
  mdiPencilOutline, 
  mdiDeleteOutline, 
  mdiMagnify, // Added
  mdiFileImportOutline, 
} from '@mdi/js';
import { useTranslation } from 'react-i18next';
import PrintWaybillsDialog from '../../components/creditor/PrintWaybillsDialog'; // Import the new dialog

// Define Creditor type for clarity
export interface Creditor {
  id: string;
  type: '组织' | '个人';
  name: string;
  identifier: string;
  contact_person_name: string;
  contact_person_phone: string;
  address: string;
}

// Mock data, replace with API call relevant to a selected case
const mockCreditors: Creditor[] = [
  { id: 'cred001', type: '组织', name: 'Acme Corp', identifier: '91330100MA2XXXXX1A', contact_person_name: 'John Doe', contact_person_phone: '13800138000', address: '科技园路1号' },
  { id: 'cred002', type: '个人', name: 'Jane Smith', identifier: '33010019900101XXXX', contact_person_name: 'Jane Smith', contact_person_phone: '13900139000', address: '文三路202号' },
  { id: 'cred003', type: '组织', name: 'Beta LLC', identifier: '91330100MA2YYYYY2B', contact_person_name: 'Mike Johnson', contact_person_phone: '13700137000', address: '创新大道33号' },
];

const CreditorListPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCreditorIds, setSelectedCreditorIds] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [printWaybillsDialogOpen, setPrintWaybillsDialogOpen] = React.useState<boolean>(false);

  // TODO: Fetch creditors for the selected case from API
  // TODO: Implement creditor creation, editing, filtering, pagination
  // TODO: Implement "打印快递单号" functionality

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredCreditors.map((n) => n.id); // Select all from filtered list
      setSelectedCreditorIds(newSelecteds);
      return;
    }
    setSelectedCreditorIds([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string) => {
    const selectedIndex = selectedCreditorIds.indexOf(id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedCreditorIds, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedCreditorIds.slice(1));
    } else if (selectedIndex === selectedCreditorIds.length - 1) {
      newSelected = newSelected.concat(selectedCreditorIds.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedCreditorIds.slice(0, selectedIndex),
        selectedCreditorIds.slice(selectedIndex + 1),
      );
    }
    setSelectedCreditorIds(newSelected);
  };

  const isSelected = (id: string) => selectedCreditorIds.indexOf(id) !== -1;

  const filteredCreditors = mockCreditors.filter(creditor => 
    creditor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    creditor.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (creditor.contact_person_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || // Handle undefined
    (creditor.contact_person_phone || '').includes(searchTerm) || // Handle undefined
    (creditor.address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) // Handle undefined
  );

  const handleOpenPrintWaybillsDialog = () => {
    if (selectedCreditorIds.length > 0) {
      setPrintWaybillsDialogOpen(true);
    }
  };

  const creditorsToPrint: Creditor[] = mockCreditors.filter(c => selectedCreditorIds.includes(c.id));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>{t('creditor_list_page_title', '债权人管理')}</Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <TextField
          label={t('search_creditors_label', '搜索债权人')}
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SvgIcon fontSize="small"><path d={mdiMagnify} /></SvgIcon>
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: '300px', flexGrow: { xs:1, sm: 0.5, md:0.3 } }} // Responsive grow
        />
        <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap', gap:1}}> {/* Allow buttons to wrap and add gap */}
          <Button variant="contained" color="primary" startIcon={<SvgIcon><path d={mdiAccountPlusOutline} /></SvgIcon>}>
            {t('add_single_creditor_button', '添加单个债权人')}
          </Button>
          <Button variant="outlined" color="secondary" startIcon={<SvgIcon><path d={mdiFileImportOutline} /></SvgIcon>}>
            {t('batch_import_creditors_button', '批量导入债权人')}
          </Button>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<SvgIcon><path d={mdiPrinterOutline} /></SvgIcon>}
            onClick={handleOpenPrintWaybillsDialog}
            disabled={selectedCreditorIds.length === 0}
          >
            {t('print_waybill_button', '打印快递单号')}
          </Button>
        </Stack>
      </Box>
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="creditor list table" size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selectedCreditorIds.length > 0 && selectedCreditorIds.length < filteredCreditors.length}
                    checked={filteredCreditors.length > 0 && selectedCreditorIds.length === filteredCreditors.length}
                    onChange={handleSelectAllClick}
                    inputProps={{ 'aria-label': t('select_all_creditors_aria_label', 'select all creditors') }}
                  />
                </TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_no', '序号')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_type', '类别')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_name', '姓名/名称')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_identifier', 'ID/统一码')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_contact_person', '联系人')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_contact_phone', '联系方式')}</TableCell>
                <TableCell sx={{whiteSpace: 'nowrap'}}>{t('table_header_address', '地址')}</TableCell>
                <TableCell align="center" sx={{whiteSpace: 'nowrap'}}>{t('table_header_actions', '操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCreditors.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center"><Typography sx={{p:2}}>{t('no_creditors_found', '暂无债权人数据或无匹配结果')}</Typography></TableCell></TableRow>
              )}
              {filteredCreditors.map((creditor, index) => {
                const isItemSelected = isSelected(creditor.id);
                const labelId = `creditor-table-checkbox-${index}`;
                return (
                  <TableRow 
                    hover 
                    onClick={(event) => handleClick(event, creditor.id)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={creditor.id}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{ 'aria-labelledby': labelId }}
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{creditor.type}</TableCell>
                    <TableCell component="th" id={labelId} scope="row">{creditor.name}</TableCell>
                    <TableCell>{creditor.identifier}</TableCell>
                    <TableCell>{creditor.contact_person_name}</TableCell>
                    <TableCell>{creditor.contact_person_phone}</TableCell>
                    <TableCell>{creditor.address}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0} justifyContent="center"> {/* Reduced spacing for compact layout */}
                        <Tooltip title={t('edit_creditor_tooltip', '编辑')}>
                          <IconButton color="primary" size="small" aria-label="edit creditor" onClick={(e) => {e.stopPropagation(); /* TODO: Add edit logic */ }}>
                            <SvgIcon fontSize="small"><path d={mdiPencilOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('delete_creditor_tooltip', '删除')}>
                          <IconButton color="error" size="small" aria-label="delete creditor" onClick={(e) => {e.stopPropagation(); /* TODO: Add delete logic */ }}>
                            <SvgIcon fontSize="small"><path d={mdiDeleteOutline} /></SvgIcon>
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {t('creditor_list_footer_note_1', '债权人管理页面。当案件处于立案阶段且用户有权限时，将自动进入此菜单。')}
        {t('creditor_list_footer_note_2', '支持录入债权人信息和打印快递单号。')}
      </Typography>
      
      <PrintWaybillsDialog
        open={printWaybillsDialogOpen}
        onClose={() => setPrintWaybillsDialogOpen(false)}
        selectedCreditors={creditorsToPrint}
      />
    </Box>
  );
};

export default CreditorListPage;