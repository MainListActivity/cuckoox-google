# 内嵌 SurrealDB 单元测试方案（与生产 schema 同步）

本文档说明在单元测试环境中如何使用“内嵌 SurrealDB + 生产 schema 脚本”完成端到端的数据校验，同时描述为保证可测性而引入的最小化覆盖策略与注意事项。

## 集成测试架构
- 使用页面测试，切换底层数据库为内嵌数据库引擎(@surrealdb/node)，完成对项目全链路的覆盖集成测试。
- 集成测试的数据不用清理，先运行的测试用例的产生数据在后面的测试用例中可以查询。
- **用例执行顺序**: admin账号创建->案件创建（指定管理人）->管理人登录->案件查询->添加案件成员->其他测试用例->案件成员登录->案件成员退出登录。
- 测试过程只需切换底层数据库 -> 加载生产数据库schema -> 执行测试用例文件 -> 调用页面功能完成数据创建（案件、成员、权限） -> 开始单个用例测试
- 集成测试在测试业务逻辑时不允许直接执行任何sql语句，所有逻辑都应该通过操作页面来完成，**禁止任何sql**


## 目标与收益

- 使用真实的 SurrealDB 引擎（内存模式）替代数据 mock，提高测试可信度与维护效率。
- 直接执行生产用的 `src/lib/surreal_schemas.surql` 初始化数据库，保证测试与生产一脉相承。
- 当测试反映出 schema 变动需求时，优先更新 `src/lib/surreal_schemas.surql`，从而形成“以测促建”的单一来源维护。
- 在测试环境中施加“最小化兼容性覆盖”，避免因生产权限/字段差异而导致用例无法聚焦业务逻辑。

---

## 关联文件与目录结构

- 生产 schema（唯一权威来源）
  - `src/lib/surreal_schemas.surql`
- 测试环境初始化入口
  - `tests/setup-embedded-db.ts`
    - 全局 beforeAll/afterAll/beforeEach/afterEach
    - 全局注入 `__TEST_DATABASE__` 与 `__TEST_DB_MANAGER__`
- 测试数据库管理器
  - `tests/database/TestDatabaseManager.ts`
    - 连接内嵌 SurrealDB（`mem://`）
    - 加载并执行生产 schema
    - 应用测试环境兼容性覆盖（详见下文）
    - 注入标准化测试数据（`tests/database/testData.ts`）
    - 提供 reset / clearAuth / validate 等便捷方法
- 标准测试数据
  - `tests/database/testData.ts`
- 测试工具（组件渲染与数据库操作辅助）
  - `tests/utils/realSurrealTestUtils.tsx`
    - `renderWithRealSurreal()` 用真实 DB 环境包裹渲染
    - `TestHelpers` 封装 `query/create/select/update/delete/resetDatabase/...`

---

## 生命周期与隔离策略

- beforeAll
  - 创建内嵌 SurrealDB 实例（`mem://`）并连接。
  - 选择隔离的 namespace/database（带时间戳）。
  - 加载 `src/lib/surreal_schemas.surql` 并执行所有语句。
  - 应用测试环境的“兼容性覆盖”（下文详述）。
  - 注入标准测试数据；验证状态并导出全局 DB/Manager。
- beforeEach
  - 重置数据库数据至初始测试数据（保留 schema）。
  - 清空“认证状态”参数，确保每个测试起点一致。
- afterEach
  - 清空认证参数与 Testing Library 清理。
- afterAll
  - 关闭 DB 连接并释放全局引用。

配合已有“测试隔离规则”（全局对象重置、完全清理机制、Provider 状态隔离等），确保测试互不影响。

---

## 使用生产 schema 的初始化流程

测试环境直接读取并执行 `src/lib/surreal_schemas.surql`。管理器会将 surql 文件按分号分割为语句顺序执行（忽略 `--` 开头的注释）。若个别语句在测试环境下产生警告，会记录并继续执行，以保证最大化完成 schema 初始化。

执行完成后，额外进行“测试环境兼容性覆盖”，用例需要按照account类型进行认证。

---

## 测试环境兼容性覆盖（最小化）

在测试环境中通过定义登录方式和初始化user表的数据，来实现$auth的引用，进而完全保证测试环境和生产环境的一致性

DEFINE ACCESS account ON DATABASE TYPE RECORD
	SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(pass, $pass) )
	DURATION FOR TOKEN 15m, FOR SESSION 12h
;
查询数据时，直接按照代码逻辑，无需特殊处理，测试环境执行数据库定义也无需特殊处理


---

## 何时需要更新生产 schema 脚本

当以下情形导致测试失败时，优先修改 `src/lib/surreal_schemas.surql`（与产品/后端达成共识）：
- 表/字段定义缺失或类型不匹配（例如新增业务字段、索引、约束）。
- 权限模型需要增加新表/新关系或调整 PERMISSIONS。生产权限仍以业务需求为准；测试覆盖只解决“可测试性”。
- 引入新模块（如 WebRTC、IM、版本/审计流水等）导致的 schema 扩展。

完成修改后：
1) 运行 `bun run test:run` 确认测试通过；
2) 运行 `bun run lint` 确保无 ESLint 错误；



---

## 运行命令

- 单测：`bun run test:run`
  - 运行单个文件：`bun run test:run -- tests/unit/pages/login.test.tsx`
- Lint：`bun run lint`

请在合并前确保：
- 所有单元测试通过；
- Lint 无任何错误；
- 若因测试发现 schema 需要演进，已经更新 `src/lib/surreal_schemas.surql` 并使相关用例通过。

---

## 约定回顾

- 数据库操作优先通过 Service Worker 通路；组件侧统一使用 `queryWithAuth`（产品代码）。
- 单元测试如需真实 DB，则通过“内嵌 Surreal + 生产 schema + 测试覆盖”的方式进行，不 mock 上层服务代码。
- 不随意修改全局测试超时配置；如需等待异步一致，使用 `waitForDatabaseOperation`。

如需扩展/优化测试覆盖策略，请提交变更说明至本文件并评审后同步实施。
