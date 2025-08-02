import { RecordId } from 'surrealdb';

// 群组基础信息接口
export interface Group {
  id: RecordId | string;
  name: string;
  description?: string;
  avatar_url?: string;
  type: 'case_related' | 'department' | 'normal';
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
export type GroupMemberRole = 'owner' | 'admin' | 'member';

// 群组成员权限接口
export interface GroupMemberPermissions {
  can_send_message?: boolean;
  can_add_member?: boolean;
  can_remove_member?: boolean;
  can_edit_info?: boolean;
  can_pin_message?: boolean;
  can_manage_settings?: boolean;
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
export type GroupInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

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
  type: Group['type'];
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
  type: Group['type'];
  member_count: number;
  is_public: boolean;
  is_member: boolean;
  case_name?: string; // 如果是案件群组
}

// 群组活动日志类型
export type GroupActivityType = 
  | 'MEMBER_JOIN' 
  | 'MEMBER_LEAVE' 
  | 'MEMBER_ROLE_CHANGE' 
  | 'GROUP_INFO_UPDATE' 
  | 'GROUP_SETTINGS_UPDATE'
  | 'MESSAGE_PIN'
  | 'MESSAGE_UNPIN';

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
  type: Group['type'];
  case_id?: RecordId | string;
  max_members?: number;
  is_public?: boolean;
  require_approval?: boolean;
  allow_member_invite?: boolean;
  initial_members?: (RecordId | string)[];
  settings?: Partial<Omit<GroupSettings, 'id' | 'group_id' | 'created_at' | 'updated_at'>>;
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
export interface UpdateGroupSettingsRequest extends Partial<Omit<GroupSettings, 'id' | 'group_id' | 'created_at' | 'updated_at'>> {}

// 群组搜索请求
export interface SearchGroupsRequest {
  keyword?: string;
  type?: Group['type'];
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
export interface GroupSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}