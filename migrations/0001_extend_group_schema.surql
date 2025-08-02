-- ==========================================
-- 群组数据表结构扩展迁移脚本
-- 任务7.2.7: 创建数据库迁移脚本
-- 版本: 0001
-- 创建时间: 2024-01-01
-- ==========================================

-- ------------------------------
-- 1. 扩展 message_group 表字段
-- ------------------------------

-- 添加群组公开性设置字段
DEFINE FIELD is_public ON message_group TYPE bool DEFAULT false PERMISSIONS FULL;

-- 添加群组加入审批设置字段  
DEFINE FIELD require_approval ON message_group TYPE bool DEFAULT false PERMISSIONS FULL;

-- 添加群组成员邀请权限设置字段
DEFINE FIELD allow_member_invite ON message_group TYPE bool DEFAULT true PERMISSIONS FULL;

-- ------------------------------
-- 2. 扩展 group_member 表字段
-- ------------------------------

-- 添加邀请者字段
DEFINE FIELD invited_by ON group_member TYPE option<record<user>> PERMISSIONS FULL;

-- 添加详细权限设置字段 (JSON对象格式)
DEFINE FIELD permissions ON group_member TYPE option<object> PERMISSIONS FULL;

-- ------------------------------
-- 3. 创建 group_settings 表
-- ------------------------------

DEFINE TABLE group_settings TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR update WHERE $auth.id IN (SELECT user_id FROM group_member WHERE group_id = $parent.group_id AND role IN ['owner', 'admin']) OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

-- 群组设置表字段定义
DEFINE FIELD group_id ON group_settings TYPE record<message_group> PERMISSIONS FULL;
DEFINE FIELD allow_member_add_others ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD allow_member_edit_info ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD allow_member_pin_message ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD mute_all_members ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD message_history_visible_to_new_members ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD allow_anonymous_join ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD auto_delete_messages_after_days ON group_settings TYPE option<int> PERMISSIONS FULL;
DEFINE FIELD welcome_message ON group_settings TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD join_question ON group_settings TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON group_settings TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON group_settings TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

-- 群组设置表索引
DEFINE INDEX group_settings_group_idx ON group_settings FIELDS group_id UNIQUE;

-- ------------------------------
-- 4. 创建 group_invitation 表
-- ------------------------------

DEFINE TABLE group_invitation TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE inviter_id = $auth.id OR invitee_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id,
  FOR update WHERE inviter_id = $auth.id OR invitee_id = $auth.id,
  FOR delete WHERE inviter_id = $auth.id OR $auth.id->has_role->role.name CONTAINS 'admin';

-- 群组邀请表字段定义
DEFINE FIELD group_id ON group_invitation TYPE record<message_group> PERMISSIONS FULL;
DEFINE FIELD inviter_id ON group_invitation TYPE record<user> DEFAULT $auth.id PERMISSIONS FULL;
DEFINE FIELD invitee_id ON group_invitation TYPE record<user> PERMISSIONS FULL;
DEFINE FIELD invitee_email ON group_invitation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD invitation_message ON group_invitation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD status ON group_invitation TYPE string DEFAULT 'pending' ASSERT $value INSIDE ['pending', 'accepted', 'declined', 'expired', 'cancelled'] PERMISSIONS FULL;
DEFINE FIELD expires_at ON group_invitation TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD responded_at ON group_invitation TYPE option<datetime> PERMISSIONS FULL;
DEFINE FIELD response_message ON group_invitation TYPE option<string> PERMISSIONS FULL;
DEFINE FIELD created_at ON group_invitation TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON group_invitation TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

-- 群组邀请表索引
DEFINE INDEX group_invitation_group_idx ON group_invitation FIELDS group_id;
DEFINE INDEX group_invitation_inviter_idx ON group_invitation FIELDS inviter_id;
DEFINE INDEX group_invitation_invitee_idx ON group_invitation FIELDS invitee_id;
DEFINE INDEX group_invitation_status_idx ON group_invitation FIELDS status, created_at DESC;
DEFINE INDEX group_invitation_expires_idx ON group_invitation FIELDS expires_at;

-- ------------------------------
-- 5. 添加群组消息已读状态相关索引优化
-- 任务7.2.6: 添加群组消息已读状态索引
-- ------------------------------

-- 优化群组已读状态查询索引 (如果不存在)
DEFINE INDEX message_read_group_message_idx ON message_read_status FIELDS group_id, message_id;

-- 优化群组未读消息统计索引
DEFINE INDEX group_read_position_unread_idx ON group_read_position FIELDS user_id, unread_count DESC;

-- 优化群组最后消息时间索引
DEFINE INDEX group_read_position_time_idx ON group_read_position FIELDS group_id, last_read_time DESC;

-- ------------------------------
-- 6. 更新现有数据表的兼容性调整
-- ------------------------------

-- 确保group_member表的role字段支持新的角色类型 (如果需要OBSERVER角色)
-- 注意: 当前schema只支持 ['owner', 'admin', 'member']
-- 如果需要添加OBSERVER角色，需要执行以下语句：
-- DEFINE FIELD role ON group_member TYPE string DEFAULT 'member' ASSERT $value INSIDE ['owner', 'admin', 'member', 'observer'] PERMISSIONS FULL;

-- 为message_group表添加缺失索引（如果需要）
DEFINE INDEX message_group_created_at_idx ON message_group FIELDS created_at DESC;
DEFINE INDEX message_group_is_active_idx ON message_group FIELDS is_active;

-- 为group_member表添加性能优化索引
DEFINE INDEX group_member_joined_at_idx ON group_member FIELDS group_id, joined_at DESC;
DEFINE INDEX group_member_last_read_idx ON group_member FIELDS group_id, last_read_at DESC;

-- ------------------------------
-- 7. 数据完整性约束和触发器
-- ------------------------------

-- 确保group_settings表与message_group表的一对一关系
-- (SurrealDB会通过UNIQUE索引自动保证)

-- 确保group_invitation表的invitee不能是已存在的群组成员
-- (这个约束需要在应用层处理，SurrealDB不支持复杂的CHECK约束)

-- ------------------------------
-- 迁移脚本完成标记
-- ------------------------------

-- 记录迁移版本（可选，用于迁移历史追踪）
DEFINE TABLE schema_migrations TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select, create, update, delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD version ON schema_migrations TYPE string PERMISSIONS FULL;
DEFINE FIELD description ON schema_migrations TYPE string PERMISSIONS FULL;
DEFINE FIELD applied_at ON schema_migrations TYPE datetime DEFAULT time::now() PERMISSIONS FULL;

DEFINE INDEX schema_migrations_version_idx ON schema_migrations FIELDS version UNIQUE;

-- 插入当前迁移记录
CREATE schema_migrations SET 
  version = '0001_extend_group_schema',
  description = '扩展群组数据表结构，添加群组设置和邀请功能',
  applied_at = time::now();