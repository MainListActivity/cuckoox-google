import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import RichTextEditor, { QuillDelta } from '@/src/components/RichTextEditor'; // Adjust path as necessary
import { Delta } from 'quill/core';

interface CaseInfo {
  caseId: string;
  caseName: string;
}

interface MeetingMinutesDialogProps {
  open: boolean;
  onClose: () => void;
  caseInfo: CaseInfo | null;
  meetingTitle: string;
  existingMinutes?: QuillDelta | string; // Can be initial HTML string or Delta
  onSave: (minutesDelta: QuillDelta, meetingTitle: string, caseId: string) => void;
}

const MeetingMinutesDialog: React.FC<MeetingMinutesDialogProps> = ({
  open,
  onClose,
  caseInfo,
  meetingTitle,
  existingMinutes,
  onSave,
}) => {
  const { t } = useTranslation();
  const [minutesContent, setMinutesContent] = useState<QuillDelta>(new Delta());
  const [isEditorDirty, setIsEditorDirty] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      if (existingMinutes) {
        if (typeof existingMinutes === 'string') {
          // If it's an HTML string, Quill will convert it internally.
          // Or, convert it to Delta here if you have a utility.
          // For now, RichTextEditor should handle string input.
          // We might need to set it as initial HTML for ReactQuill if it's a string
          // For simplicity, we'll assume RichTextEditor handles string value prop.
          // However, storing as Delta is preferred.
          // This part might need refinement based on how existingMinutes is stored/passed.
          // Let's assume it's a Delta for consistency now.
          // If it's HTML, parent should convert before passing or editor handles it.
          setMinutesContent(new Delta()); // Placeholder if it's HTML, needs proper conversion
          console.warn("existingMinutes as string received, ensure RichTextEditor handles this or convert to Delta first.");
        } else {
          setMinutesContent(existingMinutes);
        }
      } else {
        setMinutesContent(new Delta());
      }
      setIsEditorDirty(false); // Reset dirty state when dialog opens
    }
  }, [open, existingMinutes]);

  const handleEditorChange = (newDelta: QuillDelta, lastChangeDelta: QuillDelta, source: string) => {
    setMinutesContent(newDelta);
    if (source === 'user') {
      setIsEditorDirty(true);
    }
  };

  const handleSave = () => {
    if (caseInfo) {
      onSave(minutesContent, meetingTitle, caseInfo.caseId);
    }
    onClose(); // Close dialog after saving
  };
  
  const isSaveDisabled = () => {
    // Disable save if content is empty or (if editing) content hasn't changed
    if (minutesContent.length() === 0 || (minutesContent.ops && minutesContent.ops.length === 1 && !minutesContent.ops[0].insert?.trim())) {
        return true; // Empty content (Quill adds a default newline op)
    }
    if (existingMinutes && !isEditorDirty) {
        return true; // Editing existing content, but no changes made
    }
    return false;
  };


  return (
    <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="lg" // Use "lg" or "md" for wider dialog
        fullWidth 
        PaperProps={{
            sx: {
                height: '90vh', // Make dialog take up most of the viewport height
                display: 'flex',
                flexDirection: 'column',
            }
        }}
    >
      <DialogTitle>
        {meetingTitle}
        {caseInfo && <Box component="span" sx={{fontSize: '0.9rem', color: 'text.secondary', ml:1}}> ({t('case_label', '案件')}: {caseInfo.caseName})</Box>}
      </DialogTitle>
      <DialogContent 
        dividers 
        sx={{ 
            flexGrow: 1, // Allow content to grow and fill space
            display: 'flex',
            flexDirection: 'column',
            p: 1, // Reduce padding if Quill has its own
            '& .ql-toolbar': { // Target Quill toolbar
              position: 'sticky',
              top: 0,
              zIndex: 1, // Ensure toolbar stays above content when scrolling
              backgroundColor: 'var(--color-surface)', // Use theme variable
            },
            '& .ql-container': { // Target Quill container
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                borderBottomLeftRadius: (theme) => theme.shape.borderRadius, // Match dialog border radius
                borderBottomRightRadius: (theme) => theme.shape.borderRadius,
            },
            '& .ql-editor': { // Target Quill editor area
                flexGrow: 1,
                overflowY: 'auto', // Add scroll to editor if content overflows
                p: 2, // Add padding inside editor
            }
        }}
      >
        <RichTextEditor
          value={minutesContent} // Pass Delta object
          onChange={handleEditorChange} // Use the more comprehensive onChange for Delta
          placeholder={t('meeting_minutes_placeholder', '请输入会议纪要内容...')}
          // className will be applied to the root of ReactQuill
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel_button', '取消')}</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={isSaveDisabled()}
        >
          {t('save_minutes_button', '保存纪要')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingMinutesDialog;
