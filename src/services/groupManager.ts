import { RecordId, Uuid } from "surrealdb";

import type { SurrealWorkerAPI } from "@/src/contexts/SurrealProvider";

// 群组类型定义
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

// 群组成员角色定义 (适配现有数据库schema)
export type GroupMemberRole = "owner" | "admin" | "member";

// 群组成员信息
export interface GroupMember {
  id: RecordId | string;
  group_id: RecordId | string;
  user_id: RecordId | string;
  role: GroupMemberRole;
  nickname?: string; // 群内昵称
  joined_at: string;
  invited_by?: RecordId | string;
  permissions?: {
    can_send_message?: boolean;
    can_add_member?: boolean;
    can_remove_member?: boolean;
    can_edit_info?: boolean;
    can_pin_message?: boolean;
    can_manage_settings?: boolean;
  };
  is_muted: boolean;
  created_at: string;
  updated_at: string;
}

// 群组设置
export interface GroupSettings {
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

// 创建群组的参数
export interface CreateGroupData {
  name: string;
  description?: string;
  avatar_url?: string;
  type: Group["type"];
  case_id?: RecordId | string;
  max_members?: number;
  is_public?: boolean;
  require_approval?: boolean;
  allow_member_invite?: boolean;
  initial_members?: (RecordId | string)[]; // 初始成员列表
  settings?: Partial<
    Omit<GroupSettings, "group_id" | "created_at" | "updated_at">
  >;
}

// 更新群组的参数
export interface UpdateGroupData {
  name?: string;
  description?: string;
  avatar_url?: string;
  max_members?: number;
  is_public?: boolean;
  require_approval?: boolean;
  allow_member_invite?: boolean;
}

// 添加成员的参数
export interface AddMemberData {
  user_ids: (RecordId | string)[];
  role?: GroupMemberRole;
  message?: string; // 邀请消息
}

// 更新成员角色的参数
export interface UpdateMemberRoleData {
  user_id: RecordId | string;
  role: GroupMemberRole;
  permissions?: GroupMember["permissions"];
}

// 群组邀请数据
export interface GroupInvitation {
  id: RecordId | string;
  group_id: RecordId | string;
  inviter_id: RecordId | string;
  invitee_id: RecordId | string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  message?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

class GroupManager {
  private clientGetter: () => Promise<SurrealWorkerAPI> | null = null;

  /**
   * 设置客户端获取函数 - 在应用启动时由 SurrealProvider 调用
   */
  setClientGetter(getter: () => Promise<SurrealWorkerAPI>) {
    this.clientGetter = getter;
  }

  /**
   * 获取 SurrealDB 客户端
   */
  private async getClient(): Promise<SurrealWorkerAPI> {
    if (!this.clientGetter) {
      throw new Error(
        "SurrealDB client not available. Ensure GroupManager is properly initialized with setClientGetter.",
      );
    }

    return await this.clientGetter();
  }

  /**
   * 创建群组
   */
  async createGroup(data: CreateGroupData): Promise<{
    group: Group;
    settings: GroupSettings;
    members: GroupMember[];
  }> {
    try {
      const client = await this.getClient();

      // 验证用户权限
      const authQuery = "return $auth;";
      const [authResult] = await client.query(authQuery);
      if (!authResult) {
        throw new Error("用户未认证");
      }

      const now = new Date().toISOString();

      // 创建群组记录
      const groupData: Omit<Group, "id"> = {
        name: data.name,
        description: data.description,
        avatar_url: data.avatar_url,
        type: data.type,
        case_id: data.case_id
          ? typeof data.case_id === "string"
            ? new RecordId("case", data.case_id.split(":")[1])
            : data.case_id
          : undefined,
        max_members: data.max_members || 500,
        is_public: data.is_public ?? false,
        require_approval: data.require_approval ?? false,
        allow_member_invite: data.allow_member_invite ?? true,
        created_by: "$auth.id",
        created_at: now,
        updated_at: now,
      };

      const [group] = await client.create("message_group", groupData);

      // 创建群组设置
      const settingsData: Omit<GroupSettings, "id"> = {
        group_id: group.id,
        allow_all_member_at: data.settings?.allow_all_member_at ?? true,
        allow_member_edit_info: data.settings?.allow_member_edit_info ?? false,
        message_auto_delete_days: data.settings?.message_auto_delete_days,
        file_sharing_enabled: data.settings?.file_sharing_enabled ?? true,
        call_enabled: data.settings?.call_enabled ?? true,
        screen_share_enabled: data.settings?.screen_share_enabled ?? true,
        member_join_notification:
          data.settings?.member_join_notification ?? true,
        member_leave_notification:
          data.settings?.member_leave_notification ?? true,
        created_at: now,
        updated_at: now,
      };

      const [settings] = await client.create("group_settings", settingsData);

      // 添加创建者为群主
      const ownerMemberData: Omit<GroupMember, "id"> = {
        group_id: group.id,
        user_id: "$auth.id",
        role: "owner",
        joined_at: now,
        permissions: {
          can_send_message: true,
          can_add_member: true,
          can_remove_member: true,
          can_edit_info: true,
          can_pin_message: true,
          can_manage_settings: true,
        },
        is_muted: false,
        created_at: now,
        updated_at: now,
      };

      const [ownerMember] = await client.create(
        "group_member",
        ownerMemberData,
      );
      const members = [ownerMember];

      // 添加初始成员
      if (data.initial_members && data.initial_members.length > 0) {
        for (const userId of data.initial_members) {
          // 避免重复添加创建者
          if (userId === authResult.id) continue;

          const memberData: Omit<GroupMember, "id"> = {
            group_id: group.id,
            user_id:
              typeof userId === "string"
                ? new RecordId("user", userId.split(":")[1])
                : userId,
            role: "member",
            joined_at: now,
            invited_by: "$auth.id",
            permissions: this.getDefaultMemberPermissions(),
            is_muted: false,
            created_at: now,
            updated_at: now,
          };

          const [member] = await client.create("group_member", memberData);
          members.push(member);
        }
      }

      return { group, settings, members };
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }

  /**
   * 更新群组信息
   */
  async updateGroup(
    groupId: RecordId | string,
    data: UpdateGroupData,
  ): Promise<Group> {
    try {
      const client = await this.getClient();

      // 检查用户权限
      await this.checkPermission(groupId, "can_edit_info");

      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const id = typeof groupId === "string" ? groupId : String(groupId);
      const [updatedGroup] = await client.merge(id, updateData);

      return updatedGroup;
    } catch (error) {
      console.error("Error updating group:", error);
      throw error;
    }
  }

  /**
   * 删除群组
   */
  async deleteGroup(groupId: RecordId | string): Promise<boolean> {
    try {
      const client = await this.getClient();

      // 检查用户是否为群主
      await this.checkOwnerPermission(groupId);

      const groupRecordId =
        typeof groupId === "string"
          ? new RecordId("group", groupId.split(":")[1])
          : groupId;

      // 删除相关数据
      await Promise.all([
        // 删除群组成员
        client.query("DELETE group_member WHERE group_id = $group_id", {
          group_id: groupRecordId,
        }),
        // 删除群组设置
        client.query("DELETE group_settings WHERE group_id = $group_id", {
          group_id: groupRecordId,
        }),
        // 删除群组邀请
        client.query("DELETE group_invitation WHERE group_id = $group_id", {
          group_id: groupRecordId,
        }),
        // 删除群组消息 (可选，根据业务需求)
        // client.query('DELETE message WHERE group_id = $group_id', { group_id: groupRecordId })
      ]);

      // 删除群组
      const id = typeof groupId === "string" ? groupId : String(groupId);
      await client.delete(id);

      return true;
    } catch (error) {
      console.error("Error deleting group:", error);
      throw error;
    }
  }

  /**
   * 添加成员到群组
   */
  async addMembers(
    groupId: RecordId | string,
    data: AddMemberData,
  ): Promise<GroupMember[]> {
    try {
      const client = await this.getClient();

      // 检查用户是否有添加成员的权限
      await this.checkPermission(groupId, "can_add_member");

      // 检查群组是否存在且获取设置
      const [group] = await client.query(
        `SELECT * FROM ${typeof groupId === "string" ? groupId : String(groupId)}`,
      );
      if (!group) {
        throw new Error("群组不存在");
      }

      // 检查成员数量限制
      const memberCountQuery = `SELECT count() as total FROM group_member WHERE group_id = $group_id`;
      const [countResult] = await client.query(memberCountQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
      });

      if (
        group.max_members &&
        countResult.total + data.user_ids.length > group.max_members
      ) {
        throw new Error(`群组成员数量不能超过${group.max_members}人`);
      }

      const now = new Date().toISOString();
      const members: GroupMember[] = [];
      const role = data.role || "member";

      for (const userId of data.user_ids) {
        // 检查用户是否已经是群成员
        const existingMemberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id`;
        const [existingMember] = await client.query(existingMemberQuery, {
          group_id:
            typeof groupId === "string"
              ? new RecordId("group", groupId.split(":")[1])
              : groupId,
          user_id:
            typeof userId === "string"
              ? new RecordId("user", userId.split(":")[1])
              : userId,
        });

        if (existingMember) {
          console.warn(
            `User ${userId} is already a member of group ${groupId}`,
          );
          continue;
        }

        const memberData: Omit<GroupMember, "id"> = {
          group_id:
            typeof groupId === "string"
              ? new RecordId("group", groupId.split(":")[1])
              : groupId,
          user_id:
            typeof userId === "string"
              ? new RecordId("user", userId.split(":")[1])
              : userId,
          role,
          joined_at: now,
          invited_by: "$auth.id",
          permissions: this.getDefaultPermissionsByRole(role),
          is_muted: false,
          created_at: now,
          updated_at: now,
        };

        const [member] = await client.create("group_member", memberData);
        members.push(member);
      }

      return members;
    } catch (error) {
      console.error("Error adding members:", error);
      throw error;
    }
  }

  /**
   * 从群组移除成员
   */
  async removeMember(
    groupId: RecordId | string,
    userId: RecordId | string,
  ): Promise<boolean> {
    try {
      const client = await this.getClient();

      // 检查权限
      await this.checkPermission(groupId, "can_remove_member");

      // 不能移除群主
      const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id`;
      const [member] = await client.query(memberQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
        user_id:
          typeof userId === "string"
            ? new RecordId("user", userId.split(":")[1])
            : userId,
      });

      if (!member) {
        throw new Error("用户不是群组成员");
      }

      if (member.role === "owner") {
        throw new Error("不能移除群主");
      }

      // 删除成员记录
      const deleteQuery = `DELETE group_member WHERE group_id = $group_id AND user_id = $user_id`;
      await client.query(deleteQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
        user_id:
          typeof userId === "string"
            ? new RecordId("user", userId.split(":")[1])
            : userId,
      });

      return true;
    } catch (error) {
      console.error("Error removing member:", error);
      throw error;
    }
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(
    groupId: RecordId | string,
    data: UpdateMemberRoleData,
  ): Promise<GroupMember> {
    try {
      const client = await this.getClient();

      // 检查权限（需要是管理员或群主）
      await this.checkAdminPermission(groupId);

      // 获取目标成员信息
      const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $user_id`;
      const [member] = await client.query(memberQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
        user_id:
          typeof data.user_id === "string"
            ? new RecordId("user", data.user_id.split(":")[1])
            : data.user_id,
      });

      if (!member) {
        throw new Error("用户不是群组成员");
      }

      if (member.role === "owner" && data.role !== "owner") {
        throw new Error("不能改变群主角色");
      }

      // 更新成员角色和权限
      const updateData = {
        role: data.role,
        permissions:
          data.permissions || this.getDefaultPermissionsByRole(data.role),
        updated_at: new Date().toISOString(),
      };

      const updateQuery = `UPDATE group_member SET role = $role, permissions = $permissions, updated_at = $updated_at WHERE group_id = $group_id AND user_id = $user_id RETURN *`;
      const [updatedMember] = await client.query(updateQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
        user_id:
          typeof data.user_id === "string"
            ? new RecordId("user", data.user_id.split(":")[1])
            : data.user_id,
        role: data.role,
        permissions: updateData.permissions,
        updated_at: updateData.updated_at,
      });

      return updatedMember;
    } catch (error) {
      console.error("Error updating member role:", error);
      throw error;
    }
  }

  /**
   * 转让群主
   */
  async transferOwnership(
    groupId: RecordId | string,
    newOwnerId: RecordId | string,
  ): Promise<boolean> {
    try {
      const client = await this.getClient();

      // 检查当前用户是否为群主
      await this.checkOwnerPermission(groupId);

      // 检查新群主是否为群成员
      const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $new_owner_id`;
      const [newOwnerMember] = await client.query(memberQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
        new_owner_id:
          typeof newOwnerId === "string"
            ? new RecordId("user", newOwnerId.split(":")[1])
            : newOwnerId,
      });

      if (!newOwnerMember) {
        throw new Error("新群主必须是群组成员");
      }

      const now = new Date().toISOString();

      // 使用事务进行转让
      await client.query(
        `
        BEGIN TRANSACTION;

        -- 将当前群主改为管理员
        UPDATE group_member SET
          role = 'admin',
          permissions = $admin_permissions,
          updated_at = $updated_at
        WHERE group_id = $group_id AND user_id = $auth.id;

        -- 将新成员设为群主
        UPDATE group_member SET
          role = 'owner',
          permissions = $owner_permissions,
          updated_at = $updated_at
        WHERE group_id = $group_id AND user_id = $new_owner_id;

        COMMIT TRANSACTION;
      `,
        {
          group_id:
            typeof groupId === "string"
              ? new RecordId("group", groupId.split(":")[1])
              : groupId,
          new_owner_id:
            typeof newOwnerId === "string"
              ? new RecordId("user", newOwnerId.split(":")[1])
              : newOwnerId,
          admin_permissions: this.getDefaultPermissionsByRole("admin"),
          owner_permissions: this.getDefaultPermissionsByRole("owner"),
          updated_at: now,
        },
      );

      return true;
    } catch (error) {
      console.error("Error transferring ownership:", error);
      throw error;
    }
  }

  /**
   * 退出群组
   */
  async leaveGroup(groupId: RecordId | string): Promise<boolean> {
    try {
      const client = await this.getClient();

      // 获取当前用户的群组成员信息
      const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $auth.id`;
      const [member] = await client.query(memberQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
      });

      if (!member) {
        throw new Error("您不是该群组成员");
      }

      if (member.role === "owner") {
        throw new Error("群主不能直接退出群组，请先转让群主身份");
      }

      // 删除成员记录
      const deleteQuery = `DELETE group_member WHERE group_id = $group_id AND user_id = $auth.id`;
      await client.query(deleteQuery, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
      });

      return true;
    } catch (error) {
      console.error("Error leaving group:", error);
      throw error;
    }
  }

  /**
   * 获取群组信息
   */
  async getGroup(groupId: RecordId | string): Promise<Group | null> {
    try {
      const client = await this.getClient();

      const [group] = await client.query(
        `SELECT * FROM ${typeof groupId === "string" ? groupId : String(groupId)}`,
      );
      return group || null;
    } catch (error) {
      console.error("Error getting group:", error);
      throw error;
    }
  }

  /**
   * 获取群组成员列表
   */
  async getGroupMembers(groupId: RecordId | string): Promise<GroupMember[]> {
    try {
      const client = await this.getClient();

      const query = `SELECT * FROM group_member WHERE group_id = $group_id ORDER BY role ASC, joined_at ASC`;
      const members = await client.query(query, {
        group_id:
          typeof groupId === "string"
            ? new RecordId("group", groupId.split(":")[1])
            : groupId,
      });

      return members || [];
    } catch (error) {
      console.error("Error getting group members:", error);
      throw error;
    }
  }

  /**
   * 获取用户参与的群组列表
   */
  async getUserGroups(userId?: RecordId | string): Promise<Group[]> {
    try {
      const client = await this.getClient();

      const userIdParam = userId
        ? typeof userId === "string"
          ? new RecordId("user", userId.split(":")[1])
          : userId
        : "$auth.id";

      const query = `
        SELECT * FROM $user_id->group_member->message_group
        ORDER BY updated_at DESC
      `;

      const groups = await client.query(query, { user_id: userIdParam });
      return groups || [];
    } catch (error) {
      console.error("Error getting user groups:", error);
      throw error;
    }
  }

  /**
   * 检查用户权限
   */
  private async checkPermission(
    groupId: RecordId | string,
    permission: keyof GroupMember["permissions"],
  ): Promise<void> {
    const client = await this.getClient();

    const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $auth.id`;
    const [member] = await client.query(memberQuery, {
      group_id:
        typeof groupId === "string"
          ? new RecordId("group", groupId.split(":")[1])
          : groupId,
    });

    if (!member) {
      throw new Error("您不是该群组成员");
    }

    if (member.role === "owner") {
      return; // 群主拥有所有权限
    }

    if (!member.permissions?.[permission]) {
      throw new Error("权限不足");
    }
  }

  /**
   * 检查管理员权限
   */
  private async checkAdminPermission(
    groupId: RecordId | string,
  ): Promise<void> {
    const client = await this.getClient();

    const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $auth.id`;
    const [member] = await client.query(memberQuery, {
      group_id:
        typeof groupId === "string"
          ? new RecordId("group", groupId.split(":")[1])
          : groupId,
    });

    if (!member) {
      throw new Error("您不是该群组成员");
    }

    if (member.role !== "owner" && member.role !== "admin") {
      throw new Error("需要管理员权限");
    }
  }

  /**
   * 检查群主权限
   */
  private async checkOwnerPermission(
    groupId: RecordId | string,
  ): Promise<void> {
    const client = await this.getClient();

    const memberQuery = `SELECT * FROM group_member WHERE group_id = $group_id AND user_id = $auth.id`;
    const [member] = await client.query(memberQuery, {
      group_id:
        typeof groupId === "string"
          ? new RecordId("group", groupId.split(":")[1])
          : groupId,
    });

    if (!member) {
      throw new Error("您不是该群组成员");
    }

    if (member.role !== "owner") {
      throw new Error("需要群主权限");
    }
  }

  /**
   * 获取默认成员权限
   */
  private getDefaultMemberPermissions(): GroupMember["permissions"] {
    return {
      can_send_message: true,
      can_add_member: false,
      can_remove_member: false,
      can_edit_info: false,
      can_pin_message: false,
      can_manage_settings: false,
    };
  }

  /**
   * 根据角色获取默认权限
   */
  private getDefaultPermissionsByRole(
    role: GroupMemberRole,
  ): GroupMember["permissions"] {
    switch (role) {
      case "owner":
        return {
          can_send_message: true,
          can_add_member: true,
          can_remove_member: true,
          can_edit_info: true,
          can_pin_message: true,
          can_manage_settings: true,
        };
      case "admin":
        return {
          can_send_message: true,
          can_add_member: true,
          can_remove_member: true,
          can_edit_info: true,
          can_pin_message: true,
          can_manage_settings: false,
        };
      case "member":
        return {
          can_send_message: true,
          can_add_member: false,
          can_remove_member: false,
          can_edit_info: false,
          can_pin_message: false,
          can_manage_settings: false,
        };
      default:
        return this.getDefaultMemberPermissions();
    }
  }
}

export const groupManager = new GroupManager();
export default groupManager;
export { GroupManager };
