import React, { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Quill from 'quill';
import { Paper, Box, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import 'quill/dist/quill.snow.css';
import '@/src/styles/quill-theme.css';
import type { EditorCoreProps, QuillDelta } from './types';

// 注册自定义图标
const MDI_PAPERCLIP_ICON = '<svg viewBox="0 0 24 24"><path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" /></svg>';

const icons = Quill.import('ui/icons') as Record<string, string>;
if (icons && !icons['attach']) {
  icons['attach'] = MDI_PAPERCLIP_ICON;
}

export interface EditorCoreRef {
  getQuill: () => Quill | null;
  getContents: () => QuillDelta | null;
  setContents: (delta: QuillDelta, source?: string) => void;
  getText: () => string;
  getSelection: () => { index: number; length: number } | null;
  setSelection: (index: number, length?: number) => void;
  focus: () => void;
  blur: () => void;
  enable: (enabled?: boolean) => void;
}

const EditorCore = forwardRef<EditorCoreRef, EditorCoreProps>(({
  containerRef,
  defaultValue,
  initialContentForDocumentView,
  placeholder,
  readOnly = false,
  imageHandler,
  attachmentHandler,
  onReady,
}, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const quillRef = useRef<Quill | null>(null);
  const defaultValueRef = useRef(defaultValue);

  // 更新默认值引用
  useLayoutEffect(() => {
    defaultValueRef.current = defaultValue;
  }, [defaultValue]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    getQuill: () => quillRef.current,
    getContents: () => quillRef.current?.getContents() || null,
    setContents: (delta: QuillDelta, source = 'api') => {
      quillRef.current?.setContents(delta, source as 'api' | 'user' | 'silent');
    },
    getText: () => quillRef.current?.getText() || '',
    getSelection: () => quillRef.current?.getSelection() || null,
    setSelection: (index: number, length = 0) => {
      quillRef.current?.setSelection(index, length);
    },
    focus: () => quillRef.current?.focus(),
    blur: () => quillRef.current?.blur(),
    enable: (enabled = true) => quillRef.current?.enable(enabled),
  }), []);

  // 初始化QuillJS编辑器
  useEffect(() => {
    if (containerRef.current) {

      const container = containerRef.current;
      const editorContainer = container.children[0] as HTMLElement || container.appendChild(
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

      const formats = [
        'header', 'font', 'size', 'bold', 'italic', 'underline', 'strike',
        'color', 'background', 'list', 'indent', 'align', 'link', 'image'
      ];

      const editor = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: placeholder || t('richtexteditor_placeholder', '请输入内容...'),
        readOnly: readOnly,
        modules: modules,
        formats: formats,
      });

      // 设置初始内容
      const initialContent = defaultValueRef.current || initialContentForDocumentView;
      if (initialContent) {
        if (typeof initialContent === 'string') {
          editor.clipboard.dangerouslyPasteHTML(initialContent);
        } else {
          editor.setContents(initialContent as QuillDelta, 'api');
        }
      }

      quillRef.current = editor;

      // 通知父组件编辑器已准备好
      if (onReady) {
        onReady(editor);
      }

      return () => {
        // 保存当前容器的引用，避免在清理函数中访问可能已经改变的ref
        const currentContainer = container;
        if (currentContainer) {
          currentContainer.innerHTML = '';
        }
        quillRef.current = null;
      };
    }
  }, [
    containerRef,
    placeholder,
    readOnly,
    imageHandler,
    attachmentHandler,
    onReady,
    t,
    initialContentForDocumentView,
  ]);

  // 处理只读状态变化
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly);
    }
  }, [readOnly]);

  // 处理placeholder变化
  useEffect(() => {
    if (quillRef.current) {
      const placeholderText = placeholder || t('richtexteditor_placeholder', '请输入内容...');
      if (quillRef.current.root.getAttribute('data-placeholder') !== placeholderText) {
        quillRef.current.root.setAttribute('data-placeholder', placeholderText);
      }
    }
  }, [placeholder, t]);

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        px: { xs: 2, sm: 3 },
        py: 2,
        scrollBehavior: 'smooth',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: alpha(theme.palette.text.secondary, 0.3),
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.secondary, 0.5),
          },
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 300px)',
          boxShadow: theme.palette.mode === 'light'
            ? '0px 2px 12px rgba(0, 0, 0, 0.08)'
            : '0px 2px 12px rgba(0, 0, 0, 0.25)',
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
            padding: { xs: '24px 20px', sm: '40px 48px' },
            minHeight: 'calc(100vh - 300px)',
            '&.ql-blank::before': {
              left: { xs: 20, sm: 48 },
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
        <div 
          ref={containerRef} 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            width: '100%' 
          }} 
        />
      </Paper>
    </Box>
  );
});

EditorCore.displayName = 'EditorCore';

export default EditorCore; 