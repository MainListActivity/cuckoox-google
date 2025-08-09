/**
 * 测试数据生成器
 * 提供标准化的测试数据集合
 */

import { RecordId } from 'surrealdb';

// 测试数据类型定义
export interface TestUser {
  id: RecordId;
  github_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestCase {
  id: RecordId;
  acceptance_date: Date;
  announcement_date?: Date;
  case_lead_user_id?: RecordId;
  case_manager_name: string;
  case_number: string;
  case_procedure: string;
  claim_submission_end_date?: Date;
  claim_submission_start_date?: Date;
  closing_date?: Date;
  created_at: Date;
  created_by_user: RecordId;
  name: string;
  procedure_phase: string;
  selected_theme_name?: string;
  updated_at: Date;
}

export interface TestCreditor {
  id: RecordId;
  case_id: RecordId;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  organization_code?: string;
  id_number?: string;
  creditor_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestClaim {
  id: RecordId;
  case_id: RecordId;
  creditor_id: RecordId;
  created_by: RecordId;
  claim_amount: number;
  claim_nature: string;
  claim_description?: string;
  review_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestRole {
  id: RecordId;
  name: string;
  display_name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestOperationMetadata {
  id: RecordId;
  name: string;
  display_name: string;
  operation_type: string;
  tables: string[];
  description?: string;
  created_at: Date;
}

export interface TestMenuMetadata {
  id: RecordId;
  name: string;
  display_name: string;
  path?: string;
  icon?: string;
  parent_id?: RecordId;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

// 标准测试数据集合
export class TestDataGenerator {
  private static instance: TestDataGenerator;
  
  public static getInstance(): TestDataGenerator {
    if (!TestDataGenerator.instance) {
      TestDataGenerator.instance = new TestDataGenerator();
    }
    return TestDataGenerator.instance;
  }

  /**
   * 生成测试用户数据
   */
  generateUsers(): TestUser[] {
    const now = new Date();
    return [
      {
        id: new RecordId('user', 'admin'),
        github_id: '--admin--',
        name: '系统管理员',
        email: 'admin@cuckoox.cn',
        avatar_url: 'https://via.placeholder.com/40',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('user', 'case_manager'),
        github_id: 'case_manager',
        name: '案件管理员',
        email: 'manager@cuckoox.cn',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('user', 'creditor_user'),
        github_id: 'creditor_user',
        name: '债权人用户',
        email: 'creditor@cuckoox.cn',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('user', 'test_user'),
        github_id: 'test_user',
        name: '测试用户',
        email: 'test@cuckoox.cn',
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试案件数据
   */
  generateCases(): TestCase[] {
    const now = new Date();
    const acceptanceDate = new Date('2024-01-15');
    const announcementDate = new Date('2024-02-09');
    const claimStartDate = new Date('2024-03-10');
    const claimEndDate = new Date('2024-05-09');

    return [
      {
        id: new RecordId('case', 'test_case_1'),
        acceptance_date: acceptanceDate,
        announcement_date: announcementDate,
        case_lead_user_id: new RecordId('user', 'case_manager'),
        case_manager_name: '张三',
        case_number: '(2024)京0108破1号',
        case_procedure: '破产清算',
        claim_submission_start_date: claimStartDate,
        claim_submission_end_date: claimEndDate,
        created_at: now,
        created_by_user: new RecordId('user', 'admin'),
        name: '北京某某科技有限公司破产清算案',
        procedure_phase: '债权申报',
        selected_theme_name: 'default',
        updated_at: now,
      },
      {
        id: new RecordId('case', 'test_case_2'),
        acceptance_date: new Date('2024-02-01'),
        case_manager_name: '李四',
        case_number: '(2024)京0108破2号',
        case_procedure: '破产重整',
        created_at: now,
        created_by_user: new RecordId('user', 'admin'),
        name: '上海某某贸易有限公司破产重整案',
        procedure_phase: '立案',
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试债权人数据
   */
  generateCreditors(): TestCreditor[] {
    const now = new Date();
    return [
      {
        id: new RecordId('creditor', 'creditor_1'),
        case_id: new RecordId('case', 'test_case_1'),
        name: '个人债权人张某',
        phone: '13800138001',
        email: 'zhang@example.com',
        address: '北京市海淀区某某街道123号',
        id_number: '110101199001011234',
        creditor_type: 'individual',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('creditor', 'creditor_2'),
        case_id: new RecordId('case', 'test_case_1'),
        name: '企业债权人某某公司',
        phone: '010-12345678',
        email: 'contact@company.com',
        address: '北京市朝阳区某某大厦456号',
        organization_code: '91110000000000001X',
        creditor_type: 'company',
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试债权申报数据
   */
  generateClaims(): TestClaim[] {
    const now = new Date();
    return [
      {
        id: new RecordId('claim', 'claim_1'),
        case_id: new RecordId('case', 'test_case_1'),
        creditor_id: new RecordId('creditor', 'creditor_1'),
        created_by: new RecordId('user', 'creditor_user'),
        claim_amount: 100000.00,
        claim_nature: 'ordinary',
        claim_description: '借款本金及利息',
        review_status: '待审核',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('claim', 'claim_2'),
        case_id: new RecordId('case', 'test_case_1'),
        creditor_id: new RecordId('creditor', 'creditor_2'),
        created_by: new RecordId('user', 'creditor_user'),
        claim_amount: 500000.00,
        claim_nature: 'secured',
        claim_description: '抵押债权',
        review_status: '已审核',
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试角色数据
   */
  generateRoles(): TestRole[] {
    const now = new Date();
    return [
      {
        id: new RecordId('role', 'admin'),
        name: 'admin',
        display_name: '系统管理员',
        description: '拥有系统所有权限',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('role', 'case_manager'),
        name: 'case_manager',
        display_name: '案件管理员',
        description: '管理破产案件的相关操作',
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId('role', 'creditor'),
        name: 'creditor',
        display_name: '债权人',
        description: '债权人用户角色',
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试操作元数据
   */
  generateOperationMetadata(): TestOperationMetadata[] {
    const now = new Date();
    return [
      {
        id: new RecordId('operation_metadata', 'case_read'),
        name: 'case_read',
        display_name: '查看案件',
        operation_type: 'read',
        tables: ['case'],
        description: '查看破产案件信息',
        created_at: now,
      },
      {
        id: new RecordId('operation_metadata', 'case_write'),
        name: 'case_write',
        display_name: '编辑案件',
        operation_type: 'write',
        tables: ['case'],
        description: '编辑破产案件信息',
        created_at: now,
      },
      {
        id: new RecordId('operation_metadata', 'creditor_read'),
        name: 'creditor_read',
        display_name: '查看债权人',
        operation_type: 'read',
        tables: ['creditor'],
        description: '查看债权人信息',
        created_at: now,
      },
      {
        id: new RecordId('operation_metadata', 'creditor_write'),
        name: 'creditor_write',
        display_name: '编辑债权人',
        operation_type: 'write',
        tables: ['creditor'],
        description: '编辑债权人信息',
        created_at: now,
      },
      {
        id: new RecordId('operation_metadata', 'claim_read'),
        name: 'claim_read',
        display_name: '查看债权申报',
        operation_type: 'read',
        tables: ['claim'],
        description: '查看债权申报信息',
        created_at: now,
      },
      {
        id: new RecordId('operation_metadata', 'claim_create'),
        name: 'claim_create',
        display_name: '创建债权申报',
        operation_type: 'create',
        tables: ['claim'],
        description: '创建债权申报',
        created_at: now,
      },
    ];
  }

  /**
   * 生成测试菜单元数据
   */
  generateMenuMetadata(): TestMenuMetadata[] {
    const now = new Date();
    return [
      {
        id: new RecordId('menu_metadata', 'dashboard'),
        name: 'dashboard',
        display_name: '仪表板',
        path: '/dashboard',
        icon: 'mdi-view-dashboard',
        sort_order: 1,
        is_active: true,
        created_at: now,
      },
      {
        id: new RecordId('menu_metadata', 'cases'),
        name: 'cases',
        display_name: '案件管理',
        path: '/cases',
        icon: 'mdi-briefcase',
        sort_order: 2,
        is_active: true,
        created_at: now,
      },
      {
        id: new RecordId('menu_metadata', 'claims'),
        name: 'claims',
        display_name: '债权申报',
        path: '/claims',
        icon: 'mdi-file-document',
        sort_order: 3,
        is_active: true,
        created_at: now,
      },
      {
        id: new RecordId('menu_metadata', 'creditors'),
        name: 'creditors',
        display_name: '债权人管理',
        path: '/creditors',
        icon: 'mdi-account-group',
        sort_order: 4,
        is_active: true,
        created_at: now,
      },
    ];
  }

  /**
   * 生成所有测试数据的SQL插入语句
   */
  generateInsertStatements(): string[] {
    const statements: string[] = [];
    
    // 插入用户数据
    for (const user of this.generateUsers()) {
      statements.push(`
        CREATE user:${user.id.id} SET 
          github_id = '${user.github_id}',
          name = '${user.name}',
          email = '${user.email}',
          avatar_url = ${user.avatar_url ? `'${user.avatar_url}'` : 'NONE'},
          created_at = d'${user.created_at.toISOString()}',
          updated_at = d'${user.updated_at.toISOString()}';
      `.trim());
    }

    // 插入角色数据
    for (const role of this.generateRoles()) {
      statements.push(`
        CREATE role:${role.id.id} SET 
          name = '${role.name}',
          display_name = '${role.display_name}',
          description = ${role.description ? `'${role.description}'` : 'NONE'},
          created_at = d'${role.created_at.toISOString()}',
          updated_at = d'${role.updated_at.toISOString()}';
      `.trim());
    }

    // 插入操作元数据
    for (const op of this.generateOperationMetadata()) {
      statements.push(`
        CREATE operation_metadata:${op.id.id} SET 
          name = '${op.name}',
          display_name = '${op.display_name}',
          operation_type = '${op.operation_type}',
          tables = [${op.tables.map(t => `'${t}'`).join(', ')}],
          description = ${op.description ? `'${op.description}'` : 'NONE'},
          created_at = d'${op.created_at.toISOString()}';
      `.trim());
    }

    // 插入菜单元数据
    for (const menu of this.generateMenuMetadata()) {
      statements.push(`
        CREATE menu_metadata:${menu.id.id} SET 
          name = '${menu.name}',
          display_name = '${menu.display_name}',
          path = ${menu.path ? `'${menu.path}'` : 'NONE'},
          icon = ${menu.icon ? `'${menu.icon}'` : 'NONE'},
          parent_id = ${menu.parent_id ? `menu_metadata:${menu.parent_id.id}` : 'NONE'},
          sort_order = ${menu.sort_order},
          is_active = ${menu.is_active},
          created_at = d'${menu.created_at.toISOString()}';
      `.trim());
    }

    // 插入案件数据
    for (const caseData of this.generateCases()) {
      statements.push(`
        CREATE case:${caseData.id.id} SET 
          acceptance_date = d'${caseData.acceptance_date.toISOString()}',
          announcement_date = ${caseData.announcement_date ? `d'${caseData.announcement_date.toISOString()}'` : 'NONE'},
          case_lead_user_id = ${caseData.case_lead_user_id ? `user:${caseData.case_lead_user_id.id}` : 'NONE'},
          case_manager_name = '${caseData.case_manager_name}',
          case_number = '${caseData.case_number}',
          case_procedure = '${caseData.case_procedure}',
          claim_submission_start_date = ${caseData.claim_submission_start_date ? `d'${caseData.claim_submission_start_date.toISOString()}'` : 'NONE'},
          claim_submission_end_date = ${caseData.claim_submission_end_date ? `d'${caseData.claim_submission_end_date.toISOString()}'` : 'NONE'},
          closing_date = ${caseData.closing_date ? `d'${caseData.closing_date.toISOString()}'` : 'NONE'},
          created_at = d'${caseData.created_at.toISOString()}',
          created_by_user = user:${caseData.created_by_user.id},
          name = '${caseData.name}',
          procedure_phase = '${caseData.procedure_phase}',
          selected_theme_name = ${caseData.selected_theme_name ? `'${caseData.selected_theme_name}'` : 'NONE'},
          updated_at = d'${caseData.updated_at.toISOString()}';
      `.trim());
    }

    // 插入债权人数据
    for (const creditor of this.generateCreditors()) {
      statements.push(`
        CREATE creditor:${creditor.id.id} SET 
          case_id = case:${creditor.case_id.id},
          name = '${creditor.name}',
          phone = ${creditor.phone ? `'${creditor.phone}'` : 'NONE'},
          email = ${creditor.email ? `'${creditor.email}'` : 'NONE'},
          address = ${creditor.address ? `'${creditor.address}'` : 'NONE'},
          organization_code = ${creditor.organization_code ? `'${creditor.organization_code}'` : 'NONE'},
          id_number = ${creditor.id_number ? `'${creditor.id_number}'` : 'NONE'},
          creditor_type = '${creditor.creditor_type}',
          created_at = d'${creditor.created_at.toISOString()}',
          updated_at = d'${creditor.updated_at.toISOString()}';
      `.trim());
    }

    // 插入债权申报数据
    for (const claim of this.generateClaims()) {
      statements.push(`
        CREATE claim:${claim.id.id} SET 
          case_id = case:${claim.case_id.id},
          creditor_id = creditor:${claim.creditor_id.id},
          created_by = user:${claim.created_by.id},
          claim_amount = ${claim.claim_amount},
          claim_nature = '${claim.claim_nature}',
          claim_description = ${claim.claim_description ? `'${claim.claim_description}'` : 'NONE'},
          review_status = '${claim.review_status}',
          created_at = d'${claim.created_at.toISOString()}',
          updated_at = d'${claim.updated_at.toISOString()}';
      `.trim());
    }

    // 插入用户角色关系
    statements.push('RELATE user:admin->has_role->role:admin SET assigned_at = time::now(), assigned_by = user:admin;');
    statements.push('RELATE user:case_manager->has_role->role:case_manager SET assigned_at = time::now(), assigned_by = user:admin;');
    statements.push('RELATE user:creditor_user->has_role->role:creditor SET assigned_at = time::now(), assigned_by = user:admin;');
    
    // 为admin角色分配所有操作权限
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:case_read SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:case_write SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:creditor_read SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:creditor_write SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:claim_read SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_execute_operation->operation_metadata:claim_create SET granted_at = time::now(), granted_by = user:admin;');
    
    // 为case_manager角色分配案件相关权限
    statements.push('RELATE role:case_manager->can_execute_operation->operation_metadata:case_read SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:case_manager->can_execute_operation->operation_metadata:case_write SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:case_manager->can_execute_operation->operation_metadata:claim_read SET granted_at = time::now(), granted_by = user:admin;');
    
    // 为creditor角色分配债权申报权限
    statements.push('RELATE role:creditor->can_execute_operation->operation_metadata:claim_read SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:creditor->can_execute_operation->operation_metadata:claim_create SET granted_at = time::now(), granted_by = user:admin;');
    
    // 为admin角色分配所有菜单权限
    statements.push('RELATE role:admin->can_access_menu->menu_metadata:dashboard SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_access_menu->menu_metadata:cases SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_access_menu->menu_metadata:claims SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:admin->can_access_menu->menu_metadata:creditors SET granted_at = time::now(), granted_by = user:admin;');
    
    // 为case_manager角色分配菜单权限
    statements.push('RELATE role:case_manager->can_access_menu->menu_metadata:dashboard SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:case_manager->can_access_menu->menu_metadata:cases SET granted_at = time::now(), granted_by = user:admin;');
    
    // 为creditor角色分配菜单权限
    statements.push('RELATE role:creditor->can_access_menu->menu_metadata:dashboard SET granted_at = time::now(), granted_by = user:admin;');
    statements.push('RELATE role:creditor->can_access_menu->menu_metadata:claims SET granted_at = time::now(), granted_by = user:admin;');

    return statements;
  }
}