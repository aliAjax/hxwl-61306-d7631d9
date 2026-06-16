export const STORAGE_KEYS = {
  QUEUE: 'hxwl-61306-pathology-slides',
  CONFIG: 'hxwl-61306-queue-config',
  VIEWS: 'hxwl-61306-views',
  ACTIVE_VIEW: 'hxwl-61306-active-view',
  SLIDE_BORROWS: 'hxwl-61306-slide-borrows',
  CRITICAL_NOTIFIES: 'hxwl-61306-critical-notifies',
  PHRASES: 'hxwl-61306-diagnosis-phrases',
};

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createTestRecords() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  return [
    {
      id: generateId('rec'),
      caseNo: 'P2026061301',
      sampleType: '穿刺',
      priority: '加急',
      sentAt: '2026-06-13T08:30',
      doctor: '李医生',
      summary: '需关注切缘情况',
      status: '待阅片',
      createdAt: now,
      timeline: [{ status: '待阅片', at: today, by: '系统', changedAt: now }],
    },
    {
      id: generateId('rec'),
      caseNo: 'P2026061208',
      sampleType: '胃镜',
      priority: '常规',
      sentAt: '2026-06-12T15:10',
      doctor: '王医生',
      summary: '慢性炎症复核',
      status: '阅片中',
      createdAt: now,
      timeline: [
        { status: '待阅片', at: today, by: '系统', changedAt: now },
        { status: '阅片中', at: today, by: '王医生', changedAt: now },
      ],
    },
    {
      id: generateId('rec'),
      caseNo: 'P2026061117',
      sampleType: '手术切除',
      priority: '危急',
      sentAt: '2026-06-11T10:20',
      doctor: '周医生',
      summary: '疑似恶性，等待复核',
      status: '待复核',
      createdAt: now,
      timeline: [
        { status: '待阅片', at: today, by: '系统', changedAt: now },
        { status: '阅片中', at: today, by: '周医生', changedAt: now },
        { status: '待复核', at: today, by: '周医生', changedAt: now },
      ],
    },
    {
      id: generateId('rec'),
      caseNo: 'P2026061005',
      sampleType: '肠镜',
      priority: '常规',
      sentAt: '2026-06-10T09:00',
      doctor: '李医生',
      summary: '息肉切除术后复查',
      status: '已完成',
      createdAt: now,
      timeline: [
        { status: '待阅片', at: today, by: '系统', changedAt: now },
        { status: '阅片中', at: today, by: '李医生', changedAt: now },
        { status: '待复核', at: today, by: '李医生', changedAt: now },
        { status: '已完成', at: today, by: '主任', changedAt: now },
      ],
    },
  ];
}

export function createTestSlideBorrows() {
  return [
    {
      id: generateId('borrow'),
      caseNo: 'P2026061301',
      borrower: '张医生',
      department: '外科',
      borrowDate: new Date().toISOString().slice(0, 10),
      expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'borrowed',
      remark: '术前讨论用',
      createdAt: new Date().toISOString(),
      timeline: [
        { type: 'borrow', status: '已借出', at: new Date().toISOString(), by: '张医生' },
      ],
    },
  ];
}

export function createTestCriticalNotifies() {
  return [
    {
      id: generateId('notify'),
      caseNo: 'P2026061117',
      notifyTarget: '临床张主任',
      notifyMethod: '电话',
      sentAt: new Date().toISOString(),
      confirmedAt: '',
      confirmedBy: '',
      priority: '危急',
      triggerReason: '疑似恶性肿瘤',
      remark: '需尽快安排手术',
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function setupTestData(page) {
  await page.evaluate((keys) => {
    const records = [
      {
        id: 'rec_test_001',
        caseNo: 'P2026061301',
        sampleType: '穿刺',
        priority: '加急',
        sentAt: '2026-06-13T08:30',
        doctor: '李医生',
        summary: '需关注切缘情况',
        status: '待阅片',
        createdAt: new Date().toISOString(),
        timeline: [{ status: '待阅片', at: new Date().toISOString().slice(0, 10), by: '系统', changedAt: new Date().toISOString() }],
      },
      {
        id: 'rec_test_002',
        caseNo: 'P2026061208',
        sampleType: '胃镜',
        priority: '常规',
        sentAt: '2026-06-12T15:10',
        doctor: '王医生',
        summary: '慢性炎症复核',
        status: '阅片中',
        createdAt: new Date().toISOString(),
        timeline: [
          { status: '待阅片', at: new Date().toISOString().slice(0, 10), by: '系统', changedAt: new Date().toISOString() },
        ],
      },
      {
        id: 'rec_test_003',
        caseNo: 'P2026061117',
        sampleType: '手术切除',
        priority: '危急',
        sentAt: '2026-06-11T10:20',
        doctor: '周医生',
        summary: '疑似恶性，等待复核',
        status: '待复核',
        createdAt: new Date().toISOString(),
        timeline: [
          { status: '待阅片', at: new Date().toISOString().slice(0, 10), by: '系统', changedAt: new Date().toISOString() },
        ],
      },
      {
        id: 'rec_test_004',
        caseNo: 'P2026061005',
        sampleType: '肠镜',
        priority: '常规',
        sentAt: '2026-06-10T09:00',
        doctor: '李医生',
        summary: '息肉切除术后复查',
        status: '已完成',
        createdAt: new Date().toISOString(),
        timeline: [
          { status: '待阅片', at: new Date().toISOString().slice(0, 10), by: '系统', changedAt: new Date().toISOString() },
        ],
      },
    ];

    localStorage.setItem(keys.QUEUE, JSON.stringify(records));
    localStorage.setItem(keys.VIEWS, JSON.stringify([
      {
        id: 'v_default_all',
        name: '全部病例',
        icon: 'Layers',
        filters: { fl_query: '', fl_status: '全部' },
        sortConfig: { primaryField: 'priority', secondaryField: 'sentAt', direction: 'asc' },
        activeView: 'workbench',
        collapsedZones: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]));
    localStorage.setItem(keys.ACTIVE_VIEW, 'v_default_all');
  }, STORAGE_KEYS);
}
