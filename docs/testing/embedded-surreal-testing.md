# 内嵌 SurrealDB 单元测试方案（与生产 schema 同步）

本文档说明在单元测试环境中如何使用“内嵌 SurrealDB + 生产 schema 脚本”完成端到端的数据校验，同时描述为保证可测性而引入的最小化覆盖策略与注意事项。

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

执行完成后，额外进行“测试环境兼容性覆盖”，保证用例在不依赖真实 OIDC/Scope 权限体系情况下，聚焦业务逻辑验证。

---

## 测试环境兼容性覆盖（最小化）

在测试环境中通过定义登录方式和初始化user表的数据，来实现$auth的引用，进而完全保证测试环境和生产环境的一致性

DEFINE ACCESS account ON DATABASE TYPE RECORD
	SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(pass, $pass) )
	DURATION FOR TOKEN 15m, FOR SESSION 12h
;
查询数据时，直接按照代码逻辑，无需特殊处理，测试环境执行数据库定义也无需特殊处理

---

## 认证变量在测试环境的约定

- `$auth` 是 SurrealDB 的保留变量，不能在 SQL 中直接 `LET/DEFINE PARAM` 赋值。
- 测试环境约定使用 `$current_user` 来表示“当前用户”：
  - 设定：`DEFINE PARAM $current_user VALUE user:admin;`
  - 使用：`SELECT * FROM $current_user;` 或者在关系查询中作为起点
- 若仅需临时构造记录 ID，可使用 `type::thing('user','admin')`。

在应用代码中，真实页面/服务默认通过 `queryWithAuth()` 追加 `return $auth;` 并由 Service Worker 进行鉴权/缓存语义。内嵌 DB 的组件级测试（如需）也可使用 `renderWithRealSurreal({ authUserId })` 自动设定 `$current_user`。

---

## 如何在测试中使用真实 DB

- 渲染组件
  - 使用 `renderWithRealSurreal(ui, { authUserId?: 'user:admin' })` 包裹组件，内部提供真实 `SurrealProvider`，并可自动设置“当前用户”。
- 直接操作数据库
  - 使用 `TestHelpers`：
    - `query(sql, vars?)` 执行原始 SQL
    - `create(table, data)` 插入并返回单条记录
    - `select(thing)` / `update(thing, data)` / `delete(thing)`
    - `getRecordCount(table)` / `assertRecordCount(table, n)`
    - `setAuthUser('user:admin')` / `clearAuth()` / `resetDatabase()`
    - `waitForDatabaseOperation(fn, maxAttempts, delayMs)` 轮询等待异步一致

示例（伪代码）：
```
import { renderWithRealSurreal, TestHelpers, TEST_IDS } from '../utils/realSurrealTestUtils';

it('能够创建并查询案件', async () => {
  await TestHelpers.resetDatabase();
  await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

  await TestHelpers.create('case', {
    name: '测试案件',
    case_number: '(2025)测001',
    case_manager_name: '张三',
    acceptance_date: new Date(),
    case_procedure: '破产清算',
    procedure_phase: '立案',
  });

  const count = await TestHelpers.getRecordCount('case');
  expect(count).toBeGreaterThan(0);
});
```

---

## 何时需要更新生产 schema 脚本

当以下情形导致测试失败时，优先修改 `src/lib/surreal_schemas.surql`（与产品/后端达成共识）：
- 表/字段定义缺失或类型不匹配（例如新增业务字段、索引、约束）。
- 权限模型需要增加新表/新关系或调整 PERMISSIONS。生产权限仍以业务需求为准；测试覆盖只解决“可测试性”。
- 引入新模块（如 WebRTC、IM、版本/审计流水等）导致的 schema 扩展。

完成修改后：
1) 运行 `bun run test:run` 确认测试通过；
2) 运行 `bun run lint` 确保无 ESLint 错误；
3) 如涉及数据生成，请同步更新 `tests/database/testData.ts` 的标准数据，保证统计/关系用例稳定。

注意：测试管理器仅在测试环境“放宽权限+补齐兼容字段”，不要在生产脚本中硬编码测试专属字段或放宽 PERMISSIONS。

---

## 常见问题排查（FAQ）

- 报错“权限不足/无法选择表数据”
  - 确认测试覆盖已生效（表已放宽为 `SCHEMALESS PERMISSIONS FULL`）。
  - 若依赖 `$auth` 的 select 逻辑，改用 `$current_user` 或直接放宽（测试环境）。
- 找不到 `name/display_name`
  - 确认覆盖逻辑已执行（`operation_metadata` 与 `menu_metadata` 会映射补齐）。
- 历史用例依赖 `menu.name === 'claims'`
  - 测试覆盖会把 `menu_id = 'claims_list'` 的记录 `name` 统一更新为 `'claims'`。
- 冲突/重复数据
  - 测试数据插入前会清空权限关系与元数据表，减少冲突。如仍有冲突，请检查 `testData.ts` 与生产脚本新增的“唯一索引”。

---

## 运行命令

- 单测：`bun run test:run`
  - 运行单个文件：`bun run test:run -- tests/unit/pages/login.test.tsx`
- E2E：`bun run test:e2e`
- Lint：`bun run lint`

请在合并前确保：
- 所有单元测试通过；
- Lint 无任何错误；
- 若因测试发现 schema 需要演进，已经更新 `src/lib/surreal_schemas.surql` 并使相关用例通过。

---

## 约定回顾

- 数据库操作优先通过 Service Worker 通路；组件侧统一使用 `queryWithAuth`（产品代码）。
- 单元测试如需真实 DB，则通过“内嵌 Surreal + 生产 schema + 测试覆盖”的方式进行，不 mock 上层服务代码（除 SW 通道必要模拟外）。
- 不随意修改全局测试超时配置；如需等待异步一致，使用 `waitForDatabaseOperation`。

如需扩展/优化测试覆盖策略，请提交变更说明至本文件并评审后同步实施。
