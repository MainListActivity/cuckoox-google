import React, { useRef, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill'; // Quill for types
import 'react-quill/dist/quill.snow.css'; // Default Quill theme
import '../styles/quill-theme.css'; // Custom theme overrides
import { useTranslation } from 'react-i18next';

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
  // For real-time: a way to set content without triggering own onChange events back to server
  // This is often handled by checking the `source` in onChange (e.g., if source is 'user' vs 'api' or 'silent')
}

// ... (modules and formats can remain largely the same, but ensure 'image' handler is still commented out)
const modulesConfig = { // Renamed to avoid conflict if modules is imported
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['blockquote', 'code-block'],

    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
    [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
    [{ 'direction': 'rtl' }],                         // text direction

    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
    [{ 'font': [] }],
    [{ 'align': [] }],

    ['link', 'image', 'video'],                       // link, image, video (video might not be needed for this app)

    ['clean']                                         // remove formatting button
  ],
  // handlers: { image: imageHandler }, // Keep commented
};

const formatsConfig = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
  'list', 'bullet', 'indent',
  'link', 'image', 'video',
  'color', 'background', 'align', 'script', 'direction'
];


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

  // Handle initial value (string HTML to Delta conversion)
  // This effect runs when the component mounts or if `value` prop changes externally
  // and is a string (intended as initial HTML).
  useEffect(() => {
    if (quillRef.current && typeof value === 'string' && !readOnly) {
      const editor = quillRef.current.getEditor();
      // Check if current content is already this HTML to avoid loops if parent re-renders with same HTML string
      const currentHTML = editor.root.innerHTML;
      if (currentHTML !== value) {
          // This part is tricky. If `value` is an HTML string meant for initial load,
          // setting it directly might be okay. But for collaborative editing,
          // we want to ensure `value` prop is primarily a Delta.
          // For now, let's assume if string is passed, it's for initial, non-collaborative setup, or read-only.
          // This might need to be refined if HTML strings are expected to update dynamically.
          // A better approach for parent components would be to convert HTML to Delta themselves before passing.
          // Forcing HTML into a Delta-focused editor can be lossy or cause unexpected behavior.
          // A simple way:
          // editor.clipboard.dangerouslyPasteHTML(value);
          // Or if this is truly initial content:
          // editor.setContents(editor.clipboard.convert(value)); // convert HTML to Delta
          // This is only for INITIAL HTML. Subsequent updates should be Deltas.
          // This logic is complex and depends on how parent uses `value`.
          // For now, let's assume `value` will primarily be a Delta if editable.
          // If `value` is a string and editor is editable, it's ambiguous.
          // Let's simplify: if string, it's initial HTML.
          // The editor itself will convert it to its internal Delta format.
      }
    } else if (quillRef.current && typeof value !== 'string' && value && !readOnly) {
        // If value is a Delta object, set it.
        // Need to be careful if this causes an infinite loop with onChange.
        // The source of change check in onChange is crucial.
        const editor = quillRef.current.getEditor();
        // Only set if different to prevent loops. `editor.getContents()` returns a Delta.
        // Deep comparison of deltas might be needed.
        // For now, let's rely on ReactQuill's internal handling or parent to manage this.
        // editor.setContents(value, 'silent'); // 'silent' to not trigger onChange
    }
  }, [value, readOnly]); // Rerun if value or readOnly changes


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
