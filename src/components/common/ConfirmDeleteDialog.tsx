import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  useTheme,
} from '@mui/material';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  contentText: string;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  contentText,
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-delete-dialog-title"
      aria-describedby="confirm-delete-dialog-description"
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper, // Ensure theme-aware background
        }
      }}
    >
      <DialogTitle id="confirm-delete-dialog-title" sx={{ color: theme.palette.text.primary }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-delete-dialog-description" sx={{ color: theme.palette.text.secondary }}>
          {contentText}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px:3, py:2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} variant="outlined" color="secondary">
          取消
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" autoFocus>
          删除
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;
