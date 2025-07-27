# 响应式组件API文档

## 概述

本文档详细介绍CuckooX-Google系统中响应式组件的API接口、使用方法和最佳实践。这些组件基于详细的[移动端UI优化需求分析](../.kiro/specs/mobile-ui-optimization/requirements.md)设计，旨在提供最佳的移动端用户体验。

## 📋 设计原则

本API设计基于10个核心需求领域：
1. **移动端列表展示优化** - 卡片式布局、信息优先级
2. **触摸友好的交互设计** - 44px最小触摸目标、清晰反馈
3. **移动端搜索和筛选优化** - 全屏搜索、抽屉式筛选
4. **统计信息移动端适配** - 2×2网格布局、紧凑模式
5. **移动端导航优化** - 固定顶部导航、智能隐藏
6. **响应式布局系统** - 多设备适配、横屏支持
7. **性能和加载优化** - 3秒内加载、虚拟滚动
8. **可访问性和用户体验** - 屏幕阅读器、高对比度
9. **数据展示优化** - 图标编码、相对时间
10. **手势和交互增强** - 滑动操作、下拉刷新

## 核心响应式组件

### ResponsiveTable

响应式表格组件，在桌面端显示为传统表格，在移动端显示为卡片列表。

#### 接口定义

```typescript
interface ResponsiveTableProps {
  columns: ResponsiveTableColumn[];
  data: any[];
  actions?: ResponsiveTableAction[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  size?: 'small' | 'medium';
  mobileCardVariant?: 'compact' | 'detailed';
  showRowNumbers?: boolean;
}

interface ResponsiveTableColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string | React.ReactNode;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  priority?: 'high' | 'medium' | 'low'; // 移动端显示优先级
}

interface ResponsiveTableAction {
  icon: string;
  label: string;
  onClick: (row: any) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  disabled?: (row: any) => boolean;
  hideOnMobile?: boolean;
}
```

#### 使用示例

```tsx
import ResponsiveTable from '@/src/components/common/ResponsiveTable';

const columns: ResponsiveTableColumn[] = [
  {
    id: 'case_number',
    label: '案件编号',
    priority: 'high', // 移动端高优先级显示
    format: (value) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>,
  },
  {
    id: 'case_lead_name',
    label: '负责人',
    priority: 'high',
    hideOnMobile: false, // 移动端显示
  },
  {
    id: 'creator_name',
    label: '创建人',
    priority: 'low',
    hideOnMobile: true, // 移动端隐藏
  },
];

const actions: ResponsiveTableAction[] = [
  {
    icon: mdiEyeOutline,
    label: '查看',
    onClick: (row) => handleView(row),
    color: 'primary',
  },
  {
    icon: mdiPencilOutline,
    label: '编辑',
    onClick: (row) => handleEdit(row),
    hideOnMobile: true, // 移动端隐藏
  },
];

<ResponsiveTable
  columns={columns}
  data={tableData}
  actions={actions}
  mobileCardVariant="detailed"
  showRowNumbers={!isMobile}
  onRowClick={handleRowClick}
/>
```

#### 特性说明

- **自适应布局**: 桌面端显示完整表格，移动端显示卡片列表
- **列优先级**: 通过`priority`属性控制移动端显示的信息重要性
- **操作按钮**: 支持行级操作，移动端可配置显示/隐藏
- **展开详情**: 移动端支持展开查看更多信息
- **触摸友好**: 移动端按钮符合44px最小触摸目标

### ResponsiveStatsCards

响应式统计卡片组件，根据屏幕尺寸自动调整布局和显示内容。

#### 接口定义

```typescript
interface ResponsiveStatsCardsProps {
  stats: StatCardData[];
  loading?: boolean;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  variant?: 'default' | 'compact' | 'detailed';
  showTrend?: boolean;
  onCardClick?: (stat: StatCardData) => void;
}

interface StatCardData {
  id: string;
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  subtitle?: string;
  loading?: boolean;
}
```

#### 使用示例

```tsx
import ResponsiveStatsCards from '@/src/components/common/ResponsiveStatsCards';

const statsData: StatCardData[] = [
  {
    id: 'total',
    label: '总案件数',
    value: 156,
    icon: mdiBriefcaseOutline,
    color: '#00897B',
    bgColor: 'rgba(0, 137, 123, 0.1)',
    trend: {
      value: 12.5,
      isPositive: true,
      label: '较上月'
    }
  },
];

<ResponsiveStatsCards
  stats={statsData}
  variant={isMobile ? 'compact' : 'default'}
  columns={{ xs: 2, sm: 2, md: 4, lg: 4 }}
  showTrend={true}
  onCardClick={handleCardClick}
/>
```

#### 变体说明

- **compact**: 紧凑模式，水平布局，适合移动端
- **default**: 默认模式，垂直布局，平衡显示
- **detailed**: 详细模式，包含趋势和副标题信息

### MobileOptimizedLayout

移动端优化的页面布局组件，提供移动端友好的页面结构。

#### 接口定义

```typescript
interface MobileOptimizedLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMenuClick?: () => void;
  showFab?: boolean;
  fabIcon?: string;
  onFabClick?: () => void;
  fabLabel?: string;
  headerActions?: React.ReactNode;
  backgroundColor?: string;
}
```

#### 使用示例

```tsx
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';

<MobileOptimizedLayout
  title="案件管理"
  subtitle="12 个案件"
  onBack={() => navigate(-1)}
  showFab={true}
  onFabClick={handleCreate}
  fabLabel="创建案件"
>
  {pageContent}
</MobileOptimizedLayout>
```

#### 特性说明

- **固定顶部导航**: 提供返回按钮和标题显示
- **浮动操作按钮**: 支持主要操作的FAB按钮
- **滚动优化**: 根据滚动状态调整UI显示
- **安全区域适配**: 支持刘海屏等特殊屏幕

### MobileSearchFilter

移动端优化的搜索筛选组件。

#### 接口定义

```typescript
interface MobileSearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterOption[];
  onFilterChange: (filterId: string, value: any) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

interface FilterOption {
  id: string;
  label: string;
  type: 'select' | 'multiSelect' | 'dateRange' | 'toggle';
  value: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
}
```

#### 使用示例

```tsx
import MobileSearchFilter from '@/src/components/mobile/MobileSearchFilter';

const filterOptions: FilterOption[] = [
  {
    id: 'status',
    label: '案件状态',
    type: 'select',
    value: filterStatus,
    options: [
      { value: 'active', label: '进行中' },
      { value: 'completed', label: '已完成' },
    ],
  },
];

<MobileSearchFilter
  searchValue={searchValue}
  onSearchChange={setSearchValue}
  searchPlaceholder="搜索案件..."
  filters={filterOptions}
  onFilterChange={handleFilterChange}
  onClearFilters={handleClearFilters}
  activeFilterCount={activeFilterCount}
/>
```

## 响应式Hook

### useResponsiveLayout

提供设备类型检测和布局信息的Hook。

#### 接口定义

```typescript
interface ResponsiveLayoutState {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
}
```

#### 使用示例

```tsx
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

const MyComponent = () => {
  const { isMobile, deviceType, screenSize } = useResponsiveLayout();
  
  return (
    <Box>
      {isMobile ? (
        <MobileView />
      ) : (
        <DesktopView />
      )}
    </Box>
  );
};
```

### useResponsiveValue

根据不同断点返回不同值的Hook。

#### 使用示例

```tsx
import { useResponsiveValue } from '@/src/hooks/useResponsiveLayout';

const MyComponent = () => {
  const spacing = useResponsiveValue({
    mobile: 1,
    tablet: 2,
    desktop: 3
  });
  
  const columns = useResponsiveValue({
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4
  });
  
  return <Grid container spacing={spacing} columns={columns} />;
};
```

### useResponsiveSpacing

提供响应式间距值的Hook。

#### 使用示例

```tsx
import { useResponsiveSpacing } from '@/src/hooks/useResponsiveLayout';

const MyComponent = () => {
  const {
    pageMargin,
    cardSpacing,
    componentSpacing,
    getSpacing
  } = useResponsiveSpacing();
  
  return (
    <Box sx={{ 
      margin: pageMargin,
      '& .card': { marginBottom: cardSpacing }
    }}>
      {content}
    </Box>
  );
};
```

## 响应式样式系统

### CSS变量

系统定义了完整的响应式CSS变量：

```css
:root {
  /* 移动端优化的间距 */
  --mobile-padding: 8px;
  --mobile-margin: 8px;
  --mobile-border-radius: 8px;
  
  /* 桌面端间距 */
  --desktop-padding: 16px;
  --desktop-margin: 16px;
  --desktop-border-radius: 12px;
  
  /* 响应式字体大小 */
  --mobile-font-size-small: 12px;
  --mobile-font-size-medium: 14px;
  --mobile-font-size-large: 16px;
  
  --desktop-font-size-small: 14px;
  --desktop-font-size-medium: 16px;
  --desktop-font-size-large: 18px;
}
```

### 工具类

提供便捷的响应式工具类：

```css
/* 显示/隐藏工具类 */
.responsive-hide-mobile    /* 移动端隐藏 */
.responsive-hide-tablet    /* 平板端隐藏 */
.responsive-hide-desktop   /* 桌面端隐藏 */
.responsive-show-mobile    /* 仅移动端显示 */
.responsive-show-tablet    /* 仅平板端显示 */
.responsive-show-desktop   /* 仅桌面端显示 */

/* 间距工具类 */
.responsive-padding-mobile  /* 移动端间距 */
.responsive-margin-mobile   /* 移动端边距 */

/* 文本大小工具类 */
.responsive-text-mobile     /* 移动端文本大小 */
.responsive-text-small-mobile /* 移动端小文本 */
```

## 最佳实践

### 1. 组件选择

- **表格数据**: 使用ResponsiveTable替代传统Table
- **统计展示**: 使用ResponsiveStatsCards展示关键指标
- **移动端页面**: 使用MobileOptimizedLayout包装页面内容
- **搜索筛选**: 使用MobileSearchFilter提供友好的筛选体验

### 2. 布局设计

- **移动优先**: 先设计移动端布局，再扩展到桌面端
- **信息优先级**: 使用column的priority属性控制移动端显示
- **触摸友好**: 确保按钮和交互元素至少44px×44px
- **内容适配**: 长文本使用noWrap和省略号处理

### 3. 性能优化

- **条件渲染**: 使用设备检测避免不必要的组件渲染
- **懒加载**: 对非关键内容使用React.lazy
- **虚拟滚动**: 大量数据使用react-window等虚拟滚动库
- **图片优化**: 根据设备类型加载不同尺寸的图片

### 4. 测试策略

- **多设备测试**: 在不同尺寸设备上测试布局效果
- **交互测试**: 验证触摸操作的准确性和响应性
- **性能测试**: 监控移动端的渲染性能和内存使用
- **可访问性测试**: 确保屏幕阅读器和键盘导航支持

## 故障排除

### 常见问题

1. **移动端按钮太小**: 检查是否设置了最小触摸目标尺寸
2. **表格在移动端显示异常**: 确认使用了ResponsiveTable而非原生Table
3. **布局在某些设备上错乱**: 检查CSS媒体查询断点设置
4. **性能问题**: 使用React DevTools Profiler分析组件渲染性能

### 调试工具

- **响应式测试页面**: `/responsive-test` 页面提供完整的组件测试
- **浏览器开发者工具**: 使用设备模拟器测试不同屏幕尺寸
- **React DevTools**: 监控组件渲染和状态变化
- **性能监控**: 使用Lighthouse等工具评估移动端性能

## 更新日志

### 2025年1月27日
- 完成ResponsiveTable、ResponsiveStatsCards等核心组件
- 实现useResponsiveLayout等响应式Hook
- 建立完整的CSS变量系统和工具类
- 创建移动端优化布局和搜索筛选组件
- 添加响应式测试页面和文档

### 计划更新
- 键盘快捷键支持
- 高级手势操作
- 无障碍访问优化
- 离线UI适配

## 📚 相关文档

### 需求和设计文档
- **[移动端UI优化需求](../.kiro/specs/mobile-ui-optimization/requirements.md)** - 详细的需求分析和验收标准
- **[移动端优化设计](../.kiro/specs/mobile-ui-optimization/design.md)** - 架构设计和组件规范
- **[移动端实施计划](../.kiro/specs/mobile-ui-optimization/tasks.md)** - 详细的任务分解和实施计划

### 技术文档
- **[响应式优化指南](./responsive-optimization-guide.md)** - 响应式布局优化指南
- **[移动端优化计划](./mobile-ui-optimization-plan.md)** - 移动端UI优化整体规划
- **[移动端快速开始](./mobile-ui-quick-start.md)** - 移动端开发快速入门指南