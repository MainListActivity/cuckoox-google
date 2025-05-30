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
  SelectChangeEvent,
} from '@mui/material';

// Using Creditor type from creditors page for consistency
import { Creditor } from '@/src/pages/creditors';

// Form data type with camelCase property names for form handling
export type CreditorFormData = {
  id?: string;
  category: string; // Maps to Creditor.type
  name: string;
  identifier: string;
  contactPersonName: string; // Maps to Creditor.contact_person_name
  contactInfo: string; // Maps to Creditor.contact_person_phone
  address: string;
};

interface AddCreditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (creditorData: CreditorFormData) => void;
  existingCreditor?: Creditor | null; // Changed type to Creditor
}

// Initial form data constant
const initialCreditorFormData: CreditorFormData = {
  category: '',
  name: '',
  identifier: '',
  contactPersonName: '',
  contactInfo: '',
  address: '',
};

// Map Creditor to CreditorFormData
const mapCreditorToFormData = (creditor: Creditor | null | undefined): CreditorFormData => {
  if (!creditor) return initialCreditorFormData;
  return {
    id: creditor.id,
    category: creditor.type || '', // Map 'type' to 'category'
    name: creditor.name,
    identifier: creditor.identifier,
    contactPersonName: creditor.contact_person_name,
    contactInfo: creditor.contact_person_phone, // Map 'contact_person_phone' to 'contactInfo'
    address: creditor.address,
  };
};

const AddCreditorDialog: React.FC<AddCreditorDialogProps> = ({
  open,
  onClose,
  onSave,
  existingCreditor,
}) => {
  const { t } = useTranslation();

  const [creditorData, setCreditorData] = useState<CreditorFormData>(initialCreditorFormData);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (existingCreditor) {
        setCreditorData(mapCreditorToFormData(existingCreditor));
      } else {
        setCreditorData(initialCreditorFormData);
      }
      setFormError(null);
    }
  }, [open, existingCreditor]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: string }>) => {
    const { name, value } = event.target;
    setCreditorData((prevData) => ({
      ...prevData,
      [name as string]: value,
    }));
    if (formError) setFormError(null);
  };
  
  const handleSelectChange = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    setCreditorData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    if (formError) setFormError(null);
  };

  const validateForm = () => {
    if (!creditorData.category || !creditorData.name.trim() || !creditorData.identifier.trim()) {
      setFormError(t('add_creditor_error_required_fields', '请填写所有必填字段：类别、名称和ID。'));
      return false;
    }
    // Add more specific validations if needed, e.g., identifier format based on category
    return true;
  };


  const handleSave = () => {
    if (!validateForm()) {
      return;
    }
    onSave(creditorData);
  };
  
  const dialogTitle = existingCreditor 
    ? t('edit_single_creditor_dialog_title', '编辑债权人') 
    : t('add_single_creditor_dialog_title', '添加单个债权人');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent dividers>
        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
        <Grid container spacing={2} sx={{pt:1}}> {/* Added padding top for better spacing with error alert */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined" required error={formError && !creditorData.category ? true : undefined}>
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
                <MenuItem value="组织">{t('creditor_category_organization', '组织')}</MenuItem> {/* Ensure these values match Creditor['type'] */}
                <MenuItem value="个人">{t('creditor_category_individual', '个人')}</MenuItem> {/* Ensure these values match Creditor['type'] */}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={12}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={12}>
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
