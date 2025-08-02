# 群组数据库架构分析报告

## 📊 现有群组相关表结构分析

### ✅ 已存在的表结构

#### 1. `message_group` 表 (lines 420-439)
**现有字段**:
- `group_name`: 群组名称
- `group_description`: 群组描述  
- `group_avatar`: 群组头像
- `group_type`: 群组类型 ('normal', 'case_related', 'department')
- `case_id`: 关联案件ID
- `created_by`: 创建者
- `is_active`: 是否激活
- `max_members`: 最大成员数 (默认100)

**缺失字段**:
- `is_public`: 是否公开群组
- `require_approval`: 是否需要审批加入
- `allow_member_invite`: 是否允许成员邀请他人

#### 2. `group_member` 表 (lines 444-464)  
**现有字段**:
- `group_id`: 群组ID (指向message_group)
- `user_id`: 用户ID
- `role`: 角色 ('owner', 'admin', 'member')
- `joined_at`: 加入时间
- `last_read_at`: 最后已读时间
- `is_muted`: 是否静音
- `nickname`: 群内昵称

**缺失字段**:
- `invited_by`: 邀请者
- `permissions`: 详细权限设置

#### 3. `message_read_status` 表 (lines 992-1004) ✅
**已完整实现**:
- `message_id`: 消息ID
- `user_id`: 用户ID  
- `read_at`: 已读时间
- `group_id`: 群组ID

#### 4. `group_read_position` 表 (lines 1006-1018) ✅
**已完整实现**:
- `group_id`: 群组ID
- `user_id`: 用户ID
- `last_read_message_id`: 最后已读消息ID
- `last_read_time`: 最后已读时间
- `unread_count`: 未读数量

## 🔧 需要的架构更新

### 1. 扩展 `message_group` 表
需要添加以下字段以支持完整的群组功能：

```sql
-- 扩展message_group表字段
DEFINE FIELD is_public ON message_group TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD require_approval ON message_group TYPE bool DEFAULT false PERMISSIONS FULL;  
DEFINE FIELD allow_member_invite ON message_group TYPE bool DEFAULT true PERMISSIONS FULL;
```

### 2. 扩展 `group_member` 表
需要添加以下字段：

```sql
-- 扩展group_member表字段
DEFINE FIELD invited_by ON group_member TYPE option<record<user>> PERMISSIONS FULL;
DEFINE FIELD permissions ON group_member TYPE option<object> PERMISSIONS FULL;
```

### 3. 新增 `group_settings` 表
需要创建群组设置表以支持详细的群组配置：

```sql
DEFINE TABLE group_settings TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR update WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';
```

### 4. 更新消息类型支持
`message` 表已支持群组消息 (line 350 有 `group_id` 字段指向 `message_group`)

### 5. 添加群组邀请表
支持群组邀请功能：

```sql
DEFINE TABLE group_invitation TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE inviter_id = $auth.id OR invitee_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE inviter_id = $auth.id OR invitee_id = $auth.id,
  FOR delete WHERE inviter_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin';
```

## 🚧 GroupManager适配需求

### 主要适配项：
1. **表名更新**: 将 `group` 改为 `message_group`
2. **角色系统**: 简化为 ['owner', 'admin', 'member'] 
3. **权限模型**: 适配现有的简化权限结构
4. **字段映射**: 更新字段名称以匹配现有schema

## 📈 性能优化索引

现有索引已比较完善，可能需要补充：

```sql
-- 群组成员角色索引 (已存在)
DEFINE INDEX group_member_group_role_idx ON group_member FIELDS group_id, role;

-- 群组类型索引 (已存在)  
DEFINE INDEX message_group_type_idx ON message_group FIELDS group_type;

-- 可能需要的新索引
DEFINE INDEX group_settings_group_idx ON group_settings FIELDS group_id UNIQUE;
DEFINE INDEX group_invitation_status_idx ON group_invitation FIELDS status, created_at DESC;
```

## ✅ 结论

现有数据库架构已经为群组功能提供了良好的基础，主要需要：
1. 少量字段扩展
2. GroupManager代码适配
3. 新增群组设置和邀请表
4. 完善索引结构

这样的架构设计能够高效支持群组消息、成员管理、权限控制等核心功能。