# 全项目单元测试修复清单

基于 test-results.json 的完整分析结果 (699个失败测试，270个通过测试)

## 🚨 最高优先级 - 系统级问题

### 🔴 Critical: globalHistory 路由错误 (影响100+测试)
- **错误**: `globalHistory.replaceState is not a function`
- **影响范围**: 几乎所有React组件测试
- **文件**: 
  - `tests/unit/pages/cases/index.test.tsx`
  - `tests/unit/pages/claims/[claimId]/review.test.tsx`
  - `tests/unit/components/claim/**/*.test.tsx`
  - 等多个文件
- **修复**: 在测试环境中mock globalHistory API

### 🔴 Critical: 模块导入路径错误 (影响50+测试)
- **错误**: `Cannot find module '@/src/contexts/AuthContext'`等
- **影响范围**: 认证、权限、响应式布局相关测试
- **缺失模块**:
  - `@/src/contexts/AuthContext`
  - `@/src/hooks/useOperationPermission`
  - `@/src/hooks/useResponsiveLayout`
  - `@/src/contexts/SurrealProvider`
- **修复**: 创建缺失模块或修正导入路径

### 🔴 Critical: WebRTC Service 初始化错误 (影响20+测试)
- **错误**: `Date is not defined` 在 WebRTCManager 中
- **影响范围**: RichTextEditor、WebRTC相关所有测试
- **位置**: `src/services/webrtcManager.ts:985:17`
- **修复**: 在测试环境中正确配置全局对象

## 🔥 高优先级 - 组件和服务问题

### 🟠 WebRTC 配置管理 (影响15+测试)
- **错误**: 
  - `default.onConfigUpdate is not a function`
  - `Cannot read properties of undefined (reading 'call_timeout')`
- **影响文件**:
  - `tests/unit/services/mediaFileHandler.test.ts`
  - `tests/unit/services/networkAdaptation.test.ts`
  - `tests/unit/services/callManager.test.ts`
- **修复**: 完善RTC配置管理器的mock

### 🟠 Material-UI 组件渲染问题 (影响10+测试)
- **错误**: 
  - `Unable to find an element by: [data-testid="case-member-tab"]`
  - `Unable to find an element with the text: 填写审核意见与认定金额`
- **影响范围**: 案件成员管理、债权审核页面
- **修复**: 更新测试选择器和期望文本

### 🟠 React Router v7 升级警告
- **警告**: Future flags for React Router v7
- **影响**: 所有路由相关测试
- **修复**: 配置Router future flags或升级到v7

## 📋 分类测试失败统计

### 页面组件测试 (200+ 失败)
- **cases页面**: globalHistory错误、组件渲染问题
- **claims页面**: 债权审核流程、移动端布局
- **case-members页面**: 模块导入、权限检查

### 服务层测试 (150+ 失败)
- **WebRTC服务**: Date未定义、配置管理
- **消息服务**: 参数匹配、权限验证
- **媒体处理**: 配置回调、初始化

### Worker测试 (100+ 失败)
- **Service Worker**: DOM操作、缓存管理
- **数据同步**: React渲染错误

### 上下文和Hook测试 (100+ 失败)
- **AuthContext**: 模块路径问题
- **SurrealProvider**: 数据库连接mock

### 移动端组件测试 (50+ 失败)
- **响应式布局**: Hook导入错误
- **移动端组件**: 测试环境配置

## 🛠️ 修复策略

### 第一阶段：系统基础修复
1. **设置测试环境全局变量**
   ```javascript
   // vitest.config.ts
   global: {
     globalThis: {
       globalHistory: {
         replaceState: vi.fn(),
         pushState: vi.fn()
       },
       Date: Date
     }
   }
   ```

2. **创建缺失的上下文和Hook模块**
   - 实现 `@/src/contexts/AuthContext`
   - 实现 `@/src/hooks/useOperationPermission`
   - 实现 `@/src/hooks/useResponsiveLayout`

3. **完善WebRTC服务Mock**
   ```javascript
   // 在测试setup中
   vi.mock('@/src/services/webrtcManager', () => ({
     cleanupInactiveConnections: vi.fn(),
     // ... 其他方法
   }))
   ```

### 第二阶段：组件和服务修复
1. **修复组件测试选择器**
2. **完善服务层Mock数据**
3. **处理Material-UI组件渲染**

### 第三阶段：细节优化
1. **更新Router配置**
2. **优化移动端测试**
3. **处理边界情况**

## 🎯 快速验证命令

```bash
# 运行单个测试文件
bun run test:run -- tests/unit/pages/cases/index.test.tsx

# 运行特定类别测试
bun run test:run -- tests/unit/services/

# 运行所有测试并生成报告
bun run test:run -- --reporter=verbose

# 运行单个测试用例
bun run test:run -- tests/unit/pages/cases/index.test.tsx -t "缓存数据问题修复"
```

## 📊 修复进度追踪

**当前状态**: 270/969 通过 (27.9%)
**目标**: 969/969 通过 (100%)
**需修复**: 699个失败测试

### 预期修复效果：
- 🥇 **第一阶段完成**: 预计通过率提升至 60-70%
- 🥈 **第二阶段完成**: 预计通过率提升至 85-90%  
- 🥉 **第三阶段完成**: 达到 95%+ 通过率

## 🔥 立即行动项 (前3优先级)

1. **🚨 配置测试环境全局变量** - 解决100+个globalHistory错误
2. **🚨 创建缺失的Context模块** - 解决50+个模块导入错误
3. **🚨 修复WebRTC服务Mock** - 解决20+个WebRTC相关错误

完成这3项将使通过率从27.9%提升至约65%！

## 📁 主要失败测试文件清单

### 页面组件
- `tests/unit/pages/cases/index.test.tsx` - globalHistory错误
- `tests/unit/pages/claims/[claimId]/review.test.tsx` - 移动端布局测试
- `tests/unit/pages/case-members/index.test.tsx` - 模块导入错误

### 服务层
- `tests/unit/services/messageService.test.ts` - Mock数据不匹配
- `tests/unit/services/webrtcManager.test.ts` - Date未定义
- `tests/unit/services/callManager.test.ts` - 配置管理错误
- `tests/unit/services/mediaFileHandler.test.ts` - 配置回调错误
- `tests/unit/services/networkAdaptation.test.ts` - 配置管理错误

### 组件测试
- `tests/unit/components/RichTextEditor.test.tsx` - WebRTC错误
- `tests/unit/components/claim/**/*.test.tsx` - globalHistory错误

### Worker测试
- `tests/unit/workers/data-cache-manager-autosync.test.ts` - DOM操作错误

### 上下文和Hook
- 所有涉及AuthContext的测试 - 模块路径错误
- 所有涉及SurrealProvider的测试 - 数据库连接mock

## 🔗 相关文档

- [测试配置指南](../docs/testing-guide.md)
- [Mock设置文档](../docs/mock-setup.md)
- [WebRTC测试指南](../docs/webrtc-testing.md)

---

*最后更新: 基于 test-results.json 分析结果*
*总计测试数: 969 (通过: 270, 失败: 699)*
