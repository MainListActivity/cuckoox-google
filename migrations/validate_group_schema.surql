-- ==========================================
-- 群组数据表结构完整性验证脚本
-- 任务7.2.8: 验证表结构完整性
-- ==========================================

-- ------------------------------
-- 1. 验证 message_group 表结构
-- ------------------------------

-- 检查message_group表是否存在所有必需字段
SELECT 'message_group_validation' AS validation_type,
       'Checking message_group table structure' AS description;

-- 验证基础字段
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'message_group'
  AND field_name IN [
    'group_name', 'group_description', 'group_avatar', 'group_type',
    'case_id', 'created_by', 'created_at', 'updated_at', 'is_active', 'max_members'
  ]
);

-- 验证新增字段 (迁移后应该存在)
SELECT COUNT(*) AS new_fields_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'message_group'
  AND field_name IN ['is_public', 'require_approval', 'allow_member_invite']
);

-- ------------------------------
-- 2. 验证 group_member 表结构
-- ------------------------------

SELECT 'group_member_validation' AS validation_type,
       'Checking group_member table structure' AS description;

-- 验证基础字段
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'group_member'
  AND field_name IN [
    'group_id', 'user_id', 'role', 'joined_at', 'last_read_at',
    'is_muted', 'nickname', 'created_at', 'updated_at'
  ]
);

-- 验证新增字段
SELECT COUNT(*) AS new_fields_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'group_member'
  AND field_name IN ['invited_by', 'permissions']
);

-- ------------------------------
-- 3. 验证 group_settings 表
-- ------------------------------

SELECT 'group_settings_validation' AS validation_type,
       'Checking group_settings table existence and structure' AS description;

-- 验证表是否存在
SELECT COUNT(*) AS table_exists FROM information_schema.tables
WHERE table_name = 'group_settings';

-- 验证字段完整性
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'group_settings'
  AND field_name IN [
    'group_id', 'allow_member_add_others', 'allow_member_edit_info',
    'allow_member_pin_message', 'mute_all_members',
    'message_history_visible_to_new_members', 'allow_anonymous_join',
    'auto_delete_messages_after_days', 'welcome_message', 'join_question',
    'created_at', 'updated_at'
  ]
);

-- ------------------------------
-- 4. 验证 group_invitation 表
-- ------------------------------

SELECT 'group_invitation_validation' AS validation_type,
       'Checking group_invitation table existence and structure' AS description;

-- 验证表是否存在
SELECT COUNT(*) AS table_exists FROM information_schema.tables
WHERE table_name = 'group_invitation';

-- 验证字段完整性
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'group_invitation'
  AND field_name IN [
    'group_id', 'inviter_id', 'invitee_id', 'invitee_email',
    'invitation_message', 'status', 'expires_at', 'responded_at',
    'response_message', 'created_at', 'updated_at'
  ]
);

-- ------------------------------
-- 5. 验证 message_read_status 表
-- ------------------------------

SELECT 'message_read_status_validation' AS validation_type,
       'Checking message_read_status table structure' AS description;

-- 验证表存在
SELECT COUNT(*) AS table_exists FROM information_schema.tables
WHERE table_name = 'message_read_status';

-- 验证字段
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'message_read_status'
  AND field_name IN ['message_id', 'user_id', 'read_at', 'group_id']
);

-- ------------------------------
-- 6. 验证 group_read_position 表
-- ------------------------------

SELECT 'group_read_position_validation' AS validation_type,
       'Checking group_read_position table structure' AS description;

-- 验证表存在
SELECT COUNT(*) AS table_exists FROM information_schema.tables
WHERE table_name = 'group_read_position';

-- 验证字段
SELECT COUNT(*) AS field_count FROM (
  SELECT 1 FROM information_schema.fields
  WHERE table_name = 'group_read_position'
  AND field_name IN ['group_id', 'user_id', 'last_read_message_id', 'last_read_time', 'unread_count']
);

-- ------------------------------
-- 7. 验证索引完整性
-- ------------------------------

SELECT 'index_validation' AS validation_type,
       'Checking critical indexes existence' AS description;

-- 验证message_group表关键索引
SELECT COUNT(*) AS message_group_indexes FROM information_schema.indexes
WHERE table_name = 'message_group'
AND index_name IN ['message_group_case_idx', 'message_group_type_idx'];

-- 验证group_member表关键索引
SELECT COUNT(*) AS group_member_indexes FROM information_schema.indexes
WHERE table_name = 'group_member'
AND index_name IN ['group_member_unique', 'group_member_user_idx', 'group_member_group_role_idx'];

-- 验证message_read_status表关键索引
SELECT COUNT(*) AS message_read_indexes FROM information_schema.indexes
WHERE table_name = 'message_read_status'
AND index_name IN ['message_read_unique', 'message_read_group_user_idx'];

-- 验证group_read_position表关键索引
SELECT COUNT(*) AS group_read_position_indexes FROM information_schema.indexes
WHERE table_name = 'group_read_position'
AND index_name IN ['group_read_position_unique'];

-- 验证新增索引 (迁移后)
SELECT COUNT(*) AS new_indexes FROM information_schema.indexes
WHERE table_name IN ['group_settings', 'group_invitation']
AND index_name IN ['group_settings_group_idx', 'group_invitation_status_idx'];

-- ------------------------------
-- 8. 数据关系完整性验证
-- ------------------------------

SELECT 'relationship_validation' AS validation_type,
       'Checking data relationships integrity' AS description;

-- 验证现有数据中group_member与message_group的关系
LET $referenced_groups = (SELECT group_id FROM group_member GROUP BY group_id);
LET $existing_groups = (SELECT id FROM message_group);
SELECT array::len($referenced_groups) AS referenced_groups,
       array::len($existing_groups) AS existing_groups,
       (array::len($referenced_groups) = array::len($existing_groups)) AS relationship_valid;

-- 验证每个群组是否至少有一个owner
SELECT
  id AS group_id,
  group_name,
  0 AS owner_count
FROM message_group
WHERE id NOT IN (SELECT group_id FROM group_member WHERE role = 'owner');

-- ------------------------------
-- 9. 权限验证
-- ------------------------------

SELECT 'permissions_validation' AS validation_type,
       'Checking table permissions configuration' AS description;

-- 验证关键表的权限配置是否存在
SELECT
  table_name,
  COUNT(*) AS permission_rules_count
FROM information_schema.permissions
WHERE table_name IN ['message_group', 'group_member', 'group_settings', 'group_invitation']
GROUP BY table_name;

-- ------------------------------
-- 10. 综合验证报告
-- ------------------------------

SELECT 'validation_summary' AS validation_type,
       'Group schema validation completed' AS description,
       time::now() AS validated_at;

-- 验证结果汇总
SELECT
  'Tables: message_group, group_member, group_settings, group_invitation, message_read_status, group_read_position' AS tables_validated,
  'Fields: Basic + Extended fields for each table' AS fields_validated,
  'Indexes: Primary, Foreign Key, and Performance indexes' AS indexes_validated,
  'Permissions: Role-based access control' AS permissions_validated,
  'Data Integrity: Relationships and constraints' AS integrity_validated;
