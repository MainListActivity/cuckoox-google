# GlobalLoader 组件文档

## 概述

`GlobalLoader` 是一个全屏加载组件，提供与应用启动画面一致的视觉体验。该组件使用相同的品牌动画资源和渐变背景，确保从应用启动到页面加载的无缝视觉过渡。

## 功能特性

### 视觉一致性
- **统一动画资源**: 使用与 `index.html` 启动画面相同的 SVG 动画
- **品牌色彩**: 采用 CuckooX 品牌色彩 (#009688/#4db6ac)
- **专业渐变**: 浅色模式使用 #f6f6f6 到 #e8f5f5 的渐变背景

### 响应式设计
- **桌面端**: 400x300px 动画尺寸，消息位置 bottom: 80px
- **移动端**: 300x225px 动画尺寸，消息位置 bottom: 60px
- **自适应字体**: 桌面端 1.1em，移动端 1em

### 深色模式支持
- **自动检测**: 使用 `@media (prefers-color-scheme: dark)` 自动切换
- **深色背景**: #121212 到 #1e1e1e 的深色渐变
- **深色动画**: 自动切换到 `/assets/loading-animation-dark.svg`
- **深色文字**: 消息文字颜色调整为 #4db6ac

### 动画效果
- **呼吸动画**: 消息文字具有 2 秒循环的透明度变化动画
- **平滑过渡**: opacity 在 0.7 到 1 之间平滑变化

## API 接口

### Props

| 属性 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| message | string | 是 | - | 显示的加载消息文本 |

### 使用示例

```typescript
import GlobalLoader from '@/src/components/GlobalLoader';

// 基础使用
<GlobalLoader message="正在加载案件数据..." />

// 在页面组件中使用
const CasePage = () => {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return <GlobalLoader message="正在加载案件列表..." />;
  }
  
  return <div>案件内容</div>;
};

// 在异步操作中使用
const handleSubmit = async () => {
  setShowLoader(true);
  try {
    await submitClaim();
  } finally {
    setShowLoader(false);
  }
};

return (
  <>
    {showLoader && <GlobalLoader message="正在提交债权申报..." />}
    <ClaimForm onSubmit={handleSubmit} />
  </>
);
```

## 技术实现

### 样式架构
- **内联样式**: 使用内联 `<style>` 标签避免样式冲突
- **CSS 变量**: 不依赖外部 CSS 变量，使用硬编码颜色确保一致性
- **媒体查询**: 响应式设计和深色模式支持

### 布局结构
```css
.globalLoaderContainer {
  position: fixed;           /* 全屏覆盖 */
  z-index: 9999;            /* 最高层级 */
  background-image: url();   /* SVG 动画背景 */
  background-position: center;
  background-repeat: no-repeat;
}

.globalLoaderMessage {
  position: absolute;        /* 绝对定位消息 */
  bottom: 80px;             /* 距离底部位置 */
  left: 50%;
  transform: translateX(-50%); /* 水平居中 */
}
```

### 动画实现
```css
@keyframes messageGlow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.globalLoaderMessage {
  animation: messageGlow 2s ease-in-out infinite;
}
```

## 设计规范

### 颜色规范
- **浅色模式背景**: `linear-gradient(135deg, #f6f6f6 0%, #e8f5f5 100%)`
- **深色模式背景**: `linear-gradient(135deg, #121212 0%, #1e1e1e 100%)`
- **浅色模式文字**: `#009688` (CuckooX 主品牌色)
- **深色模式文字**: `#4db6ac` (CuckooX 辅助品牌色)

### 字体规范
- **字体族**: `'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- **字重**: `500` (Medium)
- **桌面端字号**: `1.1em`
- **移动端字号**: `1em`

### 动画资源
- **浅色模式**: `/assets/loading-animation.svg`
- **深色模式**: `/assets/loading-animation-dark.svg`
- **桌面端尺寸**: `400px × 300px`
- **移动端尺寸**: `300px × 225px`

## 最佳实践

### 使用场景
- **页面初始加载**: 数据获取期间的全屏加载
- **异步操作**: 表单提交、文件上传等耗时操作
- **路由切换**: 页面间导航的过渡效果
- **数据刷新**: 大量数据重新加载时的用户反馈

### 消息文案建议
- **具体描述**: "正在加载案件数据..." 而不是 "加载中..."
- **动作导向**: "正在提交债权申报..." 而不是 "请稍候..."
- **简洁明了**: 避免过长的描述文字
- **用户友好**: 使用用户能理解的业务术语

### 性能考虑
- **SVG 优化**: 使用矢量图形确保在所有设备上清晰显示
- **内联样式**: 避免额外的 CSS 文件加载
- **媒体查询**: 仅在需要时应用响应式样式
- **动画性能**: 使用 CSS 动画而非 JavaScript 动画

## 兼容性

### 浏览器支持
- **现代浏览器**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **移动浏览器**: iOS Safari 12+, Chrome Mobile 60+
- **深色模式**: 支持 `prefers-color-scheme` 的浏览器

### 设备适配
- **桌面端**: 1920×1080 及以上分辨率优化
- **平板端**: 768×1024 响应式适配
- **手机端**: 375×667 及以上移动设备
- **高分辨率**: 支持 Retina 和高 DPI 显示器

## 维护指南

### 样式更新
- 修改品牌色彩时同步更新浅色和深色模式
- 调整动画尺寸时确保响应式断点一致
- 更新字体时保持跨平台兼容性

### 动画资源
- SVG 文件应保持相同的宽高比 (4:3)
- 确保深色和浅色版本视觉效果一致
- 优化 SVG 文件大小以提升加载性能

### 测试要点
- 在不同设备尺寸下测试响应式效果
- 验证深色模式自动切换功能
- 检查消息文字的可读性和位置
- 确保动画在低性能设备上流畅运行