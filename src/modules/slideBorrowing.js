import { uid as uidFn } from '../config/configManager';

export const SLIDE_BORROW_STORAGE = 'hxwl-61306-slide-borrow';

export const SLIDE_BORROW_STATUS = {
  BORROWED: '已借出',
  RECEIVED: '已接收',
  RETURNED: '已归还',
  SOON_OVERDUE: '即将逾期',
  OVERDUE: '已逾期'
};

export const SLIDE_BORROW_STATUS_LIST = ['全部', '已借出', '已接收', '即将逾期', '已逾期', '已归还'];

export const SLIDE_BORROW_SEED = [
  {
    caseNo: 'P2026061301',
    borrower: '张医生',
    department: '外科',
    borrowTime: '2026-06-12T09:00',
    receiveTime: '2026-06-12T10:30',
    expectedReturnTime: '2026-06-14T17:00',
    actualReturnTime: '',
    status: '已借出',
    remark: '会诊用玻片，需仔细观察切缘'
  },
  {
    caseNo: 'P2026061405',
    borrower: '陈医生',
    department: '肿瘤科',
    borrowTime: '2026-06-13T10:00',
    receiveTime: '2026-06-13T11:15',
    expectedReturnTime: '2026-06-15T10:00',
    actualReturnTime: '',
    status: '已借出',
    remark: '多学科会诊用，预计明日上午归还'
  },
  {
    caseNo: 'P2026061208',
    borrower: '王医生',
    department: '内科',
    borrowTime: '2026-06-10T14:00',
    receiveTime: '2026-06-10T15:20',
    expectedReturnTime: '2026-06-12T17:00',
    actualReturnTime: '',
    status: '已逾期',
    remark: '教学查房用'
  },
  {
    caseNo: 'P2026061117',
    borrower: '刘医生',
    department: '病理科',
    borrowTime: '2026-06-11T08:30',
    receiveTime: '2026-06-11T09:00',
    expectedReturnTime: '2026-06-13T17:00',
    actualReturnTime: '2026-06-13T16:30',
    status: '已归还',
    remark: '复核完成'
  }
];

export const DEFAULT_DEPARTMENTS = ['病理科', '外科', '内科', '肿瘤科', '妇产科', '儿科', '骨科', '皮肤科', '眼科', '耳鼻喉科'];

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function uid() {
  return uidFn();
}

export function withBorrowIds(items) {
  return items.map((item) => ({
    id: uid(),
    timeline: item.timeline || buildBorrowTimeline(item),
    ...item
  }));
}

export function loadSlideBorrows() {
  const raw = localStorage.getItem(SLIDE_BORROW_STORAGE);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return data.map((item) => ({ ...item, id: item.id || uid() }));
    } catch {
      return withBorrowIds(SLIDE_BORROW_SEED);
    }
  }
  return withBorrowIds(SLIDE_BORROW_SEED);
}

export function buildBorrowTimeline(item) {
  if (!item) return [];
  const timeline = [];
  if (item.borrowTime) {
    timeline.push({
      type: 'slide-borrow',
      event: '玻片借出',
      at: formatDateShort(item.borrowTime),
      by: item.borrower || '系统',
      changedAt: item.borrowTime,
      department: item.department
    });
  }
  if (item.receiveTime) {
    timeline.push({
      type: 'slide-receive',
      event: '玻片接收',
      at: formatDateShort(item.receiveTime),
      by: item.borrower || '借阅人',
      changedAt: item.receiveTime
    });
  }
  if (item.actualReturnTime) {
    timeline.push({
      type: 'slide-return',
      event: '玻片归还',
      at: formatDateShort(item.actualReturnTime),
      by: '病理科',
      changedAt: item.actualReturnTime
    });
  }
  return timeline;
}

export function calcBorrowStatus(item) {
  if (item.status === SLIDE_BORROW_STATUS.RETURNED) {
    return SLIDE_BORROW_STATUS.RETURNED;
  }
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  if (!item.actualReturnTime && now > expected) {
    return SLIDE_BORROW_STATUS.OVERDUE;
  }
  if (!item.actualReturnTime && isSoonOverdue(item)) {
    return SLIDE_BORROW_STATUS.SOON_OVERDUE;
  }
  if (item.receiveTime) {
    return SLIDE_BORROW_STATUS.RECEIVED;
  }
  return SLIDE_BORROW_STATUS.BORROWED;
}

export function isOverdue(item) {
  if (item.status === SLIDE_BORROW_STATUS.RETURNED) return false;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return now > expected;
}

export function isSoonOverdue(item) {
  if (item.status === SLIDE_BORROW_STATUS.RETURNED) return false;
  if (isOverdue(item)) return false;
  if (item.actualReturnTime) return false;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  const diffHours = (expected - now) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 24;
}

export function overdueDays(item) {
  if (!isOverdue(item)) return 0;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return Math.ceil((now - expected) / (1000 * 60 * 60 * 24));
}

export function soonOverdueHours(item) {
  if (!isSoonOverdue(item)) return 0;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return Math.ceil((expected - now) / (1000 * 60 * 60));
}

export function borrowStatusClass(status) {
  switch (status) {
    case SLIDE_BORROW_STATUS.BORROWED:
      return 'borrow-status-borrowed';
    case SLIDE_BORROW_STATUS.RECEIVED:
      return 'borrow-status-received';
    case SLIDE_BORROW_STATUS.RETURNED:
      return 'borrow-status-returned';
    case SLIDE_BORROW_STATUS.SOON_OVERDUE:
      return 'borrow-status-soon-overdue';
    case SLIDE_BORROW_STATUS.OVERDUE:
      return 'borrow-status-overdue';
    default:
      return 'borrow-status-borrowed';
  }
}

export function getFullBorrowTimeline(item) {
  if (!item) return [];
  const baseTimeline = [...(item.timeline || buildBorrowTimeline(item))];
  if (isSoonOverdue(item)) {
    const sdHours = soonOverdueHours(item);
    const soonOverdueTime = new Date(new Date(item.expectedReturnTime).getTime() - 24 * 60 * 60 * 1000);
    const soonOverdueEvent = {
      type: 'slide-soon-overdue',
      event: `即将逾期（剩${sdHours}小时）`,
      at: formatDateShort(soonOverdueTime.toISOString()),
      by: '系统提醒',
      changedAt: soonOverdueTime.toISOString(),
      soonOverdueHours: sdHours
    };
    const soonOverdueTimeMs = soonOverdueTime.getTime();
    let insertIndex = baseTimeline.length;
    for (let i = 0; i < baseTimeline.length; i++) {
      const t = new Date(baseTimeline[i].changedAt || baseTimeline[i].at).getTime();
      if (t > soonOverdueTimeMs) {
        insertIndex = i;
        break;
      }
    }
    baseTimeline.splice(insertIndex, 0, soonOverdueEvent);
  }
  if (isOverdue(item)) {
    const odDays = overdueDays(item);
    const overdueEvent = {
      type: 'slide-overdue',
      event: `玻片逾期（超${odDays}天）`,
      at: formatDateShort(item.expectedReturnTime),
      by: '系统提醒',
      changedAt: item.expectedReturnTime,
      overdueDays: odDays
    };
    const expectedTime = new Date(item.expectedReturnTime).getTime();
    let insertIndex = baseTimeline.length;
    for (let i = 0; i < baseTimeline.length; i++) {
      const t = new Date(baseTimeline[i].changedAt || baseTimeline[i].at).getTime();
      if (t > expectedTime) {
        insertIndex = i;
        break;
      }
    }
    baseTimeline.splice(insertIndex, 0, overdueEvent);
  }
  return baseTimeline;
}

export function filterSlideBorrows(borrows, filters) {
  return borrows
    .filter((item) => {
      const realStatus = calcBorrowStatus(item);
      if (filters.status !== '全部' && realStatus !== filters.status) {
        return false;
      }
      if (filters.department !== '全部' && item.department !== filters.department) {
        return false;
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        return (
          item.caseNo.toLowerCase().includes(q) ||
          item.borrower.toLowerCase().includes(q) ||
          (item.remark || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const statusOrder = { '已逾期': 0, '即将逾期': 1, '已借出': 2, '已接收': 3, '已归还': 4 };
      const statusA = statusOrder[calcBorrowStatus(a)] ?? 9;
      const statusB = statusOrder[calcBorrowStatus(b)] ?? 9;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.borrowTime).getTime() - new Date(a.borrowTime).getTime();
    });
}

export function calcBorrowStats(borrows) {
  let total = borrows.length;
  let borrowed = 0;
  let received = 0;
  let returned = 0;
  let soonOverdue = 0;
  let overdue = 0;

  borrows.forEach((item) => {
    const status = calcBorrowStatus(item);
    if (status === SLIDE_BORROW_STATUS.BORROWED) borrowed++;
    if (status === SLIDE_BORROW_STATUS.RECEIVED) received++;
    if (status === SLIDE_BORROW_STATUS.RETURNED) returned++;
    if (status === SLIDE_BORROW_STATUS.SOON_OVERDUE) soonOverdue++;
    if (status === SLIDE_BORROW_STATUS.OVERDUE) overdue++;
  });

  return { total, borrowed, received, returned, soonOverdue, overdue, unreturned: borrowed + received + soonOverdue + overdue };
}

export function calcDepartmentList(borrows) {
  const depts = new Set(DEFAULT_DEPARTMENTS);
  borrows.forEach((item) => {
    if (item.department) depts.add(item.department);
  });
  return Array.from(depts).sort();
}

export function submitBorrow(form, borrows, editingBorrow) {
  if (!form.caseNo.trim() || !form.borrower.trim() || !form.borrowTime || !form.expectedReturnTime) {
    return null;
  }

  const now = new Date().toISOString();
  let newStatus = SLIDE_BORROW_STATUS.BORROWED;
  if (form.actualReturnTime) {
    newStatus = SLIDE_BORROW_STATUS.RETURNED;
  } else if (form.receiveTime) {
    newStatus = SLIDE_BORROW_STATUS.RECEIVED;
  }

  const timeline = buildBorrowTimeline(form);

  if (editingBorrow) {
    return borrows.map((item) =>
      item.id === editingBorrow.id
        ? {
            ...item,
            ...form,
            status: newStatus,
            timeline,
            updatedAt: now
          }
        : item
    );
  } else {
    const newRecord = {
      id: uid(),
      ...form,
      status: newStatus,
      timeline,
      createdAt: now
    };
    return [newRecord, ...borrows];
  }
}

export function returnSlide(item, borrows) {
  const now = new Date().toISOString();
  const returnTime = now;
  return borrows.map((b) =>
    b.id === item.id
      ? {
          ...b,
          actualReturnTime: returnTime,
          status: SLIDE_BORROW_STATUS.RETURNED,
          timeline: [
            ...(b.timeline || []),
            {
              type: 'slide-return',
              event: '玻片归还',
              at: formatDateShort(returnTime),
              by: '病理科',
              changedAt: returnTime
            }
          ]
        }
      : b
  );
}

export function receiveSlide(item, borrows) {
  const now = new Date().toISOString();
  return borrows.map((b) =>
    b.id === item.id
      ? {
          ...b,
          receiveTime: now,
          status: SLIDE_BORROW_STATUS.RECEIVED,
          timeline: [
            ...(b.timeline || []),
            {
              type: 'slide-receive',
              event: '玻片接收',
              at: formatDateShort(now),
              by: b.borrower,
              changedAt: now
            }
          ]
        }
      : b
  );
}

export function removeBorrowRecord(id, borrows) {
  return borrows.filter((item) => item.id !== id);
}
