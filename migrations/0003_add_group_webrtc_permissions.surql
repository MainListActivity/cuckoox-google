-- ==========================================
-- 群组WebRTC权限扩展迁移脚本
-- 任务11.2-B: 扩展群组权限数据库模式
-- 版本: 0003
-- 创建时间: 2024-01-01
-- ==========================================

-- ------------------------------
-- 1. 扩展群组设置支持WebRTC权限
-- ------------------------------

-- 为group_settings表添加WebRTC相关的群组级别控制
DEFINE FIELD webrtc_voice_calls_enabled ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD webrtc_video_calls_enabled ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD webrtc_group_calls_enabled ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD webrtc_screen_sharing_enabled ON group_settings TYPE bool DEFAULT true PERMISSIONS FULL;
DEFINE FIELD webrtc_call_recording_enabled ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;

-- 添加WebRTC权限管理设置
DEFINE FIELD webrtc_member_can_create_calls ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD webrtc_member_can_share_screen ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD webrtc_auto_answer_enabled ON group_settings TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD webrtc_max_participants ON group_settings TYPE int DEFAULT 50 PERMISSIONS FULL;

-- ------------------------------
-- 2. 为现有群组设置默认WebRTC配置
-- ------------------------------

-- 为所有现有群组添加默认WebRTC设置
UPDATE group_settings SET 
  webrtc_voice_calls_enabled = true,
  webrtc_video_calls_enabled = true,
  webrtc_group_calls_enabled = true,
  webrtc_screen_sharing_enabled = true,
  webrtc_call_recording_enabled = false,
  webrtc_member_can_create_calls = false,
  webrtc_member_can_share_screen = false,
  webrtc_auto_answer_enabled = false,
  webrtc_max_participants = 50;

-- ------------------------------
-- 3. 更新群组成员权限结构
-- ------------------------------

-- 为现有群组成员添加默认WebRTC权限
-- 根据角色设置不同的默认权限

-- 为群主设置完整WebRTC权限
FOR $member IN (SELECT * FROM group_member WHERE role = 'owner') {
  UPDATE $member.id SET permissions = {
    // 保留现有权限
    can_send_message: $member.permissions.can_send_message OR true,
    can_add_member: $member.permissions.can_add_member OR true,
    can_remove_member: $member.permissions.can_remove_member OR true,
    can_edit_info: $member.permissions.can_edit_info OR true,
    can_pin_message: $member.permissions.can_pin_message OR true,
    can_manage_settings: $member.permissions.can_manage_settings OR true,
    
    // 添加WebRTC权限 - 群主拥有所有权限
    can_initiate_voice_call: true,
    can_answer_voice_call: true,
    can_initiate_video_call: true,
    can_answer_video_call: true,
    can_create_group_call: true,
    can_join_group_call: true,
    can_manage_group_call: true,
    can_control_microphone: true,
    can_control_camera: true,
    can_share_screen: true,
    can_record_call: true,
    can_end_call: true,
    can_reject_call: true,
    can_invite_to_call: true,
    can_control_others_media: true
  };
};

-- 为管理员设置WebRTC权限
FOR $member IN (SELECT * FROM group_member WHERE role = 'admin') {
  UPDATE $member.id SET permissions = {
    // 保留现有权限
    can_send_message: $member.permissions.can_send_message OR true,
    can_add_member: $member.permissions.can_add_member OR true,
    can_remove_member: $member.permissions.can_remove_member OR true,
    can_edit_info: $member.permissions.can_edit_info OR false,
    can_pin_message: $member.permissions.can_pin_message OR true,
    can_manage_settings: $member.permissions.can_manage_settings OR false,
    
    // 添加WebRTC权限 - 管理员拥有大部分权限
    can_initiate_voice_call: true,
    can_answer_voice_call: true,
    can_initiate_video_call: true,
    can_answer_video_call: true,
    can_create_group_call: true,
    can_join_group_call: true,
    can_manage_group_call: true,
    can_control_microphone: true,
    can_control_camera: true,
    can_share_screen: true,
    can_record_call: false,
    can_end_call: true,
    can_reject_call: true,
    can_invite_to_call: true,
    can_control_others_media: true
  };
};

-- 为普通成员设置基础WebRTC权限
FOR $member IN (SELECT * FROM group_member WHERE role = 'member') {
  UPDATE $member.id SET permissions = {
    // 保留现有权限
    can_send_message: $member.permissions.can_send_message OR true,
    can_add_member: $member.permissions.can_add_member OR false,
    can_remove_member: $member.permissions.can_remove_member OR false,
    can_edit_info: $member.permissions.can_edit_info OR false,
    can_pin_message: $member.permissions.can_pin_message OR false,
    can_manage_settings: $member.permissions.can_manage_settings OR false,
    
    // 添加WebRTC权限 - 普通成员基础权限
    can_initiate_voice_call: true,
    can_answer_voice_call: true,
    can_initiate_video_call: true,
    can_answer_video_call: true,
    can_create_group_call: false,
    can_join_group_call: true,
    can_manage_group_call: false,
    can_control_microphone: true,
    can_control_camera: true,
    can_share_screen: false,
    can_record_call: false,
    can_end_call: true,
    can_reject_call: true,
    can_invite_to_call: false,
    can_control_others_media: false
  };
};

-- ------------------------------
-- 4. 创建WebRTC权限验证函数
-- ------------------------------

-- 定义函数：检查用户是否具有特定WebRTC权限
DEFINE FUNCTION fn::check_group_webrtc_permission($group_id: record<message_group>, $user_id: record<user>, $permission: string) {
  -- 获取用户在群组中的权限
  LET $member = (SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id LIMIT 1);
  
  -- 如果不是群组成员，返回false
  IF !$member {
    RETURN false;
  };
  
  -- 群主拥有所有权限
  IF $member[0].role = 'owner' {
    RETURN true;
  };
  
  -- 检查特定权限
  RETURN $member[0].permissions[$permission] OR false;
};

-- 定义函数：获取用户在群组中的所有WebRTC权限
DEFINE FUNCTION fn::get_group_webrtc_permissions($group_id: record<message_group>, $user_id: record<user>) {
  LET $member = (SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id LIMIT 1);
  
  IF !$member {
    RETURN {};
  };
  
  -- 群主拥有所有权限
  IF $member[0].role = 'owner' {
    RETURN {
      can_initiate_voice_call: true,
      can_answer_voice_call: true,
      can_initiate_video_call: true,
      can_answer_video_call: true,
      can_create_group_call: true,
      can_join_group_call: true,
      can_manage_group_call: true,
      can_control_microphone: true,
      can_control_camera: true,
      can_share_screen: true,
      can_record_call: true,
      can_end_call: true,
      can_reject_call: true,
      can_invite_to_call: true,
      can_control_others_media: true
    };
  };
  
  -- 返回用户的具体权限
  RETURN $member[0].permissions;
};

-- ------------------------------
-- 5. 创建WebRTC权限索引
-- ------------------------------

-- 为WebRTC权限查询创建复合索引
DEFINE INDEX group_member_webrtc_idx ON group_member FIELDS group_id, user_id, role;

-- 为群组WebRTC设置创建索引
DEFINE INDEX group_settings_webrtc_idx ON group_settings FIELDS group_id, webrtc_voice_calls_enabled, webrtc_video_calls_enabled, webrtc_group_calls_enabled;

-- ------------------------------
-- 6. 创建权限模板表
-- ------------------------------

DEFINE TABLE group_permission_template TYPE NORMAL SCHEMAFULL PERMISSIONS 
  FOR select WHERE $auth.id->has_role->role.name CONTAINS 'admin',
  FOR create WHERE $auth.id->has_role->role.name CONTAINS 'admin',
  FOR update WHERE $auth.id->has_role->role.name CONTAINS 'admin',
  FOR delete WHERE $auth.id->has_role->role.name CONTAINS 'admin';

DEFINE FIELD role ON group_permission_template TYPE string ASSERT $value INSIDE ['owner', 'admin', 'member'] PERMISSIONS FULL;
DEFINE FIELD permissions ON group_permission_template TYPE object PERMISSIONS FULL;
DEFINE FIELD description ON group_permission_template TYPE string PERMISSIONS FULL;
DEFINE FIELD is_default ON group_permission_template TYPE bool DEFAULT false PERMISSIONS FULL;
DEFINE FIELD created_at ON group_permission_template TYPE datetime DEFAULT time::now() READONLY PERMISSIONS FULL;
DEFINE FIELD updated_at ON group_permission_template TYPE datetime READONLY VALUE time::now() PERMISSIONS FULL;

DEFINE INDEX group_permission_template_role_idx ON group_permission_template FIELDS role, is_default;

-- 插入默认权限模板
CREATE group_permission_template SET 
  role = 'owner',
  permissions = {
    can_send_message: true, can_add_member: true, can_remove_member: true,
    can_edit_info: true, can_pin_message: true, can_manage_settings: true,
    can_initiate_voice_call: true, can_answer_voice_call: true,
    can_initiate_video_call: true, can_answer_video_call: true,
    can_create_group_call: true, can_join_group_call: true, can_manage_group_call: true,
    can_control_microphone: true, can_control_camera: true, can_share_screen: true,
    can_record_call: true, can_end_call: true, can_reject_call: true,
    can_invite_to_call: true, can_control_others_media: true
  },
  description = '群主拥有群组所有权限，包括所有WebRTC功能',
  is_default = true;

CREATE group_permission_template SET 
  role = 'admin',
  permissions = {
    can_send_message: true, can_add_member: true, can_remove_member: true,
    can_edit_info: false, can_pin_message: true, can_manage_settings: false,
    can_initiate_voice_call: true, can_answer_voice_call: true,
    can_initiate_video_call: true, can_answer_video_call: true,
    can_create_group_call: true, can_join_group_call: true, can_manage_group_call: true,
    can_control_microphone: true, can_control_camera: true, can_share_screen: true,
    can_record_call: false, can_end_call: true, can_reject_call: true,
    can_invite_to_call: true, can_control_others_media: true
  },
  description = '管理员拥有群组管理权限和大部分WebRTC功能，不能修改群组基本信息',
  is_default = true;

CREATE group_permission_template SET 
  role = 'member',
  permissions = {
    can_send_message: true, can_add_member: false, can_remove_member: false,
    can_edit_info: false, can_pin_message: false, can_manage_settings: false,
    can_initiate_voice_call: true, can_answer_voice_call: true,
    can_initiate_video_call: true, can_answer_video_call: true,
    can_create_group_call: false, can_join_group_call: true, can_manage_group_call: false,
    can_control_microphone: true, can_control_camera: true, can_share_screen: false,
    can_record_call: false, can_end_call: true, can_reject_call: true,
    can_invite_to_call: false, can_control_others_media: false
  },
  description = '普通成员拥有基础聊天和通话权限，受到一定限制',
  is_default = true;

-- ------------------------------
-- 7. 数据完整性验证
-- ------------------------------

-- 验证所有群组成员都有WebRTC权限配置
SELECT 
  COUNT(*) AS total_members,
  COUNT(CASE WHEN permissions.can_initiate_voice_call IS NOT NULL THEN 1 END) AS members_with_webrtc_permissions
FROM group_member;

-- 验证所有群组都有WebRTC设置
SELECT 
  COUNT(*) AS total_groups_with_settings,
  COUNT(CASE WHEN webrtc_voice_calls_enabled IS NOT NULL THEN 1 END) AS groups_with_webrtc_settings
FROM group_settings;

-- ------------------------------
-- 迁移脚本完成标记
-- ------------------------------

-- 记录迁移版本
CREATE schema_migrations SET 
  version = '0003_add_group_webrtc_permissions',
  description = '为群组添加WebRTC权限支持，包括权限模板和验证函数',
  applied_at = time::now();