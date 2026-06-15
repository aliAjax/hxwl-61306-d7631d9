import { uid as uidFn } from '../config/configManager';

export const CRITICAL_NOTIFY_STORAGE = 'hxwl-61306-critical-notify';

export const CRITICAL_NOTIFY_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  EXPIRED: '已超时'
};

export const CRITICAL_NOTIFY_STATUS_LIST = ['全部', '待确认', '已确认', '已超时'];

export const CRITICAL_NOTIFY_METHODS = ['电话', '短信', '微信', '系统消息', '现场通知', '其他'];

export const CRITICAL_NOTIFY_REASONS = ['危急病例', '进入待复核'];

export const NOTIFY_TARGET_PRESETS = ['临床主管医生', '科室主任', '病理科主任', '护士站', '手术室', '家属', '医务科'];

export const NOTIFY_DUPLICATE_WINDOW_MINUTES = 30;

export const NOTIFY_REMINDER_MINUTES = 15;

export const NOTIFY_EXPIRE_HOURS = 24;

export const NOTIFY_ESCALATE_WINDOW_MINUTES = 30;

export const NOTIFY_ESCALATE_TARGETS = ['科室主任', '医务科'];

export const CRITICAL_NOTIFY_SEED = [
  {
    caseNo: 'P2026061117',
    notifyTarget: '周医生',
    notifyMethod: '电话',
    sentAt: '2026-06-13T09:00',
    confirmedAt: '2026-06-13T09:08',
    confirmedBy: '周医生',
    remark: '已电话通知，医生表示立即处理',
    triggerReason: '危急病例',
    priority: '危急',
    status: '已确认'
  },
  {
    caseNo: 'P2026061117',
    notifyTarget: '外科护士站',
    notifyMethod: '系统消息',
    sentAt: '2026-06-14T08:30',
    confirmedAt: '',
    confirmedBy: '',
    remark: '',
    triggerReason: '进入待复核',
    priority: '危急',
    status: '待确认'
  }
];

function uid() {
  return uidFn();
}

export function withNotifyIds(items) {
  return items.map((item) => ({
    id: uid(),
    createdAt: item.createdAt || item.sentAt || new Date().toISOString(),
    ...item
  }));
}

export function loadCriticalNotifies() {
  const raw = localStorage.getItem(CRITICAL_NOTIFY_STORAGE);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return data.map((item) => ({ ...item, id: item.id || uid() }));
    } catch {
      return withNotifyIds(CRITICAL_NOTIFY_SEED);
    }
  }
  return withNotifyIds(CRITICAL_NOTIFY_SEED);
}

export function persistNotifies(next) {
  localStorage.setItem(CRITICAL_NOTIFY_STORAGE, JSON.stringify(next));
}

export function loadLatestCriticalNotifies() {
  try {
    const raw = localStorage.getItem(CRITICAL_NOTIFY_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function calcNotifyStatus(item) {
  if (item.confirmedAt) return CRITICAL_NOTIFY_STATUS.CONFIRMED;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  const expireMs = NOTIFY_EXPIRE_HOURS * 60 * 60 * 1000;
  if (now - sentTime > expireMs) return CRITICAL_NOTIFY_STATUS.EXPIRED;
  return CRITICAL_NOTIFY_STATUS.PENDING;
}

export function isNotifyOverdue(item) {
  if (item.confirmedAt) return false;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  const overdueMs = NOTIFY_REMINDER_MINUTES * 60 * 1000;
  return now - sentTime > overdueMs;
}

export function notifyOverdueMinutes(item) {
  if (!isNotifyOverdue(item)) return 0;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  return Math.floor((now - sentTime) / 60000);
}

export function minutesSinceSent(item) {
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  return Math.floor((now - sentTime) / 60000);
}

export function hasDuplicateUnconfirmedNotify(caseId, caseNo, notifyTarget, notifies) {
  const now = Date.now();
  const windowMs = NOTIFY_DUPLICATE_WINDOW_MINUTES * 60 * 1000;
  return notifies.some((n) => {
    const caseMatch = (caseId && n.caseId === caseId) || (caseNo && n.caseNo === caseNo);
    if (!caseMatch) return false;
    if (n.notifyTarget !== notifyTarget) return false;
    if (n.confirmedAt) return false;
    const sentTime = new Date(n.sentAt || n.createdAt).getTime();
    return now - sentTime < windowMs;
  });
}

export function canEscalateNotify(item) {
  if (!item) return false;
  if (item.confirmedAt) return false;
  return isNotifyOverdue(item);
}

export function hasRecentEscalation(caseId, caseNo, escalateTarget, notifies, windowMinutes = NOTIFY_ESCALATE_WINDOW_MINUTES) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  return notifies.some((n) => {
    const caseMatch = (caseId && n.caseId === caseId) || (caseNo && n.caseNo === caseNo);
    if (!caseMatch) return false;
    if (n.notifyTarget !== escalateTarget) return false;
    if (!n.isEscalation) return false;
    const escalateTime = new Date(n.createdAt || n.sentAt).getTime();
    return now - escalateTime < windowMs;
  });
}

export function getNotifyEscalations(notifyId, notifies) {
  if (!notifyId) return [];
  return notifies.filter((n) => n.parentNotifyId === notifyId);
}

export function filterCriticalNotifies(notifies, filters) {
  return notifies
    .filter((item) => {
      const realStatus = calcNotifyStatus(item);
      if (filters.status !== '全部' && realStatus !== filters.status) {
        return false;
      }
      if (filters.priority !== '全部' && item.priority !== filters.priority) {
        return false;
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        return (
          item.caseNo.toLowerCase().includes(q) ||
          item.notifyTarget.toLowerCase().includes(q) ||
          (item.remark || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const statusOrder = { '待确认': 0, '已超时': 1, '已确认': 2 };
      const statusA = statusOrder[calcNotifyStatus(a)] ?? 9;
      const statusB = statusOrder[calcNotifyStatus(b)] ?? 9;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime();
    });
}

export function calcNotifyStats(notifies) {
  let total = notifies.length;
  let pending = 0;
  let confirmed = 0;
  let expired = 0;
  let overduePending = 0;
  notifies.forEach((item) => {
    const status = calcNotifyStatus(item);
    if (status === CRITICAL_NOTIFY_STATUS.PENDING) pending++;
    if (status === CRITICAL_NOTIFY_STATUS.CONFIRMED) confirmed++;
    if (status === CRITICAL_NOTIFY_STATUS.EXPIRED) expired++;
    if (status === CRITICAL_NOTIFY_STATUS.PENDING && isNotifyOverdue(item)) overduePending++;
  });
  return { total, pending, confirmed, expired, overduePending };
}

export function notifyStatusClass(status) {
  switch (status) {
    case CRITICAL_NOTIFY_STATUS.PENDING:
      return 'notify-status-pending';
    case CRITICAL_NOTIFY_STATUS.CONFIRMED:
      return 'notify-status-confirmed';
    case CRITICAL_NOTIFY_STATUS.EXPIRED:
      return 'notify-status-expired';
    default:
      return 'notify-status-pending';
  }
}

export function confirmNotifyRecord(notifyItem, confirmedBy, notifies) {
  const now = new Date().toISOString();
  const confirmer = confirmedBy.trim() || notifyItem.notifyTarget;
  return notifies.map((n) =>
    n.id === notifyItem.id
      ? { ...n, confirmedAt: now, confirmedBy: confirmer, status: CRITICAL_NOTIFY_STATUS.CONFIRMED }
      : n
  );
}

export function createEscalateNotify(escalateSourceNotify, escalateForm, caseRecord, notifies) {
  const now = new Date().toISOString();
  const caseNo = escalateSourceNotify.caseNo;
  const priority = caseRecord?.priority || escalateSourceNotify.priority || '常规';

  const newEscalateNotify = {
    id: uid(),
    caseId: escalateSourceNotify.caseId,
    caseNo,
    notifyTarget: escalateForm.escalateTarget.trim(),
    notifyMethod: escalateForm.notifyMethod,
    sentAt: escalateForm.sentAt,
    confirmedAt: '',
    confirmedBy: '',
    remark: escalateForm.remark.trim(),
    triggerReason: '通知升级',
    priority,
    createdAt: now,
    isEscalation: true,
    parentNotifyId: escalateSourceNotify.id
  };

  return {
    newEscalateNotify,
    nextNotifies: [newEscalateNotify, ...notifies]
  };
}

export function removeNotifyRecord(id, notifies) {
  return notifies.filter((item) => item.id !== id);
}
