import { RecordId } from "surrealdb";

// 群组基础信息接口
export interface Group {
  id: RecordId | string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: "case_related" | "department" | "normal";
  case_id?: RecordId | string; // 案件相关群组
  max_members?: number;
  is_public?: boolean; // 是否公开群组 (迁移后字段)
  require_approval?: boolean; // 是否需要审批加入 (迁移后字段)
  allow_member_invite?: boolean; // 是否允许成员邀请他人 (迁移后字段)
  created_by: RecordId | string;
  created_at: string;
  updated_at: string;
}

// 群组成员角色定义
export type GroupMemberRole = "owner" | "admin" | "member";

// WebRTC权限组定义（方便批量操作）
export interface WebRTCPermissionGroups {
  VOICE_CALLING: (keyof GroupMemberPermissions)[];
  VIDEO_CALLING: (keyof GroupMemberPermissions)[];
  GROUP_CALLING: (keyof GroupMemberPermissions)[];
  MEDIA_CONTROLS: (keyof GroupMemberPermissions)[];
  CALL_MANAGEMENT: (keyof GroupMemberPermissions)[];
  ADVANCED_CONTROLS: (keyof GroupMemberPermissions)[];
}

// WebRTC权限组常量
export const WEBRTC_PERMISSION_GROUPS: WebRTCPermissionGroups = {
  VOICE_CALLING: ["can_initiate_voice_call", "can_answer_voice_call"],
  VIDEO_CALLING: ["can_initiate_video_call", "can_answer_video_call"],
  GROUP_CALLING: [
    "can_create_group_call",
    "can_join_group_call",
    "can_manage_group_call",
  ],
  MEDIA_CONTROLS: [
    "can_control_microphone",
    "can_control_camera",
    "can_share_screen",
  ],
  CALL_MANAGEMENT: ["can_end_call", "can_reject_call", "can_invite_to_call"],
  ADVANCED_CONTROLS: ["can_record_call", "can_control_others_media"],
} as const;

// 群组成员权限接口
export interface GroupMemberPermissions {
  // 基础群组权限
  can_send_message?: boolean;
  can_add_member?: boolean;
  can_remove_member?: boolean;
  can_edit_info?: boolean;
  can_pin_message?: boolean;
  can_manage_settings?: boolean;

  // WebRTC语音通话权限
  can_initiate_voice_call?: boolean;
  can_answer_voice_call?: boolean;

  // WebRTC视频通话权限
  can_initiate_video_call?: boolean;
  can_answer_video_call?: boolean;

  // WebRTC群组通话权限
  can_create_group_call?: boolean;
  can_join_group_call?: boolean;
  can_manage_group_call?: boolean; // 管理群组通话（邀请、踢出参与者等）

  // WebRTC媒体控制权限
  can_control_microphone?: boolean;
  can_control_camera?: boolean;
  can_share_screen?: boolean;
  can_record_call?: boolean; // 录制通话

  // WebRTC通话管理权限
  can_end_call?: boolean;
  can_reject_call?: boolean;
  can_invite_to_call?: boolean; // 邀请他人加入通话
  can_control_others_media?: boolean; // 控制他人媒体（管理员功能）
}

// 群组成员信息接口
export interface GroupMember {
  id: RecordId | string;
  group_id: RecordId | string;
  user_id: RecordId | string;
  role: GroupMemberRole;
  nickname?: string; // 群内昵称
  joined_at: string;
  invited_by?: RecordId | string;
  permissions?: GroupMemberPermissions;
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

// 扩展的群组成员信息（包含用户基本信息）
export interface ExtendedGroupMember extends GroupMember {
  user_name: string;
  user_avatar?: string;
  user_email?: string;
  is_online?: boolean;
}

// 群组设置接口
export interface GroupSettings {
  id?: RecordId | string;
  group_id: RecordId | string;
  allow_all_member_at: boolean; // 是否允许@所有人
  allow_member_edit_info: boolean; // 是否允许成员修改群信息
  message_auto_delete_days?: number; // 消息自动删除天数
  file_sharing_enabled: boolean; // 是否允许文件分享
  call_enabled: boolean; // 是否允许群通话
  screen_share_enabled: boolean; // 是否允许屏幕共享
  member_join_notification: boolean; // 成员加入通知
  member_leave_notification: boolean; // 成员离开通知
  created_at: string;
  updated_at: string;
}

// 群组邀请状态
export type GroupInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED";

// 群组邀请接口
export interface GroupInvitation {
  id: RecordId | string;
  group_id: RecordId | string;
  inviter_id: RecordId | string;
  invitee_id: RecordId | string;
  status: GroupInvitationStatus;
  message?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// 扩展的群组邀请信息（包含群组和用户信息）
export interface ExtendedGroupInvitation extends GroupInvitation {
  group_name: string;
  group_avatar?: string;
  inviter_name: string;
  invitee_name: string;
}

// 群组统计信息
export interface GroupStats {
  total_members: number;
  online_members: number;
  messages_today: number;
  files_shared: number;
  created_days_ago: number;
}

// 扩展的群组信息（包含成员统计和设置）
export interface ExtendedGroup extends Group {
  settings?: GroupSettings;
  stats?: GroupStats;
  member_count?: number;
  current_user_role?: GroupMemberRole;
  current_user_permissions?: GroupMemberPermissions;
  recent_members?: ExtendedGroupMember[];
}

// 群组列表项（用于显示群组列表）
export interface GroupListItem {
  id: RecordId | string;
  name: string;
  avatar_url?: string;
  type: Group["type"];
  member_count: number;
  last_message_content?: string;
  last_message_time?: string;
  last_message_sender?: string;
  unread_count: number;
  is_muted: boolean;
  current_user_role: GroupMemberRole;
}

// 群组搜索结果
export interface GroupSearchResult {
  id: RecordId | string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: Group["type"];
  member_count: number;
  is_public: boolean;
  is_member: boolean;
  case_name?: string; // 如果是案件群组
}

// 群组活动日志类型
export type GroupActivityType =
  | "MEMBER_JOIN"
  | "MEMBER_LEAVE"
  | "MEMBER_ROLE_CHANGE"
  | "GROUP_INFO_UPDATE"
  | "GROUP_SETTINGS_UPDATE"
  | "MESSAGE_PIN"
  | "MESSAGE_UNPIN";

// 群组活动日志
export interface GroupActivity {
  id: RecordId | string;
  group_id: RecordId | string;
  type: GroupActivityType;
  operator_id: RecordId | string;
  operator_name: string;
  target_id?: RecordId | string;
  target_name?: string;
  details?: {
    old_value?: any;
    new_value?: any;
    message?: string;
  };
  created_at: string;
}

// API 请求/响应接口

// 创建群组请求
export interface CreateGroupRequest {
  name: string;
  description?: string;
  avatar_url?: string;
  type: Group["type"];
  case_id?: RecordId | string;
  max_members?: number;
  is_public?: boolean;
  require_approval?: boolean;
  allow_member_invite?: boolean;
  initial_members?: (RecordId | string)[];
  settings?: Partial<
    Omit<GroupSettings, "id" | "group_id" | "created_at" | "updated_at">
  >;
}

// 更新群组请求
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  avatar_url?: string;
  max_members?: number;
  is_public?: boolean;
  require_approval?: boolean;
  allow_member_invite?: boolean;
}

// 添加成员请求
export interface AddMembersRequest {
  user_ids: (RecordId | string)[];
  role?: GroupMemberRole;
  message?: string;
}

// 更新成员角色请求
export interface UpdateMemberRoleRequest {
  user_id: RecordId | string;
  role: GroupMemberRole;
  permissions?: GroupMemberPermissions;
}

// 更新群组设置请求
export type UpdateGroupSettingsRequest = Partial<
  Omit<GroupSettings, "id" | "group_id" | "created_at" | "updated_at">
>;

// 群组搜索请求
export interface SearchGroupsRequest {
  keyword?: string;
  type?: Group["type"];
  case_id?: RecordId | string;
  is_public?: boolean;
  limit?: number;
  offset?: number;
}

// 群组列表响应
export interface GroupListResponse {
  groups: GroupListItem[];
  total: number;
  has_more: boolean;
}

// 群组详情响应
export interface GroupDetailsResponse {
  group: ExtendedGroup;
  members: ExtendedGroupMember[];
  settings: GroupSettings;
  stats: GroupStats;
  activities?: GroupActivity[];
}

// 错误响应
export interface GroupErrorResponse {
  error: string;
  code: string;
  details?: any;
}

// 成功响应
export type GroupSuccessResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
};

// 角色权限模板定义
export interface GroupRolePermissionTemplate {
  role: GroupMemberRole;
  permissions: GroupMemberPermissions;
  description: string;
}

// 默认角色权限模板
export const DEFAULT_GROUP_ROLE_PERMISSIONS: Record<
  GroupMemberRole,
  GroupMemberPermissions
> = {
  owner: {
    // 基础群组权限 - 群主拥有所有权限
    can_send_message: true,
    can_add_member: true,
    can_remove_member: true,
    can_edit_info: true,
    can_pin_message: true,
    can_manage_settings: true,

    // WebRTC权限 - 群主拥有所有WebRTC权限
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
    can_control_others_media: true,
  },

  admin: {
    // 基础群组权限 - 管理员拥有大部分权限
    can_send_message: true,
    can_add_member: true,
    can_remove_member: true,
    can_edit_info: false, // 管理员不能修改群组基本信息
    can_pin_message: true,
    can_manage_settings: false, // 管理员不能管理群组设置

    // WebRTC权限 - 管理员拥有大部分WebRTC权限
    can_initiate_voice_call: true,
    can_answer_voice_call: true,
    can_initiate_video_call: true,
    can_answer_video_call: true,
    can_create_group_call: true,
    can_join_group_call: true,
    can_manage_group_call: true, // 管理员可以管理群组通话
    can_control_microphone: true,
    can_control_camera: true,
    can_share_screen: true,
    can_record_call: false, // 管理员不能录制通话
    can_end_call: true,
    can_reject_call: true,
    can_invite_to_call: true,
    can_control_others_media: true, // 管理员可以控制他人媒体
  },

  member: {
    // 基础群组权限 - 普通成员基础权限
    can_send_message: true,
    can_add_member: false,
    can_remove_member: false,
    can_edit_info: false,
    can_pin_message: false,
    can_manage_settings: false,

    // WebRTC权限 - 普通成员基础通话权限
    can_initiate_voice_call: true,
    can_answer_voice_call: true,
    can_initiate_video_call: true,
    can_answer_video_call: true,
    can_create_group_call: false, // 普通成员不能创建群组通话
    can_join_group_call: true,
    can_manage_group_call: false,
    can_control_microphone: true,
    can_control_camera: true,
    can_share_screen: false, // 普通成员不能屏幕共享
    can_record_call: false,
    can_end_call: true, // 成员可以结束自己参与的通话
    can_reject_call: true,
    can_invite_to_call: false, // 普通成员不能邀请他人
    can_control_others_media: false,
  },
} as const;

// 角色权限模板数组（用于UI展示）
export const GROUP_ROLE_TEMPLATES: GroupRolePermissionTemplate[] = [
  {
    role: "owner",
    permissions: DEFAULT_GROUP_ROLE_PERMISSIONS.owner,
    description: "群主拥有群组所有权限，包括所有WebRTC功能",
  },
  {
    role: "admin",
    permissions: DEFAULT_GROUP_ROLE_PERMISSIONS.admin,
    description:
      "管理员拥有群组管理权限和大部分WebRTC功能，不能修改群组基本信息",
  },
  {
    role: "member",
    permissions: DEFAULT_GROUP_ROLE_PERMISSIONS.member,
    description: "普通成员拥有基础聊天和通话权限，受到一定限制",
  },
] as const;
