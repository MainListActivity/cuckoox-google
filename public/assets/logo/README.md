# CuckooX Logo 资源文件

## 文件说明

### SVG文件
- `cuckoo-logo-main.svg` - 完整主logo，包含布谷鸟图形、文字和副标题
- `cuckoo-icon.svg` - 应用图标版本，适用于48x48px及以上尺寸
- `favicon.svg` - 浏览器标签页版本，极简设计适用于16-32px

### 使用方法

#### 1. HTML页面中引入favicon
```html
<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">
```

#### 2. React组件中使用
```tsx
import Logo from '@/components/Logo';

<Logo size="auto" variant="full" />
```

#### 3. 直接使用SVG文件
```html
<img src="/assets/logo/cuckoo-logo-main.svg" alt="CuckooX" />
```

## PNG/ICO文件生成

如需生成PNG或ICO格式文件，可使用以下工具：

### 在线转换工具
- [Convertio](https://convertio.co/svg-png/) - SVG转PNG
- [Favicon.io](https://favicon.io/favicon-converter/) - 生成完整favicon包

### 命令行工具
```bash
# 使用inkscape
inkscape favicon.svg --export-png=favicon-16.png --export-width=16 --export-height=16
inkscape favicon.svg --export-png=favicon-32.png --export-width=32 --export-height=32

# 使用ImageMagick
convert favicon.svg -resize 16x16 favicon-16.png
convert favicon.svg -resize 32x32 favicon-32.png

# 生成ico文件
convert favicon-16.png favicon-32.png favicon.ico
```

### Node.js脚本
```javascript
const sharp = require('sharp');

// 生成不同尺寸的PNG
const sizes = [16, 32, 48, 192, 512];

sizes.forEach(size => {
  sharp('favicon.svg')
    .resize(size, size)
    .png()
    .toFile(`favicon-${size}.png`);
});
```

## 设计规范

- **色彩**: Material Design Teal色系 (#009688, #26A69A, #00695C)
- **字体**: Roboto, Medium (500)
- **圆角**: 8dp统一圆角
- **阴影**: elevation 2-4
- **渐变**: 柔和的线性渐变效果

## 更新日志

- 2024-01-XX: 初始版本设计完成
- SVG格式矢量文件
- 响应式React组件
- 完整使用指南 