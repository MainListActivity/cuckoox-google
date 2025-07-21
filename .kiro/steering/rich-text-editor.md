# 富文本编辑器开发规范

## 编辑器概述

基于Quill.js v2构建的协作式富文本编辑器，支持实时协作、文档版本控制、多媒体内容管理，主要用于破产案件的立案材料、债权附件材料等法律文档编辑。

## 核心组件架构

### RichTextEditor - 主编辑器组件
- 基于Quill.js v2的核心编辑器封装
- 支持工具栏自定义和扩展功能
- 集成文件上传和多媒体内容管理

### EditorCore - 编辑器核心
- Quill实例管理和配置
- 内容变更监听和同步
- 格式化和样式控制

### EditorToolbar - 工具栏组件
- 可配置的工具栏按钮
- 自定义格式化选项
- 文件上传和插入功能

### CollaborationManager - 协作管理器
- 实时协作功能实现
- 冲突检测和解决
- 用户光标和选择同步

## 功能特性

### 文档编辑功能
- 富文本格式化：字体、颜色、对齐、列表等
- 表格插入和编辑
- 图片上传和预览（存储到MinIO）
- 文件附件管理（PDF、Word、Excel等）
- 链接插入和管理

### 协作功能
- 实时多用户编辑
- 用户光标位置显示
- 变更历史记录
- 冲突自动解决

### 文档管理
- 自动保存和版本控制
- 文档导出（PDF、Word等格式）
- 文档模板支持
- 权限控制（只读、编辑、评论）

## 开发规范

### 组件使用
```typescript
import { RichTextEditor } from '@/src/components/RichTextEditor';

// 基础使用
<RichTextEditor
  documentId="case_filing_material_123"
  initialContent={documentContent}
  onContentChange={handleContentChange}
  readOnly={!hasEditPermission}
/>

// 协作模式
<RichTextEditor
  documentId="claim_attachment_456"
  collaborationEnabled={true}
  showUserCursors={true}
  onCollaboratorJoin={handleCollaboratorJoin}
/>
```

### 文件上传集成
```typescript
// 图片上传到MinIO
const handleImageUpload = async (file: File) => {
  const uploadResult = await fileUploadService.uploadImage(file);
  return uploadResult.url;
};

// 附件文件上传
const handleFileUpload = async (file: File) => {
  const uploadResult = await fileUploadService.uploadFile(file);
  return {
    url: uploadResult.url,
    filename: file.name,
    size: file.size,
    type: file.type
  };
};
```

### 内容同步
```typescript
// 与SurrealDB实时同步
const handleContentChange = async (content: any, delta: any) => {
  // 保存到数据库
  await documentService.updateContent(documentId, content);
  
  // 广播变更给其他协作者
  await collaborationService.broadcastChange(documentId, delta);
};
```

## 数据存储结构

### 文档表结构
```sql
-- 文档基本信息
DEFINE TABLE document SCHEMAFULL;
DEFINE FIELD title ON document TYPE string;
DEFINE FIELD content ON document TYPE object; -- Quill Delta格式
DEFINE FIELD content_html ON document TYPE string; -- HTML格式
DEFINE FIELD document_type ON document TYPE string; -- 文档类型
DEFINE FIELD case_id ON document TYPE option<record<case>>;
DEFINE FIELD created_by ON document TYPE record<user>;
DEFINE FIELD created_at ON document TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON document TYPE datetime VALUE time::now();

-- 文档版本历史
DEFINE TABLE document_version SCHEMAFULL;
DEFINE FIELD document_id ON document_version TYPE record<document>;
DEFINE FIELD version_number ON document_version TYPE int;
DEFINE FIELD content ON document_version TYPE object;
DEFINE FIELD changes ON document_version TYPE array; -- Delta变更记录
DEFINE FIELD created_by ON document_version TYPE record<user>;
DEFINE FIELD created_at ON document_version TYPE datetime DEFAULT time::now();
```

### 协作状态管理
```sql
-- 协作会话
DEFINE TABLE collaboration_session SCHEMAFULL;
DEFINE FIELD document_id ON collaboration_session TYPE record<document>;
DEFINE FIELD user_id ON collaboration_session TYPE record<user>;
DEFINE FIELD cursor_position ON collaboration_session TYPE object;
DEFINE FIELD selection_range ON collaboration_session TYPE object;
DEFINE FIELD last_activity ON collaboration_session TYPE datetime VALUE time::now();
```

## 样式和主题

### CSS自定义
```css
/* Quill编辑器主题定制 */
.ql-editor {
  font-family: var(--font-family-primary);
  font-size: 14px;
  line-height: 1.6;
}

/* 工具栏样式 */
.ql-toolbar {
  border: 1px solid var(--color-border-light);
  border-radius: 4px 4px 0 0;
}

/* 协作用户光标 */
.collaboration-cursor {
  position: absolute;
  border-left: 2px solid var(--user-color);
  height: 1.2em;
}
```

### 响应式设计
- 支持桌面端全功能编辑
- 移动端优化的工具栏布局
- 触摸设备的手势支持

## 性能优化

### 内容加载优化
- 大文档分页加载
- 图片懒加载和压缩
- 增量内容同步

### 协作性能
- 防抖处理频繁变更
- 批量发送协作消息
- 智能冲突检测

### 内存管理
- 及时清理不活跃的协作会话
- 限制版本历史数量
- 图片缓存管理

## 安全考虑

### 内容安全
- XSS防护：内容过滤和转义
- 文件上传类型限制
- 文件大小限制

### 权限控制
- 文档访问权限验证
- 编辑权限实时检查
- 敏感操作审计日志

## 测试策略

### 单元测试
- 编辑器组件功能测试
- 内容格式化测试
- 文件上传功能测试

### 集成测试
- 协作功能端到端测试
- 数据库同步测试
- 权限控制测试

### 性能测试
- 大文档加载性能
- 多用户协作性能
- 内存泄漏检测

## 最佳实践

### 内容管理
- 定期备份重要文档
- 合理设置自动保存间隔
- 版本历史清理策略

### 用户体验
- 提供丰富的格式化选项
- 直观的协作状态显示
- 友好的错误提示和恢复

### 扩展性
- 插件化的工具栏扩展
- 自定义格式支持
- 第三方服务集成接口