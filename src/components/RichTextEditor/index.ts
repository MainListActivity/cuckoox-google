// 导出主组件
import { default as RichTextEditor } from './RichTextEditor';

export default RichTextEditor;
// 导出子组件
export { default as EditorToolbar } from './EditorToolbar';
export { default as OutlinePanel } from './OutlinePanel';
export { default as ContextPanel } from './ContextPanel';
export { default as ExtensionArea } from './ExtensionArea';
export { default as EditorCore } from './EditorCore';
export { default as CollaborationManager } from './CollaborationManager';

// 导出类型
export type {
  QuillDelta,
  OutlineItem,
  Comment,
  CaseInfoForDocView,
  ContextInfo,
  ExtensionAreaTab,
  ExtensionAreaContent,
  RemoteCursor,
  CollaborationConfig,
  FileUploadHandler,
  RichTextEditorProps,
  EditorToolbarProps,
  OutlinePanelProps,
  ContextPanelProps,
  ExtensionAreaProps,
  EditorCoreProps,
  CollaborationManagerProps,
} from './types';

// 导出EditorCore的ref类型
export type { EditorCoreRef } from './EditorCore'; 