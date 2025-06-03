import React, { useState, useRef, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Link as MuiLink, // For download link
  SvgIcon,
  CircularProgress,
} from '@mui/material';
import { mdiFileDownloadOutline, mdiFileUploadOutline } from '@mdi/js';

interface BatchImportCreditorsDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
  isImporting?: boolean; // Optional prop to indicate import is in progress
}

// Updated template file path to CSV
const TEMPLATE_FILE_URL = '/templates/creditor_import_template.csv'; 

const BatchImportCreditorsDialog: React.FC<BatchImportCreditorsDialogProps> = ({
  open,
  onClose,
  onImport,
  isImporting = false,
}) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    setSelectedFile(file);
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleCloseDialog = () => {
    setSelectedFile(null); // Clear selected file on close
    onClose();
  };

  const handleStartImport = () => {
    if (selectedFile) {
      onImport(selectedFile);
      // Optionally clear file after starting import, or let parent manage
      // setSelectedFile(null); 
    }
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
      <DialogTitle>{t('batch_import_creditors_dialog_title', '批量导入债权人')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            {t('batch_import_step_1', '步骤 1: 下载模板文件')}
          </Typography>
          <Button
            component={MuiLink}
            href={TEMPLATE_FILE_URL}
            download // Suggests download to browser
            variant="outlined"
            startIcon={<SvgIcon><path d={mdiFileDownloadOutline} /></SvgIcon>}
            sx={{textTransform: 'none'}}
          >
            {t('download_import_template_button_csv', '下载导入模板 (.csv)')}
          </Button>
          <Typography variant="caption" display="block" color="text.secondary" sx={{mt:0.5}}>
            {t('batch_import_template_note_csv', '请使用此CSV模板准备您的债权人数据。')}
          </Typography>
        </Box>

        <Box sx={{ my: 3 }}>
          <Typography variant="body1" gutterBottom>
            {t('batch_import_step_2', '步骤 2: 选择已填写数据的文件')}
          </Typography>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            onClick={handleSelectFileClick}
            startIcon={<SvgIcon><path d={mdiFileUploadOutline} /></SvgIcon>}
            sx={{textTransform: 'none'}}
          >
            {t('select_file_button', '选择文件')}
          </Button>
          {selectedFile && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              {t('selected_file_label', '已选文件')}: {selectedFile.name}
            </Typography>
          )}
          {!selectedFile && (
             <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {t('no_file_selected_label', '未选择文件')}
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('batch_import_instructions', '请确保文件格式符合模板要求。支持 .xlsx, .xls, .csv 格式。')}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseDialog} disabled={isImporting}>
            {t('cancel_button', '取消')}
        </Button>
        <Button
          onClick={handleStartImport}
          variant="contained"
          color="primary"
          disabled={!selectedFile || isImporting}
          startIcon={isImporting ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isImporting ? t('importing_button_text', '导入中...') : t('start_import_button', '开始导入')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchImportCreditorsDialog;
