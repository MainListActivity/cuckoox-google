import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
} from '@mui/material';
import type { Creditor } from '../../pages/CreditorListPage'; // Assuming Creditor type is exported

interface PrintWaybillsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCreditors: Creditor[];
}

const PrintWaybillsDialog: React.FC<PrintWaybillsDialogProps> = ({
  open,
  onClose,
  selectedCreditors,
}) => {
  const { t } = useTranslation();

  const handleConfirmPrint = () => {
    const creditorNames = selectedCreditors.map(c => c.name).join(', ');
    console.log(t('print_waybills_log_message', 'Confirmed printing waybills for: {{names}}', { names: creditorNames }));
    // In a real scenario, trigger backend process here
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('print_waybills_dialog_title', '确认打印快递单号')}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1" gutterBottom>
          {t('print_waybills_confirmation_intro', '将为以下 {{count}} 位债权人打印快递单:', { count: selectedCreditors.length })}
        </Typography>
        <Box sx={{ maxHeight: 300, overflow: 'auto', my:1 }}> {/* Scrollable list area */}
          <List dense>
            {selectedCreditors.map((creditor) => (
              <ListItem key={creditor.id} disablePadding>
                <ListItemText 
                    primary={creditor.name} 
                    secondary={`${t('creditor_id_label', 'ID')}: ${creditor.identifier} - ${t('address_label', '地址')}: ${creditor.address}`} 
                />
              </ListItem>
            ))}
          </List>
        </Box>
        <Divider sx={{my:1}}/>
        <Typography variant="caption" color="text.secondary">
            {t('print_waybills_final_confirmation_note', '请确保打印机已连接并准备就绪。')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel_button', '取消')}</Button>
        <Button 
          onClick={handleConfirmPrint} 
          variant="contained" 
          color="primary"
          disabled={selectedCreditors.length === 0}
        >
          {t('confirm_print_button', '确认打印')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintWaybillsDialog;
