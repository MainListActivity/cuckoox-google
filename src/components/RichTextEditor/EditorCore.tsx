import { useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  onTextChange,
}, ref) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const quillRef = useRef<Quill | null>(null);
  const defaultValueRef = useRef(defaultValue);
  const isInitializingRef = useRef(false);

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
    // 防护：如果已经在初始化中或已经有实例，则跳过
    if (isInitializingRef.current || quillRef.current) {
      return;
    }

    if (containerRef.current) {
      isInitializingRef.current = true;

      const container = containerRef.current;
      const editorContainer = container.children[0] as HTMLElement || container.appendChild(
        container.ownerDocument.createElement('div'),
      );

      // Quill推荐的toolbar配置方式
      const toolbarOptions = [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['link', 'image', 'attach'],
        ['clean']
      ];

      // 配置header选项的国际化文本
      const headerOptions: Record<string | number, string> = {
        1: t('heading_1', '标题 1'),
        2: t('heading_2', '标题 2'), 
        3: t('heading_3', '标题 3'),
        'false': t('normal_text', '正文')
      };

      const modules = {
        toolbar: {
          container: toolbarOptions,
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

      // 设置header选项的国际化文本
      const setupHeaderInternationalization = () => {
        const headerSelect = document.querySelector('.ql-header .ql-picker-options');
        if (headerSelect) {
          const options = headerSelect.querySelectorAll('.ql-picker-item');
          options.forEach((option) => {
            const dataValue = option.getAttribute('data-value');
            if (dataValue === '1') {
              option.textContent = headerOptions[1];
            } else if (dataValue === '2') {
              option.textContent = headerOptions[2];
            } else if (dataValue === '3') {
              option.textContent = headerOptions[3];
            } else if (dataValue === '' || dataValue === null) {
              option.textContent = headerOptions['false'];
            }
          });
          
          // 设置header选择器的默认显示文本
          const headerLabel = document.querySelector('.ql-header .ql-picker-label');
          if (headerLabel) {
            headerLabel.textContent = headerOptions['false'];
          }
        }
      };

      // 修复工具栏失焦问题的完整解决方案
      const setupToolbarFocusManagement = () => {
        const toolbar = document.getElementById('quill-toolbar');
        if (!toolbar) return null;

        let savedSelection: { index: number; length: number } | null = null;
        let isQuillInteraction = false;

        // 检查是否是Quill相关的元素
        const isQuillElement = (element: HTMLElement): boolean => {
          // 检查工具栏内的元素
          if (element.closest('#quill-toolbar')) {
            return !!(element.closest('.ql-bold, .ql-italic, .ql-underline, .ql-list, .ql-indent, .ql-link, .ql-image, .ql-clean, .ql-header, .ql-color, .ql-background, .ql-picker'));
          }
          
          // 检查下拉菜单选项（可能在工具栏外部渲染）
          return !!(element.closest('.ql-picker-options') || element.closest('.ql-picker-item'));
        };

        // 处理文档级别的点击事件
        const handleDocumentClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          
          if (isQuillElement(target)) {
            // 保存当前选择状态
            savedSelection = editor.getSelection();
            isQuillInteraction = true;
            
            // 短暂延迟后恢复焦点和选择
            setTimeout(() => {
              if (isQuillInteraction && savedSelection) {
                editor.setSelection(savedSelection.index, savedSelection.length);
                editor.focus();
                isQuillInteraction = false;
              }
            }, 15); // 稍微增加延迟确保Quill操作完成
          } else {
            // 点击了非Quill元素，重置状态
            isQuillInteraction = false;
          }
        };

        // 处理编辑器失焦事件
        const handleEditorBlur = () => {
          if (isQuillInteraction) {
            // 如果是Quill交互导致的失焦，短暂延迟后检查并恢复
            setTimeout(() => {
              if (isQuillInteraction && savedSelection) {
                editor.setSelection(savedSelection.index, savedSelection.length);
                editor.focus();
              }
            }, 20);
          }
        };

        // 监听文档级别的点击事件（捕获阶段）
        document.addEventListener('click', handleDocumentClick, true);
        
        // 监听编辑器失焦事件
        editor.root.addEventListener('blur', handleEditorBlur);
        
        return () => {
          document.removeEventListener('click', handleDocumentClick, true);
          editor.root.removeEventListener('blur', handleEditorBlur);
        };
      };

      const toolbarCleanup = setupToolbarFocusManagement();
      if (toolbarCleanup) {
        (editor as Quill & { __toolbarCleanup?: () => void }).__toolbarCleanup = toolbarCleanup;
      }

      // 设置国际化文本
      setTimeout(() => {
        setupHeaderInternationalization();
      }, 100);

      quillRef.current = editor;
      isInitializingRef.current = false;

      // 设置文本变化事件监听器
      if (onTextChange) {
        editor.on('text-change', onTextChange);
      }

      // 通知父组件编辑器已准备好
      if (onReady) {
        onReady(editor);
      }

      return () => {
        // 清理工具栏事件监听器
        const editorWithCleanup = quillRef.current as Quill & { __toolbarCleanup?: () => void };
        if (quillRef.current && editorWithCleanup.__toolbarCleanup) {
          editorWithCleanup.__toolbarCleanup();
        }
        
        // 保存当前容器的引用，避免在清理函数中访问可能已经改变的ref
        const currentContainer = container;
        if (currentContainer) {
          currentContainer.innerHTML = '';
        }
        quillRef.current = null;
        isInitializingRef.current = false;
      };
    }
  }, [
    containerRef,
    placeholder,
    readOnly,
    imageHandler,
    attachmentHandler,
    onReady,
    onTextChange,
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
        overflow: 'visible', // 移除内部滚动，让父容器处理滚动
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
          // 移除固定高度，让内容自然增长
          minHeight: '100vh',
          boxShadow: 'none !important',
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
            padding: { xs: '24px 20px 200px 20px', sm: '40px 48px 200px 48px' },
            minHeight: '100vh', // 确保编辑器至少占满整个视口高度
            cursor: 'text', // 确保鼠标悬停时显示文本光标
            '&.ql-blank::before': {
              left: { xs: 20, sm: 48 },
              fontStyle: 'normal',
              color: theme.palette.text.disabled,
            },
          },
          // Quill自带的工具栏样式定制（将通过JS移动到我们的容器中）
          '& .ql-toolbar.ql-snow': {
            border: 'none !important',
            borderTop: 'none !important',
            borderBottom: 'none !important',
            borderLeft: 'none !important',
            borderRight: 'none !important',
            boxShadow: 'none !important',
            WebkitBoxShadow: 'none !important',
            MozBoxShadow: 'none !important',
            padding: 0,
            margin: 0,
            backgroundColor: 'transparent',
            display: 'none', // 初始隐藏，直到移动到正确位置
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 42,
            '&::before, &::after': {
              display: 'none !important',
            },
            '& .ql-formats': {
              display: 'flex',
              alignItems: 'center',
              marginRight: theme.spacing(1),
              border: 'none !important',
              boxShadow: 'none !important',
            },
            '& .ql-picker': {
              height: 24,
            },
            '& button': {
              width: 28,
              height: 28,
              padding: 0,
              margin: 0,
              border: 'none !important',
              boxShadow: 'none !important',
            },
            '& .ql-picker-options': {
              '& *': {
                outline: 'none !important',
                userSelect: 'none',
              }
            },
            '& .ql-picker, & .ql-picker-label, & .ql-picker-item': {
              outline: 'none !important',
            }
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