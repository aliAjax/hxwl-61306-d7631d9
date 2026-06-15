export const DEFAULT_QUEUE_CONFIG = {
  version: 2,
  id: 'hxwl-61306',
  title: '病理科玻片阅片队列',
  subtitle: '优先级、等待时间、阅片状态与详情抽屉',
  domain: '病理科',
  storage: 'hxwl-61306-pathology-slides',
  accent: '#7c3aed',

  fields: [
    {
      id: 'f_caseNo',
      key: 'caseNo',
      label: '病例号',
      type: 'input',
      placeholder: 'P2026061301',
      options: [],
      required: true,
      searchable: true,
      showInCard: true,
      cardPosition: 'title',
      order: 0
    },
    {
      id: 'f_sampleType',
      key: 'sampleType',
      label: '标本类型',
      type: 'select',
      placeholder: '穿刺',
      options: ['穿刺', '胃镜', '肠镜', '手术切除', '细胞学'],
      required: false,
      searchable: false,
      showInCard: true,
      cardPosition: 'meta',
      order: 1
    },
    {
      id: 'f_priority',
      key: 'priority',
      label: '优先级',
      type: 'select',
      placeholder: '加急',
      options: ['常规', '加急', '危急'],
      required: false,
      searchable: false,
      showInCard: true,
      cardPosition: 'meta',
      order: 2,
      sortable: true,
      sortWeights: { '危急': 0, '加急': 1, '常规': 2 }
    },
    {
      id: 'f_sentAt',
      key: 'sentAt',
      label: '送检时间',
      type: 'datetime-local',
      placeholder: '',
      options: [],
      required: false,
      searchable: false,
      showInCard: false,
      cardPosition: '',
      order: 3,
      dateKey: true
    },
    {
      id: 'f_doctor',
      key: 'doctor',
      label: '负责医生',
      type: 'input',
      placeholder: '李医生',
      options: [],
      required: false,
      searchable: true,
      showInCard: true,
      cardPosition: 'meta',
      order: 4
    },
    {
      id: 'f_summary',
      key: 'summary',
      label: '备注',
      type: 'textarea',
      placeholder: '需关注切缘情况',
      options: [],
      required: false,
      searchable: false,
      showInCard: true,
      cardPosition: 'detail',
      order: 5
    }
  ],

  statuses: [
    {
      id: 's_pending',
      name: '待阅片',
      color: '#ef4444',
      icon: 'Zap',
      order: 0,
      primary: true
    },
    {
      id: 's_reading',
      name: '阅片中',
      color: '#7c3aed',
      icon: 'Eye',
      order: 1
    },
    {
      id: 's_review',
      name: '待复核',
      color: '#f59e0b',
      icon: 'ShieldCheck',
      order: 2,
      tatTrigger: true
    },
    {
      id: 's_done',
      name: '已完成',
      color: '#10b981',
      icon: 'CircleCheckBig',
      order: 3,
      terminal: true
    }
  ],

  sortConfig: {
    primaryField: 'priority',
    secondaryField: 'sentAt',
    direction: 'asc'
  },

  priorityConfig: {
    fieldKey: 'priority',
    order: ['危急', '加急', '常规'],
    tatThresholds: {
      '危急': { timeout: 120, warning: 60 },
      '加急': { timeout: 1440, warning: 720 },
      '常规': { timeout: 4320, warning: 2880 }
    }
  },

  metrics: [
    {
      id: 'm_total',
      label: '队列病例',
      type: 'count',
      enabled: true,
      order: 0
    },
    {
      id: 'm_urgent',
      label: '危急/加急',
      type: 'filter',
      filter: { field: 'priority', operator: 'neq', value: '常规' },
      enabled: true,
      order: 1
    },
    {
      id: 'm_review',
      label: '待复核',
      type: 'filter',
      filter: { field: 'status', operator: 'eq', value: '待复核' },
      enabled: true,
      order: 2
    }
  ],

  filters: [
    {
      id: 'fl_query',
      label: '病例/医生',
      type: 'search',
      searchFields: ['caseNo', 'doctor'],
      enabled: true,
      order: 0
    },
    {
      id: 'fl_status',
      label: '阅片状态',
      type: 'status',
      enabled: true,
      order: 1
    }
  ],

  cardDisplay: {
    titleField: 'caseNo',
    metaFields: ['sampleType', 'priority', 'doctor'],
    detailField: 'summary'
  },

  batchImport: {
    enabled: true,
    fields: [
      { key: 'caseNo', label: '病例号', required: true },
      { key: 'sampleType', label: '标本类型', required: false },
      { key: 'priority', label: '优先级', required: false },
      { key: 'sentAt', label: '送检时间', required: false },
      { key: 'doctor', label: '负责医生', required: false },
      { key: 'summary', label: '备注', required: false }
    ],
    headerKeywords: ['病例号', '标本类型', '优先级', '送检时间', '负责医生', '备注', 'caseno', 'sampletype', 'priority', 'sentat', 'doctor', 'summary']
  },

  defaultValues: {
    caseNo: 'P2026061301',
    sampleType: '穿刺',
    priority: '加急',
    sentAt: '',
    doctor: '李医生',
    summary: '需关注切缘情况'
  },

  seedData: [
    {
      caseNo: 'P2026061301',
      sampleType: '穿刺',
      priority: '加急',
      sentAt: '2026-06-13T08:30',
      doctor: '李医生',
      summary: '需关注切缘情况',
      status: '待阅片'
    },
    {
      caseNo: 'P2026061208',
      sampleType: '胃镜',
      priority: '常规',
      sentAt: '2026-06-12T15:10',
      doctor: '王医生',
      summary: '慢性炎症复核',
      status: '阅片中'
    },
    {
      caseNo: 'P2026061117',
      sampleType: '手术切除',
      priority: '危急',
      sentAt: '2026-06-11T10:20',
      doctor: '周医生',
      summary: '疑似恶性，等待复核',
      status: '待复核'
    }
  ],

  businessRules: {
    criticalNotify: {
      enabled: true,
      priorityField: 'priority',
      criticalValues: ['危急'],
      tatTriggerStatuses: ['待复核']
    }
  },

  note: '首页按优先级和等待时间排序，并提供详情抽屉。'
};

export const QUEUE_CONFIG_STORAGE = 'hxwl-61306-queue-config';
export const VIEW_STORAGE_KEY = 'hxwl-61306-views';
export const ACTIVE_VIEW_STORAGE_KEY = 'hxwl-61306-active-view';

export const FIELD_TYPES = ['input', 'select', 'textarea', 'datetime-local', 'number', 'date'];

export const METRIC_TYPES = [
  { value: 'count', label: '总数计数' },
  { value: 'filter', label: '条件筛选计数' },
  { value: 'sum', label: '数值求和' },
  { value: 'avg', label: '数值平均' }
];

export const FILTER_OPERATORS = [
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' }
];
