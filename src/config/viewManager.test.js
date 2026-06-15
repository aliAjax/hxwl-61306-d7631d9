import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeView, migrateView, validateView } from './viewManager';
import { sanitizeConfig } from './configManager';
import { DEFAULT_QUEUE_CONFIG } from './defaultConfig';

function createTestConfig(overrides = {}) {
  return sanitizeConfig({
    ...DEFAULT_QUEUE_CONFIG,
    ...overrides,
  });
}

describe('viewManager', () => {
  describe('validateView', () => {
    it('空视图应返回无效', () => {
      expect(validateView(null).valid).toBe(false);
      expect(validateView(undefined).valid).toBe(false);
      expect(validateView('not object').valid).toBe(false);
    });

    it('缺少id应返回错误', () => {
      const result = validateView({ name: '测试' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('ID'))).toBe(true);
    });

    it('缺少name应返回错误', () => {
      const result = validateView({ id: 'v1' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('名称'))).toBe(true);
    });

    it('有效视图应通过验证', () => {
      const result = validateView({ id: 'v1', name: '测试视图' });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('sanitizeView', () => {
    const config = createTestConfig({
      fields: [
        { id: 'f1', key: 'name', label: '名称', type: 'input', sortable: true },
        { id: 'f2', key: 'priority', label: '优先级', type: 'select', options: ['高', '中', '低'], sortable: true },
        { id: 'f3', key: 'status', label: '状态', type: 'select', options: ['待处理', '进行中', '已完成'] },
      ],
      statuses: [
        { id: 's1', name: '待处理', primary: true },
        { id: 's2', name: '进行中' },
        { id: 's3', name: '已完成' },
      ],
      filters: [
        { id: 'fl_search', type: 'search', label: '搜索', searchFields: ['name'], enabled: true },
        { id: 'fl_status', type: 'status', label: '状态', enabled: true },
        { id: 'fl_priority', type: 'select', label: '优先级', field: 'priority', enabled: true },
        { id: 'fl_disabled', type: 'search', label: '禁用', enabled: false },
      ],
    });

    it('空或无效视图应返回null', () => {
      expect(sanitizeView(null, config)).toBeNull();
      expect(sanitizeView(undefined, config)).toBeNull();
      expect(sanitizeView('not object', config)).toBeNull();
    });

    it('应生成基本视图结构', () => {
      const view = sanitizeView({ id: 'v1', name: '我的视图' }, config);
      expect(view).not.toBeNull();
      expect(view.id).toBe('v1');
      expect(view.name).toBe('我的视图');
      expect(view.icon).toBeTruthy();
      expect(view.filters).toBeDefined();
      expect(view.sortConfig).toBeDefined();
      expect(view.activeView).toBeDefined();
      expect(view.collapsedZones).toBeDefined();
      expect(view.createdAt).toBeTruthy();
      expect(view.updatedAt).toBeTruthy();
    });

    it('缺少id时应自动生成', () => {
      const view = sanitizeView({ name: '未命名' }, config);
      expect(view.id).toBeTruthy();
      expect(view.id.startsWith('v_')).toBe(true);
    });

    it('缺少name时应使用默认名称', () => {
      const view = sanitizeView({ id: 'v1' }, config);
      expect(view.name).toBe('未命名视图');
    });

    describe('筛选器清理', () => {
      it('搜索类型筛选器应保留字符串值', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_search: '关键词' },
          },
          config
        );
        expect(view.filters.fl_search).toBe('关键词');
      });

      it('搜索类型筛选器非法值应回退为空字符串', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_search: 123 },
          },
          config
        );
        expect(view.filters.fl_search).toBe('');
      });

      it('状态筛选器合法值应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_status: '待处理' },
          },
          config
        );
        expect(view.filters.fl_status).toBe('待处理');
      });

      it('状态筛选器"全部"应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_status: '全部' },
          },
          config
        );
        expect(view.filters.fl_status).toBe('全部');
      });

      it('状态筛选器非法值应回退到"全部"', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_status: '不存在的状态' },
          },
          config
        );
        expect(view.filters.fl_status).toBe('全部');
      });

      it('select类型筛选器合法值应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_priority: '高' },
          },
          config
        );
        expect(view.filters.fl_priority).toBe('高');
      });

      it('select类型筛选器"全部"应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_priority: '全部' },
          },
          config
        );
        expect(view.filters.fl_priority).toBe('全部');
      });

      it('select类型筛选器非法值应回退到"全部"', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_priority: '不存在的选项' },
          },
          config
        );
        expect(view.filters.fl_priority).toBe('全部');
      });

      it('禁用的筛选器不应出现在结果中', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { fl_disabled: 'some value' },
          },
          config
        );
        expect(view.filters.fl_disabled).toBeUndefined();
      });

      it('未在配置中的筛选器应被忽略', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            filters: { unknown_filter: 'value' },
          },
          config
        );
        expect(view.filters.unknown_filter).toBeUndefined();
      });
    });

    describe('排序配置清理', () => {
      it('合法的排序字段应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            sortConfig: { primaryField: 'priority', secondaryField: 'name', direction: 'desc' },
          },
          config
        );
        expect(view.sortConfig.primaryField).toBe('priority');
        expect(view.sortConfig.secondaryField).toBe('name');
        expect(view.sortConfig.direction).toBe('desc');
      });

      it('排序主字段不存在时应回退到第一个可排序字段', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            sortConfig: { primaryField: 'nonexistent' },
          },
          config
        );
        expect(view.sortConfig.primaryField).toBe('name');
      });

      it('排序字段被删除后应回退', () => {
        const configWithoutSort = createTestConfig({
          fields: [
            { id: 'f1', key: 'name', label: '名称', type: 'input', sortable: false },
            { id: 'f2', key: 'desc', label: '描述', type: 'input', sortable: false },
          ],
          statuses: [{ id: 's1', name: '待处理', primary: true }],
          filters: [],
        });

        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            sortConfig: { primaryField: 'deletedField', secondaryField: 'deletedField2' },
          },
          configWithoutSort
        );
        expect(view.sortConfig.primaryField).toBe('name');
        expect(view.sortConfig.secondaryField).toBe('createdAt');
      });

      it('排序方向非法时应回退到asc', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            sortConfig: { direction: 'invalid' },
          },
          config
        );
        expect(view.sortConfig.direction).toBe('asc');
      });

      it('secondaryField为createdAt应保留', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            sortConfig: { secondaryField: 'createdAt' },
          },
          config
        );
        expect(view.sortConfig.secondaryField).toBe('createdAt');
      });
    });

    describe('其他视图属性', () => {
      it('合法的activeView应保留', () => {
        const view = sanitizeView({ id: 'v1', name: '测试', activeView: 'table' }, config);
        expect(view.activeView).toBe('table');
      });

      it('非法的activeView应回退到workbench', () => {
        const view = sanitizeView({ id: 'v1', name: '测试', activeView: 'invalid' }, config);
        expect(view.activeView).toBe('workbench');
      });

      it('collapsedZones应过滤掉无效状态', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            collapsedZones: ['待处理', '不存在的状态', '已完成'],
          },
          config
        );
        expect(view.collapsedZones).toEqual(['待处理', '已完成']);
      });

      it('collapsedZones非数组应回退到空数组', () => {
        const view = sanitizeView(
          {
            id: 'v1',
            name: '测试',
            collapsedZones: 'not array',
          },
          config
        );
        expect(Array.isArray(view.collapsedZones)).toBe(true);
        expect(view.collapsedZones.length).toBe(0);
      });
    });
  });

  describe('migrateView', () => {
    const oldConfig = createTestConfig({
      version: 1,
      fields: [
        { id: 'f_name', key: 'name', label: '名称', type: 'input', sortable: true },
        { id: 'f_oldkey', key: 'oldPriority', label: '优先级', type: 'select', options: ['高', '中', '低'], sortable: true },
      ],
      statuses: [
        { id: 's_pending', name: '待处理', primary: true },
        { id: 's_progress', name: '进行中' },
        { id: 's_done', name: '已完成' },
      ],
      filters: [
        { id: 'fl_search', type: 'search', label: '搜索', searchFields: ['name'], enabled: true },
        { id: 'fl_status', type: 'status', label: '状态', enabled: true },
        { id: 'fl_priority', type: 'select', label: '优先级', field: 'oldPriority', enabled: true },
      ],
      sortConfig: { primaryField: 'name', secondaryField: 'createdAt', direction: 'asc' },
    });

    const newConfig = createTestConfig({
      version: 2,
      fields: [
        { id: 'f_name', key: 'name', label: '名称', type: 'input', sortable: true },
        { id: 'f_oldkey', key: 'newPriority', label: '优先级', type: 'select', options: ['高', '中', '低'], sortable: true },
        { id: 'f_new', key: 'newField', label: '新字段', type: 'input', sortable: false },
      ],
      statuses: [
        { id: 's_pending', name: '待阅片', primary: true },
        { id: 's_progress', name: '阅片中' },
        { id: 's_done', name: '已完成' },
      ],
      filters: [
        { id: 'fl_search', type: 'search', label: '搜索', searchFields: ['name'], enabled: true },
        { id: 'fl_status', type: 'status', label: '状态', enabled: true },
        { id: 'fl_priority', type: 'select', label: '优先级', field: 'newPriority', enabled: true },
      ],
      sortConfig: { primaryField: 'newPriority', secondaryField: 'createdAt', direction: 'asc' },
    });

    it('字段key改名后select筛选器值应迁移', () => {
      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试视图',
          filters: {
            fl_search: '关键词',
            fl_status: '待处理',
            fl_priority: '高',
          },
          sortConfig: { primaryField: 'name', secondaryField: 'createdAt', direction: 'asc' },
        },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, newConfig);

      expect(migrated.filters.fl_priority).toBe('高');
      expect(migrated.filters.fl_search).toBe('关键词');
    });

    it('字段key改名后筛选值不在新选项中应回退到全部', () => {
      const configWithDiffOptions = createTestConfig({
        version: 2,
        fields: [
          { id: 'f_name', key: 'name', label: '名称', type: 'input', sortable: true },
          { id: 'f_oldkey', key: 'newPriority', label: '优先级', type: 'select', options: ['紧急', '普通'], sortable: true },
        ],
        statuses: [{ id: 's1', name: '待处理', primary: true }],
        filters: [
          { id: 'fl_priority', type: 'select', label: '优先级', field: 'newPriority', enabled: true },
        ],
      });

      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          filters: { fl_priority: '高' },
          sortConfig: { primaryField: 'name', direction: 'asc' },
        },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, configWithDiffOptions);
      expect(migrated.filters.fl_priority).toBe('全部');
    });

    it('状态重命名后状态筛选器值应迁移', () => {
      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          filters: {
            fl_status: '待处理',
            fl_search: '',
            fl_priority: '全部',
          },
          sortConfig: { primaryField: 'name', direction: 'asc' },
        },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, newConfig);
      expect(migrated.filters.fl_status).toBe('待阅片');
    });

    it('状态重命名后collapsedZones应迁移', () => {
      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          collapsedZones: ['待处理', '进行中'],
          sortConfig: { primaryField: 'name', direction: 'asc' },
        },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, newConfig);
      expect(migrated.collapsedZones).toContain('待阅片');
      expect(migrated.collapsedZones).toContain('阅片中');
      expect(migrated.collapsedZones).not.toContain('待处理');
      expect(migrated.collapsedZones).not.toContain('进行中');
    });

    it('排序主字段被删除后应回退', () => {
      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          sortConfig: { primaryField: 'oldPriority', secondaryField: 'createdAt', direction: 'asc' },
        },
        oldConfig
      );

      const configWithoutPriority = createTestConfig({
        version: 2,
        fields: [
          { id: 'f_name', key: 'name', label: '名称', type: 'input', sortable: true },
          { id: 'f_desc', key: 'desc', label: '描述', type: 'input', sortable: true },
        ],
        statuses: [{ id: 's1', name: '待处理', primary: true }],
        filters: [],
      });

      const migrated = migrateView(oldView, oldConfig, configWithoutPriority);
      expect(migrated.sortConfig.primaryField).toBe('name');
    });

    it('排序字段被删除后的回退 - 使用第一个可排序字段', () => {
      const oldConfigWithSort = createTestConfig({
        version: 1,
        fields: [
          { id: 'f1', key: 'fieldA', label: '字段A', type: 'input', sortable: true },
          { id: 'f2', key: 'fieldB', label: '字段B', type: 'input', sortable: true },
        ],
        statuses: [{ id: 's1', name: '状态1', primary: true }],
        filters: [],
      });

      const newConfigWithSort = createTestConfig({
        version: 2,
        fields: [
          { id: 'f3', key: 'fieldC', label: '字段C', type: 'input', sortable: true },
          { id: 'f4', key: 'fieldD', label: '字段D', type: 'input', sortable: true },
        ],
        statuses: [{ id: 's1', name: '状态1', primary: true }],
        filters: [],
      });

      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          sortConfig: { primaryField: 'fieldA', secondaryField: 'fieldB', direction: 'desc' },
        },
        oldConfigWithSort
      );

      const migrated = migrateView(oldView, oldConfigWithSort, newConfigWithSort);
      expect(migrated.sortConfig.primaryField).toBe('fieldC');
      expect(migrated.sortConfig.secondaryField).toBe('createdAt');
    });

    it('configVersion应更新为新配置版本', () => {
      const oldView = sanitizeView(
        { id: 'v1', name: '测试', sortConfig: { primaryField: 'name', direction: 'asc' } },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, newConfig);
      expect(migrated.configVersion).toBe(2);
    });

    it('updatedAt应更新', () => {
      const oldView = sanitizeView(
        { id: 'v1', name: '测试', sortConfig: { primaryField: 'name', direction: 'asc' } },
        oldConfig
      );
      const oldUpdatedAt = oldView.updatedAt;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);
      const migrated = migrateView(oldView, oldConfig, newConfig);
      vi.useRealTimers();

      expect(migrated.updatedAt).not.toBe(oldUpdatedAt);
    });

    it('无效状态的collapsedZones应被过滤', () => {
      const oldView = sanitizeView(
        {
          id: 'v1',
          name: '测试',
          collapsedZones: ['待处理', '已删除状态'],
          sortConfig: { primaryField: 'name', direction: 'asc' },
        },
        oldConfig
      );

      const migrated = migrateView(oldView, oldConfig, newConfig);
      expect(migrated.collapsedZones).not.toContain('已删除状态');
      expect(migrated.collapsedZones).toContain('待阅片');
    });

    it('空视图应直接返回', () => {
      expect(migrateView(null, oldConfig, newConfig)).toBeNull();
      expect(migrateView(undefined, oldConfig, newConfig)).toBeUndefined();
    });
  });
});
