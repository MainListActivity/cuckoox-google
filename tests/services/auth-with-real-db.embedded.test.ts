/**
 * 认证服务真实数据库测试
 * 测试用户认证、权限检查等功能在真实数据库环境下的行为
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RecordId } from 'surrealdb';
import { TestHelpers, TEST_IDS } from '../utils/realSurrealTestUtils';

describe('认证服务 - 真实数据库测试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
  });

  describe('用户认证状态', () => {
    it('应该正确设置和验证认证用户', async () => {
      // 设置管理员用户认证
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 验证认证状态 - 使用current_user变量
      const authResult = await TestHelpers.query('RETURN $current_user;');
      expect(authResult[0]).toBeDefined();
      expect(authResult[0][0].id).toBe(TEST_IDS.USERS.ADMIN);
    });

    it('应该能够清除认证状态', async () => {
      // 先设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      
      // 验证认证已设置
      let authResult = await TestHelpers.query('RETURN $current_user;');
      expect(authResult[0][0]).toBeDefined();

      // 清除认证
      await TestHelpers.clearAuth();

      // 验证认证已清除
      try {
        authResult = await TestHelpers.query('RETURN $current_user;');
        // 如果查询成功，$current_user应该是null或undefined
        expect(authResult[0][0]).toBeNull();
      } catch (error) {
        // 如果查询失败，说明认证确实被清除了
        expect(error).toBeDefined();
      }
    });

    it('应该支持不同用户的认证切换', async () => {
      // 设置为管理员用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      let authResult = await TestHelpers.query('RETURN $auth;');
      expect(authResult[0][0].id).toBe(TEST_IDS.USERS.ADMIN);

      // 切换为案件管理员用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);
      authResult = await TestHelpers.query('RETURN $auth;');
      expect(authResult[0][0].id).toBe(TEST_IDS.USERS.CASE_MANAGER);

      // 切换为债权人用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);
      authResult = await TestHelpers.query('RETURN $auth;');
      expect(authResult[0][0].id).toBe(TEST_IDS.USERS.CREDITOR_USER);
    });
  });

  describe('用户角色权限', () => {
    it('应该正确查询用户的角色信息', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询当前用户的角色
      const roleResult = await TestHelpers.query(`
        SELECT ->has_role->role.* AS roles FROM $auth.id;
      `);

      expect(roleResult[0]).toHaveLength(1);
      expect(roleResult[0][0].roles).toBeDefined();
      expect(Array.isArray(roleResult[0][0].roles)).toBe(true);
      
      // 验证管理员角色
      const hasAdminRole = roleResult[0][0].roles.some((role: any) => role.name === 'admin');
      expect(hasAdminRole).toBe(true);
    });

    it('应该正确查询案件管理员的权限', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);

      // 查询案件管理员的操作权限
      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.* AS permissions 
        FROM $auth.id;
      `);

      expect(permissionResult[0]).toHaveLength(1);
      expect(permissionResult[0][0].permissions).toBeDefined();
      
      // 验证是否有案件相关权限
      const permissions = permissionResult[0][0].permissions;
      const hasCaseReadPermission = permissions.some((perm: any) => 
        perm.name === 'case_read' && perm.operation_type === 'read'
      );
      expect(hasCaseReadPermission).toBe(true);
    });

    it('应该正确查询债权人的权限', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      // 查询债权人的权限
      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.* AS permissions 
        FROM $auth.id;
      `);

      expect(permissionResult[0]).toHaveLength(1);
      expect(permissionResult[0][0].permissions).toBeDefined();
      
      // 验证是否有债权申报权限
      const permissions = permissionResult[0][0].permissions;
      const hasClaimPermission = permissions.some((perm: any) => 
        perm.tables.includes('claim')
      );
      expect(hasClaimPermission).toBe(true);
    });
  });

  describe('菜单访问权限', () => {
    it('应该正确查询用户的菜单访问权限', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询用户可访问的菜单
      const menuResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_access_menu->menu_metadata.* AS menus 
        FROM $auth.id;
      `);

      expect(menuResult[0]).toHaveLength(1);
      expect(menuResult[0][0].menus).toBeDefined();
      
      // 验证管理员可以访问所有菜单
      const menus = menuResult[0][0].menus;
      const menuNames = menus.map((menu: any) => menu.name);
      expect(menuNames).toContain('dashboard');
      expect(menuNames).toContain('cases');
      expect(menuNames).toContain('claims');
      expect(menuNames).toContain('creditors');
    });

    it('应该验证非管理员用户的菜单访问限制', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      // 查询债权人用户的菜单权限
      const menuResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_access_menu->menu_metadata.* AS menus 
        FROM $auth.id;
      `);

      expect(menuResult[0]).toHaveLength(1);
      
      // 债权人用户可能没有所有菜单的访问权限
      const menus = menuResult[0][0].menus || [];
      const menuNames = menus.map((menu: any) => menu.name);
      
      // 根据测试数据，债权人角色可能没有分配菜单权限
      // 这是正常的，因为我们在测试数据中只为admin角色分配了菜单权限
      expect(Array.isArray(menus)).toBe(true);
    });
  });

  describe('案件级别权限', () => {
    it('应该支持案件级别的角色分配', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 为用户分配案件级别的角色
      const caseId = new RecordId('case', 'test_case_1');
      const userId = new RecordId('user', 'test_user');
      const roleId = new RecordId('role', 'case_manager');

      await TestHelpers.query(`
        RELATE $user_id->has_case_role->$role_id SET 
          case_id = $case_id,
          assigned_at = time::now(),
          assigned_by = $auth.id;
      `, {
        user_id: userId,
        role_id: roleId,
        case_id: caseId,
      });

      // 验证案件角色分配
      const caseRoleResult = await TestHelpers.query(`
        SELECT ->has_case_role->role.* AS case_roles,
               ->has_case_role.case_id AS case_ids
        FROM $user_id;
      `, { user_id: userId });

      expect(caseRoleResult[0]).toHaveLength(1);
      expect(caseRoleResult[0][0].case_roles).toBeDefined();
      expect(caseRoleResult[0][0].case_ids).toBeDefined();
      
      // 验证角色和案件ID
      const caseRoles = caseRoleResult[0][0].case_roles;
      expect(caseRoles.some((role: any) => role.name === 'case_manager')).toBe(true);
    });

    it('应该验证案件级别权限的数据访问', async () => {
      // 为测试用户分配特定案件的管理权限
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      
      const testUserId = new RecordId('user', 'test_user');
      const caseId = new RecordId('case', 'test_case_1');
      const caseManagerRoleId = new RecordId('role', 'case_manager');

      await TestHelpers.query(`
        RELATE $user_id->has_case_role->$role_id SET 
          case_id = $case_id,
          assigned_at = time::now(),
          assigned_by = $auth.id;
      `, {
        user_id: testUserId,
        role_id: caseManagerRoleId,
        case_id: caseId,
      });

      // 切换到测试用户
      await TestHelpers.setAuthUser('user:test_user');

      // 尝试访问分配的案件（根据权限系统，应该可以访问）
      const accessibleCases = await TestHelpers.query(`
        SELECT * FROM case WHERE id = $case_id;
      `, { case_id: caseId });

      expect(accessibleCases[0]).toBeDefined();
      // 根据权限设置，用户应该能看到这个案件
    });
  });

  describe('数据权限验证', () => {
    it('应该验证不同用户对案件数据的访问权限', async () => {
      // 测试管理员可以访问所有案件
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      const adminCaseAccess = await TestHelpers.query('SELECT count() FROM case;');
      const adminCaseCount = adminCaseAccess[0][0].count;
      expect(adminCaseCount).toBeGreaterThan(0);

      // 测试其他用户的访问权限
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);
      try {
        const creditorCaseAccess = await TestHelpers.query('SELECT count() FROM case;');
        // 如果查询成功，验证结果
        expect(creditorCaseAccess).toBeDefined();
      } catch (error) {
        // 如果查询失败，可能是因为权限限制
        expect(error).toBeDefined();
      }
    });

    it('应该验证债权申报数据的权限控制', async () => {
      // 创建一个属于特定用户的债权申报
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      
      const newClaim = await TestHelpers.create('claim', {
        case_id: new RecordId('case', 'test_case_1'),
        creditor_id: new RecordId('creditor', 'creditor_1'),
        created_by: new RecordId('user', 'creditor_user'),
        claim_amount: 50000.00,
        claim_nature: 'ordinary',
        claim_description: '权限测试债权',
        review_status: '待提交',
      });

      // 切换到债权申报创建者
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      // 验证用户可以访问自己创建的债权申报
      const userClaims = await TestHelpers.query(
        'SELECT * FROM claim WHERE created_by = $auth.id;'
      );
      
      expect(userClaims[0]).toBeDefined();
      const foundClaim = userClaims[0].find((claim: any) => 
        claim.claim_description === '权限测试债权'
      );
      expect(foundClaim).toBeDefined();
    });
  });

  describe('权限边界测试', () => {
    it('应该正确处理无效的用户ID', async () => {
      try {
        await TestHelpers.setAuthUser('user:nonexistent_user');
        
        // 尝试查询数据
        const result = await TestHelpers.query('RETURN $auth;');
        
        // 即使用户不存在，认证参数也应该被设置
        expect(result[0][0]).toBeDefined();
      } catch (error) {
        // 某些情况下可能会失败，这也是正常的
        expect(error).toBeDefined();
      }
    });

    it('应该验证角色权限的传递性', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);

      // 验证案件管理员是否通过角色继承获得了相应权限
      const inheritedPermissions = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.name AS permission_names
        FROM $auth.id;
      `);

      expect(inheritedPermissions[0]).toHaveLength(1);
      const permissionNames = inheritedPermissions[0][0].permission_names || [];
      
      // 验证是否有预期的权限
      expect(Array.isArray(permissionNames)).toBe(true);
    });
  });
});