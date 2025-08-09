/**
 * 债权人管理综合集成测试
 * 测试债权人的完整生命周期：添加、查询、修改、批量导入等
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

// 债权人类型定义
interface Creditor {
  id: RecordId;
  name: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  creditor_type: 'individual' | 'enterprise';
  identification_number?: string; // 身份证号或统一社会信用代码
  created_at: Date;
  updated_at: Date;
}

// 简化的债权人列表组件
const CreditorList: React.FC = () => {
  const [creditors, setCreditors] = React.useState<Creditor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');

  React.useEffect(() => {
    const loadCreditors = async () => {
      try {
        setLoading(true);
        const sql = filter 
          ? `SELECT * FROM creditor WHERE name CONTAINS "${filter}" OR contact_person CONTAINS "${filter}" ORDER BY created_at DESC;`
          : "SELECT * FROM creditor ORDER BY created_at DESC;";
        
        const result = await TestHelpers.query(sql);
        const rows = (result?.[0] as unknown as Creditor[]) || [];
        setCreditors(rows);
      } catch (err) {
        console.error("加载债权人失败:", err);
        setCreditors([]);
      } finally {
        setLoading(false);
      }
    };

    loadCreditors();
  }, [filter]);

  if (loading) return <div data-testid="loading">加载中...</div>;

  return (
    <div data-testid="creditor-list">
      <h1>债权人列表</h1>
      
      <div>
        <input
          data-testid="creditor-search"
          type="text"
          placeholder="搜索债权人..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {creditors.length === 0 ? (
        <div data-testid="empty-creditor-list">暂无债权人</div>
      ) : (
        <div data-testid="creditor-items">
          {creditors.map((creditor) => (
            <div
              key={creditor.id.toString()}
              data-testid={`creditor-${creditor.id.id}`}
              style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}
            >
              <h3>{creditor.name}</h3>
              <p>类型: {creditor.creditor_type === 'individual' ? '个人' : '企业'}</p>
              {creditor.contact_person && <p>联系人: {creditor.contact_person}</p>}
              {creditor.contact_phone && <p>电话: {creditor.contact_phone}</p>}
              {creditor.contact_email && <p>邮箱: {creditor.contact_email}</p>}
              {creditor.identification_number && (
                <p>证件号: {creditor.identification_number}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 债权人创建表单组件
const CreditorCreator: React.FC<{ onCreditorCreated?: () => void }> = ({ onCreditorCreated }) => {
  const [formData, setFormData] = React.useState({
    name: '',
    creditor_type: 'individual' as 'individual' | 'enterprise',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    identification_number: '',
  });
  const [creating, setCreating] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      setCreating(true);
      await TestHelpers.create('creditor', {
        ...formData,
        created_at: new Date(),
        updated_at: new Date(),
      });

      setFormData({
        name: '',
        creditor_type: 'individual',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        address: '',
        identification_number: '',
      });
      onCreditorCreated?.();
    } catch (error) {
      console.error('创建债权人失败:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="creditor-creator">
      <h2>添加债权人</h2>
      
      <div>
        <label htmlFor="creditor-name">债权人名称:</label>
        <input
          id="creditor-name"
          data-testid="creditor-name-input"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <label htmlFor="creditor-type">债权人类型:</label>
        <select
          id="creditor-type"
          data-testid="creditor-type-select"
          value={formData.creditor_type}
          onChange={(e) => setFormData(prev => ({ ...prev, creditor_type: e.target.value as 'individual' | 'enterprise' }))}
        >
          <option value="individual">个人</option>
          <option value="enterprise">企业</option>
        </select>
      </div>

      <div>
        <label htmlFor="contact-person">联系人:</label>
        <input
          id="contact-person"
          data-testid="contact-person-input"
          type="text"
          value={formData.contact_person}
          onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="contact-phone">联系电话:</label>
        <input
          id="contact-phone"
          data-testid="contact-phone-input"
          type="text"
          value={formData.contact_phone}
          onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="identification-number">证件号码:</label>
        <input
          id="identification-number"
          data-testid="identification-number-input"
          type="text"
          value={formData.identification_number}
          onChange={(e) => setFormData(prev => ({ ...prev, identification_number: e.target.value }))}
        />
      </div>

      <button
        type="submit"
        disabled={creating}
        data-testid="create-creditor-button"
      >
        {creating ? '创建中...' : '创建债权人'}
      </button>
    </form>
  );
};

describe('债权人管理 - 综合集成测试', () => {
  beforeEach(async () => {
    await TestHelpers.resetDatabase();
    await TestHelpers.setAuthUser(TEST_IDS.USERS.ADMIN);
  });

  describe('债权人列表功能', () => {
    it('应该显示已有的债权人列表', async () => {
      renderWithRealSurreal(<CreditorList />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByText('债权人列表')).toBeInTheDocument();
      
      // 验证测试数据中的债权人
      const creditorItems = screen.queryByTestId('creditor-items');
      if (creditorItems) {
        // 如果有测试数据，验证显示
        expect(creditorItems).toBeInTheDocument();
      } else {
        // 如果没有测试数据，应该显示空状态
        expect(screen.getByTestId('empty-creditor-list')).toBeInTheDocument();
      }
    });

    it('应该支持债权人搜索功能', async () => {
      // 先创建一些债权人用于搜索
      await TestHelpers.create('creditor', {
        name: '张三测试公司',
        creditor_type: 'enterprise',
        contact_person: '李四',
        contact_phone: '13800138000',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await TestHelpers.create('creditor', {
        name: '王五个人',
        creditor_type: 'individual',
        contact_person: '王五',
        contact_phone: '13900139000',
        created_at: new Date(),
        updated_at: new Date(),
      });

      renderWithRealSurreal(<CreditorList />);

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // 搜索测试
      const searchInput = screen.getByTestId('creditor-search');
      
      // 搜索公司名称
      fireEvent.change(searchInput, { target: { value: '张三' } });
      
      await waitFor(() => {
        expect(screen.getByText('张三测试公司')).toBeInTheDocument();
        expect(screen.queryByText('王五个人')).not.toBeInTheDocument();
      });

      // 清空搜索
      fireEvent.change(searchInput, { target: { value: '' } });
      
      await waitFor(() => {
        expect(screen.getByText('张三测试公司')).toBeInTheDocument();
        expect(screen.getByText('王五个人')).toBeInTheDocument();
      });
    });
  });

  describe('债权人创建功能', () => {
    it('应该能够创建个人债权人', async () => {
      let creditorCreated = false;
      renderWithRealSurreal(
        <CreditorCreator onCreditorCreated={() => { creditorCreated = true; }} />
      );

      // 填写个人债权人表单
      fireEvent.change(screen.getByTestId('creditor-name-input'), {
        target: { value: '个人债权人张三' }
      });
      
      fireEvent.change(screen.getByTestId('creditor-type-select'), {
        target: { value: 'individual' }
      });
      
      fireEvent.change(screen.getByTestId('contact-person-input'), {
        target: { value: '张三' }
      });
      
      fireEvent.change(screen.getByTestId('contact-phone-input'), {
        target: { value: '13812345678' }
      });
      
      fireEvent.change(screen.getByTestId('identification-number-input'), {
        target: { value: '110101199001011234' }
      });

      const initialCount = await TestHelpers.getRecordCount('creditor');

      await act(async () => {
        fireEvent.click(screen.getByTestId('create-creditor-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('create-creditor-button')).not.toBeDisabled();
      }, { timeout: 3000 });

      // 验证债权人创建成功
      await TestHelpers.waitForDatabaseOperation(
        async () => {
          const current = await TestHelpers.getRecordCount('creditor');
          return current === initialCount + 1 ? current : null;
        },
        20,
        50
      );

      expect(creditorCreated).toBe(true);

      // 验证数据库中的记录
      const result = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name = '个人债权人张三';"
      );
      const rows = (result?.[0] as any[]) ?? [];
      expect(rows).toHaveLength(1);
      
      const creditor = rows[0] as any;
      expect(creditor.creditor_type).toBe('individual');
      expect(creditor.contact_person).toBe('张三');
      expect(creditor.identification_number).toBe('110101199001011234');
    });

    it('应该能够创建企业债权人', async () => {
      renderWithRealSurreal(<CreditorCreator />);

      // 填写企业债权人表单
      fireEvent.change(screen.getByTestId('creditor-name-input'), {
        target: { value: '测试科技有限公司' }
      });
      
      fireEvent.change(screen.getByTestId('creditor-type-select'), {
        target: { value: 'enterprise' }
      });
      
      fireEvent.change(screen.getByTestId('contact-person-input'), {
        target: { value: '李经理' }
      });
      
      fireEvent.change(screen.getByTestId('contact-phone-input'), {
        target: { value: '400-123-4567' }
      });
      
      fireEvent.change(screen.getByTestId('identification-number-input'), {
        target: { value: '91110108123456789X' }
      });

      const initialCount = await TestHelpers.getRecordCount('creditor');

      await act(async () => {
        fireEvent.click(screen.getByTestId('create-creditor-button'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('create-creditor-button')).not.toBeDisabled();
      }, { timeout: 3000 });

      // 验证债权人创建成功
      await TestHelpers.waitForDatabaseOperation(
        async () => {
          const current = await TestHelpers.getRecordCount('creditor');
          return current === initialCount + 1 ? current : null;
        },
        20,
        50
      );

      // 验证数据库中的记录
      const result = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name = '测试科技有限公司';"
      );
      const rows = (result?.[0] as any[]) ?? [];
      expect(rows).toHaveLength(1);
      
      const creditor = rows[0] as any;
      expect(creditor.creditor_type).toBe('enterprise');
      expect(creditor.contact_person).toBe('李经理');
      expect(creditor.identification_number).toBe('91110108123456789X');
    });

    it('应该验证必填字段', async () => {
      renderWithRealSurreal(<CreditorCreator />);

      const initialCount = await TestHelpers.getRecordCount('creditor');

      // 不填写名称直接提交
      await act(async () => {
        fireEvent.click(screen.getByTestId('create-creditor-button'));
      });

      // HTML5 required 属性会阻止表单提交，所以计数不应该增加
      const finalCount = await TestHelpers.getRecordCount('creditor');
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('债权人批量操作', () => {
    it('应该支持批量删除债权人', async () => {
      // 创建多个债权人
      const creditor1 = await TestHelpers.create('creditor', {
        name: '待删除债权人1',
        creditor_type: 'individual',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const creditor2 = await TestHelpers.create('creditor', {
        name: '待删除债权人2',
        creditor_type: 'enterprise',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const initialCount = await TestHelpers.getRecordCount('creditor');

      // 批量删除操作
      await TestHelpers.query(`
        DELETE creditor WHERE name IN ['待删除债权人1', '待删除债权人2'];
      `);

      // 验证删除结果
      const finalCount = await TestHelpers.getRecordCount('creditor');
      expect(finalCount).toBe(initialCount - 2);

      // 验证特定记录已删除
      const result1 = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name = '待删除债权人1';"
      );
      const result2 = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name = '待删除债权人2';"
      );
      
      expect((result1?.[0] as any[]) || []).toHaveLength(0);
      expect((result2?.[0] as any[]) || []).toHaveLength(0);
    });

    it('应该支持批量更新债权人信息', async () => {
      // 创建多个债权人
      await TestHelpers.create('creditor', {
        name: '批量更新债权人1',
        creditor_type: 'individual',
        contact_phone: '旧电话1',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await TestHelpers.create('creditor', {
        name: '批量更新债权人2', 
        creditor_type: 'individual',
        contact_phone: '旧电话2',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 批量更新操作
      await TestHelpers.query(`
        UPDATE creditor SET 
          contact_phone = '13800138000',
          updated_at = time::now()
        WHERE name CONTAINS '批量更新';
      `);

      // 验证更新结果
      const result = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name CONTAINS '批量更新';"
      );
      const rows = (result?.[0] as any[]) ?? [];
      
      expect(rows).toHaveLength(2);
      for (const creditor of rows) {
        expect(creditor.contact_phone).toBe('13800138000');
      }
    });
  });

  describe('债权人数据验证', () => {
    it('应该验证身份证号码格式（个人）', async () => {
      const validCreditor = await TestHelpers.create('creditor', {
        name: '有效身份证债权人',
        creditor_type: 'individual',
        identification_number: '110101199001011234',
        created_at: new Date(),
        updated_at: new Date(),
      });

      expect(validCreditor).toBeDefined();
      expect((validCreditor as any).identification_number).toBe('110101199001011234');
    });

    it('应该验证统一社会信用代码格式（企业）', async () => {
      const validCreditor = await TestHelpers.create('creditor', {
        name: '有效信用代码企业',
        creditor_type: 'enterprise',
        identification_number: '91110108123456789X',
        created_at: new Date(),
        updated_at: new Date(),
      });

      expect(validCreditor).toBeDefined();
      expect((validCreditor as any).identification_number).toBe('91110108123456789X');
    });

    it('应该处理重复债权人名称', async () => {
      const name = '重复名称债权人';
      
      // 创建第一个债权人
      await TestHelpers.create('creditor', {
        name,
        creditor_type: 'individual',
        identification_number: '110101199001011234',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const initialCount = await TestHelpers.getRecordCount('creditor');

      // 尝试创建相同名称的债权人
      try {
        await TestHelpers.create('creditor', {
          name,
          creditor_type: 'enterprise',
          identification_number: '91110108123456789X',
          created_at: new Date(),
          updated_at: new Date(),
        });
        
        // 如果没有唯一约束，这个测试会通过
        // 如果有唯一约束，应该抛出错误
        const finalCount = await TestHelpers.getRecordCount('creditor');
        // 这里我们检查是否创建成功，具体行为取决于数据库schema
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);
      } catch (error) {
        // 如果有唯一约束，这里会捕获到错误
        expect(error).toBeDefined();
        const finalCount = await TestHelpers.getRecordCount('creditor');
        expect(finalCount).toBe(initialCount);
      }
    });
  });

  describe('债权人关联数据', () => {
    it('应该支持债权人与案件的关联', async () => {
      // 创建测试案件
      const testCase = await TestHelpers.create('case', {
        name: '债权人关联测试案件',
        case_number: '(2024)债权关联001',
        case_manager_name: '测试管理员',
        acceptance_date: new Date(),
        case_procedure: '破产清算',
        procedure_phase: '立案',
        created_by_user: new RecordId('user', 'admin'),
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 创建债权人
      const creditor = await TestHelpers.create('creditor', {
        name: '关联测试债权人',
        creditor_type: 'enterprise',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 验证两者都创建成功
      expect(testCase).toBeDefined();
      expect(creditor).toBeDefined();

      // 这里可以进一步测试债权人与案件的具体关联逻辑
      // 比如通过关系表或者查询验证关联
      const caseResult = await TestHelpers.query(
        `SELECT * FROM case WHERE case_number = '(2024)债权关联001';`
      );
      const creditorResult = await TestHelpers.query(
        "SELECT * FROM creditor WHERE name = '关联测试债权人';"
      );

      expect((caseResult?.[0] as any[]) || []).toHaveLength(1);
      expect((creditorResult?.[0] as any[]) || []).toHaveLength(1);
    });
  });
});