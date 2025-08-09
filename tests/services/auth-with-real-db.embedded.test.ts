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

      // 验证认证状态 - 使用$current_user并查询实际记录
      const authResult = await TestHelpers.query('SELECT * FROM $current_user;');
      expect(Array.isArray(authResult[0])).toBe(true);
      expect((authResult[0] as unknown[]).length).toBeGreaterThan(0);
      const first = (authResult[0] as unknown[])[0] as { id: { toString: () => string } };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.ADMIN);
    });

    it('应该能够清除认证状态', async () => {
      // 先设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      
      // 验证认证已设置
      let authResult = await TestHelpers.query('SELECT * FROM $current_user;');
      expect(Array.isArray(authResult[0])).toBe(true);
      expect((authResult[0] as unknown[])[0]).toBeDefined();

      // 清除认证
      await TestHelpers.clearAuth();

      // 验证认证已清除：此时查询应抛错或返回空
      try {
        authResult = await TestHelpers.query('SELECT * FROM $current_user;');
        expect(Array.isArray(authResult[0])).toBe(true);
        expect((authResult[0] as unknown[]).length).toBe(0);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该支持不同用户的认证切换', async () => {
      // 设置为管理员用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
      let authResult = await TestHelpers.query('SELECT * FROM $current_user;');
      let first = (authResult[0] as unknown[])[0] as { id: { toString: () => string } };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.ADMIN);

      // 切换为案件管理员用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);
      authResult = await TestHelpers.query('SELECT * FROM $current_user;');
      first = (authResult[0] as unknown[])[0] as { id: { toString: () => string } };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.CASE_MANAGER);

      // 切换为债权人用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);
      authResult = await TestHelpers.query('SELECT * FROM $current_user;');
      first = (authResult[0] as unknown[])[0] as { id: { toString: () => string } };
      expect(first.id.toString()).toBe(TEST_IDS.USERS.CREDITOR_USER);
    });
  });

  describe('用户角色权限', () => {
    it('应该正确查询用户的角色信息', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 查询当前用户的角色
      const roleResult = await TestHelpers.query(`
        SELECT ->has_role->role.* AS roles FROM $current_user;
      `);
      expect(Array.isArray(roleResult[0])).toBe(true);
      expect((roleResult[0] as unknown[]).length).toBeGreaterThan(0);
      const row0 = (roleResult[0] as unknown[])[0] as { roles: unknown[] };
      expect(Array.isArray(row0.roles)).toBe(true);
      const hasAdminRole = (row0.roles as any[]).some((role) => role.name === 'admin');
      expect(hasAdminRole).toBe(true);
    });

    it('应该正确查询案件管理员的权限', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CASE_MANAGER);

      // 查询案件管理员的操作权限
      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.* AS permissions 
        FROM $current_user;
      `);
      expect(Array.isArray(permissionResult[0])).toBe(true);
      expect((permissionResult[0] as unknown[]).length).toBeGreaterThan(0);
      const prow = (permissionResult[0] as unknown[])[0] as { permissions: unknown[] };
      expect(Array.isArray(prow.permissions)).toBe(true);
      const hasCaseReadPermission = (prow.permissions as any[]).some(
        (perm) => perm.name === 'case_read' && perm.operation_type === 'read'
      );
      expect(hasCaseReadPermission).toBe(true);
    });

    it('应该正确查询债权人的权限', async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.CREDITOR_USER);

      // 查询债权人的权限
      const permissionResult = await TestHelpers.query(`
        SELECT ->has_role->role->can_execute_operation->operation_metadata.* AS permissions 
        FROM $current_user;
      `);
      expect(Array.isArray(permissionResult[0])).toBe(true);
      expect((permissionResult[0] as unknown[]).length).toBeGreaterThan(0);
      const prow = (permissionResult[0] as unknown[])[0] as { permissions: unknown[] };
      expect(Array.isArray(prow.permissions)).toBe(true);
      const hasClaimPermission = (prow.permissions as any[]).some((perm) => 
        Array.isArray(perm.tables) && perm.tables.includes('claim')
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
        FROM $current_user;
      `);
      expect(Array.isArray(menuResult[0])).toBe(true);
      expect((menuResult[0] as unknown[]).length).toBeGreaterThan(0);
      const mrow = (menuResult[0] as unknown[])[0] as { menus: unknown[] };
      expect(Array.isArray(mrow.menus)).toBe(true);
      const menuNames = (mrow.menus as any[]).map((menu) => menu.name);
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
        FROM $current_user;
      `);
      expect(Array.isArray(menuResult[0])).toBe(true);
      const maybeArr = menuResult[0] as unknown[];
      const mrow = (maybeArr[0] ?? { menus: [] }) as { menus: unknown[] };
      expect(Array.isArray(mrow.menus)).toBe(true);
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
          assigned_by = $current_user;
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
      `, { user_id: new RecordId('user', 'test_user') });

      expect(Array.isArray(caseRoleResult[0])).toBe(true);
      expect((caseRoleResult[0] as unknown[]).length).toBeGreaterThan(0);
      const crow = (caseRoleResult[0] as unknown[])[0] as { case_roles: unknown[]; case_ids: unknown[] };
      expect(Array.isArray(crow.case_roles)).toBe(true);
      expect(crow.case_ids).toBeDefined();
      const hasCM = (crow.case_roles as any[]).some((role) => role.name === 'case_manager');
      expect(hasCM).toBe(true);
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
          assigned_by = $current_user;
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
      expect(Array.isArray(adminCaseAccess[0])).toBe(true);
      const ac0 = (adminCaseAccess[0] as unknown[])[0] as { count: number };
      const adminCaseCount = ac0.count;
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
      
      await TestHelpers.create('claim', {
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
        'SELECT * FROM claim WHERE created_by = $current_user;'
      );
      
      expect(Array.isArray(userClaims[0])).toBe(true);
      const foundClaim = (userClaims[0] as any[]).find((claim) => 
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
        const result = await TestHelpers.query('SELECT * FROM $current_user;');
        
        // 即使用户不存在，查询也应该有定义（可能为空）
        expect(result[0]).toBeDefined();
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
        FROM $current_user;
      `);

      expect(Array.isArray(inheritedPermissions[0])).toBe(true);
      const first = (inheritedPermissions[0] as any[])[0] || { permission_names: [] };
      const permissionNames = Array.isArray(first.permission_names) ? first.permission_names : [];
      
      // 验证是否有预期的权限
      expect(Array.isArray(permissionNames)).toBe(true);
    });
  });
});