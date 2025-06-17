# 富文本编辑器 API 文档

## 概览

富文本编辑器是一个基于 QuillJS 2.0.2 的 React 组件，支持实时协作、文件上传、自动保存等高级功能。

## 主要组件

### RichTextEditor

主编辑器组件，包含完整的编辑功能。

```typescript
import RichTextEditor, { QuillDelta } from '@/src/components/RichTextEditor';

<RichTextEditor
  defaultValue={content}
  onTextChange={(currentContents, delta, source) => {
    // 处理内容变化
  }}
  placeholder="请输入内容..."
  documentId="doc-123"
  userId="user-456"
  userName="张三"
  contextInfo={{
    title: "案件详情",
    subtitle: "破产清算案",
    details: [
      { label: "案件编号", value: "2024-001" },
      { label: "管理人", value: "张三律师事务所" }
    ]
  }}
  enableAutoSave={true}
  autoSaveInterval={30000}
  showSaveButton={true}
/>
```

#### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultValue` | `QuillDelta \| string` | - | 初始内容 |
| `onTextChange` | `(currentContents: QuillDelta, delta: QuillDelta, source: string) => void` | - | 内容变化回调 |
| `onSelectionChange` | `(range: QuillRange \| null, oldRange: QuillRange \| null, source: string) => void` | - | 选择变化回调 |
| `placeholder` | `string` | '请输入内容...' | 占位符文本 |
| `readOnly` | `boolean` | `false` | 是否只读 |
| `documentId` | `string` | - | 文档ID（协作编辑必需） |
| `userId` | `string` | - | 用户ID（协作编辑必需） |
| `userName` | `string` | - | 用户名（协作编辑必需） |
| `contextInfo` | `ContextInfo` | - | 上下文信息 |
| `onSave` | `(content: QuillDelta) => Promise<void>` | - | 自定义保存函数 |
| `enableAutoSave` | `boolean` | `false` | 是否启用自动保存 |
| `autoSaveInterval` | `number` | `30000` | 自动保存间隔（毫秒） |
| `showSaveButton` | `boolean` | `true` | 是否显示保存按钮 |
| `extensionAreaTabs` | `ExtensionAreaTab[]` | `[]` | 扩展区域标签页 |
| `showExtensionArea` | `boolean` | `false` | 是否显示扩展区域 |

### FullscreenRichTextEditor

全屏编辑器组件，支持全屏模式切换。

```typescript
import FullscreenRichTextEditor from '@/src/components/FullscreenRichTextEditor';

<FullscreenRichTextEditor
  value={content}
  onChange={setContent}
  initialFullscreen={false}
  onFullscreenChange={(isFullscreen) => {
    console.log('全屏状态:', isFullscreen);
  }}
/>
```

## 类型定义

### QuillDelta

```typescript
type QuillDelta = {
  ops: Array<{
    insert?: string | object;
    delete?: number;
    retain?: number;
    attributes?: object;
  }>;
};
```

### ContextInfo

```typescript
interface ContextInfo {
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
```

### ExtensionAreaTab

```typescript
interface ExtensionAreaTab {
  id: string;
  label: string;
  icon?: string;
}
```

### ExtensionAreaContent

```typescript
interface ExtensionAreaContent {
  type: 'case' | 'claim' | 'law' | 'related_docs';
  data: any;
  renderContent?: () => React.ReactNode;
}
```

## 高级功能

### 协作编辑

编辑器支持多用户实时协作编辑，基于 SurrealDB 实现。

```typescript
<RichTextEditor
  documentId="shared-doc-123"
  userId="user-001"
  userName="张三"
  onTextChange={(currentContents, delta, source) => {
    if (source === 'user') {
      // 用户编辑
    } else if (source === 'api') {
      // 远程同步
    }
  }}
/>
```

#### 协作特性

- **实时同步**: 自动同步所有用户的编辑操作
- **冲突解决**: 自动处理多用户同时编辑的冲突
- **远程光标**: 显示其他用户的光标位置
- **在线状态**: 显示协作用户的在线状态

### 文件上传

支持图片和附件上传到 MinIO 存储。

```typescript
// 图片上传会自动集成到工具栏
// 上传的图片会自动插入到编辑器中
<RichTextEditor
  documentId="doc-with-files"
  // 文件上传会自动处理
/>
```

### 自动保存

支持定时自动保存功能。

```typescript
<RichTextEditor
  enableAutoSave={true}
  autoSaveInterval={30000} // 30秒自动保存
  onSave={async (content) => {
    // 自定义保存逻辑
    await saveToServer(content);
  }}
/>
```

## 使用场景

### 债权审核页面

```typescript
<RichTextEditor
  defaultValue={claimContent}
  onTextChange={handleClaimContentChange}
  contextInfo={{
    title: "债权审核",
    subtitle: `债权人：${creditorName}`,
    details: [
      { label: "申报金额", value: formatCurrency(amount) },
      { label: "债权性质", value: claimType },
    ]
  }}
  readOnly={currentUser.role !== 'reviewer'}
/>
```

### 会议纪要

```typescript
<RichTextEditor
  defaultValue={meetingMinutes}
  onTextChange={handleMinutesChange}
  contextInfo={{
    title: "会议纪要",
    subtitle: meetingTitle,
    details: [
      { label: "会议时间", value: formatDate(meetingTime) },
      { label: "参会人数", value: `${attendeeCount}人` },
    ]
  }}
  enableAutoSave={true}
  documentId={`meeting-${meetingId}`}
  userId={currentUser.id}
  userName={currentUser.name}
/>
```

### 案件状态说明

```typescript
<RichTextEditor
  defaultValue={caseDescription}
  onTextChange={handleDescriptionChange}
  placeholder="请输入案件状态说明..."
  contextInfo={{
    title: "案件状态变更",
    subtitle: `${caseNumber} - ${newStatus}`,
    details: [
      { label: "变更类型", value: changeType },
      { label: "变更时间", value: formatDateTime(changeTime) },
    ]
  }}
/>
```

## 样式定制

编辑器会自动适配项目的主题系统（深色/亮色模式）。

### 自定义样式

```css
/* 自定义编辑器样式 */
.ql-editor {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

.ql-toolbar {
  border-radius: 8px 8px 0 0;
  border-color: var(--mui-palette-divider);
}
```

## 测试支持

组件提供完整的测试支持。

```typescript
// Mock 编辑器用于测试
vi.mock('@/src/components/RichTextEditor', () => ({
  default: vi.fn(({ onChange, value }) => {
    return (
      <div data-testid="rich-text-editor">
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value)}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    );
  }),
}));
```

## 错误处理

组件内置错误边界和异常处理。

```typescript
<RichTextEditor
  onError={(error, errorInfo) => {
    console.error('编辑器错误:', error);
    // 发送错误报告
    reportError(error, errorInfo);
  }}
/>
```

## 性能优化

- **懒加载**: 大文档支持虚拟滚动
- **防抖**: 自动保存和实时同步使用防抖机制
- **内存管理**: 自动清理事件监听器和定时器
- **增量更新**: 协作编辑仅传输变更部分

## 浏览器兼容性

- Chrome 80+
- Firefox 78+
- Safari 14+
- Edge 80+

## 移动端支持

- iOS Safari 14+
- Android Chrome 80+
- 响应式设计，自动适配移动端
- 触摸优化的工具栏和交互 