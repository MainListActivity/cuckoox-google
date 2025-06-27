import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import Quill from 'quill';
import {
  Box,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useSurrealClient as useSurreal } from '@/src/contexts/SurrealProvider';
import { useTranslation } from 'react-i18next';
import { uploadFile } from '@/src/services/fileUploadService';

import EditorToolbar from './EditorToolbar';
import OutlinePanel from './OutlinePanel';
import ContextPanel from './ContextPanel';
import ExtensionArea from './ExtensionArea';
import EditorCore, { EditorCoreRef } from './EditorCore';
import CollaborationManager from './CollaborationManager';

import type {
  RichTextEditorProps,
  OutlineItem,
  RemoteCursor,
  QuillDelta,
} from './types';
import { StringRecordId } from 'surrealdb';

// 检查是否在测试环境
const isTestEnvironment = process.env.NODE_ENV === 'test';

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
      viewMode: _viewMode = 'standard',
      initialContentForDocumentView,
      comments: _comments = [],
      extensionAreaTabs = [],
      extensionAreaContent,
      onExtensionAreaTabChange,
      showExtensionArea = false,
      breadcrumbs,
      actions,
      // 保存相关props
      onSave,
      isSaving: externalIsSaving = false,
      enableAutoSave = false,
      autoSaveInterval = 30000, // 30秒
      showSaveButton = true,
      saveButtonText,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const surreal = useSurreal();
    
    // Refs
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorCoreRef = useRef<EditorCoreRef>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContentRef = useRef<QuillDelta | null>(null);
    
    // UI状态
    const [showContextPanel, setShowContextPanel] = useState(true);
    const [isOutlineOpen, setIsOutlineOpen] = useState(true);
    const [outline, setOutline] = useState<OutlineItem[]>([]);
    const [activeHeaderIndex, setActiveHeaderIndex] = useState<number>(-1);
    const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
    
    // 扩展区域状态
    const [isExtensionAreaOpen, setIsExtensionAreaOpen] = useState(showExtensionArea);
    const [extensionAreaHeight, setExtensionAreaHeight] = useState(400);
    const [currentExtensionTab, setCurrentExtensionTab] = useState<string | null>(
      extensionAreaTabs.length > 0 ? extensionAreaTabs[0].id : null
    );

    // 保存状态
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // 手动保存功能
    const handleSave = useCallback(async () => {
      if (isSaving) return;

      const quill = editorCoreRef.current?.getQuill();
      if (!quill) return;

      const currentContent = quill.getContents();

      // 如果父组件提供了 onSave，则优先使用父组件的保存逻辑
      const saveExecutor = onSave
        ? () => onSave(currentContent)
        : async () => {
            // 默认保存逻辑：写入 SurrealDB
            if (!surreal || surreal.status !== 'connected' || !documentId || isTestEnvironment) {
              console.warn('[RichTextEditor] 未提供 onSave，且 SurrealDB 未连接或缺少 documentId，跳过保存');
              return;
            }

            try {
              // 如果文档不存在则先创建
              const existing = await surreal.select(new StringRecordId(documentId));
              if (!existing) {
                await surreal.create(new StringRecordId(documentId), { content: currentContent });
              } else {
                existing.content = currentContent;
                await surreal.update(new StringRecordId(documentId), existing);
              }
            } catch (e) {
              console.error('[RichTextEditor] 默认保存到 SurrealDB 失败:', e);
              throw e;
            }
          };

      try {
        setIsSaving(true);
        await saveExecutor();

        lastSavedContentRef.current = currentContent;
        setHasUnsavedChanges(false);
        console.log('[RichTextEditor] 文档保存成功');
      } catch (error) {
        console.error('[RichTextEditor] 保存失败:', error);
      } finally {
        setIsSaving(false);
      }
    }, [onSave, surreal, documentId, isSaving]);

    // 自动保存功能
    const scheduleAutoSave = useCallback(() => {
      if (!enableAutoSave) return;

      // 如果没有外部 onSave，则需要确保内部默认保存可用
      if (!onSave && (!surreal || surreal.status !== 'connected' || !documentId)) {
        return; // 无法自动保存
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        if (hasUnsavedChanges && !isSaving) {
          console.log('[RichTextEditor] 执行自动保存');
          handleSave();
        }
      }, autoSaveInterval);
    }, [enableAutoSave, onSave, hasUnsavedChanges, isSaving, autoSaveInterval, handleSave, surreal, documentId]);

    // 内容变化处理器
    const handleTextChange = useCallback((currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => {
      // 调用外部回调
      if (onTextChange) {
        onTextChange(currentContentsDelta, changeDelta, source);
      }

      // 检查是否有未保存的变化
      if (source === 'user') {
        const lastSavedContent = lastSavedContentRef.current;
        const hasChanges = !lastSavedContent || 
          JSON.stringify(currentContentsDelta.ops) !== JSON.stringify(lastSavedContent.ops);
        
        setHasUnsavedChanges(hasChanges);

        // 如果启用自动保存，安排自动保存
        if (hasChanges && enableAutoSave) {
          scheduleAutoSave();
        }
      }
    }, [onTextChange, enableAutoSave, scheduleAutoSave]);

    // 检测当前活动标题的函数
    const detectActiveHeader = useCallback((currentOutline: OutlineItem[]) => {
      const quill = editorCoreRef.current?.getQuill();
      
      if (!quill || currentOutline.length === 0) {
        setActiveHeaderIndex(-1);
        return;
      }

      const scrollTop = window.scrollY;
      let activeIndex = -1;

      // 遍历所有标题，找到最接近当前滚动位置的标题
      for (let i = 0; i < currentOutline.length; i++) {
        const item = currentOutline[i];
        if (item.index !== undefined) {
          const bounds = quill.getBounds(item.index);
          if (bounds) {
            const quillContainer = quill.root.getBoundingClientRect();
            const headerTop = quillContainer.top + bounds.top;
            
            // 如果标题在当前视口上方或刚好可见，则认为是活动状态
            if (headerTop <= 200) { // 考虑固定工具栏的高度
              activeIndex = i;
            } else {
              break;
            }
          }
        }
      }

      setActiveHeaderIndex(activeIndex);
    }, []);

    // 更新大纲数据的函数
    const updateOutline = useCallback(() => {
      const quill = editorCoreRef.current?.getQuill();
      if (quill) {
        const delta = quill.getContents();
        const outlineItems: OutlineItem[] = [];

        if (delta && delta.ops) {
          let currentText = '';
          let currentIndex = 0;
          
          for (let i = 0; i < delta.ops.length; i++) {
            const op = delta.ops[i];
            
            if (typeof op.insert === 'string') {
              if (op.insert === '\n') {
                // 遇到换行符，检查是否有header属性
                if (op.attributes && op.attributes.header && currentText.trim()) {
                  outlineItems.push({
                    level: Number(op.attributes.header),
                    text: currentText.trim(),
                    index: currentIndex - currentText.length
                  });
                }
                // 重置当前文本
                currentText = '';
                currentIndex += 1;
              } else {
                // 累积文本内容
                currentText += op.insert;
                currentIndex += op.insert.length;
              }
            } else {
              // 非文本内容（如图片、嵌入等）
              currentIndex += 1;
            }
          }
          
          // 处理最后一行没有换行符的情况
          if (currentText.trim()) {
            // 检查最后一个操作是否有header属性
            const lastOp = delta.ops[delta.ops.length - 1];
            if (lastOp && lastOp.attributes && lastOp.attributes.header) {
              outlineItems.push({
                level: Number(lastOp.attributes.header),
                text: currentText.trim(),
                index: currentIndex - currentText.length
              });
            }
          }
        }

        setOutline(outlineItems);
      }
    }, []); // 移除 detectActiveHeader 依赖，避免循环依赖

    // 滚动事件监听器
    const handleScroll = useCallback(() => {
      detectActiveHeader(outline);
    }, [detectActiveHeader, outline]);

    // 添加滚动监听器
    useEffect(() => {
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }, [handleScroll]);

    // 图片上传处理器
    const imageHandler = useCallback(() => {
      const quill = editorCoreRef.current?.getQuill();
      if (!quill) return;

      const range = quill.getSelection(true);
      if (!range) return;

      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'image/*');

      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const placeholderText = `\n[Uploading ${file.name}...]\n`;

          quill.insertText(range.index, placeholderText, 'user');
          quill.setSelection(range.index + placeholderText.length, 0);

          try {
            const uploadedFile = await uploadFile(file);
            quill.deleteText(range.index, placeholderText.length);
            quill.insertEmbed(range.index, 'image', uploadedFile.url);
            quill.setSelection(range.index + 1, 0);
          } catch (error) {
            console.error('Image upload failed:', error);
            const currentTextAroundOriginalRange = quill.getText(range.index, placeholderText.length);
            if (currentTextAroundOriginalRange === placeholderText) {
              quill.deleteText(range.index, placeholderText.length);
            }
            alert(t('image_upload_failed_message', 'Image upload failed. Please try again.'));
          }
        }
      };
      input.click();
    }, [t]);

    // 附件上传处理器
    const attachmentHandler = useCallback(() => {
      const quill = editorCoreRef.current?.getQuill();
      if (!quill) return;

      const range = quill.getSelection(true);
      if (!range) return;

      const input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', '*/*');

      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const placeholderText = `\n[Uploading file ${file.name}...]\n`;

          quill.insertText(range.index, placeholderText, 'user');
          quill.setSelection(range.index + placeholderText.length, 0);

          try {
            const uploadedFile = await uploadFile(file);
            quill.deleteText(range.index, placeholderText.length);

            quill.insertText(range.index, uploadedFile.name, {
              'link': uploadedFile.url
            });
            quill.insertText(range.index + uploadedFile.name.length, ' ', 'user');
            quill.setSelection(range.index + uploadedFile.name.length + 1, 0);
          } catch (error) {
            console.error('File attachment upload failed:', error);
            const currentTextAroundOriginalRange = quill.getText(range.index, placeholderText.length);
            if (currentTextAroundOriginalRange === placeholderText) {
              quill.deleteText(range.index, placeholderText.length);
            }
            alert(t('file_upload_failed_message', 'File upload failed. Please try again.'));
          }
        }
      };
      input.click();
    }, [t]);

    // 添加批注处理器
    const addCommentHandler = useCallback(() => {
      const quill = editorCoreRef.current?.getQuill();
      if (!quill) return;

      const range = quill.getSelection(true);
      if (!range || range.length === 0) {
        alert(t('select_text_for_comment', '请先选择要添加批注的文本'));
        return;
      }

      quill.formatText(range.index, range.length, {
        'background': '#FFF9C4'
      });

      console.log('添加批注:', quill.getText(range.index, range.length));
    }, [t]);

    // 滚动到标题位置
    const scrollToHeader = useCallback((headerText: string, level: number) => {
      const quill = editorCoreRef.current?.getQuill();
      if (!quill) return;

      const text = quill.getText();
      const textLength = text.length;

      for (let i = 0; i < textLength; i++) {
        const pos = text.indexOf(headerText, i);
        if (pos === -1) break;

        const formats = quill.getFormat(pos, headerText.length);

        if (formats.header === level) {
          quill.setSelection(pos, 0);

          // 使用页面级别的滚动
          const bounds = quill.getBounds(pos);
          if (bounds) {
            // 计算相对于页面顶部的偏移
            const quillContainer = quill.root.getBoundingClientRect();
            const offsetTop = quillContainer.top + bounds.top + window.scrollY;
            
            // 平滑滚动到目标位置，考虑固定工具栏的高度
            window.scrollTo({
              top: Math.max(0, offsetTop - 180), // 留出180px的缓冲空间（工具栏高度+额外空间）
              behavior: 'smooth'
            });
          }
          break;
        }

        i = pos + 1;
      }
    }, []);

    // 扩展区域Tab变更处理
    const handleExtensionTabChange = useCallback((tabId: string) => {
      setCurrentExtensionTab(tabId);
      if (onExtensionAreaTabChange) {
        onExtensionAreaTabChange(tabId);
      }
    }, [onExtensionAreaTabChange]);

    // 编辑器准备完成回调
    const handleEditorReady = useCallback((quill: Quill) => {
      // 设置ref引用
      if (typeof ref === 'function') {
        ref(quill);
      } else if (ref) {
        ref.current = quill;
      }

      // 保存初始内容作为最后保存的内容
      const initialContent = quill.getContents();
      lastSavedContentRef.current = initialContent;

      // 初始更新大纲
      updateOutline();

      // 监听文本变化以更新大纲
      quill.on('text-change', updateOutline);
    }, [ref, updateOutline]);

    // 处理扩展区域显示状态
    useEffect(() => {
      setIsExtensionAreaOpen(showExtensionArea);
    }, [showExtensionArea]);

    // 更新当前扩展区域Tab
    useEffect(() => {
      if (extensionAreaTabs.length > 0 && !currentExtensionTab) {
        setCurrentExtensionTab(extensionAreaTabs[0].id);
      }
    }, [extensionAreaTabs, currentExtensionTab]);

    // 组件卸载时清理定时器
    useEffect(() => {
      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }, []);

    // 使用外部传入的保存状态或内部保存状态
    const effectiveIsSaving = externalIsSaving || isSaving;

    return (
      <Box
        className={className}
        sx={{
          position: 'relative',
          minHeight: '100vh', // 改为minHeight，让内容决定高度
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.default,
        }}
      >
        {/* 工具栏 - 使用fixed定位悬浮在顶部 */}
        <Box sx={{ 
          position: 'fixed',
          top: 64, // 在AppBar下方
          left: 0,
          right: 0,
          zIndex: 1100,
          backgroundColor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          <EditorToolbar
            breadcrumbs={breadcrumbs}
            actions={actions}
            contextInfo={contextInfo}
            showContextPanel={showContextPanel}
            onToggleContextPanel={() => setShowContextPanel(!showContextPanel)}
            onAddComment={addCommentHandler}
            remoteCursors={remoteCursors}
            onSave={handleSave}
            isSaving={effectiveIsSaving}
            showSaveButton={showSaveButton}
            saveButtonText={saveButtonText}
          />
        </Box>

        {/* 主内容区域 - 使用正常文档流，添加顶部和底部padding */}
        <Box
          data-main-content-area="true"
          sx={{
            flex: 1,
            position: 'relative',
            pt: '120px', // 为固定工具栏留出空间
            pb: isExtensionAreaOpen ? `${extensionAreaHeight + 20}px` : '20px', // 为扩展区域留出空间
            display: 'flex',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 120px)', // 确保最小高度
          }}
        >
          {/* 左侧大纲面板 - 使用fixed定位悬浮 */}
          {isOutlineOpen && (
            <Box
              sx={{
                position: 'fixed',
                left: 0,
                top: 120, // 在工具栏下方
                bottom: isExtensionAreaOpen ? `${extensionAreaHeight}px` : 0,
                width: 280,
                zIndex: 1000,
                backgroundColor: theme.palette.background.paper,
                boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
                display: { xs: 'none', md: 'block' },
                overflowY: 'auto',
                overflowX: 'hidden',
                '& > *': {
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                },
              }}
            >
              <OutlinePanel
                isOpen={isOutlineOpen}
                outline={outline}
                onClose={() => setIsOutlineOpen(false)}
                onScrollToHeader={scrollToHeader}
                activeHeaderIndex={activeHeaderIndex}
              />
            </Box>
          )}

          {/* 左侧大纲按钮 */}
          {!isOutlineOpen && (
            <Paper
              elevation={4}
              onClick={() => setIsOutlineOpen(true)}
              sx={{
                position: 'fixed',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                zIndex: 50,
                cursor: 'pointer',
                bgcolor: 'background.paper',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                p: '12px 8px',
                borderRadius: 2,
                fontSize: '0.875rem',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {t('outline', '大纲')}
            </Paper>
          )}

          {/* 中心编辑器区域 */}
          <Box
            sx={{
              width: { xs: '100%', sm: '800px' },
              maxWidth: { xs: 'calc(100% - 32px)', sm: '800px' },
              display: 'flex',
              flexDirection: 'column',
              px: 2,
              py: 3,
            }}
          >
            <EditorCore
              ref={editorCoreRef}
              containerRef={containerRef}
              defaultValue={defaultValue}
              initialContentForDocumentView={initialContentForDocumentView}
              placeholder={placeholder}
              readOnly={readOnly}
              imageHandler={imageHandler}
              attachmentHandler={attachmentHandler}
              onReady={handleEditorReady}
            />
          </Box>

          {/* 右侧上下文面板 - 使用fixed定位悬浮 */}
          {contextInfo && showContextPanel && !isMobile && (
            <Box
              sx={{
                position: 'fixed',
                right: 16,
                top: 120,
                width: 320,
                maxHeight: 'calc(100vh - 140px)',
                zIndex: 1000,
                overflowY: 'auto',
                overflowX: 'hidden',
                '& > *': {
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                },
              }}
            >
              <ContextPanel
                contextInfo={contextInfo}
                showPanel={showContextPanel}
                onClose={() => setShowContextPanel(false)}
              />
            </Box>
          )}

          {/* 移动端上下文面板 */}
          {contextInfo && showContextPanel && isMobile && (
            <Box
              sx={{
                position: 'fixed',
                top: 120,
                left: 16,
                right: 16,
                zIndex: 1200,
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <ContextPanel
                contextInfo={contextInfo}
                showPanel={showContextPanel}
                onClose={() => setShowContextPanel(false)}
              />
            </Box>
          )}
        </Box>

        {/* 扩展区域 - 使用fixed定位悬浮在底部 */}
        <Box sx={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1050,
        }}>
          <ExtensionArea
            tabs={extensionAreaTabs}
            content={extensionAreaContent}
            isOpen={isExtensionAreaOpen}
            height={extensionAreaHeight}
            currentTabId={currentExtensionTab}
            onTabChange={handleExtensionTabChange}
            onToggle={() => setIsExtensionAreaOpen(!isExtensionAreaOpen)}
            onHeightChange={setExtensionAreaHeight}
          />
        </Box>

        {/* 协作管理器 */}
        {documentId && userId && surreal && (
          <CollaborationManager
            key={`collaboration-${documentId}-${userId}`}
            quillRef={editorCoreRef}
            config={{
              documentId,
              userId,
              userName,
              surreal,
            }}
            onTextChange={handleTextChange}
            onSelectionChange={onSelectionChange}
            onRemoteCursorsChange={setRemoteCursors}
          />
        )}
      </Box>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor; 