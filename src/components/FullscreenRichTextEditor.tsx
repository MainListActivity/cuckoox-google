import React, { useState, useCallback } from 'react';
import { Portal } from '@mui/material';
import RichTextEditor, { QuillDelta } from './RichTextEditor';

// 从RichTextEditor中提取props类型
interface RichTextEditorProps {
  value: QuillDelta | string;
  onChange?: (newDelta: QuillDelta) => void;
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  documentId?: string;
  userId?: string;
  userName?: string;
  contextInfo?: {
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
  };
  enableFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

interface FullscreenRichTextEditorProps extends Omit<RichTextEditorProps, 'enableFullscreen' | 'onFullscreenChange'> {
  // Additional props for fullscreen behavior
  initialFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

/**
 * 全屏富文本编辑器包装组件
 * 这个组件确保富文本编辑器在全屏时能够正确占满整个页面
 */
const FullscreenRichTextEditor: React.FC<FullscreenRichTextEditorProps> = ({
  initialFullscreen = false,
  onFullscreenChange,
  ...props
}) => {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);

  const handleFullscreenChange = useCallback((fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    
    // 通知父组件全屏状态变化
    if (onFullscreenChange) {
      onFullscreenChange(fullscreen);
    }

    // 处理全屏时的页面样式
    if (fullscreen) {
      // 隐藏页面滚动条，防止滚动
      document.body.style.overflow = 'hidden';
      // 确保编辑器能够占满整个页面
      document.documentElement.style.height = '100%';
      document.body.style.height = '100%';
    } else {
      // 恢复正常的页面滚动和样式
      document.body.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.height = '';
    }
  }, [onFullscreenChange]);

  // 在组件卸载时恢复正常样式
  React.useEffect(() => {
    return () => {
      if (isFullscreen) {
        document.body.style.overflow = '';
        document.documentElement.style.height = '';
        document.body.style.height = '';
      }
    };
  }, [isFullscreen]);

  if (isFullscreen) {
    // 全屏模式：使用Portal渲染到body下，确保完全覆盖页面
    return (
      <Portal>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'var(--mui-palette-background-default)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <RichTextEditor
            {...props}
            enableFullscreen={true}
            onFullscreenChange={handleFullscreenChange}
          />
        </div>
      </Portal>
    );
  }

  // 正常模式：在原始位置渲染
  return (
    <RichTextEditor
      {...props}
      enableFullscreen={true}
      onFullscreenChange={handleFullscreenChange}
    />
  );
};

export default FullscreenRichTextEditor;
export type { FullscreenRichTextEditorProps }; 