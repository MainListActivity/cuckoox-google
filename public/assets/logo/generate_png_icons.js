// Generate PNG icons for different use cases
// Run this script to generate PNG versions of the logo
// Usage: node generate_png_icons.js

const fs = require('fs');
const path = require('path');

console.log('📦 PNG图标生成脚本');
console.log('');
console.log('此脚本将帮助您生成CuckooX logo的PNG格式图标');
console.log('');

console.log('🔧 生成方法选择：');
console.log('');
console.log('1. **在线转换工具（推荐）**：');
console.log('   - 访问 https://convertio.co/svg-png/');
console.log('   - 上传 favicon.svg 和 cuckoo-icon.svg');
console.log('   - 分别生成以下尺寸：');
console.log('');

const requiredSizes = [
  { file: 'favicon.svg', sizes: [16, 32], desc: '浏览器标签页图标' },
  { file: 'cuckoo-icon.svg', sizes: [48, 64, 192, 512], desc: '应用图标' },
  { file: 'cuckoo-logo-main.svg', sizes: [180], desc: 'Apple Touch图标', name: 'apple-touch-icon' }
];

requiredSizes.forEach(item => {
  console.log(`   **${item.file}** (${item.desc}):`);
  item.sizes.forEach(size => {
    const outputName = item.name ? 
      `${item.name}.png` : 
      `${path.parse(item.file).name}-${size}.png`;
    console.log(`     - ${size}x${size}px → ${outputName}`);
  });
  console.log('');
});

console.log('2. **命令行工具**：');
console.log('');
console.log('   如果您安装了ImageMagick，可以使用：');
console.log('   ```bash');
console.log('   # Favicon 系列');
console.log('   convert assets/logo/favicon.svg -resize 16x16 assets/logo/favicon-16.png');
console.log('   convert assets/logo/favicon.svg -resize 32x32 assets/logo/favicon-32.png');
console.log('');
console.log('   # 应用图标系列');
console.log('   convert assets/logo/cuckoo-icon.svg -resize 48x48 assets/logo/cuckoo-icon-48.png');
console.log('   convert assets/logo/cuckoo-icon.svg -resize 64x64 assets/logo/cuckoo-icon-64.png');
console.log('   convert assets/logo/cuckoo-icon.svg -resize 192x192 assets/logo/cuckoo-icon-192.png');
console.log('   convert assets/logo/cuckoo-icon.svg -resize 512x512 assets/logo/cuckoo-icon-512.png');
console.log('');
console.log('   # Apple Touch图标');
console.log('   convert assets/logo/cuckoo-logo-main.svg -resize 180x180 assets/logo/apple-touch-icon.png');
console.log('   ```');
console.log('');

console.log('3. **Inkscape命令行**：');
console.log('');
console.log('   如果您安装了Inkscape，可以使用：');
console.log('   ```bash');
console.log('   # 更高质量的转换');
console.log('   inkscape assets/logo/favicon.svg --export-png=assets/logo/favicon-16.png --export-width=16 --export-height=16');
console.log('   inkscape assets/logo/favicon.svg --export-png=assets/logo/favicon-32.png --export-width=32 --export-height=32');
console.log('   ```');
console.log('');

console.log('📄 生成后请在HTML中更新引用：');
console.log('');
console.log('```html');
console.log('<!-- 在 index.html 的 <head> 中 -->');
console.log('<link rel="icon" href="/assets/logo/favicon.svg" type="image/svg+xml">');
console.log('<link rel="icon" href="/assets/logo/favicon-32.png" type="image/png" sizes="32x32">');
console.log('<link rel="icon" href="/assets/logo/favicon-16.png" type="image/png" sizes="16x16">');
console.log('<link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon.png" sizes="180x180">');
console.log('```');
console.log('');

console.log('✅ 完成后，您将获得完整的图标包，支持所有主流浏览器和设备！'); 