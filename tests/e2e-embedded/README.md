# 内嵌数据库集成测试

这个目录包含使用内嵌 SurrealDB 数据库引擎进行集成测试的相关文件和工具。

## 概述

内嵌数据库集成测试旨在：
- 使用真实的 SurrealDB 数据库引擎，但运行在内存中
- 保证测试环境和生产环境的数据库行为一致
- 支持完整的业务流程测试，包括页面交互
- 提供数据隔离和并发测试支持
- 避免外部数据库依赖

## 可用的测试命令

### 1. 独立测试运行器（推荐）
```bash
bun run test:standalone
```
这是最稳定和可靠的测试方式，包含：
- ✅ 数据库基础连接测试
- ✅ admin用户验证
- ✅ Schema完整性验证  
- ✅ 权限系统验证
- ✅ 案件创建功能测试

### 2. Vitest 集成测试
```bash
bun run test:e2e-embedded
```
使用 Vitest 运行完整的集成测试套件（包含UI测试）。

### 3. 简化测试运行器
```bash
bun run test:simple-embedded
```
基于 TestDatabaseManager 的简化测试（可能需要额外配置）。

## 文件结构

```
tests/e2e-embedded/
├── README.md                     # 本文件
├── standalone-test-runner.ts     # 独立测试运行器（推荐使用）
├── simple-test-runner.ts         # 简化测试运行器
├── full-workflow.test.tsx        # 完整业务流程测试
├── basic-database.test.tsx       # 基础数据库功能测试
├── auth.test.tsx                 # 认证流程测试
├── cases.test.tsx               # 案件管理测试
└── admin.test.tsx               # 管理员功能测试
```

## 支持工具

### 1. 数据库管理
- `tests/database/TestDatabaseManager.ts` - 测试数据库管理器
- `tests/database/testData.ts` - 测试数据生成器

### 2. 测试工具
- `tests/utils/realSurrealTestUtils.tsx` - 真实数据库测试工具
- `tests/utils/pageInteractionHelpers.tsx` - 页面交互辅助函数
- `tests/utils/testDiagnostics.ts` - 测试诊断工具
- `tests/utils/memoryTestUtils.ts` - 内存管理工具

### 3. 测试设置
- `tests/setup-embedded-db.ts` - 测试环境设置

## 测试架构特点

### 1. 数据隔离
- 每次测试运行使用独立的内存数据库
- 测试数据在测试完成后自动清理
- 支持并发测试执行

### 2. 真实数据库引擎
- 使用 `@surrealdb/node` 包的内嵌引擎
- 加载完整的生产环境数据库 Schema
- 支持所有 SurrealQL 功能和权限系统

### 3. 页面交互测试
- 使用 React Testing Library 进行 DOM 交互
- 通过页面操作创建数据，符合集成测试要求
- 模拟真实用户操作流程

### 4. 业务流程覆盖
完整的业务流程测试包括：
1. admin账号创建和验证
2. 通过页面创建案件
3. 创建案件管理人
4. 管理人登录和案件查询  
5. 添加案件成员
6. 案件成员登录
7. 案件成员退出登录

## 故障排除

### 1. 内存问题
如果遇到内存相关的错误：
```bash
# 增加内存限制运行
NODE_OPTIONS="--max-old-space-size=8192" bun run test:standalone
```

### 2. Rust panic 错误
如果遇到 SurrealDB Rust 相关错误，使用独立测试运行器：
```bash
bun run test:standalone
```

### 3. 数据库 Schema 问题
确保 `src/lib/surreal_schemas.surql` 文件存在且格式正确。

### 4. 权限测试问题
确保测试运行时有读取 Schema 文件的权限。

## 开发指南

### 添加新测试
1. 在 `standalone-test-runner.ts` 中添加新的测试用例（推荐）
2. 或者创建新的 `.test.tsx` 文件并在 Vitest 配置中包含它

### 测试最佳实践
1. 使用描述性的测试名称
2. 包含足够的日志输出便于调试
3. 验证数据库状态和页面状态
4. 清理测试创建的资源
5. 使用真实的业务场景数据

### 性能优化
- 独立测试运行器通常是最快和最稳定的选项
- 避免在 Vitest 配置中包含过多测试文件
- 使用内存数据库而不是持久化数据库

## 集成到 CI/CD

推荐在 CI/CD 管道中使用：
```bash
bun run test:standalone
```

这个命令具有最好的稳定性和性能表现。