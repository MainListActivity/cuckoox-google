import React from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import Quill snow theme

// Interface for the component's props
interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean; // Optional: to make editor read-only
}

// Define a custom image handler later if needed for S3 integration
// For now, rely on default image handling (base64 or direct URL if user pastes)
// const imageHandler = () => {
//   // Logic for custom image upload will go here in a later step
//   console.log('Attempting to add image...');
//   // const input = document.createElement('input');
//   // input.setAttribute('type', 'file');
//   // input.setAttribute('accept', 'image/*');
//   // input.click();
//   // input.onchange = async () => {
//   //   const file = input.files ? input.files[0] : null;
//   //   if (file) {
//   //     // const url = await uploadToS3(file); // Your S3 upload function
//   //     // const quill = this.quillRef.getEditor();
//   //     // const range = quill.getSelection();
//   //     // quill.insertEmbed(range.index, 'image', url);
//   //   }
//   // };
// };

const modules = {
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
  // handlers: {
  //   image: imageHandler, // Will be enabled when S3 upload is implemented
  // },
  //clipboard: {
    // matchVisual: false, // Toggle to add extra line breaks when pasting HTML.
  //}
};

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
  'list', 'bullet', 'indent',
  'link', 'image', 'video',
  'color', 'background', 'align', 'script', 'direction'
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, readOnly = false }) => {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      formats={formats}
      placeholder={placeholder || '撰写内容...'} // Default placeholder in Chinese
      readOnly={readOnly}
      style={{ backgroundColor: readOnly ? '#f8f9fa' : 'white' }} // Optional: different bg for read-only
    />
  );
};

export default RichTextEditor;
