import React, { useRef, useEffect, useState, useCallback } from 'react';
import Quill from 'quill';
import type { Delta } from 'quill/core';
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
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onTextChange,
  placeholder,
  readOnly = false,
  className,
}) => {
  const { t } = useTranslation();
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
    if (!quillRef.current || !isInitialized) return;

    const editor = quillRef.current;

    // Remove previous handler if exists
    if (changeHandlerRef.current) {
      editor.off('text-change', changeHandlerRef.current);
    }

    // Create new handler
    const handler = (delta: Delta, oldDelta: Delta, source: any) => {
      const currentContents = editor.getContents();
      
      if (onChange) {
        // Call onChange with just the new content for backward compatibility
        onChange(currentContents);
      }
      
      if (onTextChange) {
        onTextChange(currentContents, delta, source as string);
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
  }, [onChange, onTextChange, isInitialized]);

  // Update editor content when value prop changes
  useEffect(() => {
    if (!quillRef.current || !isInitialized) return;

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
