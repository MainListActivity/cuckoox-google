import React, { useRef, useEffect, useState, useCallback } from 'react';
import Quill from 'quill';
import type { Delta as QuillDeltaType } from 'quill/core';
import { useSurrealClient as useSurreal } from '@/src/contexts/SurrealProvider';
import 'quill/dist/quill.snow.css';
import '@/src/styles/quill-theme.css';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '@/src/services/fileUploadService';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Toolbar,
  Divider,
  Chip,
  Stack,
  Avatar,
  Fade,
  useTheme,
  alpha,
  Tooltip,
  AppBar,
  Dialog,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  Button,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import {
  mdiFullscreen,
  mdiFullscreenExit,
  mdiClose,
  mdiAccount,
  mdiCalendar,
  mdiFileDocumentOutline,
  mdiInformation,
  mdiPaperclip,
  mdiImage,
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatUnderline,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
} from '@mdi/js';

// Define MDI_PAPERCLIP_ICON SVG string
const MDI_PAPERCLIP_ICON = '<svg viewBox="0 0 24 24"><path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" /></svg>';

// Register the custom icon with Quill
const icons = Quill.import('ui/icons') as any;
if (icons && !icons['attach']) {
  icons['attach'] = MDI_PAPERCLIP_ICON;
}

// Export Delta type
export type QuillDelta = QuillDeltaType;

// Context information interface for the floating panel
interface ContextInfo {
  title: string;
  subtitle?: string;
  details: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
  avatar?: {
    text: string;
    color?: string;
  };
}

interface RichTextEditorProps {
  value: QuillDelta | string; // Accept initial HTML string or a Delta object
  onChange?: (newDelta: QuillDelta) => void; // Simplified onChange for backward compatibility
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  documentId?: string;
  userId?: string; // Make optional for backward compatibility
  userName?: string;
  contextInfo?: ContextInfo; // New prop for context information
  enableFullscreen?: boolean; // Enable fullscreen mode
  onFullscreenChange?: (isFullscreen: boolean) => void; // Callback when fullscreen changes
}

// Defined outside the component for clarity, or could be inside if preferred
const USER_COLORS = [
  '#26A69A', // Teal 300
  '#5C6BC0', // Indigo 300
  '#EC407A', // Pink 400
  '#FF7043', // Deep Orange 400
  '#66BB6A', // Green 400
  '#78909C', // Blue Grey 400
];

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onTextChange,
  placeholder,
  readOnly = false,
  className,
  documentId,
  userId,
  userName,
  contextInfo,
  enableFullscreen = true,
  onFullscreenChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const surreal = useSurreal();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const changeHandlerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState<any>({});

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    if (onFullscreenChange) {
      onFullscreenChange(newFullscreenState);
    }
  }, [isFullscreen, onFullscreenChange]);

  // Image handler function
  const imageHandler = useCallback(() => {
    const editor = quillRef.current;
    if (!editor) return;
    
    const range = editor.getSelection(true);
    if (!range) return;

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        const placeholderText = `\n[Uploading ${file.name}...]\n`;
        
        editor.insertText(range.index, placeholderText, 'user');
        editor.setSelection(range.index + placeholderText.length, 0);

        try {
          const uploadedFile = await uploadFile(file);
          editor.deleteText(range.index, placeholderText.length);
          editor.insertEmbed(range.index, 'image', uploadedFile.url);
          editor.setSelection(range.index + 1, 0);
        } catch (error) {
          console.error('Image upload failed:', error);
          const currentTextAroundOriginalRange = editor.getText(range.index, placeholderText.length);
          if (currentTextAroundOriginalRange === placeholderText) {
            editor.deleteText(range.index, placeholderText.length);
          } else {
            console.warn("Could not accurately remove placeholder text on error for image.");
          }
          alert(t('image_upload_failed_message', 'Image upload failed. Please try again.'));
        }
      }
    };
    input.click();
  }, [t]);

  // Attachment handler function
  const attachmentHandler = useCallback(() => {
    const editor = quillRef.current;
    if (!editor) return;
    
    const range = editor.getSelection(true);
    if (!range) return;

    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', '*/*'); // Accept all file types
    
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        const placeholderText = `\n[Uploading file ${file.name}...]\n`;
        
        editor.insertText(range.index, placeholderText, 'user');
        editor.setSelection(range.index + placeholderText.length, 0);

        try {
          const uploadedFile = await uploadFile(file);
          editor.deleteText(range.index, placeholderText.length);
          
          // Insert a link with the filename, opening in a new tab
          editor.insertText(range.index, uploadedFile.name, {
            'link': uploadedFile.url
          });
          editor.insertText(range.index + uploadedFile.name.length, ' ', 'user');
          editor.setSelection(range.index + uploadedFile.name.length + 1, 0);
        } catch (error) {
          console.error('File attachment upload failed:', error);
          const currentTextAroundOriginalRange = editor.getText(range.index, placeholderText.length);
          if (currentTextAroundOriginalRange === placeholderText) {
            editor.deleteText(range.index, placeholderText.length);
          } else {
            console.warn("Could not accurately remove placeholder text on error for attachment.");
          }
          alert(t('file_upload_failed_message', 'File upload failed. Please try again.'));
        }
      }
    };
    input.click();
  }, [t]);

  // Initialize Quill editor
  useEffect(() => {
    if (!containerRef.current || isInitialized) {
      return;
    }

    // Ensure the container is clean before initializing a new Quill instance
    let child = containerRef.current.firstChild;
    while (child) {
        containerRef.current.removeChild(child);
        child = containerRef.current.firstChild;
    }

    const toolbarOptions = [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'font': ['Arial', 'Verdana', 'sans-serif', 'serif', 'monospace'] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'image', 'attach'],
      ['clean']
    ];

    const currentFormats = [
      'header', 'font', 'size',
      'bold', 'italic', 'underline', 'strike',
      'color', 'background',
      'list', 'bullet', 'indent',
      'align',
      'link', 'image'
    ];

    const editor = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder: placeholder || t('richtexteditor_placeholder'),
      readOnly: readOnly,
      modules: {
        toolbar: {
          container: toolbarOptions,
          handlers: {
            image: imageHandler,
            attach: attachmentHandler
          }
        }
      },
      formats: currentFormats
    });

    quillRef.current = editor;
    setIsInitialized(true);

    // Set initial value
    if (value) {
      if (typeof value === 'string') {
        editor.root.innerHTML = value;
      } else {
        editor.setContents(value as any);
      }
    }

    // Cleanup function
    return () => {
      if (quillRef.current) {
         if (changeHandlerRef.current) {
            quillRef.current.off('text-change', changeHandlerRef.current);
         }
      }
      quillRef.current = null;
    };
  }, [isInitialized, placeholder, readOnly, t, imageHandler, attachmentHandler]);

  // Separate useEffect for readOnly and placeholder changes that don't require full re-init
  useEffect(() => {
    if (quillRef.current && isInitialized) {
      quillRef.current.enable(!readOnly);
      if (quillRef.current.root.getAttribute('data-placeholder') !== (placeholder || t('richtexteditor_placeholder'))) {
        quillRef.current.root.setAttribute('data-placeholder', placeholder || t('richtexteditor_placeholder'));
      }
    }
  }, [readOnly, placeholder, t, isInitialized]);

  // Handle text change events
  useEffect(() => {
    if (!quillRef.current || !isInitialized) return;

    const editor = quillRef.current;

    // Remove previous handler if exists
    if (changeHandlerRef.current) {
      editor.off('text-change', changeHandlerRef.current);
    }

    // Create new handler
    const handler = async (delta: QuillDeltaType, oldDelta: QuillDeltaType, source: any) => {
      const currentContents = editor.getContents();
      
      if (onChange) {
        onChange(currentContents);
      }
      
      if (onTextChange) {
        onTextChange(currentContents, delta, source as string);
      }

      // Send changes to SurrealDB if collaborative editing is enabled
      if (source === 'user' && surreal && documentId && userId) {
        try {
          await surreal.create(`delta`, { docId: documentId, delta, userId, ts: new Date().toISOString() });
        } catch (error) {
          console.error('Failed to send delta to SurrealDB:', error);
        }
      }
    };

    changeHandlerRef.current = handler;
    editor.on('text-change', handler);

    // Cleanup
    return () => {
      if (quillRef.current && changeHandlerRef.current) {
        quillRef.current.off('text-change', changeHandlerRef.current);
      }
    };
  }, [onChange, onTextChange, isInitialized, surreal, documentId, userId]);

  // Subscribe to changes from SurrealDB (collaborative editing)
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId || !userId) return;

    const editor = quillRef.current;

    const handleLiveChange = (data: any) => {
      if (data && data.result && typeof data.result.docId === 'string' && data.result.docId === documentId) {
        if (data.action === 'CREATE') {
            const incomingDeltaRecord = data.result as { deltaContent?: QuillDeltaType, userId?: string };
            if (incomingDeltaRecord.deltaContent && incomingDeltaRecord.userId !== userId) {
                if (quillRef.current) {
                    quillRef.current.updateContents(incomingDeltaRecord.deltaContent, 'api');
                }
            }
        }
      }
    };

    const liveQuery = `LIVE SELECT * FROM delta WHERE docId = '${documentId}' ORDER BY ts ASC`;
    let liveQueryId: string | null = null;

    const setupLiveQuery = async () => {
      if (!surreal) return;
      try {
        const docSnapshot = await surreal.select(`document:${documentId}`) as Array<{ content?: QuillDeltaType }>;
        if (!docSnapshot || docSnapshot.length === 0) {
          await surreal.create(`document:${documentId}`, { content: { ops: [] } });
        }

        const queryResult = await surreal.query(liveQuery) as Array<{ result: string }>;
        if (queryResult && queryResult.length > 0 && queryResult[0] && typeof queryResult[0].result === 'string') {
          liveQueryId = queryResult[0].result;
          (surreal as any).listenLive(liveQueryId, handleLiveChange);
        } else {
          console.error('Failed to setup live query for deltas or parse result.');
        }
      } catch (error) {
        console.error('Failed to setup live query or create document:', error);
      }
    };

    const fetchInitialContentAndSubscribe = async () => {
        if (!quillRef.current || !surreal || !documentId) return;
        try {
            type DeltaRecord = { id?: any; deltaContent?: QuillDeltaType; [key: string]: any };
            const deltasResult = await surreal.select<DeltaRecord>(`delta WHERE docId = '${documentId}' ORDER BY ts ASC`);
            
            if (deltasResult && deltasResult.length > 0) {
                const initialDeltas = deltasResult.filter(d => d.deltaContent).map(d => d.deltaContent as QuillDeltaType);
                if (initialDeltas.length > 0) {
                    const DeltaStatic = Quill.import('delta');
                    const combinedDelta = initialDeltas.reduce((acc, current) => acc.compose(new DeltaStatic(current)), new DeltaStatic());
                    if (quillRef.current) {
                        quillRef.current.setContents(combinedDelta, 'api');
                    }
                } else {
                    type DocumentSnapshot = { content?: QuillDeltaType };
                    const docSnapshotArray = await surreal.select<DocumentSnapshot>(`document:${documentId}`);
                    const docSnapshot = docSnapshotArray && docSnapshotArray.length > 0 ? docSnapshotArray[0] : null;
                    if (docSnapshot && docSnapshot.content) {
                        if (quillRef.current) {
                            quillRef.current.setContents(docSnapshot.content, 'api');
                        }
                    } else if (quillRef.current) {
                        quillRef.current.setContents({ ops: [] } as any, 'api');
                    }
                }
            } else {
                 type DocumentSnapshot = { content?: QuillDeltaType };
                 const docSnapshotArray = await surreal.select<DocumentSnapshot>(`document:${documentId}`);
                 const docSnapshot = docSnapshotArray && docSnapshotArray.length > 0 ? docSnapshotArray[0] : null;
                if (docSnapshot && docSnapshot.content) {
                    if (quillRef.current) {
                        quillRef.current.setContents(docSnapshot.content, 'api');
                    }
                } else if (quillRef.current) {
                    quillRef.current.setContents({ ops: [] } as any, 'api');
                }
            }
        } catch (error) {
            console.error('Failed to fetch initial deltas or document snapshot:', error);
            if (quillRef.current) {
              quillRef.current.setText(t('error_loading_document', 'Error loading document.'), 'api');
            }
        } finally {
            setupLiveQuery();
        }
    };

    fetchInitialContentAndSubscribe();

    return () => {
      if (liveQueryId && surreal) {
        (surreal as any).kill(liveQueryId as string);
      }
    };
  }, [isInitialized, surreal, documentId, userId, t]);

  // Handle cursor updates for collaborative editing
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId || !userId || readOnly) return;

    const editor = quillRef.current;

    const selectionChangeHandler = async (range: any, oldRange: any, source: string) => {
      if (source === 'user' && range && surreal) {
        try {
          const cursorId = `cursor:${documentId}:${userId}`;
          await (surreal as any).merge(cursorId, {
            docId: documentId,
            userId: userId,
            userName: userName,
            range: range,
            ts: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to send cursor update to SurrealDB:', error);
        }
      }
    };

    editor.on('selection-change', selectionChangeHandler);

    const cleanupCursor = async () => {
      if (surreal) {
        try {
          const cursorId = `cursor:${documentId}:${userId}`;
          await surreal.delete(cursorId);
        } catch (error) {
          console.error('Failed to delete cursor information from SurrealDB:', error);
        }
      }
    };

    window.addEventListener('beforeunload', cleanupCursor);

    return () => {
      editor.off('selection-change', selectionChangeHandler);
      cleanupCursor();
      window.removeEventListener('beforeunload', cleanupCursor);
    };
  }, [isInitialized, surreal, documentId, userId, userName, readOnly]);

  // Handle remote cursors for collaborative editing
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId || !userId || readOnly) return;

    const editor = quillRef.current;

    const updateRemoteCursorsDisplay = () => {
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());

      Object.values(remoteCursors).forEach((cursorData: any) => {
        if (cursorData.range && editor.isEnabled()) {
          try {
            const { index, length } = cursorData.range;
            if (typeof index !== 'number' || typeof length !== 'number') return;

            const caretEl = document.createElement('span');
            caretEl.className = 'remote-cursor';
            caretEl.style.position = 'absolute';
            caretEl.style.backgroundColor = cursorData.color;
            caretEl.style.width = '2px';
            caretEl.style.zIndex = '10';

            const nameLabel = document.createElement('span');
            nameLabel.className = 'remote-cursor-name';
            nameLabel.textContent = cursorData.userName || cursorData.userId;
            nameLabel.style.position = 'absolute';
            nameLabel.style.top = '-22px';
            nameLabel.style.left = '-2px';
            nameLabel.style.fontSize = '12px';
            nameLabel.style.backgroundColor = cursorData.color;
            nameLabel.style.color = 'white';
            nameLabel.style.padding = '2px 4px';
            nameLabel.style.borderRadius = '4px';
            nameLabel.style.whiteSpace = 'nowrap';
            nameLabel.style.zIndex = '11';

            caretEl.appendChild(nameLabel);

            const bounds = editor.getBounds(index, length);
            if (!bounds) return;

            caretEl.style.top = `${bounds.top}px`;
            caretEl.style.left = `${bounds.left}px`;
            caretEl.style.height = `${bounds.height}px`;

            if (length > 0) {
              const selectionEl = document.createElement('span');
              selectionEl.className = 'remote-selection';
              selectionEl.style.position = 'absolute';
              selectionEl.style.backgroundColor = hexToRgba(cursorData.color, 0.3);
              selectionEl.style.top = `${bounds.top}px`;
              selectionEl.style.left = `${bounds.left}px`;
              selectionEl.style.width = `${bounds.width}px`;
              selectionEl.style.height = `${bounds.height}px`;
              selectionEl.style.zIndex = '9';
              editor.root.parentNode?.appendChild(selectionEl);
            }

            if (editor.root.parentNode) {
                 (editor.root.parentNode as HTMLElement).style.position = 'relative';
                 editor.root.parentNode.appendChild(caretEl);
            } else {
                console.warn('Quill editor root parentNode is null, cannot append remote cursor.');
            }
          } catch(e) {
            console.error("Error displaying remote cursor:", e, cursorData);
          }
        }
      });
    };

    updateRemoteCursorsDisplay();

    const liveCursorQuery = `LIVE SELECT * FROM cursor WHERE docId = '${documentId}' AND userId != '${userId}'`;
    let liveCursorQueryId: string | null = null;

    const handleRemoteCursorChange = (data: any) => {
      if (data && data.result && typeof data.result.docId === 'string' && data.result.docId === documentId && data.result.userId !== userId) {
        const { userId: remoteUserId, userName: remoteUserName, range, ts } = data.result;

        const userHash = remoteUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const color = USER_COLORS[userHash % USER_COLORS.length];

        if (data.action === 'CREATE' || data.action === 'UPDATE') {
          setRemoteCursors((prevCursors: any) => ({
            ...prevCursors,
            [remoteUserId]: { userId: remoteUserId, userName: remoteUserName, range, ts, color },
          }));
        } else if (data.action === 'DELETE') {
          setRemoteCursors((prevCursors:any) => {
            const newCursors = { ...prevCursors };
            delete newCursors[remoteUserId];
            return newCursors;
          });
        }
      }
    };

    const setupLiveCursorQuery = async () => {
      if (!surreal) return;
      try {
        const queryResult = await surreal.query(liveCursorQuery) as Array<{ result: string }>;
        if (queryResult && queryResult.length > 0 && queryResult[0] && typeof queryResult[0].result === 'string') {
          liveCursorQueryId = queryResult[0].result;
          (surreal as any).listenLive(liveCursorQueryId, handleRemoteCursorChange);
        } else {
          console.error('Failed to setup live query for remote cursors or parse result.');
        }
      } catch (error) {
        console.error('Error setting up live query for remote cursors:', error);
      }
    };

    setupLiveCursorQuery();

    return () => {
      if (liveCursorQueryId && surreal) {
        (surreal as any).kill(liveCursorQueryId as string);
      }
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());
    };
  }, [isInitialized, surreal, documentId, userId, readOnly, remoteCursors]);

  // Update editor content when value prop changes
  useEffect(() => {
    if (documentId || !quillRef.current || !isInitialized || readOnly) return;
    const editor = quillRef.current;
    if (editor.hasFocus()) return;
    if (value) {
      if (typeof value === 'string') {
        const currentHTML = editor.root.innerHTML;
        if (currentHTML !== value) {
          editor.root.innerHTML = value;
        }
      } else {
        const currentContents = editor.getContents();
        if (JSON.stringify(currentContents) !== JSON.stringify(value)) {
          editor.setContents(value as any);
        }
      }
    } else {
      editor.setText('');
    }
  }, [value, isInitialized, documentId, readOnly]);

  // Context Panel Component
  const ContextPanel = () => {
    if (!contextInfo || !showContextPanel) return null;

    return (
      <Fade in={showContextPanel}>
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: { xs: 280, sm: 320 },
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                {contextInfo.avatar && (
                  <Avatar
                    sx={{
                      bgcolor: contextInfo.avatar.color || theme.palette.primary.main,
                      width: 32,
                      height: 32,
                      fontSize: '0.875rem',
                    }}
                  >
                    {contextInfo.avatar.text}
                  </Avatar>
                )}
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {contextInfo.title}
                  </Typography>
                  {contextInfo.subtitle && (
                    <Typography variant="caption" color="text.secondary">
                      {contextInfo.subtitle}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <IconButton
                size="small"
                onClick={() => setShowContextPanel(false)}
                sx={{ ml: 1 }}
              >
                <SvgIcon><path d={mdiClose} /></SvgIcon>
              </IconButton>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1.5}>
              {contextInfo.details.map((detail, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {detail.icon && (
                    <SvgIcon sx={{ fontSize: 16, color: 'text.secondary' }}>
                      <path d={detail.icon} />
                    </SvgIcon>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {detail.label}
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {detail.value}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Fade>
    );
  };

  // Main editor component
  const EditorComponent = () => (
    <Box
      className={className}
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Custom Toolbar */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .MuiToolbar-root': {
            minHeight: 56,
            px: 2,
          }
        }}
      >
        <Toolbar>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
            {/* Document Title */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <SvgIcon sx={{ color: 'text.secondary' }}>
                <path d={mdiFileDocumentOutline} />
              </SvgIcon>
              <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
                {contextInfo?.title || '未命名文档'}
              </Typography>
            </Stack>

            {/* Collaboration indicators */}
            {Object.keys(remoteCursors).length > 0 && (
              <Stack direction="row" spacing={-1}>
                {Object.values(remoteCursors).slice(0, 3).map((cursor: any, index) => (
                  <Tooltip key={cursor.userId} title={cursor.userName || cursor.userId}>
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        fontSize: '0.75rem',
                        bgcolor: cursor.color,
                        border: `2px solid ${theme.palette.background.paper}`,
                      }}
                    >
                      {(cursor.userName || cursor.userId).charAt(0).toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
                {Object.keys(remoteCursors).length > 3 && (
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      fontSize: '0.75rem',
                      bgcolor: 'text.secondary',
                      border: `2px solid ${theme.palette.background.paper}`,
                    }}
                  >
                    +{Object.keys(remoteCursors).length - 3}
                  </Avatar>
                )}
              </Stack>
            )}

            {/* Context panel toggle */}
            {contextInfo && !isFullscreen && (
              <Tooltip title={showContextPanel ? '隐藏详情面板' : '显示详情面板'}>
                <IconButton
                  size="small"
                  onClick={() => setShowContextPanel(!showContextPanel)}
                  sx={{
                    color: showContextPanel ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <SvgIcon>
                    <path d={mdiInformation} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}

            {/* Fullscreen toggle */}
            {enableFullscreen && (
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏编辑'}>
                <IconButton size="small" onClick={toggleFullscreen}>
                  <SvgIcon>
                    <path d={isFullscreen ? mdiFullscreenExit : mdiFullscreen} />
                  </SvgIcon>
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Editor Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Main Editor Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            maxWidth: isFullscreen ? '100%' : (showContextPanel && contextInfo && !isMobile ? 'calc(100% - 360px)' : '100%'),
            transition: 'max-width 0.3s ease',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              m: { xs: 1, sm: 2 },
              maxWidth: { xs: '100%', sm: 800 },
              mx: 'auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: theme.palette.mode === 'light' 
                ? '0px 2px 8px rgba(0, 0, 0, 0.1)' 
                : '0px 2px 8px rgba(0, 0, 0, 0.3)',
              '& .ql-toolbar': {
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderRadius: 0,
                backgroundColor: theme.palette.background.paper,
              },
              '& .ql-container': {
                flex: 1,
                border: 'none',
                borderRadius: 0,
                fontFamily: theme.typography.fontFamily,
                fontSize: '16px',
                lineHeight: 1.6,
              },
              '& .ql-editor': {
                padding: { xs: '20px 16px', sm: '32px 48px' },
                minHeight: 'calc(100vh - 200px)',
                '&.ql-blank::before': {
                  left: { xs: 16, sm: 48 },
                  fontStyle: 'normal',
                  color: theme.palette.text.disabled,
                },
              },
            }}
          >
            <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }} />
          </Paper>
        </Box>

        {/* Context Panel */}
        <ContextPanel />
      </Box>
    </Box>
  );

  // Render fullscreen or normal mode
  if (isFullscreen) {
    return (
      <Dialog
        open={isFullscreen}
        onClose={toggleFullscreen}
        maxWidth={false}
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            margin: 0,
            borderRadius: 0,
            height: '100vh',
            maxHeight: '100vh',
          },
        }}
      >
        <EditorComponent />
      </Dialog>
    );
  }

  return <EditorComponent />;
};

export default RichTextEditor;
