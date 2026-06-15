import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeConfig,
  migrateLegacyRecords,
  evaluateMetric,
  getFieldKeyRenames,
  validateConfig,
} from '../config/configManager';
import { DEFAULT_QUEUE_CONFIG } from '../config/defaultConfig';

describe('configManager', () => {
  describe('sanitizeConfig', () => {
    it('空或无效配置应回退到默认配置', () => {
      expect(sanitizeConfig(null)).toEqual(DEFAULT_QUEUE_CONFIG);
      expect(sanitizeConfig(undefined)).toEqual(DEFAULT_QUEUE_CONFIG);
      expect(sanitizeConfig('not an object')).toEqual(DEFAULT_QUEUE_CONFIG);
      expect(sanitizeConfig(123)).toEqual(DEFAULT_QUEUE_CONFIG);
    });

    it('应保留有效配置字段', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        title: '自定义标题',
        subtitle: '自定义副标题',
        accent: '#ff0000',
      };
      const result = sanitizeConfig(config);
      expect(result.title).toBe('自定义标题');
      expect(result.subtitle).toBe('自定义副标题');
      expect(result.accent).toBe('#ff0000');
    });

    it('字段列表为空时应使用默认字段', () => {
      const config = { ...DEFAULT_QUEUE_CONFIG, fields: [] };
      const result = sanitizeConfig(config);
      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.fields[0].key).toBe(DEFAULT_QUEUE_CONFIG.fields[0].key);
    });

    it('无效字段应被过滤掉', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: '', label: '空key' },
          null,
          undefined,
          'not an object',
          { key: 'valid', label: '有效字段', type: 'input' },
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.fields.length).toBe(1);
      expect(result.fields[0].key).toBe('valid');
    });

    it('重复的字段key应去重', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'name', label: '名称1', type: 'input' },
          { key: 'name', label: '名称2', type: 'input' },
          { key: 'age', label: '年龄', type: 'number' },
        ],
      };
      const result = sanitizeConfig(config);
      const keys = result.fields.map((f) => f.key);
      expect(keys.filter((k) => k === 'name').length).toBe(1);
      expect(keys.includes('age')).toBe(true);
    });

    it('无效的字段类型应回退到默认类型', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'test', label: '测试', type: 'invalid_type' },
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.fields[0].type).toBe('input');
    });

    it('状态列表为空时应使用默认状态', () => {
      const config = { ...DEFAULT_QUEUE_CONFIG, statuses: [] };
      const result = sanitizeConfig(config);
      expect(result.statuses.length).toBeGreaterThan(0);
    });

    it('无效状态应被过滤', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        statuses: [
          '',
          null,
          { name: '' },
          '有效状态',
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.statuses.length).toBe(1);
      expect(result.statuses[0].name).toBe('有效状态');
    });

    it('没有主状态时第一个状态应设为主状态', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        statuses: [
          { name: '状态A', primary: false },
          { name: '状态B', primary: false },
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.statuses[0].primary).toBe(true);
      expect(result.statuses[1].primary).toBe(false);
    });

    it('重复状态名称应去重', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        statuses: ['待处理', '待处理', '已完成'],
      };
      const result = sanitizeConfig(config);
      const names = result.statuses.map((s) => s.name);
      expect(names.filter((n) => n === '待处理').length).toBe(1);
    });

    it('排序字段不存在时应回退', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'name', label: '名称', type: 'input', sortable: true },
          { key: 'sentAt', label: '时间', type: 'datetime-local', sortable: false },
        ],
        sortConfig: {
          primaryField: 'nonexistent',
          secondaryField: 'nonexistent2',
          direction: 'invalid',
        },
      };
      const result = sanitizeConfig(config);
      expect(result.sortConfig.primaryField).toBe('name');
      expect(result.sortConfig.secondaryField).toBe('sentAt');
      expect(result.sortConfig.direction).toBe('asc');
    });

    it('卡片显示字段不存在时应回退', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'name', label: '名称', type: 'input' },
          { key: 'desc', label: '描述', type: 'input' },
        ],
        cardDisplay: {
          titleField: 'nonexistent',
          metaFields: ['nonexistent', 'name'],
          detailField: 'nonexistent',
        },
      };
      const result = sanitizeConfig(config);
      expect(result.cardDisplay.titleField).toBe('name');
      expect(result.cardDisplay.metaFields).toEqual(['name']);
    });

    it('统计卡片应正确清理', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        metrics: [
          { label: '总数', type: 'count' },
          { label: '', type: 'count' },
          { label: '无效类型', type: 'invalid' },
          null,
          { label: '筛选计数', type: 'filter', filter: { field: 'status', operator: 'eq', value: '待处理' } },
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.metrics.length).toBe(2);
      expect(result.metrics[0].type).toBe('count');
      expect(result.metrics[1].type).toBe('filter');
    });

    it('筛选器应正确清理', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'name', label: '名称', type: 'input' },
          { key: 'status', label: '状态', type: 'select', options: ['a', 'b'] },
        ],
        filters: [
          { type: 'search', label: '搜索', searchFields: ['name', 'nonexistent'] },
          { type: 'invalid', label: '无效' },
          null,
          { type: 'status', label: '状态' },
        ],
      };
      const result = sanitizeConfig(config);
      expect(result.filters.length).toBe(2);
      expect(result.filters[0].type).toBe('search');
      expect(result.filters[0].searchFields).toEqual(['name']);
      expect(result.filters[1].type).toBe('status');
    });
  });

  describe('getFieldKeyRenames', () => {
    it('应检测字段key重命名', () => {
      const oldConfig = {
        fields: [
          { id: 'f1', key: 'oldKey', label: '字段1' },
          { id: 'f2', key: 'sameKey', label: '字段2' },
        ],
      };
      const newConfig = {
        fields: [
          { id: 'f1', key: 'newKey', label: '字段1' },
          { id: 'f2', key: 'sameKey', label: '字段2' },
          { id: 'f3', key: 'newField', label: '新字段' },
        ],
      };
      const renames = getFieldKeyRenames(oldConfig, newConfig);
      expect(renames.length).toBe(1);
      expect(renames[0].oldKey).toBe('oldKey');
      expect(renames[0].newKey).toBe('newKey');
    });

    it('没有重命名时返回空数组', () => {
      const config = {
        fields: [
          { id: 'f1', key: 'key1', label: '字段1' },
        ],
      };
      const renames = getFieldKeyRenames(config, config);
      expect(renames.length).toBe(0);
    });
  });

  describe('migrateLegacyRecords', () => {
    it('字段key改名后数据应迁移到新key', () => {
      const config = {
        fields: [
          { key: 'caseNo', label: '病例号', type: 'input' },
          { key: 'newPriority', label: '优先级', type: 'select' },
        ],
        statuses: [
          { name: '待阅片', primary: true },
          { name: '已完成' },
        ],
        defaultValues: {},
      };
      const records = [
        { id: '1', caseNo: 'P001', oldPriority: '加急', status: '待阅片' },
        { id: '2', caseNo: 'P002', oldPriority: '常规', status: '待阅片' },
      ];
      const options = {
        fieldKeyRenames: [{ oldKey: 'oldPriority', newKey: 'newPriority' }],
      };

      const result = migrateLegacyRecords(records, config, options);

      expect(result[0].newPriority).toBe('加急');
      expect(result[1].newPriority).toBe('常规');
    });

    it('新key已有值时不应覆盖', () => {
      const config = {
        fields: [
          { key: 'caseNo', label: '病例号', type: 'input' },
          { key: 'newPriority', label: '优先级', type: 'select' },
        ],
        statuses: [
          { name: '待阅片', primary: true },
        ],
        defaultValues: {},
      };
      const records = [
        { id: '1', caseNo: 'P001', oldPriority: '加急', newPriority: '常规', status: '待阅片' },
      ];
      const options = {
        fieldKeyRenames: [{ oldKey: 'oldPriority', newKey: 'newPriority' }],
      };

      const result = migrateLegacyRecords(records, config, options);

      expect(result[0].newPriority).toBe('常规');
    });

    it('状态不存在时应回退到初始状态', () => {
      const config = {
        fields: [
          { key: 'caseNo', label: '病例号', type: 'input' },
        ],
        statuses: [
          { name: '待阅片', primary: true },
          { name: '已完成' },
        ],
        defaultValues: {},
      };
      const records = [
        { id: '1', caseNo: 'P001', status: '已删除状态' },
        { id: '2', caseNo: 'P002', status: null },
        { id: '3', caseNo: 'P003', status: undefined },
      ];

      const result = migrateLegacyRecords(records, config);

      expect(result[0].status).toBe('待阅片');
      expect(result[1].status).toBe('待阅片');
      expect(result[2].status).toBe('待阅片');
    });

    it('缺失字段应填充默认值或空字符串', () => {
      const config = {
        fields: [
          { key: 'caseNo', label: '病例号', type: 'input' },
          { key: 'priority', label: '优先级', type: 'select' },
          { key: 'doctor', label: '医生', type: 'input' },
        ],
        statuses: [
          { name: '待阅片', primary: true },
        ],
        defaultValues: {
          priority: '常规',
          doctor: '李医生',
        },
      };
      const records = [
        { id: '1', caseNo: 'P001', status: '待阅片' },
      ];

      const result = migrateLegacyRecords(records, config);

      expect(result[0].priority).toBe('常规');
      expect(result[0].doctor).toBe('李医生');
      expect(result[0].caseNo).toBe('P001');
    });

    it('没有id的记录应自动生成id', () => {
      const config = {
        fields: [{ key: 'caseNo', label: '病例号', type: 'input' }],
        statuses: [{ name: '待阅片', primary: true }],
        defaultValues: {},
      };
      const records = [
        { caseNo: 'P001', status: '待阅片' },
      ];

      const result = migrateLegacyRecords(records, config);

      expect(result[0].id).toBeTruthy();
      expect(typeof result[0].id).toBe('string');
    });

    it('无效记录应被过滤', () => {
      const config = {
        fields: [{ key: 'caseNo', label: '病例号', type: 'input' }],
        statuses: [{ name: '待阅片', primary: true }],
        defaultValues: {},
      };
      const records = [
        null,
        undefined,
        'not an object',
        { id: '1', caseNo: 'P001', status: '待阅片' },
      ];

      const result = migrateLegacyRecords(records, config);

      expect(result.length).toBe(1);
      expect(result[0].caseNo).toBe('P001');
    });

    it('非数组输入应返回空数组', () => {
      const config = {
        fields: [],
        statuses: [],
        defaultValues: {},
      };
      expect(migrateLegacyRecords(null, config)).toEqual([]);
      expect(migrateLegacyRecords('not array', config)).toEqual([]);
      expect(migrateLegacyRecords(123, config)).toEqual([]);
    });

    it('没有timeline的记录应自动创建timeline', () => {
      const config = {
        fields: [{ key: 'caseNo', label: '病例号', type: 'input' }],
        statuses: [{ name: '待阅片', primary: true }],
        defaultValues: {},
      };
      const records = [
        { id: '1', caseNo: 'P001', status: '待阅片', createdAt: '2024-01-01T00:00:00Z' },
      ];

      const result = migrateLegacyRecords(records, config);

      expect(Array.isArray(result[0].timeline)).toBe(true);
      expect(result[0].timeline.length).toBeGreaterThan(0);
      expect(result[0].timeline[0].status).toBe('待阅片');
    });
  });

  describe('evaluateMetric', () => {
    const records = [
      { id: '1', name: '病例A', status: '待处理', priority: '加急', amount: 100 },
      { id: '2', name: '病例B', status: '处理中', priority: '常规', amount: 200 },
      { id: '3', name: '病例C', status: '待处理', priority: '加急', amount: 300 },
      { id: '4', name: '病例D', status: '已完成', priority: '常规', amount: 400 },
      { id: '5', name: '病例E', status: '待处理', priority: '危急', amount: null },
    ];

    it('count类型应返回记录总数', () => {
      const metric = { type: 'count', label: '总数' };
      expect(evaluateMetric(metric, records)).toBe(5);
    });

    it('count类型空记录应返回0', () => {
      const metric = { type: 'count', label: '总数' };
      expect(evaluateMetric(metric, [])).toBe(0);
      expect(evaluateMetric(metric, null)).toBe(0);
      expect(evaluateMetric(metric, undefined)).toBe(0);
    });

    it('filter类型eq操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '待处理',
        filter: { field: 'status', operator: 'eq', value: '待处理' },
      };
      expect(evaluateMetric(metric, records)).toBe(3);
    });

    it('filter类型neq操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '非常规',
        filter: { field: 'priority', operator: 'neq', value: '常规' },
      };
      expect(evaluateMetric(metric, records)).toBe(3);
    });

    it('filter类型contains操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '包含A',
        filter: { field: 'name', operator: 'contains', value: '病例' },
      };
      expect(evaluateMetric(metric, records)).toBe(5);
    });

    it('filter类型gt操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '大于200',
        filter: { field: 'amount', operator: 'gt', value: 200 },
      };
      expect(evaluateMetric(metric, records)).toBe(2);
    });

    it('filter类型lt操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '小于200',
        filter: { field: 'amount', operator: 'lt', value: 200 },
      };
      expect(evaluateMetric(metric, records)).toBe(2);
    });

    it('filter类型gte操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '大于等于200',
        filter: { field: 'amount', operator: 'gte', value: 200 },
      };
      expect(evaluateMetric(metric, records)).toBe(3);
    });

    it('filter类型lte操作符应正确筛选', () => {
      const metric = {
        type: 'filter',
        label: '小于等于200',
        filter: { field: 'amount', operator: 'lte', value: 200 },
      };
      expect(evaluateMetric(metric, records)).toBe(3);
    });

    it('filter类型无字段时应返回总数', () => {
      const metric = {
        type: 'filter',
        label: '无效筛选',
        filter: {},
      };
      expect(evaluateMetric(metric, records)).toBe(5);
    });

    it('sum类型应正确求和', () => {
      const metric = { type: 'sum', label: '金额总和', field: 'amount' };
      expect(evaluateMetric(metric, records)).toBe(1000);
    });

    it('sum类型空字段应返回0', () => {
      const metric = { type: 'sum', label: '总和', field: '' };
      expect(evaluateMetric(metric, records)).toBe(0);
    });

    it('sum类型无效值应忽略', () => {
      const metric = { type: 'sum', label: '总和', field: 'nonexistent' };
      expect(evaluateMetric(metric, records)).toBe(0);
    });

    it('avg类型应正确计算平均值', () => {
      const metric = { type: 'avg', label: '平均金额', field: 'amount' };
      expect(evaluateMetric(metric, records)).toBe(200);
    });

    it('avg类型空字段应返回0', () => {
      const metric = { type: 'avg', label: '平均', field: '' };
      expect(evaluateMetric(metric, records)).toBe(0);
    });

    it('avg类型无有效值应返回0', () => {
      const metric = { type: 'avg', label: '平均', field: 'nonexistent' };
      expect(evaluateMetric(metric, records)).toBe(0);
    });

    it('未知类型应回退到count', () => {
      const metric = { type: 'unknown', label: '未知' };
      expect(evaluateMetric(metric, records)).toBe(5);
    });
  });

  describe('validateConfig', () => {
    it('空配置应返回无效', () => {
      const result = validateConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('有效配置应返回有效', () => {
      const result = validateConfig(DEFAULT_QUEUE_CONFIG);
      expect(result.valid).toBe(true);
    });

    it('重复状态名称应有警告', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        statuses: [
          { name: '状态A' },
          { name: '状态A' },
        ],
      };
      const result = validateConfig(config);
      expect(result.warnings.some((w) => w.includes('重复的状态名称'))).toBe(true);
    });

    it('重复字段key应有警告', () => {
      const config = {
        ...DEFAULT_QUEUE_CONFIG,
        fields: [
          { key: 'name', label: '名称', type: 'input' },
          { key: 'name', label: '名称2', type: 'input' },
        ],
      };
      const result = validateConfig(config);
      expect(result.warnings.some((w) => w.includes('重复的字段key'))).toBe(true);
    });
  });
});
