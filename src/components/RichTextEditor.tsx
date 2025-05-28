import React, { useRef, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
// Define MDI_PAPERCLIP_ICON SVG string
const MDI_PAPERCLIP_ICON = '<svg viewBox="0 0 24 24"><path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" /></svg>';

// Register the custom icon with Quill
const icons = Quill.import('ui/icons');
if (icons && !icons['attach']) {
  icons['attach'] = MDI_PAPERCLIP_ICON;
}
import '../styles/quill-theme.css';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '../services/fileUploadService'; // Import the upload service

// Import Delta type. It might be from 'quill/core' or 'quill'.
// react-quill typically uses types from the 'quill' package it depends on.
// If using Quill v2, Delta is part of the main export.
// For Quill v1, it might be `import Delta from 'quill-delta';`
// Let's assume Quill.imports['delta'] or find a direct import.
// After checking react-quill, it seems direct Delta import isn't standard.
// We often get Delta from editor.getContents() or in onChange.
// Let's define a basic Delta interface for prop typing if direct import is messy.
// Or use `any` for now and refine with actual Delta type from Quill instance.
// `DeltaStatic` is often used but might require `quill` as a direct dev dependency.
// Let's try to get it from `ReactQuill.Sources` or `Quill` if possible or define a compatible type.

// A simplified Delta representation for props, actual Delta objects are more complex.
// It's better to use the actual DeltaStatic type if possible.
// For now, we'll use `any` for the Delta prop and refine if type issues arise during use.
// The `editor.getContents()` and `delta` in `onChange` will be actual Deltas.
// Correctly use Delta from quill-delta, which is compatible with Quill 1.x used by react-quill 2.0.0
import Delta from 'quill-delta';
export type QuillDelta = Delta;

interface RichTextEditorProps {
  value: QuillDelta | string; // Accept initial HTML string or a Delta object
  onChange?: (newDelta: QuillDelta, lastChangeDelta: QuillDelta, source: string, editor: ReactQuill.UnprivilegedEditor) => void;
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void; // Clarified params for onTextChange
  placeholder?: string;
  readOnly?: boolean;
  className?: string; // Allow passing custom classNames
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
  const quillRef = useRef<ReactQuill | null>(null);

  const imageHandler = () => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection(true);

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
  };

  const attachmentHandler = () => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection(true);

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
          const uploadedFile = await uploadFile(file); // Reuse the same upload service
          editor.deleteText(range.index, placeholderText.length);
          
          // Insert a link with the filename, opening in a new tab, and custom attribute
          editor.insertText(range.index, uploadedFile.name, {
            'link': uploadedFile.url,
            'target': '_blank',
            'data-file-attachment': 'true'
          });
          editor.insertText(range.index + uploadedFile.name.length, ' ', 'user'); // Add a space after
          editor.setSelection(range.index + uploadedFile.name.length + 1, 0); // Move cursor after the space
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
  };

  const modulesConfig = {
    toolbar: [
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
      ['link', 'image', 'video', 'attach'], // Added 'attach' here
      ['clean']
    ],
    handlers: { 
      image: imageHandler,
      attach: attachmentHandler // New handler
    },
  };

  const formatsConfig = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
  'list', 'bullet', 'indent',
  'link', 'image', 'video',
  'color', 'background', 'align', 'script', 'direction'
];

  // and is a string (intended as initial HTML).
  useEffect(() => {
    if (quillRef.current && typeof value === 'string' && !readOnly) {
      const editor = quillRef.current.getEditor();
      const currentHTML = editor.root.innerHTML;
      if (currentHTML !== value) {
        // Assuming string value is for initial content or read-only display
        // Editor internally converts HTML to Delta.
      }
    } else if (quillRef.current && typeof value !== 'string' && value && !readOnly) {
      // If value is a Delta object
      // Rely on ReactQuill's internal handling or parent to manage Delta updates
    }
  }, [value, readOnly]);


  const handleChange = (content: string, delta: QuillDelta, source: string, editor: ReactQuill.UnprivilegedEditor) => {
    // `content` is HTML string
    // `delta` is the change delta (what just happened)
    // `editor.getContents()` is the full new document Delta
    if (onChange) {
      onChange(editor.getContents() as QuillDelta, delta, source, editor); // Cast to QuillDelta for safety
    }
  };
  
  const handleTextChange = (changeDelta: QuillDelta, oldFullDelta: QuillDelta, source: string) => {
    // `changeDelta` is the diff/change.
    // `oldFullDelta` is the full document Delta before this change.
    // `quillRef.current.getEditor().getContents()` is the full document Delta *after* this change.
    if (onTextChange && quillRef.current) {
      onTextChange(quillRef.current.getEditor().getContents() as QuillDelta, changeDelta, source); // Pass new full delta and the change delta
    }
  };


  return (
    <ReactQuill
      ref={quillRef}
      theme="snow"
      value={value} // ReactQuill can take HTML string or Delta object as value
      onChange={handleChange}
      onEditorChange={onTextChange ? handleTextChange : undefined} // onEditorChange is for text/selection changes
      modules={modulesConfig}
      formats={formatsConfig}
      placeholder={placeholder || t('richtexteditor_placeholder')}
      readOnly={readOnly}
      className={className}
      // style={{ backgroundColor: readOnly ? '#f8f9fa' : 'white' }} // Removed hardcoded style
    />
  );
};

export default RichTextEditor;
