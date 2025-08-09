/**
 * 测试数据生成器
 * 提供标准化的测试数据集合
 */

import { RecordId } from "surrealdb";

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
        id: new RecordId("user", "admin"),
        github_id: "--admin--",
        name: "系统管理员",
        email: "admin@cuckoox.cn",
        avatar_url: "https://via.placeholder.com/40",
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId("user", "case_manager"),
        github_id: "case_manager",
        name: "案件管理员",
        email: "manager@cuckoox.cn",
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId("user", "creditor_user"),
        github_id: "creditor_user",
        name: "债权人用户",
        email: "creditor@cuckoox.cn",
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId("user", "test_user"),
        github_id: "test_user",
        name: "测试用户",
        email: "test@cuckoox.cn",
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
    const acceptanceDate = new Date("2024-01-15");
    const announcementDate = new Date("2024-02-09");
    const claimStartDate = new Date("2024-03-10");
    const claimEndDate = new Date("2024-05-09");

    return [
      {
        id: new RecordId("case", "test_case_1"),
        acceptance_date: acceptanceDate,
        announcement_date: announcementDate,
        case_lead_user_id: new RecordId("user", "case_manager"),
        case_manager_name: "张三",
        case_number: "(2024)京0108破1号",
        case_procedure: "破产清算",
        claim_submission_start_date: claimStartDate,
        claim_submission_end_date: claimEndDate,
        created_at: now,
        created_by_user: new RecordId("user", "admin"),
        name: "北京某某科技有限公司破产清算案",
        procedure_phase: "债权申报",
        selected_theme_name: "default",
        updated_at: now,
      },
      {
        id: new RecordId("case", "test_case_2"),
        acceptance_date: new Date("2024-02-01"),
        case_manager_name: "李四",
        case_number: "(2024)京0108破2号",
        case_procedure: "破产重整",
        created_at: now,
        created_by_user: new RecordId("user", "admin"),
        name: "上海某某贸易有限公司破产重整案",
        procedure_phase: "立案",
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试债权人数据
   */
  generateCreditors(): TestCreditor[] {
    const now = new Date();
    const caseId = new RecordId("case", "test_case_1");

    return [
      {
        id: new RecordId("creditor", "test_creditor_1"),
        case_id: caseId,
        name: "北京某某科技有限公司",
        phone: "010-12345678",
        email: "contact@company1.com",
        address: "北京市海淀区科技园区123号",
        organization_code: "91110108123456789X",
        creditor_type: "enterprise",
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId("creditor", "test_creditor_2"),
        case_id: caseId,
        name: "张三",
        phone: "138-0013-8000",
        email: "zhangsan@example.com",
        address: "上海市浦东新区某某路456号",
        id_number: "310101199001011234",
        creditor_type: "individual",
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
    const caseId = new RecordId("case", "test_case_1");
    const creditor1Id = new RecordId("creditor", "test_creditor_1");
    const creditor2Id = new RecordId("creditor", "test_creditor_2");
    const createdBy = new RecordId("user", "admin");

    return [
      {
        id: new RecordId("claim", "test_claim_1"),
        case_id: caseId,
        creditor_id: creditor1Id,
        created_by: createdBy,
        claim_amount: 500000,
        claim_nature: "ordinary",
        claim_description: "货款债务",
        review_status: "approved",
        created_at: now,
        updated_at: now,
      },
      {
        id: new RecordId("claim", "test_claim_2"),
        case_id: caseId,
        creditor_id: creditor2Id,
        created_by: createdBy,
        claim_amount: 100000,
        claim_nature: "priority",
        claim_description: "工资债务",
        review_status: "submitted",
        created_at: now,
        updated_at: now,
      },
    ];
  }

  /**
   * 生成测试角色数据（依赖Schema创建）
   */
  generateRoles(): TestRole[] {
    return []; // Schema会自动创建角色数据
  }

  /**
   * 生成测试操作元数据（依赖Schema创建）
   */
  generateOperationMetadata(): TestOperationMetadata[] {
    return []; // Schema会自动创建操作元数据
  }

  /**
   * 生成测试菜单元数据（依赖Schema创建）
   */
  generateMenuMetadata(): TestMenuMetadata[] {
    return []; // Schema会自动创建菜单元数据
  }

  /**
   * 生成所有测试数据的SQL插入语句
   */
  generateInsertStatements(): string[] {
    const statements: string[] = [];

    // 插入基础用户数据 - 这些用户已在Schema中定义
    // 只需要创建admin用户，因为Schema会自动处理用户角色关系
    statements.push(
      `
      CREATE user:admin SET
        github_id = '--admin--',
        username = 'admin',
        name = '系统管理员',
        email = 'admin@cuckoox.cn',
        avatar_url = 'https://via.placeholder.com/40',
        created_at = time::now(),
        updated_at = time::now();
    `.trim(),
    );

    // 为admin用户分配admin角色
    statements.push(`
      RELATE user:admin->has_role->role:admin SET
        created_at = time::now(),
        updated_at = time::now();
    `.trim());

    // 插入测试案件数据
    const cases = this.generateCases();
    for (const testCase of cases) {
      statements.push(`
        CREATE case:${testCase.id.id} SET
          acceptance_date = d'${testCase.acceptance_date.toISOString().split('T')[0]}',
          case_manager_name = '${testCase.case_manager_name}',
          case_number = '${testCase.case_number}',
          case_procedure = '${testCase.case_procedure}',
          name = '${testCase.name}',
          procedure_phase = '${testCase.procedure_phase}',
          created_by_user = ${testCase.created_by_user.toString()},
          created_at = time::now(),
          updated_at = time::now();
      `.trim());
    }

    // 暂时跳过债权人和债权申报数据，因为它们需要特殊的权限认证
    // 这些数据将在特定的页面测试中通过TestHelpers.create()方法创建
    
    // 由于Schema中已经定义了完整的权限系统和初始数据，
    // 包括角色、操作元数据、菜单元数据、用户角色关系等，
    // 这里只需要确保基础数据存在即可

    return statements;
  }
}
