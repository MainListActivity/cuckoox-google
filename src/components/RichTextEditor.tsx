import React, { useRef, useEffect, useState, useCallback } from 'react';
import Quill from 'quill';
import type { Delta } from 'quill/core';
import { useSurreal } from '@/src/hooks/useSurreal'; // Import useSurreal
import 'quill/dist/quill.snow.css';
import '@/src/styles/quill-theme.css';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '@/src/services/fileUploadService';

// Define MDI_PAPERCLIP_ICON SVG string
const MDI_PAPERCLIP_ICON = '<svg viewBox="0 0 24 24"><path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" /></svg>';

// Register the custom icon with Quill
const icons = Quill.import('ui/icons') as any;
if (icons && !icons['attach']) {
  icons['attach'] = MDI_PAPERCLIP_ICON;
}

// Export Delta type
export type QuillDelta = Delta;

interface RichTextEditorProps {
  value: QuillDelta | string; // Accept initial HTML string or a Delta object
  onChange?: (newDelta: QuillDelta) => void; // Simplified onChange for backward compatibility
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  documentId: string;
  userId: string; // Add userId prop
  userName: string;
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
  userId, // Destructure userId
  userName, // Destructure userName
}) => {
  const { t } = useTranslation();
  const surreal = useSurreal();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const changeHandlerRef = useRef<any>(null);

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
    if (!containerRef.current || isInitialized) return;

    const toolbarOptions = [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['link', 'image', 'video', 'attach'],
      ['clean']
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
      formats: [
        'header', 'font', 'size',
        'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
        'list', 'bullet', 'indent',
        'link', 'image', 'video',
        'color', 'background', 'align', 'script', 'direction'
      ]
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
      // Properly cleanup Quill instance
      if (quillRef.current) {
        quillRef.current.off('text-change');
        // Don't destroy the editor to avoid React lifecycle issues
        quillRef.current = null;
      }
    };
  }, [placeholder, readOnly, t, imageHandler, attachmentHandler]); // Remove isInitialized from deps to prevent re-initialization

  // Handle text change events
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal) return; // Add surreal dependency

    const editor = quillRef.current;

    // Remove previous handler if exists
    if (changeHandlerRef.current) {
      editor.off('text-change', changeHandlerRef.current);
    }

    // Create new handler
    const handler = async (delta: Delta, oldDelta: Delta, source: any) => {
      const currentContents = editor.getContents();
      
      if (onChange) {
        // Call onChange with just the new content for backward compatibility
        onChange(currentContents);
      }
      
      if (onTextChange) {
        onTextChange(currentContents, delta, source as string);
      }

      // Send changes to SurrealDB
      // Send deltas to SurrealDB
      // Send deltas to SurrealDB
      if (source === 'user' && surreal) { // Only send changes made by the user
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
  }, [onChange, onTextChange, isInitialized, surreal, documentId]); // Add surreal and documentId to dependencies

  // Subscribe to changes from SurrealDB
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId) return;

    const editor = quillRef.current;

    const handleLiveChange = (data: any) => {
      if (data.action === 'CREATE' && data.result && data.result.docId === documentId) {
        // Handle incoming deltas
        if (data.result.delta && data.result.userId !== userId) { // Only apply deltas from other users
          if (quillRef.current) {
            quillRef.current.updateContents(data.result.delta, 'api');
          }
        }
        // Handle incoming cursor updates (to be implemented)
        // if (data.result.cursor && data.result.userId !== userId) {
        //   updateRemoteCursor(data.result.cursor);
        // }
      }
    };

    // Live query for new deltas related to the current document
    // This assumes deltas are stored in a 'delta' table/collection
    // and have a 'docId' field and a timestamp 'ts' for ordering if necessary.
    const liveQuery = `LIVE SELECT * FROM delta WHERE docId = '${documentId}' ORDER BY ts ASC`;

    let liveQueryId: string | null = null;

    const setupLiveQuery = async () => {
      try {
        // Check if the document exists. If not, create it.
        // This step might be handled differently based on application flow.
        const doc = await surreal.select(`document:${documentId}`);
        if (!doc) {
          await surreal.create(`document:${documentId}`, { content: { ops: [] } }); // Initialize with empty Delta
        }

        // Subscribe to deltas
        const result = await surreal.query(liveQuery);
        if (result && result.length > 0 && typeof result[0].result === 'string') {
          liveQueryId = result[0].result;
          surreal.listenLive(liveQueryId, handleLiveChange);
        } else {
          console.error('Failed to setup live query for deltas.');
        }
      } catch (error) {
        console.error('Failed to setup live query or create document:', error);
      }
    };

    // Fetch initial document content (or deltas) and then setup live query
    const fetchInitialContentAndSubscribe = async () => {
        if (!quillRef.current || !surreal || !documentId) return;
        try {
            // Fetch all deltas for the document and apply them
            // This is a simplified way to reconstruct the document.
            // A snapshotting mechanism would be better for performance with many deltas.
            const deltasResult: any[] = await surreal.select(`delta WHERE docId = '${documentId}' ORDER BY ts ASC`);
            if (deltasResult && deltasResult.length > 0) {
                const initialDeltas = deltasResult.map(d => d.delta);
                // Combine all deltas into one to set initial content
                const combinedDelta = initialDeltas.reduce((acc, current) => acc.compose(current), new Quill.sources.API().delta());
                if (quillRef.current) {
                    quillRef.current.setContents(combinedDelta, 'api');
                }
            } else {
                 // If no deltas, check for a snapshot or initialize empty
                const doc = await surreal.select(`document:${documentId}`);
                if (doc && (doc as any).content) {
                    if (quillRef.current) {
                        quillRef.current.setContents((doc as any).content, 'api');
                    }
                } else {
                    // Initialize with empty content if document is new or has no content
                    if (quillRef.current) {
                        quillRef.current.setContents({ ops: [] } as any, 'api');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch initial deltas:', error);
            if (quillRef.current) {
              quillRef.current.setText('Error loading document.', 'api');
            }
        } finally {
            setupLiveQuery(); // Setup live query after attempting to load initial content
        }
    };

    fetchInitialContentAndSubscribe();

    return () => {
      if (liveQueryId && surreal) {
        surreal.kill(liveQueryId);
      }
    };
  }, [isInitialized, surreal, documentId]); // Add surreal and documentId to dependencies

  // Update editor content when value prop changes
  // Effect for handling local selection changes and sending cursor updates
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId || !userId || readOnly) return;

    const editor = quillRef.current;

    const selectionChangeHandler = async (range: any, oldRange: any, source: string) => {
      if (source === 'user' && range && surreal) { // Check surreal instance
        try {
          // Record for cursor position: `cursor:<docId>:<userId>`
          const cursorId = `cursor:${documentId}:${userId}`;
          // Use `change` to create or update the cursor position.
          // SurrealDB's `change` method with `diff` true can be efficient here if supported well by the client.
          // Otherwise, a simple create/update by ID is fine.
          await surreal.change(cursorId, {
            docId: documentId,
            userId: userId,
            userName: userName, // Include userName
            range: range,
            ts: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to send cursor update to SurrealDB:', error);
        }
      }
    };

    editor.on('selection-change', selectionChangeHandler);

    // Cleanup: remove user's cursor information when editor is unmounted or user leaves
    const cleanupCursor = async () => {
      if (surreal) { // Check surreal instance
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
      cleanupCursor(); // Also cleanup on component unmount
      window.removeEventListener('beforeunload', cleanupCursor);
    };
  }, [isInitialized, surreal, documentId, userId, userName, readOnly]); // Add userName and readOnly

  const [remoteCursors, setRemoteCursors] = useState<any>({}); // State to store remote cursors

  // Effect for subscribing to remote cursor changes
  useEffect(() => {
    if (!quillRef.current || !isInitialized || !surreal || !documentId || !userId || readOnly) return;

    const editor = quillRef.current;

    // Function to render remote cursors (basic implementation)
    // This will need to be significantly enhanced, possibly with a Quill module
    const updateRemoteCursorsDisplay = () => {
      // First, clear any existing custom cursor elements if not managed by a proper module
      // This is a naive approach; a Quill module would handle this better.
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());

      Object.values(remoteCursors).forEach((cursorData: any) => {
        if (cursorData.range && editor.isEnabled()) { // Check if editor is enabled
          try {
            const { index, length } = cursorData.range;
            if (typeof index !== 'number' || typeof length !== 'number') return;


            // Create a caret element
            const caretEl = document.createElement('span');
            caretEl.className = 'remote-cursor';
            // TODO: Assign unique color based on cursorData.userId or userName
            caretEl.style.position = 'absolute';
            caretEl.style.backgroundColor = cursorData.color; // Use assigned color
            caretEl.style.width = '2px';
            caretEl.style.zIndex = '10'; // Ensure caret is visible

            const nameLabel = document.createElement('span');
            nameLabel.className = 'remote-cursor-name';
            nameLabel.textContent = cursorData.userName || cursorData.userId;
            nameLabel.style.position = 'absolute';
            nameLabel.style.top = '-22px'; // Adjusted for better spacing
            nameLabel.style.left = '-2px'; // Slight offset to align with caret
            nameLabel.style.fontSize = '12px';
            nameLabel.style.backgroundColor = cursorData.color; // Use assigned color
            nameLabel.style.color = 'white'; // High-contrast text
            nameLabel.style.padding = '2px 4px'; // Chip-like padding
            nameLabel.style.borderRadius = '4px'; // Rounded corners for chip
            nameLabel.style.whiteSpace = 'nowrap'; // Prevent name from wrapping
            nameLabel.style.zIndex = '11'; // Ensure label is above caret and selection

            caretEl.appendChild(nameLabel);


            const bounds = editor.getBounds(index, length);
            if (!bounds) return;

            caretEl.style.top = `${bounds.top}px`;
            caretEl.style.left = `${bounds.left}px`;
            caretEl.style.height = `${bounds.height}px`;

            // For selection
            if (length > 0) {
              const selectionEl = document.createElement('span');
              selectionEl.className = 'remote-selection';
              selectionEl.style.position = 'absolute';
              // Use hexToRgba for proper transparency
              selectionEl.style.backgroundColor = hexToRgba(cursorData.color, 0.3);
              selectionEl.style.top = `${bounds.top}px`;
              selectionEl.style.left = `${bounds.left}px`;
              selectionEl.style.width = `${bounds.width}px`;
              selectionEl.style.height = `${bounds.height}px`;
              selectionEl.style.zIndex = '9'; // Ensure selection is behind caret/label but above text
              editor.root.parentNode?.appendChild(selectionEl); // Append to relative parent
            }
            // Ensure editor.root.parentNode exists before appending
            if (editor.root.parentNode) {
                 (editor.root.parentNode as HTMLElement).style.position = 'relative'; // Needed for absolute positioning of children
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

    // Call display update when remoteCursors state changes
    updateRemoteCursorsDisplay();


    const liveCursorQuery = `LIVE SELECT * FROM cursor WHERE docId = '${documentId}' AND userId != '${userId}'`;
    let liveCursorQueryId: string | null = null;

    const handleRemoteCursorChange = (data: any) => {
      if (data.result && data.result.docId === documentId && data.result.userId !== userId) {
        const { userId: remoteUserId, userName: remoteUserName, range, ts } = data.result;

        // Assign a color using the new USER_COLORS palette and hash function
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
        const result = await surreal.query(liveCursorQuery);
        if (result && result.length > 0 && typeof result[0].result === 'string') {
          liveCursorQueryId = result[0].result;
          surreal.listenLive(liveCursorQueryId, handleRemoteCursorChange);
        } else {
          console.error('Failed to setup live query for remote cursors.');
        }
      } catch (error) {
        console.error('Error setting up live query for remote cursors:', error);
      }
    };

    setupLiveCursorQuery();

    return () => {
      if (liveCursorQueryId && surreal) {
        surreal.kill(liveCursorQueryId);
      }
      // Clear remote cursors on unmount
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());
    };
  }, [isInitialized, surreal, documentId, userId, readOnly, remoteCursors]); // Add remoteCursors to re-run display



  // Update editor content when value prop changes
  useEffect(() => {
    // Disable this effect if documentId is present, as SurrealDB will manage content
    if (documentId || !quillRef.current || !isInitialized || readOnly) return; // Add readOnly condition

    const editor = quillRef.current;
    
    // Prevent updating if editor is focused (user is typing)
    if (editor.hasFocus()) return;
    
    if (value) {
      if (typeof value === 'string') {
        const currentHTML = editor.root.innerHTML;
        if (currentHTML !== value) {
          editor.root.innerHTML = value;
        }
      } else {
        // For Delta objects, check if content is different before updating
        const currentContents = editor.getContents();
        if (JSON.stringify(currentContents) !== JSON.stringify(value)) {
          editor.setContents(value as any);
        }
      }
    } else {
      // Clear editor if value is empty
      editor.setText('');
    }
  }, [value, isInitialized]);

  // Update readOnly state
  useEffect(() => {
    if (!quillRef.current || !isInitialized) return;
    quillRef.current.enable(!readOnly);
  }, [readOnly, isInitialized]);

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
};

export default RichTextEditor;
