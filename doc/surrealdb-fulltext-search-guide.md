# SurrealDB 全文检索使用指南

## 概述

SurrealDB 提供了强大的全文检索功能，支持多语言文本搜索、关键词高亮、相关性评分等特性。本指南详细介绍如何在破产案件管理平台中使用这些功能。

## 核心功能

### 1. 全文检索操作符

SurrealDB 使用 `@@` 操作符进行全文检索：

```sql
-- 基本全文检索
SELECT * FROM case WHERE name @@ "破产重整";

-- 多字段检索（带编号）
SELECT * FROM case 
WHERE name @0@ "破产重整" 
   OR description @1@ "债权申报";
```

### 2. 搜索函数

#### search::highlight()
高亮匹配的关键词：

```sql
SELECT *,
  search::highlight("**", "**", 0) AS highlighted_name,
  search::highlight("##", "##", 1) AS highlighted_description
FROM case
WHERE name @0@ "破产重整"
   OR description @1@ "债权申报";
```

**参数说明**:
- 第一个参数：高亮开始标记
- 第二个参数：高亮结束标记  
- 第三个参数：对应 `@@` 操作符的编号

#### search::score()
计算搜索相关性评分：

```sql
SELECT *,
  search::score(0) AS name_score,
  search::score(1) AS description_score,
  search::score(0) + search::score(1) AS total_score
FROM case
WHERE name @0@ "破产重整"
   OR description @1@ "债权申报"
ORDER BY total_score DESC;
```

#### search::offsets()
返回匹配关键词的位置信息：

```sql
SELECT *,
  search::offsets(0) AS name_offsets,
  search::offsets(1) AS description_offsets
FROM case
WHERE name @0@ "破产重整"
   OR description @1@ "债权申报";
```

#### search::analyze()
测试搜索分析器的输出：

```sql
SELECT search::analyze("standard", "破产重整案件管理");
```

## 实际应用示例

### 1. 案件搜索

```sql
-- 综合案件搜索
SELECT *,
  search::highlight("**", "**", 0) AS highlighted_name,
  search::highlight("##", "##", 1) AS highlighted_description,
  search::score(0) + search::score(1) AS relevance_score
FROM case
WHERE name @0@ $keyword
   OR description @1@ $keyword
ORDER BY relevance_score DESC
LIMIT 20;
```

### 2. 债权人搜索

```sql
-- 债权人姓名搜索
SELECT *,
  search::highlight("->", "<-", 0) AS highlighted_name,
  search::score(0) AS name_score
FROM creditor
WHERE name @0@ $searchTerm
ORDER BY name_score DESC
LIMIT 50;
```

### 3. 文档内容搜索

```sql
-- 文档全文搜索
SELECT *,
  search::highlight("**", "**", 0) AS highlighted_title,
  search::highlight("##", "##", 1) AS highlighted_content,
  search::score(0) * 2 + search::score(1) AS weighted_score
FROM document
WHERE title @0@ $keyword
   OR content @1@ $keyword
ORDER BY weighted_score DESC
LIMIT 30;
```

### 4. 多条件复合搜索

```sql
-- 复合搜索条件
SELECT *,
  search::highlight("**", "**", 0) AS highlighted_name,
  search::highlight("##", "##", 1) AS highlighted_description,
  search::highlight("->", "<-", 2) AS highlighted_notes,
  search::score(0) * 3 + search::score(1) * 2 + search::score(2) AS weighted_score
FROM case
WHERE (name @0@ $keyword OR description @1@ $keyword OR notes @2@ $keyword)
  AND status IN ["active", "pending"]
  AND created_at > $startDate
ORDER BY weighted_score DESC, created_at DESC
LIMIT 25;
```

## 在 TypeScript 中的使用

### 1. 基础搜索服务

```typescript
interface SearchResult<T> {
  data: T;
  highlighted_name?: string;
  highlighted_description?: string;
  relevance_score: number;
}

class FullTextSearchService {
  constructor(private surreal: SurrealService) {}

  async searchCases(keyword: string, userId: string, caseId?: string): Promise<SearchResult<Case>[]> {
    const sql = `
      SELECT *,
        search::highlight("**", "**", 0) AS highlighted_name,
        search::highlight("##", "##", 1) AS highlighted_description,
        search::score(0) + search::score(1) AS relevance_score
      FROM case
      WHERE name @0@ $keyword
         OR description @1@ $keyword
      ORDER BY relevance_score DESC
      LIMIT 20
    `;

    return await this.surreal.query(sql, { keyword }, userId, caseId);
  }

  async searchCreditors(searchTerm: string, userId: string, caseId?: string): Promise<SearchResult<Creditor>[]> {
    const sql = `
      SELECT *,
        search::highlight("->", "<-", 0) AS highlighted_name,
        search::score(0) AS relevance_score
      FROM creditor
      WHERE name @0@ $searchTerm
      ORDER BY relevance_score DESC
      LIMIT 50
    `;

    return await this.surreal.query(sql, { searchTerm }, userId, caseId);
  }

  async searchDocuments(keyword: string, userId: string, caseId?: string): Promise<SearchResult<Document>[]> {
    const sql = `
      SELECT *,
        search::highlight("**", "**", 0) AS highlighted_title,
        search::highlight("##", "##", 1) AS highlighted_content,
        search::score(0) * 2 + search::score(1) AS relevance_score
      FROM document
      WHERE title @0@ $keyword
         OR content @1@ $keyword
      ORDER BY relevance_score DESC
      LIMIT 30
    `;

    return await this.surreal.query(sql, { keyword }, userId, caseId);
  }
}
```

### 2. React Hook 封装

```typescript
import { useState, useCallback } from 'react';
import { useSurreal } from '@/src/contexts/SurrealProvider';

interface UseFullTextSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

export function useFullTextSearch<T>(
  searchFunction: (keyword: string, userId: string, caseId?: string) => Promise<SearchResult<T>[]>,
  options: UseFullTextSearchOptions = {}
) {
  const { debounceMs = 300, minQueryLength = 2 } = options;
  const [results, setResults] = useState<SearchResult<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    debounce(async (keyword: string, userId: string, caseId?: string) => {
      if (keyword.length < minQueryLength) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchResults = await searchFunction(keyword, userId, caseId);
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : '搜索失败');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs),
    [searchFunction, debounceMs, minQueryLength]
  );

  return { results, loading, error, search };
}

// 防抖函数
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  }) as T;
}
```

### 3. 搜索组件示例

```typescript
import React, { useState } from 'react';
import { TextField, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { useFullTextSearch } from '@/src/hooks/useFullTextSearch';
import { FullTextSearchService } from '@/src/services/fullTextSearchService';

interface CaseSearchProps {
  onCaseSelect: (case: Case) => void;
}

export function CaseSearch({ onCaseSelect }: CaseSearchProps) {
  const [keyword, setKeyword] = useState('');
  const searchService = new FullTextSearchService(surreal);
  
  const { results, loading, error, search } = useFullTextSearch(
    searchService.searchCases.bind(searchService),
    { debounceMs: 300, minQueryLength: 2 }
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setKeyword(value);
    search(value, userId, caseId);
  };

  return (
    <div>
      <TextField
        fullWidth
        label="搜索案件"
        value={keyword}
        onChange={handleInputChange}
        placeholder="输入案件名称或描述关键词..."
        InputProps={{
          endAdornment: loading && <CircularProgress size={20} />
        }}
      />
      
      {error && (
        <div style={{ color: 'red', marginTop: 8 }}>
          搜索出错: {error}
        </div>
      )}
      
      <List>
        {results.map((result, index) => (
          <ListItem 
            key={index} 
            button 
            onClick={() => onCaseSelect(result.data)}
          >
            <ListItemText
              primary={
                <div dangerouslySetInnerHTML={{ 
                  __html: result.highlighted_name || result.data.name 
                }} />
              }
              secondary={
                <div dangerouslySetInnerHTML={{ 
                  __html: result.highlighted_description || result.data.description 
                }} />
              }
            />
            <div style={{ marginLeft: 16, fontSize: '0.8em', color: '#666' }}>
              相关性: {result.relevance_score.toFixed(2)}
            </div>
          </ListItem>
        ))}
      </List>
    </div>
  );
}
```

## 智能缓存系统集成

### 缓存优化策略

全文检索查询会被智能缓存系统自动优化：

```typescript
// 搜索结果会被缓存，提升重复搜索的响应速度
const searchResult = await enhancedQueryHandler.handleQuery(`
  SELECT *,
    search::highlight("**", "**", 0) AS highlighted_name,
    search::score(0) AS relevance_score
  FROM case
  WHERE name @0@ $keyword
  ORDER BY relevance_score DESC
  LIMIT 20
`, { keyword: "破产重整" }, userId, caseId);
```

### 缓存特性

- **检索结果缓存**: 常用搜索关键词的结果会被缓存
- **本地检索**: 对于已缓存的数据，支持本地全文检索
- **混合检索**: 结合本地缓存和远程数据库
- **增量索引**: 实时更新本地全文检索索引

## 性能优化建议

### 1. 查询优化

```sql
-- 使用 LIMIT 限制结果数量
SELECT * FROM case 
WHERE name @@ $keyword 
ORDER BY search::score(0) DESC 
LIMIT 50;

-- 结合其他条件缩小搜索范围
SELECT * FROM case 
WHERE name @@ $keyword 
  AND status = "active"
  AND created_at > $startDate
ORDER BY search::score(0) DESC 
LIMIT 20;
```

### 2. 索引优化

确保搜索字段有适当的全文索引：

```sql
-- 创建全文索引（在数据库设计阶段）
DEFINE INDEX case_name_fulltext ON case FIELDS name SEARCH ANALYZER ascii BM25;
DEFINE INDEX case_description_fulltext ON case FIELDS description SEARCH ANALYZER ascii BM25;
```

### 3. 缓存策略

```typescript
// 为搜索功能配置合适的缓存策略
await sendMessage({
  type: 'configure_table_cache',
  payload: {
    table: 'case',
    config: {
      defaultStrategy: 'HYBRID',  // 混合策略适合搜索场景
      consistencyRequirement: 'EVENTUAL',
      defaultTTL: 30 * 60 * 1000, // 30分钟缓存
      priority: 8
    }
  }
});
```

## 最佳实践

### 1. 搜索体验优化

- **防抖处理**: 避免频繁的搜索请求
- **最小查询长度**: 设置合理的最小搜索字符数
- **结果高亮**: 使用 `search::highlight()` 提升用户体验
- **相关性排序**: 利用 `search::score()` 提供最相关的结果

### 2. 性能考虑

- **结果限制**: 使用 `LIMIT` 控制返回结果数量
- **条件过滤**: 结合业务条件缩小搜索范围
- **缓存利用**: 充分利用智能缓存系统的优化

### 3. 用户体验

- **加载状态**: 显示搜索进度指示器
- **错误处理**: 提供友好的错误提示
- **空状态**: 处理无搜索结果的情况
- **搜索历史**: 考虑保存用户的搜索历史

## 故障排除

### 常见问题

1. **搜索无结果**: 检查全文索引是否正确创建
2. **中文搜索问题**: 确认使用了支持中文的分析器
3. **性能问题**: 检查查询是否有适当的限制条件
4. **高亮显示问题**: 确认 `search::highlight()` 的参数设置

### 调试技巧

```sql
-- 测试分析器输出
SELECT search::analyze("standard", "破产重整案件管理");

-- 检查搜索评分
SELECT *, search::score(0) AS score 
FROM case 
WHERE name @0@ "破产重整" 
ORDER BY score DESC;

-- 查看匹配位置
SELECT *, search::offsets(0) AS offsets 
FROM case 
WHERE name @0@ "破产重整";
```

通过合理使用 SurrealDB 的全文检索功能，可以为破产案件管理平台提供强大而高效的搜索体验，帮助用户快速找到所需的信息。