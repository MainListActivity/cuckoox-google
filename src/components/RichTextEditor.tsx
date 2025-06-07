import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Quill from 'quill';
import type { Delta as QuillDeltaType, Range as QuillRange } from 'quill/core';
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
  Stack,
  Avatar,
  Fade,
  useTheme,
  alpha,
  Tooltip,
  AppBar,
  Dialog,
  useMediaQuery,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Tabs,
  Tab,
  Grid,
} from '@mui/material';
import SvgIcon from '@mui/material/SvgIcon';
import {
  mdiClose,
  mdiFileDocumentOutline,
  mdiInformation,
  mdiCommentOutline,
} from '@mdi/js';
import {
  ChevronLeft,
  ExpandMore,
  ExpandLess,
  AddComment,
} from '@mui/icons-material';

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


interface OutlineItem {
  level: number;
  text: string;
}
interface Comment {
  id: string;
  author: string;
  content: string;
  time: string;
}
interface CaseInfoForDocView {
  caseNumber: string;
  responsiblePerson: string;
}
// ======================================

// 新增扩展区域相关接口
interface ExtensionAreaTab {
  id: string;
  label: string;
  icon?: string;
}

interface ExtensionAreaContent {
  type: 'case' | 'claim' | 'law' | 'related_docs';
  data: any;
  renderContent?: () => React.ReactNode;
}

interface RichTextEditorProps {
  defaultValue?: QuillDelta | string; // Changed from value
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  onSelectionChange?: (range: QuillRange | null, oldRange: QuillRange | null, source: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  documentId?: string;
  userId?: string; // Make optional for backward compatibility
  userName?: string;
  contextInfo?: ContextInfo; // New prop for context information
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;

  // New props for Document View mode
  viewMode?: 'standard' | 'document';
  initialContentForDocumentView?: any[];
  comments?: Comment[];
  caseInfoForDocumentView?: CaseInfoForDocView;

  // 新增的Props
  extensionAreaTabs?: ExtensionAreaTab[];
  extensionAreaContent?: ExtensionAreaContent;
  onExtensionAreaTabChange?: (tabId: string) => void;
  showExtensionArea?: boolean;
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

const RichTextEditor = forwardRef<Quill, RichTextEditorProps>(
  (
    {
      defaultValue,
      onTextChange,
      onSelectionChange,
      placeholder,
      readOnly = false,
      className,
      documentId,
      userId,
      userName,
      contextInfo,
      viewMode = 'standard',
      initialContentForDocumentView,
      comments = [],
      extensionAreaTabs = [],
      extensionAreaContent,
      onExtensionAreaTabChange,
      showExtensionArea = false,
      breadcrumbs,
      actions,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const surreal = useSurreal();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const quillRef = useRef<Quill | null>(null);
    const [showContextPanel, setShowContextPanel] = useState(true);
    const [remoteCursors, setRemoteCursors] = useState<any>({});

    // Callbacks ref
    const onTextChangeRef = useRef(onTextChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const defaultValueRef = useRef(defaultValue);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
    });

    // States for Document View
    const [isOutlineOpen, setIsOutlineOpen] = useState(true);
    const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
    const [outline, setOutline] = useState<OutlineItem[]>([]);

    // 新增状态
    const [isExtensionAreaOpen, setIsExtensionAreaOpen] = useState(showExtensionArea);
    const [extensionAreaHeight, setExtensionAreaHeight] = useState(400);
    const [currentExtensionTab, setCurrentExtensionTab] = useState<string | null>(
      extensionAreaTabs.length > 0 ? extensionAreaTabs[0].id : null
    );
    const resizingRef = useRef<boolean>(false);
    const startYRef = useRef<number>(0);
    const startHeightRef = useRef<number>(300);

    // 更新大纲数据的函数
    const updateOutline = useCallback(() => {
      if (quillRef.current) {
        const delta = quillRef.current.getContents();
        const outlineItems: OutlineItem[] = [];

        if (delta && delta.ops) {
          delta.ops.forEach((op: any) => {
            if (op.attributes && op.attributes.header && typeof op.insert === 'string') {
              outlineItems.push({
                level: op.attributes.header,
                text: op.insert.trim()
              });
            }
          });
        }

        setOutline(outlineItems);
      }
    }, []);

    // 编辑器内容变更时更新大纲
    useEffect(() => {
      if (quillRef.current) {
        const editor = quillRef.current;

        const textChangeHandler = () => {
          updateOutline();
        };

        editor.on('text-change', textChangeHandler);

        // 初始更新大纲
        updateOutline();

        return () => {
          editor.off('text-change', textChangeHandler);
        };
      }
    }, [updateOutline]);

    // Image handler function
    const imageHandler = useCallback(() => {
      const editor = quillRef.current; // Get editor from ref, not state
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
    }, [t]); // Dependency no longer includes ref.current

    // Attachment handler function
    const attachmentHandler = useCallback(() => {
      const editor = quillRef.current; // Get editor from ref, not state
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
    }, [t]); // Dependency no longer includes ref.current

    // Initialize Quill editor
    useEffect(() => {
      if (containerRef.current && !containerRef.current.dataset.quillInitialized) {
        containerRef.current.dataset.quillInitialized = 'true';

        const container = containerRef.current;
        const editorContainer = container.appendChild(
          container.ownerDocument.createElement('div'),
        );

        const modules = {
          toolbar: {
            container: '#quill-toolbar',
            handlers: {
              image: imageHandler,
              attach: attachmentHandler,
            },
          },
        };

        const currentFormats = [
          'header', 'font', 'size', 'bold', 'italic', 'underline', 'strike',
          'color', 'background', 'list', 'indent', 'align', 'link', 'image'
        ];

        const editor = new Quill(editorContainer, {
          theme: 'snow',
          placeholder: placeholder || t('richtexteditor_placeholder'),
          readOnly: readOnly,
          modules: modules,
          formats: currentFormats,
        });

        const initialContent = defaultValueRef.current || initialContentForDocumentView;
        if (initialContent) {
          if (typeof initialContent === 'string') {
            editor.clipboard.dangerouslyPasteHTML(initialContent);
          } else {
            editor.setContents(initialContent as any, 'api');
          }
        }
        if (viewMode === 'document') {
          updateOutline();
        }
        quillRef.current = editor;
        if (typeof ref === 'function') {
          ref(editor);
        } else if (ref) {
          ref.current = editor;
        }

        return () => {
          quillRef.current = null;
          if (typeof ref === 'function') {
            ref(null);
          } else if (ref) {
            ref.current = null;
          }
          // The container is a ref, its value might be captured in this closure.
          // It's safer to read from the ref directly in the cleanup function.
          const currentContainer = containerRef.current;
          if (currentContainer) {
            delete currentContainer.dataset.quillInitialized;
            currentContainer.innerHTML = '';
          }
        };
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this runs only ONCE

    useEffect(() => {
      quillRef.current?.enable(!readOnly);
    }, [readOnly]);

    // 处理 placeholder 属性变化
    useEffect(() => {
      if (quillRef.current) {
        const placeholderText = placeholder || t('richtexteditor_placeholder');
        if (quillRef.current.root.getAttribute('data-placeholder') !== placeholderText) {
          quillRef.current.root.setAttribute('data-placeholder', placeholderText);
        }
      }
    }, [placeholder, t]);

    // Handle text change and selection change events
    useEffect(() => {
      if (!quillRef.current) return;

      const editor = quillRef.current;
      const textChangeHandler = (delta: QuillDeltaType, oldDelta: QuillDeltaType, source: string) => {
        if (!quillRef.current) return;
        const currentContents = quillRef.current.getContents();
        if (onTextChangeRef.current) {
          onTextChangeRef.current(currentContents, delta, source as string);
        }

        if (source === 'user' && surreal && documentId && userId) {
          surreal.create(`delta`, {
            docId: documentId,
            delta,
            userId,
            ts: new Date().toISOString(),
          }).catch(error => console.error('Failed to send delta to SurrealDB:', error));
        }
      };

      const selectionChangeHandler = (range: QuillRange | null, oldRange: QuillRange | null, source: string) => {
        if (onSelectionChangeRef.current) {
          onSelectionChangeRef.current(range, oldRange, source);
        }
      };

      editor.on(Quill.events.TEXT_CHANGE, textChangeHandler);
      editor.on(Quill.events.SELECTION_CHANGE, selectionChangeHandler);

      return () => {
        editor.off(Quill.events.TEXT_CHANGE, textChangeHandler);
        editor.off(Quill.events.SELECTION_CHANGE, selectionChangeHandler);
      };
    }, [surreal, documentId, userId]);


    // Subscribe to changes from SurrealDB (collaborative editing)
    useEffect(() => {
      if (!quillRef || !surreal || !documentId || !userId) return;

      const handleLiveChange = (data: any) => {
        if (data && data.result && typeof data.result.docId === 'string' && data.result.docId === documentId) {
          if (data.action === 'CREATE') {
            const incomingDeltaRecord = data.result as { deltaContent?: QuillDeltaType, userId?: string };
            if (incomingDeltaRecord.deltaContent && incomingDeltaRecord.userId !== userId) {
              quillRef.current?.updateContents(incomingDeltaRecord.deltaContent, 'api');
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

      const loadDocumentSnapshot = async () => {
        if (!surreal || !quillRef) return;
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
      };

      const fetchInitialContentAndSubscribe = async () => {
        if (!quillRef.current || !surreal || !documentId) return;
        try {
          type DeltaRecord = { id?: any; deltaContent?: QuillDeltaType;[key: string]: any };
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
              await loadDocumentSnapshot();
            }
          } else {
            await loadDocumentSnapshot();
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
    }, [surreal, documentId, userId, t]);

    // Handle cursor updates for collaborative editing
    useEffect(() => {
      if (!quillRef.current || !surreal || !documentId || !userId || readOnly) return;

      const selectionChangeHandler = async (range: QuillRange | null, oldRange: QuillRange | null, source: string) => {
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

      quillRef.current.on('selection-change', selectionChangeHandler);

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
        quillRef.current?.off('selection-change', selectionChangeHandler);
        cleanupCursor();
        window.removeEventListener('beforeunload', cleanupCursor);
      };
    }, [surreal, documentId, userId, userName, readOnly]);

    // Handle remote cursors for collaborative editing
    useEffect(() => {
      if (!quillRef.current || !surreal || !documentId || !userId || readOnly) return;

      const updateRemoteCursorsDisplay = () => {
        const editor = quillRef.current!;
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
            } catch (e) {
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
            setRemoteCursors((prevCursors: any) => {
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
    }, [surreal, documentId, userId, readOnly, remoteCursors]);

    // 扩展区域Tab变更处理函数
    const handleExtensionTabChange = (tabId: string) => {
      setCurrentExtensionTab(tabId);
      if (onExtensionAreaTabChange) {
        onExtensionAreaTabChange(tabId);
      }
    };

    // 处理拖动调整扩展区域高度
    const handleResizeStart = (e: React.MouseEvent) => {
      resizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = extensionAreaHeight;

      // 添加全局鼠标事件监听
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeMove = useCallback((e: MouseEvent) => {
      if (!resizingRef.current) return;

      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeightRef.current + deltaY));
      setExtensionAreaHeight(newHeight);
    }, []);

    const handleResizeEnd = useCallback(() => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    }, [handleResizeMove]);

    // 在组件卸载时清理事件监听器
    useEffect(() => {
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }, [handleResizeMove, handleResizeEnd]);

    // 更新当前扩展区域Tab
    useEffect(() => {
      if (extensionAreaTabs.length > 0 && !currentExtensionTab) {
        setCurrentExtensionTab(extensionAreaTabs[0].id);
      }
    }, [extensionAreaTabs, currentExtensionTab]);

    // 控制扩展区域显示/隐藏
    useEffect(() => {
      setIsExtensionAreaOpen(showExtensionArea);
    }, [showExtensionArea]);

    // 渲染扩展区域内容
    const renderExtensionContent = () => {
      if (!extensionAreaContent) return null;

      // 如果传入了自定义渲染函数，优先使用
      if (extensionAreaContent.renderContent) {
        return extensionAreaContent.renderContent();
      }

      // 否则使用默认的渲染逻辑
      const { type, data } = extensionAreaContent;

      switch (type) {
        case 'case':
          return renderCaseInfo(data);
        case 'claim':
          return renderClaimInfo(data);
        case 'law':
          return renderLawInfo(data);
        case 'related_docs':
          return renderRelatedDocs(data);
        default:
          return (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Typography color="text.secondary">无法显示此类型的扩展信息</Typography>
            </Box>
          );
      }
    };

    // 案件信息渲染
    const renderCaseInfo = (data: any) => {
      return (
        <Box sx={{ p: 2, boxSizing: 'border-box' }}>
          <Grid container spacing={3}>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>案件编号</Typography>
                <Typography variant="body2" color="text.secondary">{data.caseNumber || '暂无数据'}</Typography>
              </Paper>
            </Grid>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>案件名称</Typography>
                <Typography variant="body2" color="text.secondary">{data.caseName || '暂无数据'}</Typography>
              </Paper>
            </Grid>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>当前阶段</Typography>
                <Typography variant="body2" color="text.secondary">{data.stage || '暂无数据'}</Typography>
              </Paper>
            </Grid>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>受理法院</Typography>
                <Typography variant="body2" color="text.secondary">{data.court || '暂无数据'}</Typography>
              </Paper>
            </Grid>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>管理人</Typography>
                <Typography variant="body2" color="text.secondary">{data.administrator || '暂无数据'}</Typography>
              </Paper>
            </Grid>
            <Grid size={4}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>受理日期</Typography>
                <Typography variant="body2" color="text.secondary">{data.acceptanceDate || '暂无数据'}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      );
    };

    // 债权信息渲染
    const renderClaimInfo = (data: any) => {
      return (
        <Box sx={{ p: 2, boxSizing: 'border-box' }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>债权人信息</Typography>
            <Grid container spacing={2}>
              <Grid size={6}>
                <Typography variant="subtitle2">名称</Typography>
                <Typography variant="body2" color="text.secondary">{data.creditorName || '暂无数据'}</Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="subtitle2">申报编号</Typography>
                <Typography variant="body2" color="text.secondary">{data.claimNumber || '暂无数据'}</Typography>
              </Grid>
            </Grid>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>债权详情</Typography>
            <Grid container spacing={2}>
              <Grid size={4}>
                <Typography variant="subtitle2">债权性质</Typography>
                <Typography variant="body2" color="text.secondary">{data.claimType || '暂无数据'}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="subtitle2">申报金额</Typography>
                <Typography variant="body2" color="text.secondary">{data.amount ? `¥${data.amount}` : '暂无数据'}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="subtitle2">审核状态</Typography>
                <Typography variant="body2" color="text.secondary">{data.status || '暂无数据'}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="subtitle2">认定金额</Typography>
                <Typography variant="body2" color="text.secondary">{data.approvedAmount ? `¥${data.approvedAmount}` : '暂无数据'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      );
    };

    // 法律条文信息渲染
    const renderLawInfo = (data: any) => {
      return (
        <Box sx={{ p: 2, boxSizing: 'border-box' }}>
          <Typography variant="subtitle1" gutterBottom>相关法律条文</Typography>
          {data && data.length > 0 ? (
            data.map((item: any, index: number) => (
              <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {item.title}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{item.content}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  来源: {item.source}
                </Typography>
              </Paper>
            ))
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">暂无相关法律条文</Typography>
            </Box>
          )}
        </Box>
      );
    };

    // 相关文档信息渲染
    const renderRelatedDocs = (data: any) => {
      return (
        <Box sx={{ p: 2, boxSizing: 'border-box' }}>
          <Typography variant="subtitle1" gutterBottom>相关文档</Typography>
          {data && data.length > 0 ? (
            <List>
              {data.map((doc: any, index: number) => (
                <ListItemButton key={index} component="a" href={doc.url} target="_blank">
                  <ListItemText
                    primary={doc.title}
                    secondary={doc.description}
                    primaryTypographyProps={{ fontWeight: 500 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {doc.date}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">暂无相关文档</Typography>
            </Box>
          )}
        </Box>
      );
    };

    // 注释功能相关代码
    const addCommentHandler = useCallback(() => {
      const editor = quillRef.current;
      if (!editor) return;

      const range = editor.getSelection(true);
      if (!range || range.length === 0) {
        alert('请先选择要添加批注的文本');
        return;
      }

      // 这里可以添加高亮标记并弹出评论输入框
      // 简单实现为直接高亮文本
      editor.formatText(range.index, range.length, {
        'background': '#FFF9C4'
      });

      // 显示评论面板
      setIsCommentsPanelOpen(true);

      // 这里可以调用函数来添加一个新的评论
      // 实际项目中会将此评论保存到数据库
      console.log('添加批注:', editor.getText(range.index, range.length));
    }, []);

    // 文档评论组件
    const CommentsPanel = ({ comments }: { comments: Comment[] }) => {
      if (!comments || comments.length === 0) {
        return (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <SvgIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}>
              <path d={mdiCommentOutline} />
            </SvgIcon>
            <Typography variant="body2" color="text.secondary" align="center">
              暂无批注
            </Typography>
            <Typography variant="caption" color="text.disabled" align="center">
              选择文本后点击批注按钮添加新批注
            </Typography>
          </Box>
        );
      }

      return (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          {comments.map((comment) => (
            <Paper key={comment.id} variant="outlined" sx={{ p: 1.5, mb: 1.5, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                  {comment.author.charAt(0)}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{comment.author}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  {comment.time}
                </Typography>
              </Box>
              <Typography variant="body2">{comment.content}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button size="small" variant="text" sx={{ minWidth: 'auto', p: '2px 8px' }}>
                  回复
                </Button>
                <Button size="small" variant="text" color="success" sx={{ minWidth: 'auto', p: '2px 8px' }}>
                  解决
                </Button>
              </Box>
            </Paper>
          ))}
        </Box>
      );
    };

    // 滚动到对应大纲位置的函数
    const scrollToHeader = useCallback((headerText: string, level: number) => {
      if (!quillRef.current) return;

      const editor = quillRef.current;
      const text = editor.getText();
      const textLength = text.length;

      // 逐字符搜索标题文本
      for (let i = 0; i < textLength; i++) {
        const pos = text.indexOf(headerText, i);
        if (pos === -1) break;

        // 获取当前位置的格式
        const formats = editor.getFormat(pos, headerText.length);

        // 检查是否是对应级别的标题
        if (formats.header === level) {
          // 找到匹配的标题，滚动到该位置
          editor.setSelection(pos, 0);

          // 使用DOM原生滚动
          const editorElem = editor.root.parentElement;
          if (editorElem) {
            const bounds = editor.getBounds(pos);
            if (bounds) {
              editorElem.scrollTop = bounds.top;
            }
          }

          break;
        }

        i = pos + 1; // 从下一个位置继续搜索
      }
    }, []);

    // 文档大纲组件
    interface OutlinePanelProps {
      setIsOutlineOpen: React.Dispatch<React.SetStateAction<boolean>>;
      outline: OutlineItem[];
      scrollToHeader: (headerText: string, level: number) => void;
    }

    const OutlinePanel = ({ setIsOutlineOpen, outline, scrollToHeader }: OutlinePanelProps) => {
      return (
        <Paper
          elevation={4}
          sx={{
            width: 280,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            position: 'relative',
            zIndex: 20
          }}
        >
          <Box sx={{ p: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>大纲</Typography>
            <IconButton onClick={() => setIsOutlineOpen(false)}>
              <ChevronLeft />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <List sx={{ p: 1 }}>
              {outline.length > 0 ? outline.map((item, index) => (
                <ListItemButton
                  key={index}
                  sx={{ pl: item.level * 2, borderRadius: 1 }}
                  onClick={() => scrollToHeader(item.text, item.level)}
                >
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                  />
                </ListItemButton>
              )) : (
                <Typography sx={{ p: 2, color: 'text.secondary', fontSize: '0.875rem' }}>
                  文档中未找到标题
                </Typography>
              )}
            </List>
          </Box>
        </Paper>
      );
    };

    // Context Panel Component
    interface ContextPanelProps {
      contextInfo: ContextInfo | undefined;
      showContextPanel: boolean;
      setShowContextPanel: React.Dispatch<React.SetStateAction<boolean>>;
    }

    const ContextPanel = ({ contextInfo, showContextPanel, setShowContextPanel }: ContextPanelProps) => {
      const theme = useTheme();
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

    return (
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
        {/* 左侧大纲按钮 */}
        {!isOutlineOpen && (
          <Paper
            elevation={4}
            onClick={() => setIsOutlineOpen(true)}
            sx={{
              position: 'absolute',
              top: '30%',
              left: 0,
              zIndex: 10,
              cursor: 'pointer',
              bgcolor: 'background.paper',
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              p: '12px 8px',
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            大纲
          </Paper>
        )}

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
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, width: '100%' }}>
              {/* Document Title & Breadcrumbs */}
              <Stack direction="column" sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {breadcrumbs}
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SvgIcon sx={{ color: 'text.secondary', flexShrink: 0 }}>
                    <path d={mdiFileDocumentOutline} />
                  </SvgIcon>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 500 }} noWrap>
                    {contextInfo?.title || '未命名文档'}
                  </Typography>
                </Stack>
              </Stack>

              {/* QuillJS Toolbar Container */}
              <Box
                id="quill-toolbar"
                style={{
                  borderBottom: 'none',
                  boxShadow: 'none',
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 2,
                  justifyContent: 'center',
                  minHeight: 42,
                  '& .ql-formats': {
                    display: 'flex',
                    alignItems: 'center',
                    mr: 1
                  },
                  '& .ql-picker': {
                    height: 24,
                  },
                  '& button': {
                    width: 28,
                    height: 28,
                    padding: 0
                  },
                }}
              >
                <span className="ql-formats">
                  <select className="ql-header" defaultValue={4}>
                    <option value="1">标题 1</option>
                    <option value="2">标题 2</option>
                    <option value="3">标题 3</option>
                    <option value="4">正文</option>
                  </select>
                </span>
                <span className="ql-formats">
                  <button className="ql-bold"></button>
                  <button className="ql-italic"></button>
                  <button className="ql-underline"></button>
                </span>
                <span className="ql-formats">
                  <select className="ql-color"></select>
                  <select className="ql-background"></select>
                </span>
                <span className="ql-formats">
                  <button className="ql-list" value="ordered"></button>
                  <button className="ql-list" value="bullet"></button>
                  <button className="ql-indent" value="-1"></button>
                  <button className="ql-indent" value="+1"></button>
                </span>
                <span className="ql-formats">
                  <button className="ql-link"></button>
                  <button className="ql-image"></button>
                  <button className="ql-attach"></button>
                </span>
                <span className="ql-formats">
                  <button className="ql-clean"></button>
                </span>
              </Box>

              {/* Right side actions and indicators */}
              <Stack direction="row" spacing={1} alignItems="center">
                {actions}
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

                {/* Add Comment button */}
                <Tooltip title="添加批注">
                  <IconButton
                    size="small"
                    onClick={addCommentHandler}
                    sx={{ color: 'text.secondary' }}
                  >
                    <AddComment />
                  </IconButton>
                </Tooltip>

                {/* Context panel toggle */}
                {contextInfo && (
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
              </Stack>
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
          {/* 左侧大纲面板 - 修改为固定定位而不是绝对定位 */}
          {isOutlineOpen && (
            <Box
              sx={{
                width: 280,
                height: '100%',
                flexShrink: 0,
                position: 'relative',
                zIndex: 20
              }}
            >
              <OutlinePanel
                setIsOutlineOpen={setIsOutlineOpen}
                outline={outline}
                scrollToHeader={scrollToHeader}
              />
            </Box>
          )}

          {/* Main Editor Area - 修改布局，当大纲打开时内容自动向右移动 */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxWidth: showContextPanel && contextInfo && !isMobile ? 'calc(100% - 360px)' : '100%',
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
                '& .ql-container': {
                  flex: 1,
                  border: 'none',
                  borderRadius: 0,
                  fontFamily: theme.typography.fontFamily,
                  fontSize: '16px',
                  lineHeight: 1.6,
                },
                '& .ql-editor': {
                  margin: 0,
                  padding: { xs: '20px 16px', sm: '32px 48px' },
                  minHeight: isExtensionAreaOpen ? `calc(100vh - ${extensionAreaHeight + 200}px)` : 'calc(100vh - 200px)',
                  '&.ql-blank::before': {
                    left: { xs: 16, sm: 48 },
                    fontStyle: 'normal',
                    color: theme.palette.text.disabled,
                  },
                },
                // 隐藏Quill自带的工具栏
                '& .ql-toolbar.ql-snow': {
                  display: 'none',
                  borderBottom: 'none',
                  boxShadow: 'none',
                },
              }}
            >
              <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }} />
            </Paper>
          </Box>

          {/* Context Panel */}
          <ContextPanel
            contextInfo={contextInfo}
            showContextPanel={showContextPanel}
            setShowContextPanel={setShowContextPanel}
          />
        </Box>

        {/* Document Extension Area - 修复扩展区域收起后无法再次展开的问题 */}
        {extensionAreaTabs.length > 0 && (
          <Box
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              height: isExtensionAreaOpen ? `${extensionAreaHeight}px` : '141px',
              transition: 'height 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 拖动调整高度的手柄 */}
            {isExtensionAreaOpen && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  cursor: 'ns-resize',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  },
                  zIndex: 1,
                }}
                onMouseDown={handleResizeStart}
              />
            )}

            {/* 面板标题栏 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1,
                borderBottom: isExtensionAreaOpen ? `1px solid ${theme.palette.divider}` : 'none',
                cursor: 'pointer', // 添加鼠标指针样式
              }}
              onClick={() => setIsExtensionAreaOpen(!isExtensionAreaOpen)} // 确保整个标题栏可点击切换
            >
              {/* 左侧: 当前标签页标题 */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {currentExtensionTab && extensionAreaTabs.find(tab => tab.id === currentExtensionTab)?.label || '扩展区域'}
              </Typography>

              {/* 中间: 标签页切换器 */}
              {isExtensionAreaOpen && extensionAreaTabs.length > 1 && (
                <Tabs
                  value={currentExtensionTab}
                  onChange={(event, value) => {
                    event.stopPropagation(); // 防止触发父元素的点击事件
                    handleExtensionTabChange(value);
                  }}
                  sx={{ mx: 2, flex: 1 }}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {extensionAreaTabs.map((tab) => (
                    <Tab
                      key={tab.id}
                      value={tab.id}
                      label={tab.label}
                      icon={tab.icon ? <SvgIcon fontSize="small"><path d={tab.icon} /></SvgIcon> : undefined}
                      iconPosition="start"
                      sx={{ minHeight: 36, py: 0.5 }}
                    />
                  ))}
                </Tabs>
              )}

              {/* 右侧: 折叠/展开按钮 */}
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation(); // 防止触发父元素的点击事件
                  setIsExtensionAreaOpen(!isExtensionAreaOpen);
                }}
                sx={{ ml: 'auto' }}
              >
                {isExtensionAreaOpen ? <ExpandMore /> : <ExpandLess />}
              </IconButton>
            </Box>

            {/* 面板内容区域 */}
            {isExtensionAreaOpen && (
              <Box sx={{ overflowY: 'scroll', height: 'calc(100% - 141px)' }}>
                {extensionAreaContent ? (
                  renderExtensionContent()
                ) : (
                  <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography color="text.secondary">暂无可用的扩展信息</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }
);

RichTextEditor.displayName = 'Editor';

export default RichTextEditor;
