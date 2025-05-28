import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Alert,
} from '@mui/material';

export interface CreditorData {
  category: '组织' | '个人' | '';
  name: string;
  identifier: string; // ID/Org Code
  contactPersonName: string;
  contactInfo: string;
  address: string;
}

interface AddCreditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (creditorData: CreditorData) => void;
}

const AddCreditorDialog: React.FC<AddCreditorDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();

  const initialCreditorData: CreditorData = {
    category: '',
    name: '',
    identifier: '',
    contactPersonName: '',
    contactInfo: '',
    address: '',
  };

  const [creditorData, setCreditorData] = useState<CreditorData>(initialCreditorData);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when dialog opens
    if (open) {
      setCreditorData(initialCreditorData);
      setFormError(null);
    }
  }, [open]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = event.target;
    setCreditorData((prevData) => ({
      ...prevData,
      [name as string]: value,
    }));
    if (formError) setFormError(null); // Clear error on input change
  };
  
  // Handle Select change specifically as its event structure is different
  const handleSelectChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof CreditorData;
    const value = event.target.value;
     setCreditorData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    if (formError) setFormError(null);
  };


  const isSaveDisabled = () => {
    return !creditorData.category || !creditorData.name.trim() || !creditorData.identifier.trim();
    // Add more validation as needed, e.g., contactPersonName for '组织'
  };

  const handleSave = () => {
    if (isSaveDisabled()) {
        setFormError(t('add_creditor_error_required_fields', '请填写所有必填字段：类别、名称和ID。'));
        return;
    }
    setFormError(null);
    onSave(creditorData);
    // Parent component should handle closing the dialog on successful save
    // onClose(); // Optionally close here, or let parent decide
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('add_single_creditor_dialog_title', '添加单个债权人')}</DialogTitle>
      <DialogContent dividers>
        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined" required>
              <InputLabel id="category-select-label">{t('creditor_form_category_label', '类别')}</InputLabel>
              <Select
                labelId="category-select-label"
                id="category"
                name="category"
                value={creditorData.category}
                onChange={handleSelectChange}
                label={t('creditor_form_category_label', '类别')}
              >
                <MenuItem value="" disabled><em>{t('select_placeholder', '请选择...')}</em></MenuItem>
                <MenuItem value="组织">{t('creditor_category_organization', '组织')}</MenuItem>
                <MenuItem value="个人">{t('creditor_category_individual', '个人')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              id="name"
              name="name"
              label={t('creditor_form_name_label', '名称')}
              fullWidth
              variant="outlined"
              value={creditorData.name}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              required
              id="identifier"
              name="identifier"
              label={t('creditor_form_identifier_label', 'ID (统一社会信用代码/身份证号)')}
              fullWidth
              variant="outlined"
              value={creditorData.identifier}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              id="contactPersonName"
              name="contactPersonName"
              label={t('creditor_form_contact_person_name_label', '联系人姓名')}
              fullWidth
              variant="outlined"
              value={creditorData.contactPersonName}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              id="contactInfo"
              name="contactInfo"
              label={t('creditor_form_contact_info_label', '联系方式')}
              fullWidth
              variant="outlined"
              value={creditorData.contactInfo}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              id="address"
              name="address"
              label={t('creditor_form_address_label', '地址')}
              fullWidth
              variant="outlined"
              value={creditorData.address}
              onChange={handleChange}
              multiline
              rows={2}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel_button', '取消')}</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          // disabled={isSaveDisabled()} // Let's show error message instead
        >
          {t('save_button', '保存')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCreditorDialog;
