# 富文本编辑器组件架构重构

## 概述

富文本编辑器已经完成了架构重构，从一个1500多行的巨型组件拆分为多个职责单一、可复用的子组件。这大大提高了代码的可维护性、可扩展性和测试性。

## 架构设计

### 组件层次结构

```
RichTextEditor (主组件)
├── EditorToolbar (工具栏)
├── OutlinePanel (大纲面板)
├── ContextPanel (上下文面板)
├── ExtensionArea (扩展区域)
├── EditorCore (编辑器核心)
└── CollaborationManager (协作管理器)
```

### 组件职责分离

#### 1. **RichTextEditor** - 主组件
- **职责**: 组合子组件，状态管理，事件协调
- **文件**: `src/components/RichTextEditor/RichTextEditor.tsx`
- **主要功能**:
  - 管理编辑器整体状态
  - 协调子组件之间的通信
  - 处理文件上传逻辑
  - 管理大纲数据更新

#### 2. **EditorToolbar** - 工具栏组件
- **职责**: 显示编辑工具和文档信息
- **文件**: `src/components/RichTextEditor/EditorToolbar.tsx`
- **主要功能**:
  - QuillJS工具栏容器
  - 文档标题和面包屑导航
  - 协作用户指示器
  - 批注和上下文面板切换按钮

#### 3. **OutlinePanel** - 大纲面板组件
- **职责**: 显示文档大纲，支持导航
- **文件**: `src/components/RichTextEditor/OutlinePanel.tsx`
- **主要功能**:
  - 显示文档标题层次结构
  - 点击跳转到对应标题位置
  - 支持开关显示/隐藏

#### 4. **ContextPanel** - 上下文面板组件
- **职责**: 显示与当前文档相关的上下文信息
- **文件**: `src/components/RichTextEditor/ContextPanel.tsx`
- **主要功能**:
  - 显示案件、债权等相关信息
  - 支持自定义信息展示
  - 响应式设计，移动端友好

#### 5. **ExtensionArea** - 扩展区域组件
- **职责**: 提供可扩展的底部区域
- **文件**: `src/components/RichTextEditor/ExtensionArea.tsx`
- **主要功能**:
  - 多标签页支持
  - 高度可调节
  - 自定义内容渲染
  - 折叠/展开功能

#### 6. **EditorCore** - 编辑器核心组件
- **职责**: QuillJS编辑器的初始化和基本功能
- **文件**: `src/components/RichTextEditor/EditorCore.tsx`
- **主要功能**:
  - QuillJS编辑器初始化
  - 提供编辑器操作API
  - 处理只读状态和占位符
  - 独立滚动和样式管理

#### 7. **CollaborationManager** - 协作管理器组件
- **职责**: 处理实时协作编辑功能
- **文件**: `src/components/RichTextEditor/CollaborationManager.tsx`
- **主要功能**:
  - 实时文档同步
  - 远程光标显示
  - SurrealDB集成
  - 冲突解决

## 使用方法

### 基本使用

```tsx
import { RichTextEditor } from '@/src/components/RichTextEditor';

const MyEditor = () => {
  const [content, setContent] = useState(null);
  
  return (
    <RichTextEditor
      defaultValue={content}
      onTextChange={(currentContents, delta, source) => {
        setContent(currentContents);
      }}
      placeholder="请输入内容..."
      contextInfo={{
        title: "案件详情",
        subtitle: "破产清算案",
        details: [
          { label: "案件编号", value: "2024-001" },
          { label: "管理人", value: "张三律师事务所" }
        ]
      }}
    />
  );
};
```

### 扩展区域使用

```tsx
const editorWithExtension = (
  <RichTextEditor
    // ... 其他props
    extensionAreaTabs={[
      { id: 'case', label: '案件信息', icon: mdiGavel },
      { id: 'claim', label: '债权信息', icon: mdiCurrencyUsd }
    ]}
    extensionAreaContent={{
      type: 'case',
      data: caseData,
      renderContent: () => <CustomCaseView data={caseData} />
    }}
    showExtensionArea={true}
    onExtensionAreaTabChange={(tabId) => {
      // 处理标签页切换
    }}
  />
);
```

### 协作编辑

```tsx
const collaborativeEditor = (
  <RichTextEditor
    // ... 其他props
    documentId="doc-123"
    userId="user-456"
    userName="张三"
    onTextChange={(currentContents, delta, source) => {
      // 处理文本变化
    }}
    onSelectionChange={(range, oldRange, source) => {
      // 处理选择变化
    }}
  />
);
```

## 优势与改进

### 🎯 架构优势

1. **单一职责原则**: 每个组件只负责一个特定功能
2. **高内聚低耦合**: 组件之间通过props和回调进行通信
3. **易于测试**: 每个子组件可以独立测试
4. **便于维护**: 修改特定功能只需要关注对应组件
5. **易于扩展**: 新功能可以通过新增组件或扩展现有组件实现

### 🔧 技术改进

1. **TypeScript严格类型**: 完整的类型定义，减少运行时错误
2. **性能优化**: 避免不必要的重渲染，合理使用React.memo
3. **代码复用**: 通用逻辑抽取为独立组件
4. **错误边界**: 各组件有独立的错误处理
5. **内存管理**: 正确的事件监听器清理

### 📝 代码质量

- **可读性**: 代码结构清晰，易于理解
- **可维护性**: 模块化设计，便于修改和调试  
- **可扩展性**: 新功能可以无缝集成
- **可测试性**: 每个组件都可以独立进行单元测试

## 测试策略

### 单元测试

每个子组件都应该有对应的单元测试：

```bash
# 运行特定组件测试
bunx vitest --run tests/unit/components/RichTextEditor/EditorToolbar.test.tsx
bunx vitest --run tests/unit/components/RichTextEditor/OutlinePanel.test.tsx
bunx vitest --run tests/unit/components/RichTextEditor/ContextPanel.test.tsx
```

### 集成测试

测试组件之间的协作：

```bash
# 运行集成测试
bunx vitest --run tests/unit/components/RichTextEditor/RichTextEditor.test.tsx
```

## 迁移指南

### 从旧版本迁移

1. **导入路径更新**:
```tsx
// 旧版本
import RichTextEditor from '@/src/components/RichTextEditor';

// 新版本
import { RichTextEditor } from '@/src/components/RichTextEditor';
```

2. **Props调整**:
```tsx
// 某些内部使用的props已经被重命名或移除
// 请参考类型定义文件进行调整
```

3. **Ref使用**:
```tsx
// Ref现在指向Quill实例，使用方式保持不变
const editorRef = useRef<Quill>(null);
```

## 后续规划

1. **性能优化**: 继续优化大文档的渲染性能
2. **功能扩展**: 添加更多协作功能，如评论系统
3. **移动端优化**: 提升移动设备上的用户体验
4. **插件系统**: 开发插件架构，支持第三方扩展

## 贡献指南

1. 新增功能时，请遵循单一职责原则
2. 确保所有组件都有对应的TypeScript类型定义
3. 编写单元测试覆盖新功能
4. 更新相关文档
5. 提交前运行ESLint和测试检查

---

> 这次重构大大提升了富文本编辑器的代码质量和可维护性，为后续功能开发奠定了坚实的基础。 