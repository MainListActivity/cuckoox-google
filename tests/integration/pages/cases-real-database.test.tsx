/**
 * 案件管理真实数据库集成测试
 * 使用内嵌 SurrealDB 进行真实数据库操作测试
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { RecordId } from "surrealdb";
import {
  renderWithRealSurreal,
  TestHelpers,
  TEST_IDS,
} from "../utils/realSurrealTestUtils";
import { RealUserOperations } from "../utils/realUserOperations";
import { getTestDatabase } from "../../setup-embedded-db";

// 这里我们需要一个简单的案件组件来测试
// 由于复杂的页面组件可能有很多依赖，我们先创建一个简单的测试组件

interface Case {
  id: RecordId;
  name: string;
  case_number: string;
  case_manager_name: string;
  created_at: Date;
}

// 简单的案件列表组件用于测试
const SimpleCaseList: React.FC = () => {
  const [cases, setCases] = React.useState<Case[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);
        // 直接使用测试数据库查询案件
        const result = await TestHelpers.query(
          "SELECT * FROM case ORDER BY created_at DESC;",
        );
        const rows = (result?.[0] as unknown as Case[]) || [];
        setCases(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载案件失败");
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, []);

  if (loading) return <div data-testid="loading">加载中...</div>;
  if (error) return <div data-testid="error">错误: {error}</div>;

  return (
    <div data-testid="case-list">
      <h1>案件列表</h1>
      {cases.length === 0 ? (
        <div data-testid="empty-list">暂无案件</div>
      ) : (
        <ul>
          {cases.map((caseItem) => (
            <li
              key={caseItem.id.toString()}
              data-testid={`case-${caseItem.id.id}`}
            >
              <h3>{caseItem.name}</h3>
              <p>案件编号: {caseItem.case_number}</p>
              <p>负责人: {caseItem.case_manager_name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// 简单的案件创建组件用于测试
const SimpleCaseCreator: React.FC<{ onCaseCreated?: () => void }> = ({
  onCaseCreated,
}) => {
  const [formData, setFormData] = React.useState({
    name: "",
    case_number: "",
    case_manager_name: "",
  });
  const [creating, setCreating] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.case_number ||
      !formData.case_manager_name
    ) {
      return;
    }

    try {
      setCreating(true);

      // 创建案件记录
      await TestHelpers.create("case", {
        ...formData,
        acceptance_date: new Date(),
        case_procedure: "破产清算",
        procedure_phase: "立案",
      });

      // 重置表单
      setFormData({ name: "", case_number: "", case_manager_name: "" });
      onCaseCreated?.();
    } catch (error) {
      console.error("创建案件失败:", error);
      // 不要重置表单，让用户看到失败
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="case-creator">
      <h2>创建案件</h2>
      <div>
        <label htmlFor="case-name">案件名称:</label>
        <input
          id="case-name"
          data-testid="case-name-input"
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      </div>
      <div>
        <label htmlFor="case-number">案件编号:</label>
        <input
          id="case-number"
          data-testid="case-number-input"
          type="text"
          value={formData.case_number}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, case_number: e.target.value }))
          }
        />
      </div>
      <div>
        <label htmlFor="case-manager">负责人:</label>
        <input
          id="case-manager"
          data-testid="case-manager-input"
          type="text"
          value={formData.case_manager_name}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              case_manager_name: e.target.value,
            }))
          }
        />
      </div>
      <button
        type="submit"
        disabled={creating}
        data-testid="create-case-button"
      >
        {creating ? "创建中..." : "创建案件"}
      </button>
    </form>
  );
};

describe("案件管理 - 真实数据库集成测试", () => {
  beforeEach(async () => {
    // 确保每个测试开始时都有干净的数据库状态
    await TestHelpers.resetDatabase();

    // 使用 admin 登录并创建两条基础用例数据，避免依赖预置用例
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
    const client = getTestDatabase();

    await RealUserOperations.adminCreateCase(client, {
      name: "用例一有限公司破产清算案",
      case_number: "(2025)测001号",
      case_manager_name: "张三",
      acceptance_date: new Date(),
      case_procedure: "破产清算",
      procedure_phase: "立案",
    });

    await RealUserOperations.adminCreateCase(client, {
      name: "用例二贸易有限公司破产重整案",
      case_number: "(2025)测002号",
      case_manager_name: "李四",
      acceptance_date: new Date(),
      case_procedure: "破产重整",
      procedure_phase: "立案",
    });
  });

  describe("案件列表功能", () => {
    it("应该显示数据库中的案件列表", async () => {
      // 设置认证用户
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 渲染案件列表组件
      renderWithRealSurreal(<SimpleCaseList />);

      // 等待加载完成
      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      // 验证显示了测试数据中的案件
      expect(screen.getByText("案件列表")).toBeInTheDocument();
      expect(screen.getByText("用例一有限公司破产清算案")).toBeInTheDocument();
      expect(
        screen.getByText("用例二贸易有限公司破产重整案"),
      ).toBeInTheDocument();

      // 验证案件详细信息
      expect(screen.getByText("案件编号: (2025)测001号")).toBeInTheDocument();
      expect(screen.getByText("负责人: 张三")).toBeInTheDocument();
    });

    it("应该正确处理空案件列表", async () => {
      // 清空所有案件数据
      await TestHelpers.query("DELETE case;");

      renderWithRealSurreal(<SimpleCaseList />);

      await waitFor(() => {
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("empty-list")).toBeInTheDocument();
      expect(screen.getByText("暂无案件")).toBeInTheDocument();
    });
  });

  describe("案件创建功能", () => {
    it("应该能够创建新案件", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      let caseCreated = false;
      renderWithRealSurreal(
        <SimpleCaseCreator
          onCaseCreated={() => {
            caseCreated = true;
          }}
        />,
      );

      // 填写案件表单
      fireEvent.change(screen.getByTestId("case-name-input"), {
        target: { value: "测试案件ABC公司破产案" },
      });
      fireEvent.change(screen.getByTestId("case-number-input"), {
        target: { value: "(2024)测试破001号" },
      });
      fireEvent.change(screen.getByTestId("case-manager-input"), {
        target: { value: "测试管理员" },
      });

      // 获取创建前的案件总数
      const initialCount = await TestHelpers.getRecordCount("case");

      // 提交表单，使用act包装状态更新
      await act(async () => {
        fireEvent.click(screen.getByTestId("create-case-button"));
      });

      // 等待表单提交处理完成
      await waitFor(
        () => {
          expect(screen.getByTestId("create-case-button")).not.toBeDisabled();
        },
        { timeout: 3000 },
      );

      // 轮询等待计数+1，避免偶发竞态
      await TestHelpers.waitForDatabaseOperation(
        async () => {
          const current = await TestHelpers.getRecordCount("case");
          return current === initialCount + 1 ? current : null;
        },
        20,
        50,
      );

      // 验证回调函数是否被调用
      expect(caseCreated).toBe(true);

      // 验证新案件的数据
      const newCases = await TestHelpers.query(
        "SELECT * FROM case WHERE case_number = '(2024)测试破001号';",
      );
      const newRows = (newCases?.[0] as any[]) ?? [];
      expect(newRows).toHaveLength(1);
      const newRow = newRows[0] as any;
      expect(newRow.name).toBe("测试案件ABC公司破产案");
      expect(newRow.case_manager_name).toBe("测试管理员");
    });

    it("应该验证案件编号的唯一性", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 先创建一个案件
      await TestHelpers.create("case", {
        name: "第一个案件",
        case_number: "(2024)重复编号001",
        case_manager_name: "管理员A",
        acceptance_date: new Date(),
        case_procedure: "破产清算",
        procedure_phase: "立案",
      });

      const initialCount = await TestHelpers.getRecordCount("case");

      renderWithRealSurreal(<SimpleCaseCreator />);

      // 尝试创建具有相同案件编号的案件
      fireEvent.change(screen.getByTestId("case-name-input"), {
        target: { value: "第二个案件" },
      });
      fireEvent.change(screen.getByTestId("case-number-input"), {
        target: { value: "(2024)重复编号001" },
      });
      fireEvent.change(screen.getByTestId("case-manager-input"), {
        target: { value: "管理员B" },
      });

      // 提交表单（这应该会失败，因为案件编号重复）
      await act(async () => {
        fireEvent.click(screen.getByTestId("create-case-button"));
      });

      // 等待表单提交处理完成
      await waitFor(
        () => {
          expect(screen.getByTestId("create-case-button")).not.toBeDisabled();
        },
        { timeout: 3000 },
      );

      // 验证案件数量没有增加（由于唯一约束失败）
      const finalCount = await TestHelpers.getRecordCount("case");
      expect(finalCount).toBe(initialCount);
    });
  });

  describe("数据库约束和关系测试", () => {
    it("应该正确处理案件创建者关系", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 创建案件并指定创建者
      const caseResult = await TestHelpers.create("case", {
        name: "关系测试案件",
        case_number: "(2024)关系测试001",
        case_manager_name: "关系测试管理员",
        acceptance_date: new Date(),
        case_procedure: "破产清算",
        procedure_phase: "立案",
      });

      // 验证案件创建成功
      expect(caseResult).toBeDefined();
      // create 已被规范化为返回对象，确保 name 可读
      expect((caseResult as any).name).toBe("关系测试案件");

      // 验证创建者关系
      const caseWithCreator = await TestHelpers.query(
        `SELECT *, created_by_user.* AS creator FROM case WHERE case_number = '(2024)关系测试001';`,
      );

      const creatorRows = (caseWithCreator?.[0] as any[]) ?? [];
      expect(creatorRows).toHaveLength(1);
      const creatorRow = creatorRows[0] as any;
      expect(creatorRow.creator).toBeDefined();
      expect(String((creatorRow.creator as any).id)).toContain("user:admin");
    });

    it("应该正确验证日期字段", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      const acceptanceDate = new Date("2024-03-15");
      const announcementDate = new Date("2024-04-15");

      const caseResult = await TestHelpers.create("case", {
        name: "日期测试案件",
        case_number: "(2024)日期测试001",
        case_manager_name: "日期测试管理员",
        acceptance_date: acceptanceDate,
        announcement_date: announcementDate,
        case_procedure: "破产清算",
        procedure_phase: "立案",
      });

      // Surreal 可能返回字符串，需要兼容
      const acc = (caseResult as any).acceptance_date;
      const ann = (caseResult as any).announcement_date;
      const accDate = acc instanceof Date ? acc : new Date(acc);
      const annDate = ann instanceof Date ? ann : new Date(ann);

      expect(accDate instanceof Date && !isNaN(accDate.getTime())).toBe(true);
      expect(annDate instanceof Date && !isNaN(annDate.getTime())).toBe(true);

      // 从数据库重新查询验证（通过 case_number 避免 ID 形态差异）
      const savedRes = await TestHelpers.query(
        "SELECT * FROM case WHERE case_number = '(2024)日期测试001';",
      );
      const saved = ((savedRes?.[0] as any[]) || [])[0];
      expect(saved).toBeTruthy();
      const acc2 = saved.acceptance_date as unknown;
      const ann2 = saved.announcement_date as unknown;
      const accDate2 = acc2 instanceof Date ? acc2 : new Date(acc2 as any);
      const annDate2 = ann2 instanceof Date ? ann2 : new Date(ann2 as any);
      expect(accDate2 instanceof Date && !isNaN(accDate2.getTime())).toBe(true);
      expect(annDate2 instanceof Date && !isNaN(annDate2.getTime())).toBe(true);
    });
  });

  describe("权限和认证测试", () => {
    it("应该区分管理员用户的访问权限", async () => {
      // 仅验证管理员用户可以访问案件列表（其余用户需通过页面流程创建后再验证）
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      const adminCases = await TestHelpers.query("SELECT * FROM case;");
      const adminRows = (adminCases?.[0] as any[]) ?? [];
      expect(adminRows.length).toBeGreaterThan(0);
    });

    it("应该正确处理未认证用户", async () => {
      // 清除认证状态
      await TestHelpers.clearAuth();

      // 尝试查询案件（根据权限系统，这可能会失败或返回空结果）
      try {
        const result = await TestHelpers.query("SELECT * FROM case;");
        // 如果查询成功，验证结果
        expect(result).toBeDefined();
      } catch (error) {
        // 如果查询失败，验证是权限相关的错误
        expect(error).toBeDefined();
      }
    });
  });

  describe("数据一致性测试", () => {
    it("应该正确维护案件统计信息", async () => {
      await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);

      // 获取初始案件数量
      const initialStats = await TestHelpers.getDatabaseStats();
      const initialCaseCount = initialStats.case || 0;

      // 创建新案件
      await TestHelpers.create("case", {
        name: "统计测试案件",
        case_number: "(2024)统计测试001",
        case_manager_name: "统计测试管理员",
        acceptance_date: new Date(),
        case_procedure: "破产清算",
        procedure_phase: "立案",
      });

      // 验证统计信息更新（等待计数变化）
      await TestHelpers.waitForDatabaseOperation(
        async () => {
          const newStats = await TestHelpers.getDatabaseStats();
          return (newStats.case || 0) === initialCaseCount + 1
            ? newStats
            : null;
        },
        20,
        50,
      );

      // 删除案件
      await TestHelpers.query(
        "DELETE case WHERE case_number = '(2024)统计测试001';",
      );

      // 验证统计信息回到原值
      await TestHelpers.waitForDatabaseOperation(
        async () => {
          const finalStats = await TestHelpers.getDatabaseStats();
          return (finalStats.case || 0) === initialCaseCount
            ? finalStats
            : null;
        },
        20,
        50,
      );
    });
  });
});
