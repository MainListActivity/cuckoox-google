import type { Delta as QuillDeltaType, Range as QuillRange } from 'quill/core';
import Quill from 'quill';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

// 导出Delta类型
export type QuillDelta = QuillDeltaType;

// 大纲项接口
export interface OutlineItem {
  level: number;
  text: string;
  index?: number; // 在文档中的位置索引
}

// 评论接口
export interface Comment {
  id: string;
  author: string;
  content: string;
  time: string;
}

// 案件信息接口（用于文档视图）
export interface CaseInfoForDocView {
  caseNumber: string;
  responsiblePerson: string;
}

// 上下文信息接口
export interface ContextInfo {
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

// 扩展区域标签页接口
export interface ExtensionAreaTab {
  id: string;
  label: string;
  icon?: string;
}

// 扩展区域内容接口
export interface ExtensionAreaContent {
  type: 'case' | 'claim' | 'law' | 'related_docs';
  data: Record<string, unknown>;
  renderContent?: () => React.ReactNode;
}

// 远程光标接口
export interface RemoteCursor {
  userId: string;
  userName?: string;
  range: QuillRange;
  ts: string;
  color: string;
}

// 协作编辑相关接口
export interface CollaborationConfig {
  documentId?: string;
  userId?: string;
  userName?: string;
  surreal?: SurrealWorkerAPI;
}

// 文件上传接口
export interface FileUploadHandler {
  (file: File): Promise<{ url: string; name: string }>;
}

// 主要Props接口
export interface RichTextEditorProps {
  defaultValue?: QuillDelta | string;
  value?: QuillDelta | string; // 支持受控组件模式
  onChange?: (newDelta: QuillDelta) => void; // 支持受控组件模式
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  onSelectionChange?: (range: QuillRange | null, oldRange: QuillRange | null, source: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  documentId?: string;
  userId?: string;
  userName?: string;
  contextInfo?: ContextInfo;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  
  // 全屏相关props
  enableFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;

  // 保存相关功能
  onSave?: (content: QuillDelta) => Promise<void>;
  isSaving?: boolean;
  enableAutoSave?: boolean;
  autoSaveInterval?: number; // 毫秒
  showSaveButton?: boolean;
  saveButtonText?: string;

  // 文档视图模式
  viewMode?: 'standard' | 'document';
  initialContentForDocumentView?: QuillDelta;
  comments?: Comment[];
  caseInfoForDocumentView?: CaseInfoForDocView;

  // 扩展区域
  extensionAreaTabs?: ExtensionAreaTab[];
  extensionAreaContent?: ExtensionAreaContent;
  onExtensionAreaTabChange?: (tabId: string) => void;
  showExtensionArea?: boolean;
}

// 工具栏Props
export interface EditorToolbarProps {
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  contextInfo?: ContextInfo;
  showContextPanel: boolean;
  onToggleContextPanel: () => void;
  onAddComment: () => void;
  remoteCursors: Record<string, RemoteCursor>;
  
  // 保存相关props
  onSave?: () => void;
  isSaving?: boolean;
  showSaveButton?: boolean;
  saveButtonText?: string;
}

// 大纲面板Props
export interface OutlinePanelProps {
  isOpen: boolean;
  outline: OutlineItem[];
  onClose: () => void;
  onScrollToHeader: (headerText: string, level: number) => void;
  activeHeaderIndex?: number;
}

// 上下文面板Props
export interface ContextPanelProps {
  contextInfo?: ContextInfo;
  showPanel: boolean;
  onClose: () => void;
}

// 扩展区域Props
export interface ExtensionAreaProps {
  tabs: ExtensionAreaTab[];
  content?: ExtensionAreaContent;
  isOpen: boolean;
  height: number;
  currentTabId: string | null;
  onTabChange: (tabId: string) => void;
  onToggle: () => void;
  onHeightChange: (height: number) => void;
}

// 编辑器核心Props
export interface EditorCoreProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultValue?: QuillDelta | string;
  initialContentForDocumentView?: QuillDelta;
  placeholder?: string;
  readOnly?: boolean;
  imageHandler: () => void;
  attachmentHandler: () => void;
  onReady?: (quill: Quill) => void;
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
}

// 协作管理器Props
export interface CollaborationManagerProps {
  quillRef: React.RefObject<{ getQuill: () => Quill | null } | null>;
  config: CollaborationConfig;
  onTextChange?: (currentContentsDelta: QuillDelta, changeDelta: QuillDelta, source: string) => void;
  onSelectionChange?: (range: QuillRange | null, oldRange: QuillRange | null, source: string) => void;
  onRemoteCursorsChange: (cursors: Record<string, RemoteCursor>) => void;
} 