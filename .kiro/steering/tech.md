# Technology Stack

## Build System & Package Management

- **Build Tool**: Vite 6.x with ESNext target
- **Package Manager**: Bun (preferred over npm/yarn)
- **TypeScript**: Strict mode enabled with experimental decorators

## Core Technologies

### Frontend Stack
- **Framework**: React 19 + TypeScript
- **UI Library**: Material-UI v7 (MUI)
- **Styling**: MUI + Tailwind CSS + CSS Variables
- **State Management**: React Context + TanStack Query
- **Routing**: React Router v6
- **Icons**: @mdi/js (Material Design Icons)
- **Rich Text**: Quill.js v2
- **Internationalization**: i18next + react-i18next

### Backend Integration
- **Database**: SurrealDB (real-time database)
- **File Storage**: MinIO (S3-compatible)
- **Authentication**: OIDC (OpenID Connect)
- **Real-time Communication**: WebSocket + Service Worker

### Testing
- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **Test Environment**: jsdom
- **单元测试**: 非必要不能新增重复的单元测试文件，请在原来的测试文件中修改，如果必须创建新的测试文件，需要确保测试用例的完善，在测试通过后需要覆盖原来的测试文件
- **永远不要**创建新的测试文件，只需要保证现有测试文件能够通过测试。
- **永远不要**删除现有的测试文件或测试用例。
- 你需要确保修改后的代码能够通过所有单元测试。
- 在终端运行命令后务必等待命令执行结束再获取结果。

## Common Commands

### Development
```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Build Service Worker
bun run build:sw

# Preview production build
bun run preview
```

### Testing
```bash

# Run tests with UI
bun run test:ui

# Run tests once
bun run test:run

# Run E2E tests
bun run test:e2e

# Install Playwright browsers
bunx playwright install --with-deps
```

### Code Quality
```bash
# Lint code
bun run lint

# Type check
bunx tsc --noEmit

# ESLint specific files
bunx eslint src/**/*.tsx
```

## Key Configuration

### Vite Configuration
- **Target**: ESNext with top-level await support
- **Optimizations**: Exclude @surrealdb/wasm from pre-bundling
- **Environment Variables**: Custom loading order (.env → .env.dev → .env.local)

### TypeScript Configuration
- **Strict Mode**: Enabled with unused locals/parameters checking
- **Module Resolution**: Bundler mode
- **Path Mapping**: `@/*` maps to project root

### Environment Variables
```bash
# Database access mode
VITE_DB_ACCESS_MODE=service-worker  # or 'direct'

# SurrealDB configuration
VITE_SURREALDB_WS_URL=ws://localhost:8000/rpc
VITE_SURREALDB_NS=ck_go
VITE_SURREALDB_DB=test

# OIDC configuration
VITE_OIDC_AUTHORITY=https://auth.example.com
VITE_OIDC_CLIENT_ID=your-client-id
```

## Architecture Patterns

- **Clean Architecture**: Layered architecture with dependency inversion
- **Service Worker Pattern**: Background data sync and caching
- **Context + Hook Pattern**: State management and business logic encapsulation
- **Component-Based Architecture**: Reusable component design

## Important Notes
- Uses Bun as package manager instead of npm/yarn
- Custom path alias `@/*` maps to project root
- Strict TypeScript configuration with experimental decorators
- E2E tests require Playwright browser installation
- Uses CSS custom properties for theming integration MUI
- ts的类型错误尽量不要使用 `as any`来修复，应当在`typs.d.ts` 或 `index.d.ts` 中定义类型
- 在涉及到surreal的方法、存储代码中尽可能使用`RecordId`而不是`string`
- 不要尝试运行 bun run dev 判断代码是否可运行，lint检查通过并且单元测试通过就可完成任务
- 使用service worker在后台保持与surrealdb的连接状态，所有页面与service worker通信获取数据
- 数据库的权限全部由surrealdb数据库控制，这意味着当我们需要查询数据时，只需要加上用户输入的条件，比如查询案件时： `select * from case`，当用户输入关键字搜索： `select * form case where 'fox' IN name`;
- 已实现完整的数据缓存架构，包含两种缓存策略：
  - 持久化缓存：用户个人信息（权限、菜单、操作按钮等），登录时缓存，退出时清除
  - 临时缓存：页面数据，进入页面时订阅，离开页面时取消订阅
- 支持增量数据同步，基于更新时间获取变更数据
- 支持双向数据同步，本地和远程数据库同时修改时自动同步
- 权限检查现在基于本地缓存的用户个人数据，提供更快的响应速度
- 系统中有一部分页面需要用户登录之后才能访问，否则会跳转到登录页面的，针对这种查询需要在查询的sql之前添加 当前认证状态的查询 例如查询案件： `return $auth;select * from case;`，返回的数据从返回数组中的索引位置1开始获取，先获取0位置的认证状态，如果没有认证则直接跳转登录页面
- **关系表设计**: 所有多对多关系必须使用 `TYPE RELATION IN source OUT target` 语法定义，使用 `RELATE` 语句创建关系，通过 `->relation_table->` 和 `<-relation_table<-` 语法查询关系
- **PDF智能识别**: 系统集成PDF智能识别功能，支持立案书和债权合同的自动解析，提取企业信息和债权信息，所有识别结果都包含置信度评估
- **Grid组件使用语法**:
```typescript
import { Grid } from '@mui/material';

<Grid container spacing={2}>
  <Grid size={8}>
    <Item>size=8</Item>
  </Grid>
  <Grid size={4}>
    <Item>size=4</Item>
  </Grid>
</Grid>
```
# surrreal查询语法

#### IF-ELSE 语句必须用 `END` 结尾
```sql

-- ✅ 正确写法
LET $case_roles = IF $case_id THEN 
    (SELECT out.name FROM $user_id->has_case_role WHERE case_id = $case_id)
ELSE [];
END;  -- 必须有 END
```

#### 子查询中的排序需要特殊语法
```sql

-- ✅ 正确写法
FROM $case_id->(select * from has_member ORDER BY assigned_at DESC)
```

#### RELATE 语句中应该只选择 ID 字段
```sql

-- ✅ 正确写法
FOR $menu IN (SELECT id FROM menu_metadata) {
    RELATE role:admin->can_access_menu->$menu SET ...
};
```

## 查询语法

```sql
SELECT 
	VALUE @field | @fields [ AS @alias ] [ OMIT @fields ... ]
	FROM [ ONLY ] @targets
	[ WITH [ NOINDEX | INDEX @indexes ... ]]
	[ WHERE @conditions ]
	[ SPLIT [ ON ] @field, ... ]
	[ GROUP [ BY ] @field, ... ]
	[ ORDER [ BY ] 
		@field [ COLLATE ] [ NUMERIC ] [ ASC | DESC ], ...
		| RAND() ]
	[ LIMIT [ BY ] @limit ]
	[ START [ AT ] @start 0 ]
	[ FETCH @fields ... ]
	[ TIMEOUT @duration ]
	[ PARALLEL ]
	[ TEMPFILES ]
	[ EXPLAIN [ FULL ]]
;

```

### 查询示例

```sql

SELECT * FROM person;

-- Field `address` now shows up as "string::uppercase"
-- name.first structure now flattened into a simple field
SELECT
	name.first AS user_name,
	string::uppercase(address)
FROM person;

-- "Morgan Hitchcock" added to `name` field structure,
-- `angry_address` for field name instead of automatically
-- generated "string::uppercase(address) + '!!!'"
SELECT
	name.first,
	"Morgan Hitchcock" AS name.last,
	string::uppercase(address) + "!!!" AS angry_address
FROM person;

```

### 返回示例

query方法的每一个分号都会作为一个数组返回，可以同时执行多个查询语句

```json
-------- Query --------

[
	{
		address: '1 Bagshot Row',
		email: 'tobie@surrealdb.com',
		id: person:tobie,
		name: {
			first: 'Tobie'
		}
	}
]

-------- Query --------

[
	{
		"string::uppercase": '1 BAGSHOT ROW',
		user_name: 'Tobie'
	}
]

-------- Query --------

[
	{
		angry_address: '1 BAGSHOT ROW!!!',
		name: {
			first: 'Tobie',
			last: 'Morgan Hitchcock'
		}
	}
]

```

### 全文检索

- search::highlight: Highlights the matching keywords for the predicate reference number.
- search::offsets: Returns the position of the matching keywords for the predicate reference number.
- search::score: Helps with scoring and ranking the search results based on their relevance to the search terms.
- search::analyze: Used to test the output of a defined search analyzer.

- search::highlight(...): SurrealDB can highlight the matched terms in the text.
- search::score() works with the BM25 ranking function to return the relevance score for the matched document.
- @@ "machine learning": SurrealDB will check if the tokens “machine” and “learning” appear in the title field’s FTS index. The number in between the two characters of the operator lets the database know in the above functions which part of the query to highlight and calculate a score for. If no search functions are used, this operator will be used as @@ without a number (e.g. `WHERE title @@ “machine” OR body @@ “machine learning”).
```sql
SELECT *,
  search::highlight("**", "**", 1) AS body,
  search::highlight("##", "", 0) AS title,
  search::score(0) + search::score(1) AS score
FROM article
WHERE title @0@ "machine"
   OR body @1@ "machine learning"
ORDER BY score DESC
LIMIT 10;
```


## SurrealDB关系表(Relation Table)设计规范

### 关系表定义语法

关系表用于建立两个实体之间的多对多关系，必须使用 `TYPE RELATION` 语法定义：

```sql
-- 定义关系表的标准语法
DEFINE TABLE relation_table_name TYPE RELATION IN source_table OUT target_table SCHEMAFULL PERMISSIONS 
  FOR select WHERE [权限条件],
  FOR create WHERE [权限条件],
  FOR update WHERE [权限条件],
  FOR delete WHERE [权限条件];

-- 为关系表定义属性字段
DEFINE FIELD relationship_type ON relation_table_name TYPE string PERMISSIONS FULL;
DEFINE FIELD created_at ON relation_table_name TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
DEFINE FIELD created_by ON relation_table_name TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
```

### 关系表实例示例

```sql
-- 案件与破产企业关联关系表
DEFINE TABLE has_bankruptcy_entity TYPE RELATION IN case OUT bankruptcy_entity SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_bankruptcy_entity' AND operation_type = 'read'],
  FOR create WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_bankruptcy_entity' AND operation_type = 'create'],
  FOR update WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_bankruptcy_entity' AND operation_type = 'update'],
  FOR delete WHERE $auth.id->has_role->role->can_execute_operation->operation_metadata[WHERE tables CONTAINS 'has_bankruptcy_entity' AND operation_type = 'delete'];

DEFINE FIELD relationship_type ON has_bankruptcy_entity TYPE string DEFAULT '主要债务人' PERMISSIONS FULL;
DEFINE FIELD is_primary ON has_bankruptcy_entity TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD associated_at ON has_bankruptcy_entity TYPE datetime DEFAULT time::now() PERMISSIONS FULL;
```

### 关系操作语法

#### 创建关系 (RELATE)
```sql
-- 基本关系创建
RELATE case:case_id->has_bankruptcy_entity->bankruptcy_entity:entity_id 
SET relationship_type = '主要债务人', 
    is_primary = true, 
    associated_at = time::now();

-- 批量创建关系
FOR $entity IN (SELECT id FROM bankruptcy_entity WHERE name CONTAINS '某公司') {
    RELATE case:case_123->has_bankruptcy_entity->$entity 
    SET relationship_type = '关联企业', 
        is_primary = false;
};
```

#### 查询关系数据
```sql
-- 查询案件关联的所有企业（正向查询）
SELECT *, ->has_bankruptcy_entity.* as relation_info 
FROM case:case_id->has_bankruptcy_entity->bankruptcy_entity
ORDER BY relation_info.is_primary DESC;

-- 查询企业关联的所有案件（反向查询）
SELECT *, <-has_bankruptcy_entity.* as relation_info 
FROM bankruptcy_entity:entity_id<-has_bankruptcy_entity<-case
ORDER BY relation_info.associated_at DESC;

-- 查询特定关系类型
SELECT * FROM case:case_id->has_bankruptcy_entity->bankruptcy_entity
WHERE ->has_bankruptcy_entity.relationship_type = '主要债务人';
```

#### 更新关系属性
```sql
-- 更新关系表中的属性
UPDATE case:case_id->has_bankruptcy_entity->bankruptcy_entity:entity_id
SET relationship_type = '担保人',
    is_primary = false,
    updated_at = time::now();
```

#### 删除关系
```sql
-- 删除特定关系
DELETE case:case_id->has_bankruptcy_entity->bankruptcy_entity:entity_id;

-- 删除案件的所有企业关联
DELETE case:case_id->has_bankruptcy_entity;

-- 删除企业的所有案件关联
DELETE bankruptcy_entity:entity_id<-has_bankruptcy_entity;
```

### 关系表设计最佳实践

1. **命名规范**: 关系表名使用 `has_`, `belongs_to_`, `associated_with_` 等前缀
2. **权限控制**: 关系表权限应该考虑源表和目标表的权限
3. **索引优化**: 为关系表的关键字段创建索引以提高查询性能
4. **审计字段**: 添加 `created_at`, `created_by`, `updated_at` 等审计字段
5. **关系属性**: 根据业务需求添加关系特有的属性字段

### 常见关系表模式

```sql
-- 用户角色关系
DEFINE TABLE has_role TYPE RELATION IN user OUT role;

-- 案件成员关系  
DEFINE TABLE has_member TYPE RELATION IN case OUT user;

-- 角色权限关系
DEFINE TABLE can_execute_operation TYPE RELATION IN role OUT operation_metadata;

-- 菜单访问权限关系
DEFINE TABLE can_access_menu TYPE RELATION IN role OUT menu_metadata;
```

### TypeScript中的关系操作

```typescript
// 服务层中的关系操作示例
class RelationService {
  // 创建关系
  async createRelation(sourceId: string, targetId: string, relationData: any) {
    const query = `
      RELATE ${sourceId}->relation_table->${targetId} 
      SET ${Object.keys(relationData).map(key => `${key} = $${key}`).join(', ')};
    `;
    return await this.db.query(query, relationData);
  }

  // 查询关系
  async getRelatedEntities(sourceId: string) {
    const query = `
      SELECT *, ->relation_table.* as relation_info 
      FROM ${sourceId}->relation_table->target_table;
    `;
    return await this.db.query(query);
  }

  // 更新关系
  async updateRelation(sourceId: string, targetId: string, updateData: any) {
    const query = `
      UPDATE ${sourceId}->relation_table->${targetId}
      SET ${Object.keys(updateData).map(key => `${key} = $${key}`).join(', ')};
    `;
    return await this.db.query(query, updateData);
  }

  // 删除关系
  async deleteRelation(sourceId: string, targetId: string) {
    const query = `DELETE ${sourceId}->relation_table->${targetId};`;
    return await this.db.query(query);
  }
}
```

## PDF智能识别技术栈

### 核心技术组件
- **文档解析**: 基于AI大模型的PDF内容提取和结构化解析
- **文档类型识别**: 智能识别立案书、债权合同等法律文档类型
- **信息提取**: 从PDF中提取企业信息、债权信息等结构化数据
- **置信度评估**: 为每个识别结果提供准确性评分

### PDF解析服务架构
```typescript
// PDF解析服务扩展接口
interface ExtendedPDFParseService {
  // 文档类型识别
  identifyDocumentType(fileId: string): Promise<DocumentTypeResult>;
  
  // 立案书解析
  parseFilingDocument(fileId: string): Promise<FilingDocumentParseResult>;
  
  // 合同解析
  parseContractDocument(fileId: string): Promise<ContractParseResult>;
  
  // 企业信息提取
  extractEntityInfo(parseResult: ParseResult): Promise<EntityExtractionResult>;
  
  // 债权信息提取
  extractClaimInfo(parseResult: ParseResult): Promise<ClaimExtractionResult>;
}
```

### 识别结果数据结构
```typescript
interface EntityRecognitionResult {
  documentType: '立案书' | '债权合同';
  entityInfo: Partial<BankruptcyEntity>;
  confidence: number;
  extractedFields: ExtractedField[];
  suggestedActions: EntityAction[];
}

interface FilingDocumentParseResult {
  caseInfo: {
    caseName: string;
    caseNumber: string;
    acceptanceDate: Date;
    court: string;
    caseManager: string;
  };
  entityInfo: Partial<BankruptcyEntity>;
  confidence: number;
}

interface ContractParseResult {
  contractInfo: {
    contractAmount: number;
    interestRate: number;
    contractDate: Date;
    maturityDate?: Date;
    contractType: string;
  };
  parties: {
    creditor: Partial<BankruptcyEntity>;
    debtor: Partial<BankruptcyEntity>;
  };
  claimInfo: {
    principal: number;
    interest: number;
    otherAmount?: number;
    totalAmount: number;
    currency: string;
    nature: string;
    briefDescription?: string;
  };
  confidence: number;
}
```

### 识别流程集成
1. **文档上传**: 用户在案件管理或债权申报页面上传PDF
2. **类型识别**: 系统自动识别文档类型（立案书/债权合同）
3. **内容解析**: 根据文档类型采用相应的解析策略
4. **结果验证**: 提供置信度评估和用户确认机制
5. **数据填充**: 将确认后的信息自动填充到业务表单
6. **关系建立**: 使用关系表建立企业、案件、债权之间的关联