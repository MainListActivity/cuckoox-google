import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  useTheme,
} from '@mui/material';

// Define StatusData type
export interface StatusData {
  id?: string; // Present if editing
  label: string;
  description: string;
}

// Props for the Dialog component
interface AddEditStatusDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (statusData: StatusData) => void;
  initialData?: StatusData | null;
}

const AddEditStatusDialog: React.FC<AddEditStatusDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const theme = useTheme();
  const [statusLabel, setStatusLabel] = useState('');
  const [description, setDescription] = useState('');
  const [labelError, setLabelError] = useState('');

  useEffect(() => {
    if (open) { // Reset form when dialog opens or initialData changes while open
      if (initialData) {
        setStatusLabel(initialData.label);
        setDescription(initialData.description);
      } else {
        setStatusLabel('');
        setDescription('');
      }
      setLabelError(''); // Clear previous errors
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!statusLabel.trim()) {
      setLabelError('状态标签不能为空');
      return;
    }
    setLabelError('');

    const statusDataToSave: StatusData = {
      id: initialData?.id,
      label: statusLabel.trim(),
      description: description.trim(),
    };
    onSave(statusDataToSave);
  };

  const isEditing = initialData != null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper, // Ensure theme-aware background
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, color: theme.palette.text.primary }}>
        {isEditing ? '编辑状态' : '添加新状态'}
      </DialogTitle>
      <DialogContent sx={{ py: 2.5 }}> {/* Add some vertical padding */}
        <Stack spacing={2.5}> {/* Use Stack for spacing between TextFields */}
          <TextField
            autoFocus
            margin="dense" // dense is fine with Stack spacing
            id="statusLabel"
            label="状态标签"
            type="text"
            fullWidth
            variant="outlined"
            value={statusLabel}
            onChange={(e) => {
              setStatusLabel(e.target.value);
              if (labelError && e.target.value.trim()) {
                setLabelError('');
              }
            }}
            required
            error={!!labelError}
            helperText={labelError || "例如: '审核通过', '待补充材料'"}
          />
          <TextField
            margin="dense"
            id="description"
            label="描述"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="详细描述此状态的含义和适用场景。"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px:3, py:2 }}>
        <Button onClick={onClose} variant="outlined" color="secondary">
          取消
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddEditStatusDialog;
