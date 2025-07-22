# PDF解析器菜单配置指南

## 访问PDF解析器页面

由于PDF解析器已成功集成到系统中，你可以通过以下方式访问：

### 1. 直接访问URL
直接在浏览器地址栏输入：
```
http://localhost:3000/pdf-parser
```

### 2. 添加到系统菜单（推荐）

要将PDF解析器添加到左侧导航菜单，需要在SurrealDB数据库中添加菜单配置：

#### 数据库配置语句

```sql
-- 添加PDF解析器菜单项
INSERT INTO menu_metadata {
    menu_id: "pdf-parser",
    path: "/pdf-parser", 
    label_key: "menu.pdfParser",
    icon_name: "mdiFileDocumentSearchOutline",
    display_order: 60,
    is_active: true,
    created_at: time::now(),
    updated_at: time::now()
};

-- 为管理员角色添加访问权限
RELATE role:admin->can_access_menu->menu_metadata:pdf-parser SET {
    can_access: true,
    created_at: time::now()
};

-- 为案件相关角色添加访问权限（可选）
RELATE role:case_manager->can_access_menu->menu_metadata:pdf-parser SET {
    can_access: true,
    created_at: time::now()
};
```

#### 添加多语言标签（可选）

如果系统使用了国际化，还需要添加对应的语言标签：

```sql
-- 添加中文标签
INSERT INTO i18n_labels {
    key: "menu.pdfParser",
    language: "zh-CN",
    value: "PDF智能解析",
    created_at: time::now()
};

-- 添加英文标签
INSERT INTO i18n_labels {
    key: "menu.pdfParser", 
    language: "en-US",
    value: "PDF Parser",
    created_at: time::now()
};
```

## 功能特性

PDF解析器页面包含以下功能：

### 核心功能
- ✅ PDF文档拖拽上传（支持最大50MB）
- ✅ 批量上传管理（最多10个文件）
- ✅ PDF在线预览和页面导航
- ✅ 智能解析结果展示
- ✅ 字段编辑和修正功能
- ✅ 置信度可视化显示
- ✅ 响应式设计（桌面端+移动端）

### 使用流程
1. **上传PDF**：拖拽或选择PDF文件上传
2. **等待解析**：系统自动解析文档内容
3. **查看结果**：在左侧查看结构化解析结果
4. **预览对比**：在右侧预览PDF，点击字段高亮对应区域
5. **编辑修正**：对识别错误的字段进行人工修正
6. **保存使用**：将解析结果用于后续业务流程

## 技术规格

### 前端技术栈
- React 19 + TypeScript
- Material-UI v7
- react-pdf (PDF渲染)
- react-dropzone (文件上传)
- TanStack Query (状态管理)
- react-hook-form + zod (表单验证)

### 后端集成
- RESTful API接口 (`/api/pdf/*`)
- 文件上传和存储
- AI/ML解析服务集成
- 数据库字段存储

### 权限控制
- 基于现有权限系统
- 支持角色级访问控制
- 操作权限细分

## 故障排除

### 如果菜单未显示
1. 检查数据库中是否已添加菜单配置
2. 确认当前用户角色有访问权限
3. 检查浏览器控制台是否有错误信息

### 如果页面加载失败
1. 确认路由配置正确 (`/pdf-parser`)
2. 检查网络连接和后端服务状态
3. 查看浏览器开发者工具中的错误信息

### 如果功能异常
1. PDF预览问题：检查PDF文件格式和大小
2. 上传失败：检查文件大小限制和网络连接
3. 解析结果异常：检查后端解析服务状态

## 开发者信息

- 源代码路径：`src/pages/pdf-parser/`
- 组件路径：`src/components/pdf-parser/`  
- API服务：`src/services/pdfParseService.ts`
- 类型定义：`src/types/pdfParser.ts`
- 路由配置：`src/App.tsx`（第196行）