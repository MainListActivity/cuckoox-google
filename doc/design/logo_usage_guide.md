# CuckooX Logo 使用指南

## 概述

CuckooX logo是破产案件全生命周期管理平台的核心品牌标识，融合了布谷鸟的时间精准性与现代科技的专业感。本指南将帮助您正确使用logo，确保品牌形象的一致性和专业性。

## 设计文件结构

```
public/assets/logo/
├── cuckoo-logo-main.svg    # 完整主logo
├── cuckoo-icon.svg         # 应用图标版本
└── favicon.svg             # 浏览器标签页版本

src/components/Logo/
├── Logo.tsx                # React组件
└── index.ts                # 导出文件
```

## Logo组件使用

### 基本用法

```tsx
import Logo from '@/components/Logo';

// 默认完整logo，自适应尺寸
<Logo />

// 指定尺寸
<Logo size="large" />
<Logo size="medium" />
<Logo size="small" />

// 指定变体
<Logo variant="full" />    // 完整logo
<Logo variant="icon" />    // 纯图标
<Logo variant="text" />    // 纯文字
```

### 高级用法

```tsx
// 可点击logo
<Logo 
  onClick={() => navigate('/')} 
  size="medium"
  variant="full"
/>

// 链接logo
<Logo 
  href="/"
  size="large"
  color="primary"
/>

// 响应式logo（推荐）
<Logo size="auto" variant="full" />
```

### 属性说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | `'small' \| 'medium' \| 'large' \| 'auto'` | `'auto'` | logo尺寸 |
| `variant` | `'full' \| 'icon' \| 'text'` | `'full'` | logo变体 |
| `color` | `'primary' \| 'white' \| 'dark'` | `'primary'` | 颜色主题 |
| `href` | `string` | - | 链接地址 |
| `onClick` | `() => void` | - | 点击事件 |

## 尺寸规范

### 自动响应式规则

- **移动端 (<600px)**: 自动使用 `small` 尺寸 + `icon` 变体
- **平板端 (600px-960px)**: 使用 `medium` 尺寸 + `full` 变体
- **桌面端 (>960px)**: 使用 `large` 尺寸 + `full` 变体

### 固定尺寸

| 尺寸 | 宽度 | 高度 | 适用场景 |
|------|------|------|----------|
| `small` | 32px | 32px | 移动端顶部栏、按钮内图标 |
| `medium` | 48px | 48px | 平板端、卡片头部 |
| `large` | 240px | 64px | 桌面端首页、登录页 |

## 使用场景

### 1. 应用顶部栏

```tsx
// 移动端
<AppBar>
  <Logo size="small" variant="icon" />
  <Typography variant="h6">CuckooX</Typography>
</AppBar>

// 桌面端
<AppBar>
  <Logo size="medium" variant="full" />
</AppBar>
```

### 2. 登录/首页

```tsx
// 登录页面
<Box sx={{ textAlign: 'center', mb: 4 }}>
  <Logo size="large" variant="full" />
</Box>

// 首页欢迎区
<Hero>
  <Logo size="large" variant="full" />
  <Typography variant="h3">欢迎使用CuckooX</Typography>
</Hero>
```

### 3. 侧边栏

```tsx
// 展开状态
<Drawer open>
  <Logo size="medium" variant="full" />
</Drawer>

// 收起状态
<Drawer>
  <Logo size="small" variant="icon" />
</Drawer>
```

### 4. 打印文档/PDF

```tsx
// 使用SVG确保打印清晰度
<Box sx={{ '@media print': { display: 'block' } }}>
  <Logo size="medium" variant="full" />
</Box>
```

## 色彩使用

### 主色调版本（默认）
- 适用于白色或浅色背景
- 使用Material Design Teal色系
- 确保对比度符合无障碍标准

### 白色版本
```tsx
<Logo color="white" />
```
- 适用于深色背景
- 保持足够的对比度

### 深色版本
```tsx
<Logo color="dark" />
```
- 适用于特殊场景
- 单色打印友好

## 布局规范

### 安全区域
- logo周围保持至少1x高度的安全区域
- 与其他元素的最小间距为0.5x高度

### 对齐方式
- **左对齐**: 适用于导航栏、表头
- **居中对齐**: 适用于登录页、欢迎页
- **右对齐**: 适用于文档落款、版权信息

## 禁止行为

### ❌ 不要这样做

1. **不要拉伸变形**
   - 保持原始宽高比
   - 使用等比例缩放

2. **不要更改颜色**
   - 不使用品牌色系外的颜色
   - 不添加阴影或特效

3. **不要截取部分**
   - 不单独使用布谷鸟图形
   - 不单独使用文字部分

4. **不要在低对比度背景上使用**
   - 确保logo清晰可见
   - 注意无障碍要求

5. **不要与其他元素过度接近**
   - 保持足够的安全区域
   - 避免视觉混乱

## 文件格式选择

### SVG格式（推荐）
- **适用**: 网页、响应式设计、高清显示
- **优点**: 矢量无损、文件小、可缩放
- **使用**: 所有数字媒体

### PNG格式
- **适用**: 需要透明背景的位图场景
- **规格**: 16x16, 32x32, 48x48, 192x192, 512x512px
- **使用**: 应用图标、操作系统集成

### ICO格式
- **适用**: 浏览器标签页图标
- **规格**: 包含多尺寸（16px, 32px, 48px）
- **使用**: favicon.ico

## 技术实现

### HTML中使用

```html
<!-- 内联SVG -->
<img src="/assets/logo/cuckoo-logo-main.svg" alt="CuckooX" />

<!-- Favicon -->
<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo/favicon.ico" type="image/x-icon">
```

### CSS中使用

```css
.logo {
  background-image: url('/assets/logo/cuckoo-logo-main.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* 响应式 */
@media (max-width: 600px) {
  .logo {
    background-image: url('/assets/logo/cuckoo-icon.svg');
  }
}
```

## 品牌延展

基于CuckooX主logo，可以延展出功能相关的图标族：

- **案件管理**: 文件夹 + 时钟元素
- **债权申报**: 天平 + 文档元素
- **数据大屏**: 图表 + 鸟眼元素
- **消息中心**: 对话框 + 鸟嘴元素

## 质量检查清单

在使用logo前，请确认：

- [ ] 选择了正确的logo变体
- [ ] 尺寸适合当前场景
- [ ] 颜色与背景有足够对比度
- [ ] 保持了安全区域
- [ ] 文件格式适合使用场景
- [ ] 符合响应式设计要求

## 获取帮助

如果您在使用过程中遇到问题，请：

1. 查看本指南的相关章节
2. 检查设计文件是否最新
3. 联系设计团队获取支持

---

**设计更新日期**: 2024年1月
**版本**: v1.0
**维护者**: CuckooX设计团队 