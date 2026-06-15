import { useEffect, useMemo, useRef, useState } from 'react';
import { Microscope, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileUp, X, AlertCircle, Clock, Zap, Eye, ShieldCheck, CircleCheckBig, Stethoscope, FileCheck, Edit, Save, User, UserCheck, Users, Send, CheckSquare, Square, Layers, UserPlus, Info, BookOpen, ArrowRightLeft, Home, CornerDownRight, FileText, Building2, CalendarClock, Undo2, Bell, BellRing, Phone, MessageSquare, Mail, Megaphone, HandHeart, Timer, Radio, Settings, CircleDot, Pin, PinOff, ChevronDown, ArrowUpCircle } from 'lucide-react';
import { TabSync } from './tabSync';
import { ConfigManager } from './components/ConfigManager';
import {
  loadConfig,
  persistConfig,
  migrateLegacyRecords,
  getFieldKeyRenames,
  sanitizeConfig,
  evaluateMetric,
  getStatusNames,
  getPrimaryStatusName,
  getStatusIndex,
  nextStatusName,
  prevStatusName,
  buildStatusClass,
  buildPriorityRankFn,
  getTatThresholds,
  buildSearchFields,
  isCriticalEligible,
  buildCardMeta,
  getStatusColor,
  uid as uidFn
} from './config/configManager';
import './App.css';

const INITIAL_CONFIG = sanitizeConfig(loadConfig());

const ICON_MAP = {
  Microscope, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays,
  FileUp, X, AlertCircle, Clock, Zap, Eye, ShieldCheck, CircleCheckBig, Stethoscope, FileCheck, Edit, Save,
  UserCheck, Users, Send, CheckSquare, Square, Layers, UserPlus, Info, BookOpen, ArrowRightLeft, Home,
  CornerDownRight, FileText, Building2, CalendarClock, Undo2, Bell, BellRing, Phone, MessageSquare, Mail,
  Megaphone, HandHeart, Timer, Radio, Settings, CircleDot, Pin, PinOff
};

function safeGetIcon(iconName) {
  return ICON_MAP[iconName] || CircleDot;
}

const SLIDE_BORROW_STORAGE = 'hxwl-61306-slide-borrow';
const SLIDE_BORROW_STATUS = {
  BORROWED: '已借出',
  RECEIVED: '已接收',
  RETURNED: '已归还',
  SOON_OVERDUE: '即将逾期',
  OVERDUE: '已逾期'
};

const SLIDE_BORROW_STATUS_LIST = ['全部', '已借出', '已接收', '即将逾期', '已逾期', '已归还'];

const SLIDE_BORROW_SEED = [
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

const DEFAULT_DEPARTMENTS = ['病理科', '外科', '内科', '肿瘤科', '妇产科', '儿科', '骨科', '皮肤科', '眼科', '耳鼻喉科'];

const CRITICAL_NOTIFY_STORAGE = 'hxwl-61306-critical-notify';
const CRITICAL_NOTIFY_STATUS = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  EXPIRED: '已超时'
};
const CRITICAL_NOTIFY_STATUS_LIST = ['全部', '待确认', '已确认', '已超时'];
const CRITICAL_NOTIFY_METHODS = ['电话', '短信', '微信', '系统消息', '现场通知', '其他'];
const CRITICAL_NOTIFY_REASONS = ['危急病例', '进入待复核'];
const NOTIFY_TARGET_PRESETS = ['临床主管医生', '科室主任', '病理科主任', '护士站', '手术室', '家属', '医务科'];
const NOTIFY_DUPLICATE_WINDOW_MINUTES = 30;
const NOTIFY_REMINDER_MINUTES = 15;
const NOTIFY_EXPIRE_HOURS = 24;
const NOTIFY_ESCALATE_WINDOW_MINUTES = 30;
const NOTIFY_ESCALATE_TARGETS = ['科室主任', '医务科'];

const CRITICAL_NOTIFY_SEED = [
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

const PHRASE_LIBRARY_STORAGE = 'hxwl-61306-phrase-library';

const PHRASE_LIBRARY_SEED = [
  {
    phrase: '镜下见肿瘤细胞呈巢状排列，核大深染，核分裂象易见，考虑为恶性肿瘤。',
    sampleType: '手术切除',
    useCount: 12,
    lastUsedAt: '2026-06-12T10:30:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '胃黏膜慢性炎，伴肠上皮化生，未见异型增生，建议定期复查。',
    sampleType: '胃镜',
    useCount: 25,
    lastUsedAt: '2026-06-13T14:20:00.000Z',
    pinned: true,
    pinnedAt: '2026-06-13T14:20:00.000Z'
  },
  {
    phrase: '结肠黏膜慢性炎，可见溃疡形成，伴炎性息肉，建议治疗后复查。',
    sampleType: '肠镜',
    useCount: 18,
    lastUsedAt: '2026-06-11T09:15:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '细针穿刺涂片见异型细胞，考虑为腺癌，建议进一步活检明确诊断。',
    sampleType: '穿刺',
    useCount: 8,
    lastUsedAt: '2026-06-10T16:45:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '细胞学检查见大量炎性细胞，未见明确癌细胞，建议结合临床。',
    sampleType: '细胞学',
    useCount: 15,
    lastUsedAt: '2026-06-09T11:00:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '切缘未见肿瘤细胞，肿瘤浸润至浆膜层，伴淋巴结转移（2/12）。',
    sampleType: '手术切除',
    useCount: 6,
    lastUsedAt: '2026-06-08T15:30:00.000Z',
    pinned: false,
    pinnedAt: ''
  },
  {
    phrase: '胃体溃疡型中分化腺癌，溃疡大小约2.5cm，侵及黏膜下层。',
    sampleType: '胃镜',
    useCount: 10,
    lastUsedAt: '2026-06-13T08:50:00.000Z',
    pinned: true,
    pinnedAt: '2026-06-12T08:00:00.000Z'
  },
  {
    phrase: '乳腺穿刺标本：浸润性导管癌，ER(+)，PR(+)，HER2(-)，Ki-67约30%。',
    sampleType: '穿刺',
    useCount: 4,
    lastUsedAt: '2026-06-07T13:20:00.000Z',
    pinned: false,
    pinnedAt: ''
  }
];

const PHRASE_SAMPLE_TYPES = ['全部', '穿刺', '胃镜', '肠镜', '手术切除', '细胞学'];

function loadPhrases() {
  const raw = localStorage.getItem(PHRASE_LIBRARY_STORAGE);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return data.map((item) => ({
        ...item,
        id: item.id || uid(),
        pinned: typeof item.pinned === 'boolean' ? item.pinned : false,
        pinnedAt: item.pinnedAt || ''
      }));
    } catch {
      return withPhraseIds(PHRASE_LIBRARY_SEED);
    }
  }
  return withPhraseIds(PHRASE_LIBRARY_SEED);
}

function withPhraseIds(items) {
  return items.map((item) => ({
    id: uid(),
    createdAt: item.createdAt || new Date().toISOString(),
    pinned: typeof item.pinned === 'boolean' ? item.pinned : false,
    pinnedAt: item.pinnedAt || '',
    ...item
  }));
}

function persistPhrases(next) {
  localStorage.setItem(PHRASE_LIBRARY_STORAGE, JSON.stringify(next));
}

function loadCriticalNotifies() {
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

function withNotifyIds(items) {
  return items.map((item) => ({
    id: uid(),
    createdAt: item.createdAt || item.sentAt || new Date().toISOString(),
    ...item
  }));
}

function persistNotifies(next) {
  localStorage.setItem(CRITICAL_NOTIFY_STORAGE, JSON.stringify(next));
}

function calcNotifyStatus(item) {
  if (item.confirmedAt) return CRITICAL_NOTIFY_STATUS.CONFIRMED;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  const expireMs = NOTIFY_EXPIRE_HOURS * 60 * 60 * 1000;
  if (now - sentTime > expireMs) return CRITICAL_NOTIFY_STATUS.EXPIRED;
  return CRITICAL_NOTIFY_STATUS.PENDING;
}

function isNotifyOverdue(item) {
  if (item.confirmedAt) return false;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  const overdueMs = NOTIFY_REMINDER_MINUTES * 60 * 1000;
  return now - sentTime > overdueMs;
}

function notifyOverdueMinutes(item) {
  if (!isNotifyOverdue(item)) return 0;
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  return Math.floor((now - sentTime) / 60000);
}

function minutesSinceSent(item) {
  const now = Date.now();
  const sentTime = new Date(item.sentAt || item.createdAt).getTime();
  return Math.floor((now - sentTime) / 60000);
}

function hasDuplicateUnconfirmedNotify(caseId, caseNo, notifyTarget, notifies) {
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

function canEscalateNotify(item) {
  if (!item) return false;
  if (item.confirmedAt) return false;
  return isNotifyOverdue(item);
}

function hasRecentEscalation(caseId, caseNo, escalateTarget, notifies, windowMinutes = NOTIFY_ESCALATE_WINDOW_MINUTES) {
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

function getNotifyEscalations(notifyId, notifies) {
  if (!notifyId) return [];
  return notifies.filter((n) => n.parentNotifyId === notifyId);
}

function loadLatestCriticalNotifies() {
  try {
    const raw = localStorage.getItem(CRITICAL_NOTIFY_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function isCriticalNotifyEligible(config, record) {
  return isCriticalEligible(config, record);
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function formatDateTimeInput(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const today = new Date().toISOString().slice(0, 10);

function uid() {
  return uidFn();
}

function withIds(config, items) {
  const primary = getPrimaryStatusName(config);
  return items.map((item) => ({
    id: uid(),
    timeline: item.timeline || [{ status: item.status || primary, at: today, by: '系统', changedAt: new Date().toISOString() }],
    status: item.status || primary,
    ...item
  }));
}

function loadRecords(config) {
  const storageKey = config.storage || INITIAL_CONFIG.storage;
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return migrateLegacyRecords(data, config);
    } catch {
      return withIds(config, config.seedData);
    }
  }
  return withIds(config, config.seedData || INITIAL_CONFIG.seedData);
}

function loadSlideBorrows() {
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

function withBorrowIds(items) {
  return items.map((item) => ({
    id: uid(),
    timeline: item.timeline || buildBorrowTimeline(item),
    ...item
  }));
}

function buildBorrowTimeline(item) {
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

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function calcBorrowStatus(item) {
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

function isOverdue(item) {
  if (item.status === SLIDE_BORROW_STATUS.RETURNED) return false;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return now > expected;
}

function isSoonOverdue(item) {
  if (item.status === SLIDE_BORROW_STATUS.RETURNED) return false;
  if (isOverdue(item)) return false;
  if (item.actualReturnTime) return false;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  const diffHours = (expected - now) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 24;
}

function overdueDays(item) {
  if (!isOverdue(item)) return 0;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return Math.ceil((now - expected) / (1000 * 60 * 60 * 24));
}

function soonOverdueHours(item) {
  if (!isSoonOverdue(item)) return 0;
  const now = new Date().getTime();
  const expected = new Date(item.expectedReturnTime).getTime();
  return Math.ceil((expected - now) / (1000 * 60 * 60));
}

function borrowStatusClass(status) {
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

function getFullBorrowTimeline(item) {
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

function avg(numbers) {
  const valid = numbers.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value || 0);
}

function inNextDays(dateText, days) {
  if (!dateText) return false;
  const date = new Date(dateText);
  const now = new Date(today);
  const diff = (date.getTime() - now.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function latestTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps[temps.length - 1];
}

function hasHotTemp(item) {
  const temps = item.temps || [Number(item.temperature)];
  return temps.some((value) => Number(value) > 2);
}

function priorityRank(config, value) {
  const rankFn = buildPriorityRankFn(config);
  return rankFn(value);
}

function hasOverlap(target, records) {
  if (!target.bed || !target.date || !target.start || !target.end) return false;
  return records.some((item) => item.id !== target.id && item.bed === target.bed && item.date === target.date && target.start < item.end && target.end > item.start);
}

function statusClass(config, status) {
  return buildStatusClass(config, status);
}

function buildWorkbenchZones(config) {
  return (config.statuses || []).map((s, idx) => {
    const keys = ['urgent', 'reading', 'review', 'done', 'custom'];
    const labels = { '待阅片': '优先处理', '阅片中': '正在阅片', '待复核': '等待复核', '已完成': '已完成' };
    return {
      key: s.key || s.id || keys[idx] || `zone_${idx}`,
      label: labels[s.name] || s.name,
      status: s.name,
      icon: safeGetIcon(s.icon),
      color: s.color || '#6b7280',
      order: s.order ?? idx
    };
  }).sort((a, b) => a.order - b.order);
}

function waitDuration(config, item) {
  if (!item) return '0分';
  const now = Date.now();
  const timeline = item.timeline || [];
  const lastEntry = timeline[timeline.length - 1];
  const dateKey = config.sortConfig?.secondaryField || config.fields?.find((f) => f.dateKey)?.key || 'sentAt';
  const startMs = [item[dateKey], item.sentAt, item.createdAt, lastEntry?.changedAt]
    .map((value) => new Date(value).getTime())
    .find((value) => Number.isFinite(value)) ?? now;
  const diffMs = Math.max(0, now - startMs);
  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `${days}天${hours}时`;
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分`;
}

function nextStatus(config, current) {
  return nextStatusName(config, current);
}

function prevStatus(config, current) {
  return prevStatusName(config, current);
}

const REVIEW_CONCLUSIONS = ['通过', '修改后通过', '退回重审'];

const TAT_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  OVERDUE: 'overdue',
  UNKNOWN: 'unknown',
};

function getTatThresholdsFor(config, priority) {
  return getTatThresholds(config, priority);
}

function getStartTime(config, item) {
  if (!item) return null;
  const timeline = item.timeline || [];
  const firstEntry = timeline[0];
  const dateKey = config.sortConfig?.secondaryField || config.fields?.find((f) => f.dateKey)?.key || 'sentAt';
  const candidates = [item[dateKey], item.sentAt, item.createdAt, firstEntry?.changedAt];
  for (const value of candidates) {
    if (value) {
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

function getEndTime(config, item) {
  if (!item) return null;
  const terminalStatuses = (config.statuses || []).filter((s) => s.terminal).map((s) => s.name);
  const completedStatuses = terminalStatuses.length > 0 ? terminalStatuses : ['已完成'];
  if (!completedStatuses.includes(item.status)) return null;
  const timeline = item.timeline || [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (completedStatuses.includes(timeline[i].status)) {
      const ms = new Date(timeline[i].changedAt).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

function calcTatInfo(config, item) {
  if (!item) {
    return {
      status: TAT_STATUS.UNKNOWN,
      waitedMinutes: 0,
      remainingMinutes: null,
      threshold: null,
      hasStartTime: false,
      isCompleted: false,
    };
  }
  const startMs = getStartTime(config, item);
  const now = Date.now();

  if (!startMs) {
    return {
      status: TAT_STATUS.UNKNOWN,
      waitedMinutes: 0,
      remainingMinutes: null,
      threshold: null,
      hasStartTime: false,
      isCompleted: false,
    };
  }

  const endMs = getEndTime(config, item);
  const refMs = endMs || now;
  const waitedMinutes = Math.floor((refMs - startMs) / 60000);
  const priorityKey = config.priorityConfig?.fieldKey || 'priority';
  const thresholds = getTatThresholdsFor(config, item[priorityKey]);
  const timeoutMinutes = thresholds.timeout;
  const warningMinutes = thresholds.warning;

  const terminalStatuses = (config.statuses || []).filter((s) => s.terminal).map((s) => s.name);
  const isCompleted = terminalStatuses.length > 0
    ? terminalStatuses.includes(item.status)
    : item.status === '已完成';

  if (isCompleted) {
    const isOverdue = waitedMinutes > timeoutMinutes;
    return {
      status: isOverdue ? TAT_STATUS.OVERDUE : TAT_STATUS.NORMAL,
      waitedMinutes,
      remainingMinutes: 0,
      threshold: timeoutMinutes,
      hasStartTime: true,
      isCompleted: true,
    };
  }

  const remainingMinutes = timeoutMinutes - waitedMinutes;

  let status;
  if (remainingMinutes <= 0) {
    status = TAT_STATUS.OVERDUE;
  } else if (remainingMinutes <= warningMinutes) {
    status = TAT_STATUS.WARNING;
  } else {
    status = TAT_STATUS.NORMAL;
  }

  return {
    status,
    waitedMinutes,
    remainingMinutes,
    threshold: timeoutMinutes,
    hasStartTime: true,
    isCompleted: false,
  };
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '-';
  const absMins = Math.abs(minutes);
  const days = Math.floor(absMins / 1440);
  const hours = Math.floor((absMins % 1440) / 60);
  const mins = Math.floor(absMins % 60);
  const prefix = minutes < 0 ? '超' : '';
  if (days > 0) return `${prefix}${days}天${hours}时`;
  if (hours > 0) return `${prefix}${hours}时${mins}分`;
  return `${prefix}${mins}分`;
}

function tatStatusLabel(status) {
  return {
    [TAT_STATUS.NORMAL]: '正常',
    [TAT_STATUS.WARNING]: '即将超时',
    [TAT_STATUS.OVERDUE]: '已超时',
    [TAT_STATUS.UNKNOWN]: '待计时',
  }[status] || '未知';
}

function tatStatusClass(status) {
  return {
    [TAT_STATUS.NORMAL]: 'tat-normal',
    [TAT_STATUS.WARNING]: 'tat-warning',
    [TAT_STATUS.OVERDUE]: 'tat-overdue',
    [TAT_STATUS.UNKNOWN]: 'tat-unknown',
  }[status] || 'tat-unknown';
}

function buildInitialFiltersState(config) {
  const state = {};
  const enabledFilters = (config.filters || [])
    .filter((f) => f.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  enabledFilters.forEach((filter) => {
    switch (filter.type) {
      case 'search':
        state[filter.id] = '';
        break;
      case 'status':
        state[filter.id] = '全部';
        break;
      case 'select':
        state[filter.id] = '全部';
        break;
      default:
        break;
    }
  });

  return state;
}

function applyFiltersFromConfig(records, config, filterState) {
  const enabledFilters = (config.filters || [])
    .filter((f) => f.enabled)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return records.filter((item) => {
    for (const filter of enabledFilters) {
      const value = filterState[filter.id];
      if (!value) continue;

      switch (filter.type) {
        case 'search': {
          const searchFields = filter.searchFields || [];
          if (searchFields.length === 0) continue;
          const q = String(value).toLowerCase();
          const match = searchFields.some((f) =>
            String(item?.[f] ?? '').toLowerCase().includes(q)
          );
          if (!match) return false;
          break;
        }
        case 'status': {
          if (value === '全部') continue;
          if (item.status !== value) return false;
          break;
        }
        case 'select': {
          if (value === '全部') continue;
          const field = filter.field;
          if (!field) continue;
          if (item[field] !== value) return false;
          break;
        }
        default:
          break;
      }
    }
    return true;
  });
}

function buildSortFnFromConfig(config) {
  const { primaryField, secondaryField, direction = 'asc' } = config.sortConfig || {};
  const dateField = config.fields?.find((f) => f.dateKey)?.key || 'sentAt';
  const dirMultiplier = direction === 'asc' ? 1 : -1;
  const priorityField = config.priorityConfig?.fieldKey || 'priority';

  return (a, b) => {
    if (primaryField) {
      const sortableField = config.fields?.find((f) => f.key === primaryField);
      if (primaryField === priorityField && config.priorityConfig?.order?.length) {
        const rank = priorityRank(config, a[primaryField]) - priorityRank(config, b[primaryField]);
        if (rank !== 0) return rank * dirMultiplier;
      } else if (sortableField?.sortWeights && Object.keys(sortableField.sortWeights).length) {
        const rankA = sortableField.sortWeights[a?.[primaryField]] ?? 99;
        const rankB = sortableField.sortWeights[b?.[primaryField]] ?? 99;
        if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
      } else if (sortableField?.sortable) {
        const rank = priorityRank(config, a[primaryField]) - priorityRank(config, b[primaryField]);
        if (rank !== 0) return rank * dirMultiplier;
      }
    }
    const aDate = a[secondaryField] || a[dateField] || a.createdAt || '';
    const bDate = b[secondaryField] || b[dateField] || b.createdAt || '';
    return String(aDate).localeCompare(String(bDate)) * dirMultiplier;
  };
}

function App() {
  const [queueConfig, setQueueConfig] = useState(INITIAL_CONFIG);
  const [showConfigManager, setShowConfigManager] = useState(false);
  const [records, setRecords] = useState(() => loadRecords(INITIAL_CONFIG));
  const tabSyncRef = useRef(null);
  const [activeTabCount, setActiveTabCount] = useState(1);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [form, setForm] = useState({
    ...INITIAL_CONFIG.defaultValues,
    status: getPrimaryStatusName(INITIAL_CONFIG)
  });
  const [filters, setFilters] = useState(() => buildInitialFiltersState(INITIAL_CONFIG));
  const [selected, setSelected] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRaw, setBatchRaw] = useState('');
  const [batchParsed, setBatchParsed] = useState([]);
  const [rawParsed, setRawParsed] = useState([]);
  const [batchColumns, setBatchColumns] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [tempDefaultValues, setTempDefaultValues] = useState({});
  const [detectedHeader, setDetectedHeader] = useState(false);
  const [tick, setTick] = useState(0);
  const [reviewForm, setReviewForm] = useState({ reviewDoctor: '', conclusion: '', remark: '' });
  const [reviewEditing, setReviewEditing] = useState(false);
  const [noteAdding, setNoteAdding] = useState(false);
  const [noteForm, setNoteForm] = useState({ noteText: '', noteBy: '' });
  const [statusNoteAdding, setStatusNoteAdding] = useState(null);
  const [tatFilters, setTatFilters] = useState({ doctor: '全部', status: '全部', tatStatus: '全部', priority: '全部' });
  const [tatGroupCaseFilters, setTatGroupCaseFilters] = useState({});
  const [showTatBoard, setShowTatBoard] = useState(false);
  const [expandedDoctors, setExpandedDoctors] = useState(new Set());
  const [activeView, setActiveView] = useState('workbench');
  const [dispatchFilters, setDispatchFilters] = useState({ query: '', priority: '全部', sampleType: '全部' });
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [selectedDoctorForDetail, setSelectedDoctorForDetail] = useState(null);
  const [slideBorrows, setSlideBorrows] = useState(loadSlideBorrows);
  const [slideBorrowFilters, setSlideBorrowFilters] = useState({ query: '', status: '全部', department: '全部' });
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [editingBorrow, setEditingBorrow] = useState(null);
  const [borrowForm, setBorrowForm] = useState({
    caseNo: '',
    borrower: '',
    department: '病理科',
    borrowTime: '',
    receiveTime: '',
    expectedReturnTime: '',
    actualReturnTime: '',
    remark: ''
  });
  const [selectedBorrowForDetail, setSelectedBorrowForDetail] = useState(null);
  const [criticalNotifies, setCriticalNotifies] = useState(loadCriticalNotifies);
  const [notifyFilters, setNotifyFilters] = useState({ query: '', status: '全部', priority: '全部' });
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({
    caseId: '',
    caseNo: '',
    notifyTarget: '',
    notifyMethod: '电话',
    sentAt: '',
    triggerReason: '危急病例',
    remark: ''
  });
  const [selectedNotifyForDetail, setSelectedNotifyForDetail] = useState(null);
  const [notifyDuplicateWarning, setNotifyDuplicateWarning] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateSourceNotify, setEscalateSourceNotify] = useState(null);
  const [escalateForm, setEscalateForm] = useState({
    escalateTarget: '科室主任',
    notifyMethod: '电话',
    sentAt: '',
    remark: ''
  });
  const [escalateWarning, setEscalateWarning] = useState('');
  const [phrases, setPhrases] = useState(loadPhrases);
  const [phraseFilters, setPhraseFilters] = useState({ query: '', sampleType: '全部' });
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [editingPhrase, setEditingPhrase] = useState(null);
  const [phraseForm, setPhraseForm] = useState({
    phrase: '',
    sampleType: '穿刺',
    useCount: 0,
    lastUsedAt: ''
  });
  const [phraseDeleteConfirm, setPhraseDeleteConfirm] = useState(null);
  const [phrasePickerTarget, setPhrasePickerTarget] = useState(null);
  const [showPhrasePicker, setShowPhrasePicker] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showEscalateModal || !escalateSourceNotify) return;
    const latestNotifies = loadLatestCriticalNotifies();
    const isDup = hasRecentEscalation(
      escalateSourceNotify.caseId,
      escalateSourceNotify.caseNo,
      escalateForm.escalateTarget,
      latestNotifies
    );
    if (isDup) {
      setEscalateWarning(`该病例在${NOTIFY_ESCALATE_WINDOW_MINUTES}分钟内已向「${escalateForm.escalateTarget}」发送过升级通知，请勿重复升级`);
    } else {
      setEscalateWarning('');
    }
  }, [showEscalateModal, escalateSourceNotify, escalateForm.escalateTarget]);

  useEffect(() => {
    const initialRecords = loadRecords(queueConfig);
    const storageKey = queueConfig.storage || INITIAL_CONFIG.storage;
    const tabSync = new TabSync(storageKey, {
      onExternalUpdate: (externalRecords) => {
        const migrated = migrateLegacyRecords(externalRecords, queueConfig);
        setRecords(migrated);
        setSelected((prevSelected) => {
          if (!prevSelected) return null;
          const updatedSelected = migrated.find((r) => r.id === prevSelected.id);
          return updatedSelected || null;
        });
      },
      onConflict: (conflictData) => {
        setConflictInfo(conflictData);
        setShowConflictModal(true);
      },
      onTabListChange: (count) => {
        setActiveTabCount(count);
      }
    });
    tabSync.init(initialRecords);
    tabSyncRef.current = tabSync;

    return () => {
      tabSync.destroy();
    };
  }, [queueConfig]);

  useEffect(() => {
    setFilters(buildInitialFiltersState(queueConfig));
  }, [queueConfig.filters]);

  function handleConfigSave(newConfig) {
    const sanitized = sanitizeConfig(newConfig);
    const fieldKeyRenames = getFieldKeyRenames(queueConfig, sanitized);
    setQueueConfig(sanitized);
    setFilters(buildInitialFiltersState(sanitized));
    const migratedRecords = migrateLegacyRecords(records, sanitized, { fieldKeyRenames });
    if (migratedRecords.length !== records.length || JSON.stringify(migratedRecords) !== JSON.stringify(records)) {
      setRecords(migratedRecords);
      if (tabSyncRef.current) {
        tabSyncRef.current.persist(migratedRecords);
      }
    }
    setForm({
      ...sanitized.defaultValues,
      status: getPrimaryStatusName(sanitized)
    });
    localStorage.setItem(sanitized.storage || INITIAL_CONFIG.storage,
      localStorage.getItem(sanitized.storage || INITIAL_CONFIG.storage) || '[]');
  }

  useEffect(() => {
    if (selected) {
      const latestReview = (selected.reviews || []).slice(-1)[0];
      if (latestReview && !reviewEditing) {
        setReviewForm({
          reviewDoctor: latestReview.reviewDoctor || '',
          conclusion: latestReview.conclusion || '',
          remark: latestReview.remark || ''
        });
      } else if (!latestReview) {
        setReviewForm({ reviewDoctor: '', conclusion: '', remark: '' });
      }
    } else {
      setReviewForm({ reviewDoctor: '', conclusion: '', remark: '' });
      setReviewEditing(false);
    }
    setNoteAdding(false);
    setNoteForm({ noteText: '', noteBy: '' });
    setStatusNoteAdding(null);
  }, [selected]);

  function handleReviewSubmit(e) {
    e.preventDefault();
    if (!selected || selected.status !== '待复核') return;
    if (!reviewForm.reviewDoctor.trim() || !reviewForm.conclusion) return;

    const now = new Date().toISOString();
    const reviewRecord = {
      id: uid(),
      reviewDoctor: reviewForm.reviewDoctor.trim(),
      conclusion: reviewForm.conclusion,
      remark: reviewForm.remark.trim(),
      reviewedAt: now
    };

    const next = records.map((item) => {
      if (item.id === selected.id) {
        const newReviews = [...(item.reviews || []), reviewRecord];
        return {
          ...item,
          reviews: newReviews,
          timeline: [...(item.timeline || []), {
            type: 'review-status',
            status: '复核意见',
            at: today,
            by: reviewForm.reviewDoctor.trim(),
            changedAt: now,
            reviewId: reviewRecord.id,
            note: reviewForm.remark.trim() || undefined,
            noteBy: reviewForm.reviewDoctor.trim()
          }]
        };
      }
      return item;
    });

    persist(next);
    setSelected(next.find((item) => item.id === selected.id));
    setReviewEditing(false);
  }

  function handleReviewCancel() {
    setReviewEditing(false);
    const latestReview = (selected?.reviews || []).slice(-1)[0];
    if (latestReview) {
      setReviewForm({
        reviewDoctor: latestReview.reviewDoctor || '',
        conclusion: latestReview.conclusion || '',
        remark: latestReview.remark || ''
      });
    } else {
      setReviewForm({ reviewDoctor: '', conclusion: '', remark: '' });
    }
  }

  function handleReviewEdit() {
    const latestReview = (selected?.reviews || []).slice(-1)[0];
    if (latestReview) {
      setReviewForm({
        reviewDoctor: latestReview.reviewDoctor || '',
        conclusion: latestReview.conclusion || '',
        remark: latestReview.remark || ''
      });
    }
    setReviewEditing(true);
  }

  const BATCH_FIELDS = queueConfig.batchImport?.fields || queueConfig.fields.map((f) => ({
    key: f.key, label: f.label, required: !!f.required
  }));

  const BATCH_FIELD_DETAILS = BATCH_FIELDS.map((field) => ({
    ...(queueConfig.fields.find((f) => f.key === field.key) || {}),
    ...field
  }));

  const HEADER_KEYWORDS = queueConfig.batchImport?.headerKeywords ||
    queueConfig.fields.flatMap((f) => [f.label, f.key.toLowerCase()]);

  function fieldHeaderLabels(field) {
    return [
      field.label,
      field.key,
      field.key?.toLowerCase()
    ]
      .filter(Boolean)
      .map((label) => String(label).toLowerCase());
  }

  function looksLikeDataCell(value, field) {
    const v = (value || '').trim();
    if (!v) return false;
    if (field.type === 'datetime-local' || field.type === 'date') {
      return /\d{4}[-/:]\d{1,2}[-/:]\d{1,2}/.test(v) || /\d{1,2}[-/月]\d{1,2}[-/日]/.test(v);
    }
    if (field.key === 'caseNo' || field.label.includes('病例') || field.label.includes('编号')) {
      return /^[A-Za-z0-9\-]+$/.test(v) && v.length >= 4;
    }
    if (field.type === 'select' && field.options?.length) {
      return field.options.some((opt) => v === opt || v.includes(opt));
    }
    return true;
  }

  function detectHeader(lines) {
    if (!lines.length) return { hasHeader: false, matchScore: 0 };
    const firstLine = lines[0];
    const firstParts = firstLine.split('\t').map((p) => p.trim());
    const partCount = firstParts.length;

    const secondLine = lines[1] || '';
    const secondParts = secondLine.split('\t').map((p) => p.trim());

    const fieldLabels = BATCH_FIELD_DETAILS.map((f) => ({
      key: f.key,
      labels: new Set(fieldHeaderLabels(f))
    }));

    let exactHeaderMatches = 0;
    firstParts.forEach((part) => {
      const p = part.toLowerCase();
      if (!p) return;
      const isLabel = fieldLabels.some((f) =>
        Array.from(f.labels).some((label) =>
          label === p || p === label || (p.length >= 2 && label.includes(p))
        )
      );
      if (isLabel) exactHeaderMatches++;
    });

    let exactDataMatches = 0;
    secondParts.forEach((part, idx) => {
      const field = BATCH_FIELD_DETAILS[idx];
      if (!field) return;
      if (looksLikeDataCell(part, field)) exactDataMatches++;
    });

    const headerMatchRatio = exactHeaderMatches / Math.max(partCount, 1);
    const dataMatchRatio = exactDataMatches / Math.max(secondParts.length, 1);

    let hasHeader = false;
    if (exactHeaderMatches >= Math.min(2, partCount) && headerMatchRatio >= 0.5) {
      hasHeader = true;
    }
    if (partCount <= 2 && exactHeaderMatches >= 1 && dataMatchRatio < 0.5) {
      hasHeader = true;
    }

    return { hasHeader, matchScore: exactHeaderMatches };
  }

  function parseRawColumns(raw) {
    const lines = raw.split('\n').map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) return { columns: [], data: [], hasHeader: false };

    const { hasHeader } = detectHeader(lines);
    let startIndex = hasHeader ? 1 : 0;

    const firstDataLine = lines[startIndex] || '';
    const firstParts = firstDataLine.split('\t');
    const columnCount = firstParts.length;

    const columns = [];
    if (hasHeader) {
      const headerParts = lines[0].split('\t').map((p) => p.trim());
      for (let i = 0; i < Math.max(columnCount, headerParts.length); i++) {
        columns.push({
          index: i,
          name: headerParts[i]?.trim() || `列${i + 1}`,
          originalName: headerParts[i]?.trim() || `列${i + 1}`
        });
      }
    } else {
      for (let i = 0; i < columnCount; i++) {
        const fieldAtPos = BATCH_FIELD_DETAILS[i];
        columns.push({
          index: i,
          name: fieldAtPos ? `${fieldAtPos.label} (列${i + 1})` : `列${i + 1}`,
          originalName: `列${i + 1}`
        });
      }
    }

    const data = [];
    for (let i = startIndex; i < lines.length; i++) {
      const rawLine = lines[i];
      let parts = rawLine.split('\t').map((p) => (p || '').trim());
      if (parts.length < columns.length) {
        parts = parts.concat(new Array(columns.length - parts.length).fill(''));
      }
      const row = { _id: uid() };
      columns.forEach((col, idx) => {
        row[`_col_${idx}`] = parts[idx] || '';
      });
      data.push(row);
    }

    return { columns, data, hasHeader };
  }

  function guessFieldMapping(columns, hasHeader) {
    const mapping = {};
    const configFields = [...BATCH_FIELD_DETAILS];
    const usedFieldKeys = new Set();

    if (!hasHeader) {
      columns.forEach((col, idx) => {
        const field = configFields[idx];
        mapping[col.index] = field ? field.key : null;
        if (field) usedFieldKeys.add(field.key);
      });
      return mapping;
    }

    columns.forEach((col) => {
      const colName = col.name.toLowerCase();
      let matched = null;
      let bestScore = 0;

      for (const field of configFields) {
        if (usedFieldKeys.has(field.key)) continue;
        const fieldLabels = fieldHeaderLabels(field);

        let score = 0;
        for (const label of fieldLabels) {
          if (!label) continue;
          if (colName === label) { score = 100; break; }
          if (colName.includes(label) && label.length >= 2) { score = Math.max(score, 50 + label.length); }
          if (label.includes(colName) && colName.length >= 2) { score = Math.max(score, 30 + colName.length); }
        }

        if (score > bestScore && score >= 30) {
          bestScore = score;
          matched = field.key;
        }
      }

      if (matched) usedFieldKeys.add(matched);
      mapping[col.index] = matched || null;
    });

    return mapping;
  }

  function applyFieldMapping(rawData, columns, mapping, defaultValues) {
    if (!rawData.length) return [];

    const existingCaseNos = new Set(records.map((r) => r.caseNo));
    const seenCaseNos = new Set();
    const primaryStatus = getPrimaryStatusName(queueConfig);
    const idField = BATCH_FIELDS[0]?.key || 'caseNo';

    return rawData.map((rawRow) => {
      const record = {};

      columns.forEach((col) => {
        const targetField = mapping[col.index];
        if (targetField && targetField !== '__ignore__') {
          record[targetField] = rawRow[`_col_${col.index}`] || '';
        }
      });

      Object.entries(defaultValues || {}).forEach(([key, value]) => {
        if (value && (!record[key] || record[key] === '')) {
          record[key] = value;
        }
      });

      const missingRequired = BATCH_FIELDS
        .filter((f) => f.required && !record[f.key])
        .map((f) => f.label);

      const missingOptional = BATCH_FIELDS
        .filter((f) => !f.required && !record[f.key])
        .map((f) => f.label);

      const idValue = record[idField];
      const duplicate = idValue && (existingCaseNos.has(idValue) || seenCaseNos.has(idValue));

      if (idValue) seenCaseNos.add(idValue);

      return {
        _id: rawRow._id,
        ...record,
        status: record.status || primaryStatus,
        _missingRequired: missingRequired,
        _missingOptional: missingOptional,
        _duplicate: duplicate,
        _invalid: missingRequired.length > 0,
      };
    });
  }

  function fallbackOrderMapping(columns) {
    const mapping = {};
    columns.forEach((col, idx) => {
      const field = BATCH_FIELDS[idx];
      mapping[col.index] = field ? field.key : null;
    });
    return mapping;
  }

  function handleBatchParse() {
    const { columns, data, hasHeader } = parseRawColumns(batchRaw);
    setDetectedHeader(hasHeader);
    if (!columns.length || !data.length) {
      setBatchParsed([]);
      setRawParsed([]);
      setBatchColumns([]);
      setFieldMapping({});
      setTempDefaultValues({});
      return;
    }

    let initialMapping = guessFieldMapping(columns, hasHeader);

    if (hasHeader) {
      const mappedCount = Object.values(initialMapping).filter((v) => v && v !== '__ignore__').length;
      const totalRequired = BATCH_FIELDS.filter((f) => f.required).length;
      const requiredMapped = BATCH_FIELDS.filter((f) => f.required && Object.values(initialMapping).includes(f.key)).length;
      const mappedRatio = mappedCount / Math.max(columns.length, 1);

      if (mappedRatio < 0.4 || (totalRequired > 0 && requiredMapped < totalRequired)) {
        const orderMapping = fallbackOrderMapping(columns);
        const orderMappedCount = Object.values(orderMapping).filter((v) => v && v !== '__ignore__').length;
        if (orderMappedCount >= mappedCount) {
          initialMapping = orderMapping;
        }
      }
    }

    const initialDefaults = {};
    BATCH_FIELDS.forEach((f) => {
      if (queueConfig.defaultValues && queueConfig.defaultValues[f.key] !== undefined) {
        initialDefaults[f.key] = queueConfig.defaultValues[f.key];
      }
    });

    setBatchColumns(columns);
    setRawParsed(data);
    setFieldMapping(initialMapping);
    setTempDefaultValues(initialDefaults);

    const parsed = applyFieldMapping(data, columns, initialMapping, initialDefaults);
    setBatchParsed(parsed);
  }

  function handleFieldMappingChange(colIndex, fieldKey) {
    const newMapping = { ...fieldMapping, [colIndex]: fieldKey };
    setFieldMapping(newMapping);
    const parsed = applyFieldMapping(rawParsed, batchColumns, newMapping, tempDefaultValues);
    setBatchParsed(parsed);
  }

  function handleDefaultValueChange(fieldKey, value) {
    const newDefaults = { ...tempDefaultValues, [fieldKey]: value };
    setTempDefaultValues(newDefaults);
    const parsed = applyFieldMapping(rawParsed, batchColumns, fieldMapping, newDefaults);
    setBatchParsed(parsed);
  }

  function handleBatchConfirm() {
    const valid = batchParsed.filter((r) => !r._duplicate && !r._invalid);
    if (!valid.length) return;

    const now = new Date().toISOString();
    const primaryStatus = getPrimaryStatusName(queueConfig);
    const priorityField = queueConfig.priorityConfig?.fieldKey;
    const defaultPriority = queueConfig.priorityConfig?.order?.[queueConfig.priorityConfig.order.length - 1] || '常规';

    const newRecords = valid.map((r) => {
      const recordData = {};
      BATCH_FIELDS.forEach((field) => {
        const val = r[field.key];
        if (val !== undefined && val !== null) recordData[field.key] = val;
      });
      if (priorityField && !recordData[priorityField]) {
        recordData[priorityField] = defaultPriority;
      }
      return {
        id: uid(),
        ...recordData,
        status: r.status || primaryStatus,
        createdAt: now,
        timeline: [{ status: r.status || primaryStatus, at: today, by: '批量导入', changedAt: new Date().toISOString() }],
      };
    });

    persist([...newRecords, ...records]);
    setBatchOpen(false);
    setBatchRaw('');
    setBatchParsed([]);
    setRawParsed([]);
    setBatchColumns([]);
    setFieldMapping({});
    setTempDefaultValues({});
    setDetectedHeader(false);
  }

  function handleBatchClose() {
    setBatchOpen(false);
    setBatchRaw('');
    setBatchParsed([]);
    setRawParsed([]);
    setBatchColumns([]);
    setFieldMapping({});
    setTempDefaultValues({});
    setDetectedHeader(false);
  }

  function toggleCaseSelection(caseId) {
    const next = new Set(selectedCases);
    if (next.has(caseId)) {
      next.delete(caseId);
    } else {
      next.add(caseId);
    }
    setSelectedCases(next);
  }

  function toggleSelectAllVisible() {
    const visibleIds = allDispatchableCases.map((item) => item.id);
    const allSelected = visibleIds.every((id) => selectedCases.has(id));
    if (allSelected) {
      const next = new Set(selectedCases);
      visibleIds.forEach((id) => next.delete(id));
      setSelectedCases(next);
    } else {
      const next = new Set(selectedCases);
      visibleIds.forEach((id) => next.add(id));
      setSelectedCases(next);
    }
  }

  function clearSelection() {
    setSelectedCases(new Set());
    setSelectedDoctor('');
    setDispatchResult(null);
  }

  function handleDispatch() {
    if (selectedCases.size === 0) return;
    if (selectedDoctor === '__new__') {
      const newDoctor = prompt('请输入新医生姓名：');
      if (newDoctor && newDoctor.trim()) {
        setSelectedDoctor(newDoctor.trim());
        setShowDispatchConfirm(true);
      }
      return;
    }
    if (!selectedDoctor.trim()) return;
    setShowDispatchConfirm(true);
  }

  function confirmDispatch() {
    if (selectedCases.size === 0 || !selectedDoctor.trim()) {
      setShowDispatchConfirm(false);
      return;
    }

    const now = new Date().toISOString();
    const targetDoctor = selectedDoctor.trim();
    const success = [];
    const failed = [];
    const skipped = [];

    const primaryStatus = getPrimaryStatusName(queueConfig);
    const nonDispatchableStatuses = getStatusNames(queueConfig).filter(
      (s, idx) => idx > 0 && idx !== getStatusNames(queueConfig).indexOf(primaryStatus)
    );
    const terminalStatuses = queueConfig.statuses.filter((s) => s.terminal).map((s) => s.name);
    const caseNoField = queueConfig.cardDisplay?.titleField || 'caseNo';
    const doctorField = queueConfig.fields.find((f) => f.label.includes('医生'))?.key || 'doctor';

    const next = records.map((item) => {
      if (!selectedCases.has(item.id)) return item;

      const itemDoctor = item[doctorField];
      if (itemDoctor && String(itemDoctor).trim() === targetDoctor && !terminalStatuses.includes(item.status)) {
        skipped.push({
          caseNo: item[caseNoField] || item.id,
          reason: `已由${targetDoctor}负责`
        });
        return item;
      }

      if (nonDispatchableStatuses.includes(item.status) || terminalStatuses.includes(item.status)) {
        skipped.push({
          caseNo: item[caseNoField] || item.id,
          reason: `当前状态为「${item.status}」，不可重新派单`
        });
        return item;
      }

      try {
        const updatedItem = {
          ...item,
          [doctorField]: targetDoctor,
          timeline: [
            ...(item.timeline || []),
            {
              status: '派单',
              at: today,
              by: '调度员',
              changedAt: now,
              action: 'assign',
              fromDoctor: itemDoctor || '未分配',
              toDoctor: targetDoctor
            }
          ]
        };
        success.push({ caseNo: item[caseNoField] || item.id });
        return updatedItem;
      } catch (error) {
        failed.push({
          caseNo: item[caseNoField] || item.id,
          reason: error.message || '系统错误'
        });
        return item;
      }
    });

    persist(next);

    setDispatchResult({
      success: success.length,
      failed: failed.length,
      skipped: skipped.length,
      successList: success,
      failedList: failed,
      skippedList: skipped,
      targetDoctor
    });

    if (success.length > 0) {
      const successIds = new Set(success.map((s) => s.caseNo));
      const remaining = new Set(selectedCases);
      records.forEach((item) => {
        if (successIds.has(item[caseNoField])) {
          remaining.delete(item.id);
        }
      });
      setSelectedCases(remaining);
    }

    setShowDispatchConfirm(false);
  }

  function cancelDispatch() {
    setShowDispatchConfirm(false);
  }

  function handleViewChange(view) {
    setActiveView(view);
    setSelectedCases(new Set());
    setSelectedDoctor('');
    setDispatchResult(null);
    setDispatchFilters({ query: '', priority: '全部', sampleType: '全部' });
    setSelectedBorrowForDetail(null);
    setSelectedNotifyForDetail(null);
    setNotifyFilters({ query: '', status: '全部', priority: '全部' });
    setPhraseFilters({ query: '', sampleType: '全部' });
    setEditingPhrase(null);
    setPhraseDeleteConfirm(null);
  }

  function persist(next) {
    setRecords(next);
    if (tabSyncRef.current) {
      tabSyncRef.current.persist(next);
    }
  }

  function persistBorrows(next) {
    setSlideBorrows(next);
    localStorage.setItem(SLIDE_BORROW_STORAGE, JSON.stringify(next));
  }

  function persistCriticalNotifies(next) {
    setCriticalNotifies(next);
    persistNotifies(next);
  }

  function handleConflictResolve(strategy) {
    if (!conflictInfo || !tabSyncRef.current) return;
    const resolved = tabSyncRef.current.resolve(strategy);
    setRecords(resolved);
    setSelected((prevSelected) => {
      if (!prevSelected) return null;
      const updatedSelected = resolved.find((r) => r.id === prevSelected.id);
      return updatedSelected || null;
    });
    setConflictInfo(null);
    setShowConflictModal(false);
  }

  function handlePhrasesPersist(next) {
    setPhrases(next);
    persistPhrases(next);
  }

  function openPhraseModal(item = null) {
    if (item) {
      setEditingPhrase(item);
      setPhraseForm({
        phrase: item.phrase || '',
        sampleType: item.sampleType || '穿刺',
        useCount: item.useCount || 0,
        lastUsedAt: item.lastUsedAt || ''
      });
    } else {
      setEditingPhrase(null);
      setPhraseForm({
        phrase: '',
        sampleType: '穿刺',
        useCount: 0,
        lastUsedAt: ''
      });
    }
    setShowPhraseModal(true);
  }

  function closePhraseModal() {
    setShowPhraseModal(false);
    setEditingPhrase(null);
  }

  function handlePhraseSubmit(e) {
    e.preventDefault();
    if (!phraseForm.phrase.trim()) return;

    const now = new Date().toISOString();
    if (editingPhrase) {
      const next = phrases.map((item) =>
        item.id === editingPhrase.id
          ? {
              ...item,
              phrase: phraseForm.phrase.trim(),
              sampleType: phraseForm.sampleType,
              updatedAt: now
            }
          : item
      );
      handlePhrasesPersist(next);
    } else {
      const newPhrase = {
        id: uid(),
        phrase: phraseForm.phrase.trim(),
        sampleType: phraseForm.sampleType,
        useCount: 0,
        lastUsedAt: '',
        pinned: false,
        pinnedAt: '',
        createdAt: now
      };
      handlePhrasesPersist([newPhrase, ...phrases]);
    }
    closePhraseModal();
  }

  function confirmDeletePhrase(id) {
    setPhraseDeleteConfirm(id);
  }

  function cancelDeletePhrase() {
    setPhraseDeleteConfirm(null);
  }

  function removePhrase(id) {
    const next = phrases.filter((item) => item.id !== id);
    handlePhrasesPersist(next);
    setPhraseDeleteConfirm(null);
  }

  function recordPhraseUsage(id) {
    const now = new Date().toISOString();
    const next = phrases.map((item) =>
      item.id === id
        ? {
            ...item,
            useCount: (item.useCount || 0) + 1,
            lastUsedAt: now
          }
        : item
    );
    handlePhrasesPersist(next);
  }

  function togglePhrasePin(id) {
    const now = new Date().toISOString();
    const next = phrases.map((item) =>
      item.id === id
        ? {
            ...item,
            pinned: !item.pinned,
            pinnedAt: !item.pinned ? now : ''
          }
        : item
    );
    handlePhrasesPersist(next);
  }

  function openPhrasePicker(target) {
    setPhrasePickerTarget(target);
    setShowPhrasePicker(true);
  }

  function closePhrasePicker() {
    setShowPhrasePicker(false);
    setPhrasePickerTarget(null);
  }

  function applyPhrase(phraseItem) {
    if (!phrasePickerTarget || !selected) {
      closePhrasePicker();
      return;
    }

    recordPhraseUsage(phraseItem.id);

    if (phrasePickerTarget === 'summary') {
      const currentSummary = selected.summary || '';
      const newSummary = currentSummary
        ? currentSummary + '\n' + phraseItem.phrase
        : phraseItem.phrase;

      const next = records.map((item) =>
        item.id === selected.id
          ? { ...item, summary: newSummary }
          : item
      );
      persist(next);
      setSelected(next.find((item) => item.id === selected.id));
    } else if (phrasePickerTarget === 'review') {
      const currentRemark = reviewForm.remark || '';
      const newRemark = currentRemark
        ? currentRemark + '\n' + phraseItem.phrase
        : phraseItem.phrase;
      setReviewForm({ ...reviewForm, remark: newRemark });
    }

    closePhrasePicker();
  }

  function openNotifyModal(caseItem = null) {
    if (caseItem) {
      const defaultReason = caseItem.priority === '危急' ? '危急病例' : (caseItem.status === '待复核' ? '进入待复核' : '危急病例');
      setNotifyForm({
        caseId: caseItem.id || '',
        caseNo: caseItem.caseNo || '',
        notifyTarget: caseItem.doctor || '',
        notifyMethod: '电话',
        sentAt: new Date().toISOString().slice(0, 16),
        triggerReason: defaultReason,
        remark: ''
      });
      setNotifyDuplicateWarning('');
    } else {
      setNotifyForm({
        caseId: '',
        caseNo: '',
        notifyTarget: '',
        notifyMethod: '电话',
        sentAt: new Date().toISOString().slice(0, 16),
        triggerReason: '危急病例',
        remark: ''
      });
      setNotifyDuplicateWarning('');
    }
    setShowNotifyModal(true);
  }

  function closeNotifyModal() {
    setShowNotifyModal(false);
    setNotifyDuplicateWarning('');
  }

  function checkNotifyDuplicate() {
    if (!notifyForm.caseNo || !notifyForm.notifyTarget) {
      setNotifyDuplicateWarning('');
      return false;
    }
    const isDuplicate = hasDuplicateUnconfirmedNotify(
      notifyForm.caseId,
      notifyForm.caseNo,
      notifyForm.notifyTarget,
      criticalNotifies
    );
    if (isDuplicate) {
      setNotifyDuplicateWarning(`该病例在${NOTIFY_DUPLICATE_WINDOW_MINUTES}分钟内已存在对「${notifyForm.notifyTarget}」的未确认通知，请勿重复发送`);
    } else {
      setNotifyDuplicateWarning('');
    }
    return isDuplicate;
  }

  function handleNotifySubmit(e) {
    e.preventDefault();
    if (!notifyForm.caseNo.trim() || !notifyForm.notifyTarget.trim() || !notifyForm.sentAt) {
      return;
    }
    if (checkNotifyDuplicate()) {
      return;
    }
    const now = new Date().toISOString();
    const caseNo = notifyForm.caseNo.trim();
    const caseRecord = records.find((r) => r.caseNo === caseNo);
    if (!isCriticalNotifyEligible(queueConfig, caseRecord)) {
      setNotifyDuplicateWarning('仅支持为优先级为「危急」或状态为「待复核」的病例创建通知，请先选择符合条件的病例');
      return;
    }
    const priority = caseRecord?.priority || '常规';
    const newNotify = {
      id: uid(),
      caseId: caseRecord.id,
      caseNo,
      notifyTarget: notifyForm.notifyTarget.trim(),
      notifyMethod: notifyForm.notifyMethod,
      sentAt: notifyForm.sentAt,
      confirmedAt: '',
      confirmedBy: '',
      remark: notifyForm.remark.trim(),
      triggerReason: notifyForm.triggerReason,
      priority,
      createdAt: now
    };
    persistCriticalNotifies([newNotify, ...criticalNotifies]);
    if (caseRecord) {
      const updatedRecords = records.map((item) => {
        if (item.id === caseRecord.id) {
          return {
            ...item,
            timeline: [
              ...(item.timeline || []),
              {
                type: 'critical-notify-sent',
                event: '通知发送',
                at: formatDateShort(notifyForm.sentAt),
                by: '系统',
                changedAt: notifyForm.sentAt,
                notifyId: newNotify.id,
                notifyTarget: newNotify.notifyTarget,
                notifyMethod: newNotify.notifyMethod,
                triggerReason: newNotify.triggerReason
              }
            ]
          };
        }
        return item;
      });
      persist(updatedRecords);
      if (selected?.id === caseRecord.id) {
        setSelected(updatedRecords.find((r) => r.id === caseRecord.id));
      }
    }
    closeNotifyModal();
  }

  function confirmNotify(notifyItem, confirmedBy = '') {
    const now = new Date().toISOString();
    const confirmer = confirmedBy.trim() || notifyItem.notifyTarget;
    const nextNotifies = criticalNotifies.map((n) =>
      n.id === notifyItem.id
        ? { ...n, confirmedAt: now, confirmedBy: confirmer, status: CRITICAL_NOTIFY_STATUS.CONFIRMED }
        : n
    );
    persistCriticalNotifies(nextNotifies);
    const caseRecord = records.find((r) => r.id === notifyItem.caseId || r.caseNo === notifyItem.caseNo);
    if (caseRecord) {
      const updatedRecords = records.map((item) => {
        if (item.id === caseRecord.id) {
          return {
            ...item,
            timeline: [
              ...(item.timeline || []),
              {
                type: 'critical-notify-confirmed',
                event: '通知确认',
                at: formatDateShort(now),
                by: confirmer,
                changedAt: now,
                notifyId: notifyItem.id,
                notifyTarget: notifyItem.notifyTarget,
                notifyMethod: notifyItem.notifyMethod
              }
            ]
          };
        }
        return item;
      });
      persist(updatedRecords);
      if (selected?.id === caseRecord.id) {
        setSelected(updatedRecords.find((r) => r.id === caseRecord.id));
      }
    }
  }

  function removeNotifyRecord(id) {
    const next = criticalNotifies.filter((item) => item.id !== id);
    persistCriticalNotifies(next);
    if (selectedNotifyForDetail?.id === id) {
      setSelectedNotifyForDetail(null);
    }
  }

  function openEscalateModal(notifyItem) {
    if (!canEscalateNotify(notifyItem)) return;
    const initialForm = {
      escalateTarget: '科室主任',
      notifyMethod: '电话',
      sentAt: formatDateTimeInput(),
      remark: `原通知对象「${notifyItem.notifyTarget}」未在规定时间内确认，已升级通知。`
    };
    setEscalateSourceNotify(notifyItem);
    setEscalateForm(initialForm);
    const latestNotifies = loadLatestCriticalNotifies();
    const isDup = hasRecentEscalation(
      notifyItem.caseId,
      notifyItem.caseNo,
      initialForm.escalateTarget,
      latestNotifies
    );
    if (isDup) {
      setEscalateWarning(`该病例在${NOTIFY_ESCALATE_WINDOW_MINUTES}分钟内已向「${initialForm.escalateTarget}」发送过升级通知，请勿重复升级`);
    } else {
      setEscalateWarning('');
    }
    setShowEscalateModal(true);
  }

  function closeEscalateModal() {
    setShowEscalateModal(false);
    setEscalateSourceNotify(null);
    setEscalateWarning('');
  }

  function checkEscalateDuplicate() {
    if (!escalateSourceNotify || !escalateForm.escalateTarget) {
      setEscalateWarning('');
      return false;
    }
    const latestNotifies = loadLatestCriticalNotifies();
    const isDuplicate = hasRecentEscalation(
      escalateSourceNotify.caseId,
      escalateSourceNotify.caseNo,
      escalateForm.escalateTarget,
      latestNotifies
    );
    if (isDuplicate) {
      setEscalateWarning(`该病例在${NOTIFY_ESCALATE_WINDOW_MINUTES}分钟内已向「${escalateForm.escalateTarget}」发送过升级通知，请勿重复升级`);
    } else {
      setEscalateWarning('');
    }
    return isDuplicate;
  }

  function handleEscalateSubmit(e) {
    e.preventDefault();
    if (!escalateSourceNotify) return;
    if (!escalateForm.escalateTarget.trim() || !escalateForm.sentAt) return;

    const latestNotifies = loadLatestCriticalNotifies();
    const isDuplicate = hasRecentEscalation(
      escalateSourceNotify.caseId,
      escalateSourceNotify.caseNo,
      escalateForm.escalateTarget,
      latestNotifies
    );
    if (isDuplicate) {
      setEscalateWarning(`该病例在${NOTIFY_ESCALATE_WINDOW_MINUTES}分钟内已向「${escalateForm.escalateTarget}」发送过升级通知，请勿重复升级`);
      return;
    }

    const now = new Date().toISOString();
    const caseNo = escalateSourceNotify.caseNo;
    const caseRecord = records.find((r) => r.caseNo === caseNo || r.id === escalateSourceNotify.caseId);
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

    const nextNotifies = [newEscalateNotify, ...criticalNotifies];
    persistCriticalNotifies(nextNotifies);

    if (caseRecord) {
      const updatedRecords = records.map((item) => {
        if (item.id === caseRecord.id) {
          return {
            ...item,
            timeline: [
              ...(item.timeline || []),
              {
                type: 'critical-notify-escalated',
                event: '通知升级',
                at: formatDateShort(escalateForm.sentAt),
                by: '系统',
                changedAt: escalateForm.sentAt,
                notifyId: newEscalateNotify.id,
                parentNotifyId: escalateSourceNotify.id,
                notifyTarget: newEscalateNotify.notifyTarget,
                notifyMethod: newEscalateNotify.notifyMethod,
                fromTarget: escalateSourceNotify.notifyTarget,
                triggerReason: '通知升级'
              }
            ]
          };
        }
        return item;
      });
      persist(updatedRecords);
      if (selected?.id === caseRecord.id) {
        setSelected(updatedRecords.find((r) => r.id === caseRecord.id));
      }
    }
    closeEscalateModal();
  }

  function getCaseNotifies(caseNo, caseId) {
    return criticalNotifies.filter((n) =>
      (caseId && n.caseId === caseId) || (caseNo && n.caseNo === caseNo)
    );
  }

  const filteredNotifies = useMemo(() => {
    void tick;
    return criticalNotifies
      .filter((item) => {
        const realStatus = calcNotifyStatus(item);
        if (notifyFilters.status !== '全部' && realStatus !== notifyFilters.status) {
          return false;
        }
        if (notifyFilters.priority !== '全部' && item.priority !== notifyFilters.priority) {
          return false;
        }
        if (notifyFilters.query) {
          const q = notifyFilters.query.toLowerCase();
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
  }, [criticalNotifies, notifyFilters, tick]);

  const filteredPhrases = useMemo(() => {
    return phrases
      .filter((item) => {
        if (phraseFilters.sampleType !== '全部' && item.sampleType !== phraseFilters.sampleType) {
          return false;
        }
        if (phraseFilters.query) {
          const q = phraseFilters.query.toLowerCase();
          return item.phrase.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) {
          const pinA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
          const pinB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
          return pinB - pinA;
        }
        if (a.lastUsedAt && b.lastUsedAt) {
          return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
        }
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return (b.useCount || 0) - (a.useCount || 0);
      });
  }, [phrases, phraseFilters]);

  const phraseStats = useMemo(() => {
    let total = phrases.length;
    let totalUsed = phrases.filter((p) => (p.useCount || 0) > 0).length;
    let totalUseCount = phrases.reduce((sum, p) => sum + (p.useCount || 0), 0);
    return { total, totalUsed, totalUseCount };
  }, [phrases]);

  const notifyStats = useMemo(() => {
    void tick;
    let total = criticalNotifies.length;
    let pending = 0;
    let confirmed = 0;
    let expired = 0;
    let overduePending = 0;
    criticalNotifies.forEach((item) => {
      const status = calcNotifyStatus(item);
      if (status === CRITICAL_NOTIFY_STATUS.PENDING) pending++;
      if (status === CRITICAL_NOTIFY_STATUS.CONFIRMED) confirmed++;
      if (status === CRITICAL_NOTIFY_STATUS.EXPIRED) expired++;
      if (status === CRITICAL_NOTIFY_STATUS.PENDING && isNotifyOverdue(item)) overduePending++;
    });
    return { total, pending, confirmed, expired, overduePending };
  }, [criticalNotifies, tick]);

  const notifyStatusClass = (status) => {
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
  };

  const notifyMethodIcon = (method) => {
    switch (method) {
      case '电话': return Phone;
      case '短信': return MessageSquare;
      case '微信': return MessageSquare;
      case '系统消息': return Radio;
      case '现场通知': return HandHeart;
      default: return Bell;
    }
  };

  function openBorrowModal(item = null) {
    if (item) {
      setEditingBorrow(item);
      setBorrowForm({
        caseNo: item.caseNo || '',
        borrower: item.borrower || '',
        department: item.department || '病理科',
        borrowTime: item.borrowTime || '',
        receiveTime: item.receiveTime || '',
        expectedReturnTime: item.expectedReturnTime || '',
        actualReturnTime: item.actualReturnTime || '',
        remark: item.remark || ''
      });
    } else {
      setEditingBorrow(null);
      setBorrowForm({
        caseNo: '',
        borrower: '',
        department: '病理科',
        borrowTime: new Date().toISOString().slice(0, 16),
        receiveTime: '',
        expectedReturnTime: '',
        actualReturnTime: '',
        remark: ''
      });
    }
    setShowBorrowModal(true);
  }

  function closeBorrowModal() {
    setShowBorrowModal(false);
    setEditingBorrow(null);
  }

  function handleBorrowSubmit(e) {
    e.preventDefault();
    if (!borrowForm.caseNo.trim() || !borrowForm.borrower.trim() || !borrowForm.borrowTime || !borrowForm.expectedReturnTime) {
      return;
    }

    const now = new Date().toISOString();
    let newStatus = SLIDE_BORROW_STATUS.BORROWED;
    if (borrowForm.actualReturnTime) {
      newStatus = SLIDE_BORROW_STATUS.RETURNED;
    } else if (borrowForm.receiveTime) {
      newStatus = SLIDE_BORROW_STATUS.RECEIVED;
    }

    const timeline = [];
    if (borrowForm.borrowTime) {
      timeline.push({
        type: 'slide-borrow',
        event: '玻片借出',
        at: formatDateShort(borrowForm.borrowTime),
        by: borrowForm.borrower,
        changedAt: borrowForm.borrowTime,
        department: borrowForm.department
      });
    }
    if (borrowForm.receiveTime) {
      timeline.push({
        type: 'slide-receive',
        event: '玻片接收',
        at: formatDateShort(borrowForm.receiveTime),
        by: borrowForm.borrower,
        changedAt: borrowForm.receiveTime
      });
    }
    if (borrowForm.actualReturnTime) {
      timeline.push({
        type: 'slide-return',
        event: '玻片归还',
        at: formatDateShort(borrowForm.actualReturnTime),
        by: '病理科',
        changedAt: borrowForm.actualReturnTime
      });
    }

    if (editingBorrow) {
      const next = slideBorrows.map((item) =>
        item.id === editingBorrow.id
          ? {
              ...item,
              ...borrowForm,
              status: newStatus,
              timeline,
              updatedAt: now
            }
          : item
      );
      persistBorrows(next);
    } else {
      const newRecord = {
        id: uid(),
        ...borrowForm,
        status: newStatus,
        timeline,
        createdAt: now
      };
      persistBorrows([newRecord, ...slideBorrows]);
    }

    closeBorrowModal();
  }

  function handleReturnSlide(item) {
    const now = new Date().toISOString();
    const returnTime = now;
    const next = slideBorrows.map((b) =>
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
    persistBorrows(next);
  }

  function handleReceiveSlide(item) {
    const now = new Date().toISOString();
    const next = slideBorrows.map((b) =>
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
    persistBorrows(next);
  }

  function removeBorrowRecord(id) {
    const next = slideBorrows.filter((item) => item.id !== id);
    persistBorrows(next);
  }

  const filteredSlideBorrows = useMemo(() => {
    void tick;
    return slideBorrows
      .filter((item) => {
        const realStatus = calcBorrowStatus(item);
        if (slideBorrowFilters.status !== '全部' && realStatus !== slideBorrowFilters.status) {
          return false;
        }
        if (slideBorrowFilters.department !== '全部' && item.department !== slideBorrowFilters.department) {
          return false;
        }
        if (slideBorrowFilters.query) {
          const q = slideBorrowFilters.query.toLowerCase();
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
  }, [slideBorrows, slideBorrowFilters, tick]);

  const borrowStats = useMemo(() => {
    void tick;
    let total = slideBorrows.length;
    let borrowed = 0;
    let received = 0;
    let returned = 0;
    let soonOverdue = 0;
    let overdue = 0;

    slideBorrows.forEach((item) => {
      const status = calcBorrowStatus(item);
      if (status === SLIDE_BORROW_STATUS.BORROWED) borrowed++;
      if (status === SLIDE_BORROW_STATUS.RECEIVED) received++;
      if (status === SLIDE_BORROW_STATUS.RETURNED) returned++;
      if (status === SLIDE_BORROW_STATUS.SOON_OVERDUE) soonOverdue++;
      if (status === SLIDE_BORROW_STATUS.OVERDUE) overdue++;
    });

    return { total, borrowed, received, returned, soonOverdue, overdue, unreturned: borrowed + received + soonOverdue + overdue };
  }, [slideBorrows, tick]);

  const departmentList = useMemo(() => {
    const depts = new Set(DEFAULT_DEPARTMENTS);
    slideBorrows.forEach((item) => {
      if (item.department) depts.add(item.department);
    });
    return Array.from(depts).sort();
  }, [slideBorrows]);

  const getCaseBorrowRecords = useMemo(() => {
    return (caseNo) => {
      return slideBorrows.filter((b) => b.caseNo === caseNo);
    };
  }, [slideBorrows]);

  const getMergedTimeline = useMemo(() => {
    void tick;
    return (record) => {
      if (!record) return [];
      const caseBorrows = Array.isArray(slideBorrows) ? slideBorrows.filter((b) => b && b.caseNo === record.caseNo) : [];
      const merged = [];

      (record.timeline || []).forEach((step) => {
        if (step) {
          merged.push({
            ...step,
            type: step.type !== undefined ? step.type : 'review-status',
            sortTime: new Date(step.changedAt || step.at).getTime()
          });
        }
      });

      caseBorrows.forEach((borrow) => {
        if (borrow) {
          const borrowEvents = getFullBorrowTimeline(borrow) || [];
          borrowEvents.forEach((event) => {
            if (event) {
              merged.push({
                ...event,
                borrowId: borrow.id,
                borrower: borrow.borrower,
                sortTime: new Date(event.changedAt || event.at).getTime()
              });
            }
          });
        }
      });

      return merged.sort((a, b) => a.sortTime - b.sortTime);
    };
  }, [slideBorrows, tick]);

  const getMergedTimelineWithNotify = useMemo(() => {
    void tick;
    return (record) => {
      if (!record) return [];
      const baseTimeline = getMergedTimeline(record);
      const caseNotifies = getCaseNotifies(record.caseNo, record.id);
      const extraEvents = [];
      caseNotifies.forEach((notify) => {
        const hasSent = baseTimeline.some((t) => t.notifyId === notify.id && t.type === 'critical-notify-sent');
        const hasConfirmed = baseTimeline.some((t) => t.notifyId === notify.id && t.type === 'critical-notify-confirmed');
        const hasEscalated = baseTimeline.some((t) => t.notifyId === notify.id && t.type === 'critical-notify-escalated');
        if (!hasSent) {
          extraEvents.push({
            type: 'critical-notify-sent',
            event: notify.isEscalation ? '升级通知发送' : '通知发送',
            at: formatDateShort(notify.sentAt || notify.createdAt),
            by: '系统',
            changedAt: notify.sentAt || notify.createdAt,
            notifyId: notify.id,
            parentNotifyId: notify.parentNotifyId,
            notifyTarget: notify.notifyTarget,
            notifyMethod: notify.notifyMethod,
            triggerReason: notify.triggerReason,
            isEscalation: !!notify.isEscalation,
            sortTime: new Date(notify.sentAt || notify.createdAt).getTime()
          });
        }
        if (notify.isEscalation && !hasEscalated && notify.parentNotifyId) {
          const sourceNotify = caseNotifies.find((n) => n.id === notify.parentNotifyId);
          extraEvents.push({
            type: 'critical-notify-escalated',
            event: '通知升级',
            at: formatDateShort(notify.sentAt || notify.createdAt),
            by: '系统',
            changedAt: notify.sentAt || notify.createdAt,
            notifyId: notify.id,
            parentNotifyId: notify.parentNotifyId,
            notifyTarget: notify.notifyTarget,
            notifyMethod: notify.notifyMethod,
            fromTarget: sourceNotify?.notifyTarget,
            triggerReason: '通知升级',
            sortTime: new Date(notify.sentAt || notify.createdAt).getTime() - 1
          });
        }
        if (notify.confirmedAt && !hasConfirmed) {
          extraEvents.push({
            type: 'critical-notify-confirmed',
            event: notify.isEscalation ? '升级通知确认' : '通知确认',
            at: formatDateShort(notify.confirmedAt),
            by: notify.confirmedBy || notify.notifyTarget,
            changedAt: notify.confirmedAt,
            notifyId: notify.id,
            notifyTarget: notify.notifyTarget,
            notifyMethod: notify.notifyMethod,
            isEscalation: !!notify.isEscalation,
            sortTime: new Date(notify.confirmedAt).getTime()
          });
        }
      });
      const merged = [...baseTimeline, ...extraEvents];
      return merged.sort((a, b) => a.sortTime - b.sortTime);
    };
  }, [criticalNotifies, tick, getMergedTimeline, records]);

  function addRecord(event) {
    event.preventDefault();
    const primaryStatus = getPrimaryStatusName(queueConfig);
    const nextRecord = {
      id: uid(),
      ...form,
      status: form.status || primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || primaryStatus, at: today, by: '录入', changedAt: new Date().toISOString() }]
    };

    persist([nextRecord, ...records]);
    setForm({
      ...queueConfig.defaultValues,
      status: primaryStatus
    });
    setSelected(nextRecord);
  }

  function updateStatus(id, status, noteInfo) {
    const now = new Date().toISOString();
    const next = records.map((item) => {
      if (item.id === id) {
        const timelineEntry = { status, at: today, by: '操作员', changedAt: now };
        if (noteInfo && noteInfo.noteText) {
          timelineEntry.note = noteInfo.noteText;
          timelineEntry.noteBy = noteInfo.noteBy || '操作员';
        }
        return {
          ...item,
          status,
          timeline: [...(item.timeline || []), timelineEntry]
        };
      }
      return item;
    });
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function addNote(recordId, noteText, noteBy) {
    if (!noteText?.trim()) return;
    const now = new Date().toISOString();
    const next = records.map((item) => {
      if (item.id === recordId) {
        return {
          ...item,
          timeline: [...(item.timeline || []), {
            type: 'case-note',
            event: '关键事件备注',
            note: noteText.trim(),
            noteBy: noteBy?.trim() || '医生',
            at: today,
            by: noteBy?.trim() || '医生',
            changedAt: now
          }]
        };
      }
      return item;
    });
    persist(next);
    if (selected?.id === recordId) setSelected(next.find((item) => item.id === recordId));
  }

  function handleNoteSubmit(e) {
    e.preventDefault();
    if (!selected || !noteForm.noteText.trim()) return;
    addNote(selected.id, noteForm.noteText, noteForm.noteBy);
    setNoteForm({ noteText: '', noteBy: '' });
    setNoteAdding(false);
  }

  function handleNoteCancel() {
    setNoteForm({ noteText: '', noteBy: '' });
    setNoteAdding(false);
  }

  function handleStatusNoteSubmit(e, id, status) {
    e.preventDefault();
    if (!noteForm.noteText.trim()) {
      updateStatus(id, status);
    } else {
      updateStatus(id, status, { noteText: noteForm.noteText, noteBy: noteForm.noteBy });
    }
    setNoteForm({ noteText: '', noteBy: '' });
    setStatusNoteAdding(null);
  }

  function handleStatusNoteCancel() {
    setNoteForm({ noteText: '', noteBy: '' });
    setStatusNoteAdding(null);
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const primaryStatus = getPrimaryStatusName(queueConfig);
    const copied = { ...item, id: uid(), status: primaryStatus, timeline: [{ status: primaryStatus, at: today, by: '复制', changedAt: new Date().toISOString() }] };
    persist([copied, ...records]);
    setSelected(copied);
  }

  function addTemperature(item) {
    const value = Number(prompt('录入新的温度读数'));
    if (!Number.isFinite(value)) return;
    const next = records.map((record) => record.id === item.id ? {
      ...record,
      temps: [...(record.temps || []), value],
      temperature: String(value),
      status: value > 2 ? '异常' : record.status
    } : record);
    persist(next);
    setSelected(next.find((record) => record.id === item.id));
  }

  const filteredRecords = useMemo(() => {
    const sortFn = buildSortFnFromConfig(queueConfig);
    const filtered = applyFiltersFromConfig(records, queueConfig, filters);
    return filtered.sort(sortFn);
  }, [records, filters, queueConfig]);

  const metrics = useMemo(() => {
    return (queueConfig.metrics || [])
      .filter((m) => m.enabled)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((metric) => ({
        label: metric.label,
        value: evaluateMetric(metric, records)
      }));
  }, [records, queueConfig.metrics]);

  const groupedByDate = useMemo(() => {
    const dateField = queueConfig.fields?.find((f) => f.dateKey)?.key || 'sentAt';
    return filteredRecords.reduce((acc, item) => {
      const key = item[dateField] || item.date || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords, queueConfig.fields]);

  const directory = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.issue || '未分类';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  const workbenchGroups = useMemo(() => {
    void tick;
    const statuses = queueConfig.statuses || [];
    const dateField = queueConfig.fields?.find((f) => f.dateKey)?.key || 'sentAt';
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    const primaryStatus = getPrimaryStatusName(queueConfig);
    return statuses
      .filter((s) => !s.terminal)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((statusDef) => ({
        id: statusDef.id,
        status: statusDef.name,
        color: statusDef.color,
        icon: statusDef.icon,
        items: records
          .filter((item) => item.status === statusDef.name)
          .sort((a, b) => {
            if (statusDef.name === primaryStatus) {
              const rankDiff = priorityRank(queueConfig, a[priorityField]) - priorityRank(queueConfig, b[priorityField]);
              if (rankDiff !== 0) return rankDiff;
            }
            const aTime = a[dateField] || a.createdAt || '';
            const bTime = b[dateField] || b.createdAt || '';
            return String(aTime).localeCompare(String(bTime));
          }),
      }));
  }, [records, tick, queueConfig]);

  const doctorList = useMemo(() => {
    const doctors = new Set();
    const doctorField = queueConfig.fields?.find((f) => f.key === 'doctor')?.key || 'doctor';
    records.forEach((item) => {
      if (item[doctorField]) doctors.add(item[doctorField]);
    });
    return Array.from(doctors).sort();
  }, [records, queueConfig]);

  const sampleTypeList = useMemo(() => {
    const types = new Set();
    const sampleField = queueConfig.fields?.find((f) => f.key === 'sampleType')?.key || 'sampleType';
    records.forEach((item) => {
      if (item[sampleField]) types.add(item[sampleField]);
    });
    return Array.from(types).sort();
  }, [records, queueConfig]);

  const doctorWorkload = useMemo(() => {
    void tick;
    const statusNames = getStatusNames(queueConfig);
    const doctorField = queueConfig.fields?.find((f) => f.key === 'doctor')?.key || 'doctor';
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    const dateField = queueConfig.fields?.find((f) => f.dateKey)?.key || 'sentAt';
    const terminalStatuses = queueConfig.statuses.filter((s) => s.terminal).map((s) => s.name);
    const workload = {};
    records.forEach((item) => {
      if (!item[doctorField]) return;
      if (!workload[item[doctorField]]) {
        workload[item[doctorField]] = {
          doctor: item[doctorField],
          pending: 0,
          reading: 0,
          reviewing: 0,
          completed: 0,
          total: 0,
          incomplete: 0,
          urgentCritical: 0,
          earliestSentAt: null,
          cases: []
        };
      }
      workload[item[doctorField]].total++;
      workload[item[doctorField]].cases.push(item);
      const status = item.status;
      if (status === statusNames[0]) workload[item[doctorField]].pending++;
      else if (status === statusNames[1]) workload[item[doctorField]].reading++;
      else if (status === statusNames[2]) workload[item[doctorField]].reviewing++;
      else if (status === statusNames[3]) workload[item[doctorField]].completed++;

      const isIncomplete = !terminalStatuses.includes(status);
      if (isIncomplete) {
        workload[item[doctorField]].incomplete++;

        const priority = item[priorityField];
        if (priority === '危急' || priority === '加急') {
          workload[item[doctorField]].urgentCritical++;
        }

        const sentTimeStr = item[dateField] || item.sentAt || item.createdAt;
        if (sentTimeStr) {
          const sentTime = new Date(sentTimeStr).getTime();
          if (Number.isFinite(sentTime)) {
            if (!workload[item[doctorField]].earliestSentAt || sentTime < new Date(workload[item[doctorField]].earliestSentAt).getTime()) {
              workload[item[doctorField]].earliestSentAt = sentTimeStr;
            }
          }
        }
      }
    });
    return Object.values(workload).sort((a, b) => b.total - a.total);
  }, [records, tick, queueConfig]);

  const unassignedCases = useMemo(() => {
    void tick;
    const dateField = queueConfig.fields?.find((f) => f.dateKey)?.key || 'sentAt';
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    const doctorField = queueConfig.fields?.find((f) => f.key === 'doctor')?.key || 'doctor';
    const caseNoField = queueConfig.fields?.find((f) => f.key === 'caseNo')?.key || 'caseNo';
    const summaryField = queueConfig.cardDisplay?.detailField || 'summary';
    const searchFields = [caseNoField, summaryField, doctorField];
    const sampleField = queueConfig.fields?.find((f) => f.key === 'sampleType')?.key || 'sampleType';

    return records
      .filter((item) => !item[doctorField] || String(item[doctorField]).trim() === '')
      .filter((item) => {
        if (!dispatchFilters.query) return true;
        const q = String(dispatchFilters.query).toLowerCase();
        return searchFields.some((f) => String(item?.[f] ?? '').toLowerCase().includes(q));
      })
      .filter((item) => dispatchFilters.priority === '全部' || item[priorityField] === dispatchFilters.priority)
      .filter((item) => dispatchFilters.sampleType === '全部' || item[sampleField] === dispatchFilters.sampleType)
      .sort((a, b) => {
        const rankDiff = priorityRank(queueConfig, a[priorityField]) - priorityRank(queueConfig, b[priorityField]);
        if (rankDiff !== 0) return rankDiff;
        const aTime = a[dateField] || a.createdAt || '';
        const bTime = b[dateField] || b.createdAt || '';
        return String(aTime).localeCompare(String(bTime));
      });
  }, [records, dispatchFilters, tick, queueConfig]);

  const pendingReassignCases = useMemo(() => {
    void tick;
    const dateField = queueConfig.fields?.find((f) => f.dateKey)?.key || 'sentAt';
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    const doctorField = queueConfig.fields?.find((f) => f.key === 'doctor')?.key || 'doctor';
    const caseNoField = queueConfig.fields?.find((f) => f.key === 'caseNo')?.key || 'caseNo';
    const summaryField = queueConfig.cardDisplay?.detailField || 'summary';
    const primaryStatus = getPrimaryStatusName(queueConfig);
    const searchFields = [caseNoField, doctorField, summaryField];
    const sampleField = queueConfig.fields?.find((f) => f.key === 'sampleType')?.key || 'sampleType';

    return records
      .filter((item) => item[doctorField] && item.status === primaryStatus)
      .filter((item) => {
        if (!dispatchFilters.query) return true;
        const q = String(dispatchFilters.query).toLowerCase();
        return searchFields.some((f) => String(item?.[f] ?? '').toLowerCase().includes(q));
      })
      .filter((item) => dispatchFilters.priority === '全部' || item[priorityField] === dispatchFilters.priority)
      .filter((item) => dispatchFilters.sampleType === '全部' || item[sampleField] === dispatchFilters.sampleType)
      .sort((a, b) => {
        const rankDiff = priorityRank(queueConfig, a[priorityField]) - priorityRank(queueConfig, b[priorityField]);
        if (rankDiff !== 0) return rankDiff;
        const aTime = a[dateField] || a.createdAt || '';
        const bTime = b[dateField] || b.createdAt || '';
        return String(aTime).localeCompare(String(bTime));
      });
  }, [records, dispatchFilters, tick, queueConfig]);

  const allDispatchableCases = useMemo(() => {
    return [...unassignedCases, ...pendingReassignCases];
  }, [unassignedCases, pendingReassignCases]);

  const selectedCasesData = useMemo(() => {
    return records.filter((item) => selectedCases.has(item.id));
  }, [records, selectedCases]);

  function toggleDoctorExpand(doctor) {
    const next = new Set(expandedDoctors);
    if (next.has(doctor)) {
      next.delete(doctor);
    } else {
      next.add(doctor);
    }
    setExpandedDoctors(next);
  }

  const tatFilteredRecords = useMemo(() => {
    void tick;
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    return records
      .filter((item) => tatFilters.doctor === '全部' || item.doctor === tatFilters.doctor)
      .filter((item) => tatFilters.status === '全部' || item.status === tatFilters.status)
      .filter((item) => tatFilters.priority === '全部' || item[priorityField] === tatFilters.priority)
      .filter((item) => {
        if (tatFilters.tatStatus === '全部') return true;
        const tat = calcTatInfo(queueConfig, item);
        if (tatFilters.tatStatus === '已超时') return tat.status === TAT_STATUS.OVERDUE;
        if (tatFilters.tatStatus === '即将超时') return tat.status === TAT_STATUS.WARNING;
        if (tatFilters.tatStatus === '正常') return tat.status === TAT_STATUS.NORMAL;
        if (tatFilters.tatStatus === '待计时') return tat.status === TAT_STATUS.UNKNOWN;
        return true;
      })
      .sort((a, b) => {
        const tatA = calcTatInfo(queueConfig, a);
        const tatB = calcTatInfo(queueConfig, b);
        const rankA = { [TAT_STATUS.OVERDUE]: 0, [TAT_STATUS.WARNING]: 1, [TAT_STATUS.NORMAL]: 2, [TAT_STATUS.UNKNOWN]: 3 }[tatA.status] ?? 9;
        const rankB = { [TAT_STATUS.OVERDUE]: 0, [TAT_STATUS.WARNING]: 1, [TAT_STATUS.NORMAL]: 2, [TAT_STATUS.UNKNOWN]: 3 }[tatB.status] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        const priorityDiff = priorityRank(queueConfig, a[priorityField]) - priorityRank(queueConfig, b[priorityField]);
        if (priorityDiff !== 0) return priorityDiff;
        return (tatA.waitedMinutes || 0) - (tatB.waitedMinutes || 0);
      });
  }, [records, tatFilters, tick, queueConfig]);

  const tatDoctorGroups = useMemo(() => {
    void tick;
    const doctorField = queueConfig.fields?.find((f) => f.key === 'doctor')?.key || 'doctor';
    const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
    const groups = {};

    tatFilteredRecords.forEach((item) => {
      const doctor = item[doctorField] || '未分配';
      const tat = calcTatInfo(queueConfig, item);
      const priority = item[priorityField] || '未知';

      if (!groups[doctor]) {
        groups[doctor] = {
          doctor,
          total: 0,
          normal: 0,
          warning: 0,
          overdue: 0,
          unknown: 0,
          priorityBreakdown: {},
          cases: []
        };
      }

      groups[doctor].total++;
      groups[doctor].cases.push({ ...item, _tat: tat });

      switch (tat.status) {
        case TAT_STATUS.OVERDUE:
          groups[doctor].overdue++;
          break;
        case TAT_STATUS.WARNING:
          groups[doctor].warning++;
          break;
        case TAT_STATUS.NORMAL:
          groups[doctor].normal++;
          break;
        default:
          groups[doctor].unknown++;
      }

      if (!groups[doctor].priorityBreakdown[priority]) {
        groups[doctor].priorityBreakdown[priority] = { total: 0, normal: 0, warning: 0, overdue: 0, unknown: 0 };
      }
      groups[doctor].priorityBreakdown[priority].total++;
      switch (tat.status) {
        case TAT_STATUS.OVERDUE:
          groups[doctor].priorityBreakdown[priority].overdue++;
          break;
        case TAT_STATUS.WARNING:
          groups[doctor].priorityBreakdown[priority].warning++;
          break;
        case TAT_STATUS.NORMAL:
          groups[doctor].priorityBreakdown[priority].normal++;
          break;
        default:
          groups[doctor].priorityBreakdown[priority].unknown++;
      }
    });

    return Object.values(groups).sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.warning !== a.warning) return b.warning - a.warning;
      return b.total - a.total;
    });
  }, [tatFilteredRecords, tick, queueConfig]);

  const tatStats = useMemo(() => {
    void tick;
    let overdue = 0;
    let warning = 0;
    let normal = 0;
    let unknown = 0;
    const waitTimes = [];

    tatFilteredRecords.forEach((item) => {
      const tat = calcTatInfo(queueConfig, item);
      if (tat.hasStartTime) {
        waitTimes.push(tat.waitedMinutes);
      }
      switch (tat.status) {
        case TAT_STATUS.OVERDUE:
          overdue++;
          break;
        case TAT_STATUS.WARNING:
          warning++;
          break;
        case TAT_STATUS.NORMAL:
          normal++;
          break;
        default:
          unknown++;
      }
    });

    const avgWait = waitTimes.length
      ? Math.floor(waitTimes.reduce((s, v) => s + v, 0) / waitTimes.length)
      : 0;

    return { overdue, warning, normal, unknown, total: tatFilteredRecords.length, avgWait };
  }, [tatFilteredRecords, tick]);

  return (
    <main className="shell" style={{ '--accent': queueConfig.accent || '#5f69c8' }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><Microscope size={18} />{queueConfig.domain || '病理科'}</div>
          <h1>{queueConfig.title || '病理科玻片阅片队列'}</h1>
          <p>{queueConfig.subtitle || '数字化阅片 · 状态流转 · 全流程追踪'}</p>
        </div>
        <div className="hero-actions">
          <button
            className="icon-btn"
            type="button"
            onClick={() => setShowConfigManager(true)}
            title="队列配置管理"
          >
            <Settings size={18} />
          </button>
          <div className="port-card">
            <span>Local Port</span>
            <strong>{queueConfig.port || '61306'}</strong>
          </div>
        </div>
      </section>

      <section className="view-tabs">
        <button
          className={`view-tab ${activeView === 'workbench' ? 'active' : ''}`}
          onClick={() => handleViewChange('workbench')}
        >
          <Layers size={16} />
          阅片工作台
        </button>
        <button
          className={`view-tab ${activeView === 'dispatch' ? 'active' : ''}`}
          onClick={() => handleViewChange('dispatch')}
        >
          <UserPlus size={16} />
          医生派单与负荷
        </button>
        <button
          className={`view-tab ${activeView === 'slide-borrow' ? 'active' : ''}`}
          onClick={() => handleViewChange('slide-borrow')}
        >
          <BookOpen size={16} />
          玻片借阅归还
        </button>
        <button
          className={`view-tab ${activeView === 'critical-notify' ? 'active' : ''}`}
          onClick={() => handleViewChange('critical-notify')}
        >
          <BellRing size={16} />
          危急病例通知
          {notifyStats.pending > 0 && (
            <span className="notify-tab-badge">{notifyStats.pending}</span>
          )}
        </button>
        <button
          className={`view-tab ${activeView === 'phrase-library' ? 'active' : ''}`}
          onClick={() => handleViewChange('phrase-library')}
        >
          <BookOpen size={16} />
          诊断短语库
        </button>
      </section>

      {activeView === 'workbench' && (
        <>
      <section className="metrics">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="workbench">
        <div className="workbench-header">
          <div className="eyebrow"><Microscope size={18} />今日阅片工作台</div>
          <button className="tat-toggle-btn" type="button" onClick={() => setShowTatBoard(!showTatBoard)}>
            <Clock size={14} />
            {showTatBoard ? '隐藏TAT预警' : 'TAT超时预警'}
          </button>
        </div>
        <div className="workbench-columns">
          {workbenchGroups.map((zone) => {
            const ZoneIcon = safeGetIcon(zone.icon || 'CircleDot');
            const reviewStatus = queueConfig.statuses?.find((s) => s.order === 2)?.name;
            const isReviewZone = zone.status === reviewStatus;
            return (
              <div className="workbench-column" key={zone.id || zone.status}>
                <div className="workbench-column-header" style={{ '--zone-color': zone.color }}>
                  <ZoneIcon size={16} />
                  <span>{zone.status}</span>
                  <strong>{zone.items.length}</strong>
                </div>
                <div className="workbench-cards">
                  {zone.items.length === 0 && (
                    <p className="workbench-empty">暂无病例</p>
                  )}
                  {zone.items.map((item) => {
                    const tat = calcTatInfo(queueConfig, item);
                    const titleField = queueConfig.cardDisplay?.titleField || 'caseNo';
                    const metaFields = queueConfig.cardDisplay?.metaFields || ['sampleType', 'doctor'];
                    const cardMeta = buildCardMeta(queueConfig, item);
                    return (
                    <div className={`workbench-card tat-card-${tat.status}`} key={item.id} onClick={() => setSelected(item)}>
                      <div className="workbench-card-top">
                        <h3>{item[titleField] || item.id}</h3>
                        <span className={'status ' + statusClass(queueConfig, item.status)}>{item.status}</span>
                      </div>
                      <div className="workbench-card-meta">
                        {metaFields.map((mf) => (
                          <span key={mf}>{item[mf] ?? ''}</span>
                        ))}
                        {cardMeta && (
                          <span className="wb-meta-extra">{cardMeta}</span>
                        )}
                        {isReviewZone && (item.reviews || []).length > 0 && (
                          <span className="wb-review-badge">已复核</span>
                        )}
                        {isReviewZone && !(item.reviews || []).length && (
                          <span className="wb-review-badge wb-review-pending">待录入</span>
                        )}
                      </div>
                      <div className="workbench-card-wait">
                        <Clock size={13} />
                        <span>{waitDuration(queueConfig, item)}</span>
                        {tat.status !== TAT_STATUS.NORMAL && tat.status !== TAT_STATUS.UNKNOWN && (
                          <span className={`wb-tat-badge ${tatStatusClass(tat.status)}`}>
                            {tatStatusLabel(tat.status)}
                          </span>
                        )}
                      </div>
                      <div className="workbench-card-actions" onClick={(e) => e.stopPropagation()}>
                        {prevStatus(queueConfig, item.status) && (
                          <button className="wb-btn wb-btn-prev" type="button" onClick={() => setStatusNoteAdding({ id: item.id, status: prevStatus(queueConfig, item.status) })}>
                            ← {prevStatus(queueConfig, item.status)}
                          </button>
                        )}
                        {nextStatus(queueConfig, item.status) && (
                          <button className="wb-btn wb-btn-next" type="button" style={{ '--zone-color': zone.color }} onClick={() => setStatusNoteAdding({ id: item.id, status: nextStatus(queueConfig, item.status) })}>
                            {nextStatus(queueConfig, item.status)} →
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showTatBoard && (
        <section className="tat-board">
          <div className="tat-header">
            <div className="eyebrow"><Clock size={18} />TAT超时预警看板 · 按医生+优先级双维度概览</div>
            <div className="tat-filters">
              <select value={tatFilters.tatStatus} onChange={(e) => setTatFilters({ ...tatFilters, tatStatus: e.target.value })}>
                <option value="全部">全部TAT状态</option>
                <option value="已超时">已超时</option>
                <option value="即将超时">即将超时</option>
                <option value="正常">正常</option>
                <option value="待计时">待计时</option>
              </select>
              <select value={tatFilters.priority} onChange={(e) => setTatFilters({ ...tatFilters, priority: e.target.value })}>
                <option value="全部">全部优先级</option>
                {(queueConfig.priorityConfig?.order || []).map((p) => <option key={p}>{p}</option>)}
              </select>
              <select value={tatFilters.doctor} onChange={(e) => setTatFilters({ ...tatFilters, doctor: e.target.value })}>
                <option value="全部">全部医生</option>
                {doctorList.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select value={tatFilters.status} onChange={(e) => setTatFilters({ ...tatFilters, status: e.target.value })}>
                <option value="全部">全部阅片状态</option>
                {getStatusNames(queueConfig).map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="tat-metrics">
            <div className="tat-metric tat-metric-overdue">
              <div className="tat-metric-label">已超时</div>
              <div className="tat-metric-value">{tatStats.overdue}</div>
              <div className="tat-metric-desc">超过TAT阈值</div>
            </div>
            <div className="tat-metric tat-metric-warning">
              <div className="tat-metric-label">即将超时</div>
              <div className="tat-metric-value">{tatStats.warning}</div>
              <div className="tat-metric-desc">即将到达预警线</div>
            </div>
            <div className="tat-metric tat-metric-normal">
              <div className="tat-metric-label">正常</div>
              <div className="tat-metric-value">{tatStats.normal}</div>
              <div className="tat-metric-desc">在TAT范围内</div>
            </div>
            <div className="tat-metric tat-metric-avg">
              <div className="tat-metric-label">平均等待</div>
              <div className="tat-metric-value">{formatDuration(tatStats.avgWait)}</div>
              <div className="tat-metric-desc">整体平均时长</div>
            </div>
          </div>

          <div className="tat-risk-matrix">
            <div className="risk-matrix-title">
              <AlertTriangle size={16} />
              <span>优先级风险矩阵（超时+预警）</span>
            </div>
            <div className="risk-matrix-grid">
              {(queueConfig.priorityConfig?.order || []).map((priority) => {
                const pbTotal = tatDoctorGroups.reduce((sum, g) => sum + (g.priorityBreakdown[priority]?.total || 0), 0);
                const pbOverdue = tatDoctorGroups.reduce((sum, g) => sum + (g.priorityBreakdown[priority]?.overdue || 0), 0);
                const pbWarning = tatDoctorGroups.reduce((sum, g) => sum + (g.priorityBreakdown[priority]?.warning || 0), 0);
                const pbNormal = tatDoctorGroups.reduce((sum, g) => sum + (g.priorityBreakdown[priority]?.normal || 0), 0);
                const riskLevel = pbOverdue > 0 ? 'high' : pbWarning > 0 ? 'medium' : 'low';
                return (
                  <div key={priority} className={`risk-matrix-cell risk-${riskLevel}`}>
                    <div className="risk-matrix-priority">
                      <span className={`priority-tag priority-${priority}`}>{priority}</span>
                    </div>
                    <div className="risk-matrix-stats">
                      <span className="risk-stat risk-overdue" title="超时">{pbOverdue}</span>
                      <span className="risk-sep">/</span>
                      <span className="risk-stat risk-warning" title="预警">{pbWarning}</span>
                      <span className="risk-sep">/</span>
                      <span className="risk-stat risk-normal" title="正常">{pbNormal}</span>
                    </div>
                    <div className="risk-matrix-total">共 {pbTotal} 条</div>
                    {(pbOverdue > 0 || pbWarning > 0) && (
                      <div className="risk-matrix-bar">
                        <div
                          className="risk-bar-overdue"
                          style={{ width: pbTotal > 0 ? `${(pbOverdue / pbTotal) * 100}%` : '0%' }}
                        />
                        <div
                          className="risk-bar-warning"
                          style={{ width: pbTotal > 0 ? `${(pbWarning / pbTotal) * 100}%` : '0%' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="tat-thresholds">
            <span className="tat-thresholds-label">TAT阈值配置：</span>
            {Object.entries(queueConfig.priorityConfig?.tatThresholds || {}).map(([priority, th]) => (
              <span key={priority} className="tat-threshold-item">
                <strong>{priority}</strong>：{formatDuration(th.warning)}预警 / {formatDuration(th.timeout)}超时
              </span>
            ))}
          </div>

          <div className="tat-doctor-groups">
            {tatDoctorGroups.length === 0 && (
              <div className="tat-empty">暂无符合条件的病例</div>
            )}
            {tatDoctorGroups.map((group) => {
              const isExpanded = expandedDoctors.has(group.doctor);
              const hasRisk = group.overdue > 0 || group.warning > 0;
              const caseFilter = tatGroupCaseFilters[group.doctor] || '全部';
              const priorityField = queueConfig.priorityConfig?.fieldKey || 'priority';
              const filteredCases = group.cases.filter((item) => {
                if (caseFilter === '全部') return true;
                if (caseFilter === '超时') return item._tat.status === TAT_STATUS.OVERDUE;
                if (caseFilter === '预警') return item._tat.status === TAT_STATUS.WARNING;
                if (caseFilter === '正常') return item._tat.status === TAT_STATUS.NORMAL;
                if (caseFilter === '待计时') return item._tat.status === TAT_STATUS.UNKNOWN;
                return true;
              });
              return (
                <div
                  key={group.doctor}
                  className={`tat-doctor-group ${hasRisk ? 'has-risk' : ''} ${group.overdue > 0 ? 'has-overdue' : ''}`}
                >
                  <div
                    className="tat-doctor-header"
                    onClick={() => toggleDoctorExpand(group.doctor)}
                  >
                    <div className="tat-doctor-info">
                      <div className={`tat-doctor-avatar ${group.overdue > 0 ? 'avatar-danger' : group.warning > 0 ? 'avatar-warning' : ''}`}>
                        {group.doctor.slice(0, 1)}
                      </div>
                      <div className="tat-doctor-name">
                        <h3>{group.doctor}</h3>
                        <span>共 {group.total} 条病例</span>
                      </div>
                    </div>
                    <div className="tat-doctor-stats">
                      <div className={`tat-doctor-stat overdue ${group.overdue > 0 ? 'active' : ''}`}>
                        <span className="stat-label">超时</span>
                        <strong>{group.overdue}</strong>
                      </div>
                      <div className={`tat-doctor-stat warning ${group.warning > 0 ? 'active' : ''}`}>
                        <span className="stat-label">预警</span>
                        <strong>{group.warning}</strong>
                      </div>
                      <div className={`tat-doctor-stat normal ${group.normal > 0 ? 'active' : ''}`}>
                        <span className="stat-label">正常</span>
                        <strong>{group.normal}</strong>
                      </div>
                      {group.unknown > 0 && (
                        <div className="tat-doctor-stat unknown">
                          <span className="stat-label">待计时</span>
                          <strong>{group.unknown}</strong>
                        </div>
                      )}
                    </div>
                    <div className={`tat-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  {Object.keys(group.priorityBreakdown).length > 0 && (
                    <div className="tat-priority-breakdown">
                      <span className="priority-breakdown-label">按优先级：</span>
                      {Object.entries(group.priorityBreakdown).map(([priority, pb]) => (
                        <span key={priority} className="priority-breakdown-item">
                          <span className={`priority-tag priority-${priority}`}>{priority}</span>
                          {pb.overdue > 0 && <span className="pb-count overdue">超时{pb.overdue}</span>}
                          {pb.warning > 0 && <span className="pb-count warning">预警{pb.warning}</span>}
                          {pb.normal > 0 && <span className="pb-count normal">正常{pb.normal}</span>}
                          {pb.unknown > 0 && <span className="pb-count unknown">待计{pb.unknown}</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {isExpanded && (
                    <>
                      <div className="tat-group-case-toolbar" onClick={(e) => e.stopPropagation()}>
                        <span className="case-toolbar-label">筛选病例：</span>
                        <div className="case-toolbar-tabs">
                          {['全部', '超时', '预警', '正常', '待计时'].map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              className={`case-tab ${caseFilter === tab ? 'active' : ''} case-tab-${tab}`}
                              onClick={() => setTatGroupCaseFilters({
                                ...tatGroupCaseFilters,
                                [group.doctor]: tab
                              })}
                            >
                              {tab}
                              {tab === '全部' && <em>({group.cases.length})</em>}
                              {tab === '超时' && group.overdue > 0 && <em>({group.overdue})</em>}
                              {tab === '预警' && group.warning > 0 && <em>({group.warning})</em>}
                              {tab === '正常' && group.normal > 0 && <em>({group.normal})</em>}
                              {tab === '待计时' && group.unknown > 0 && <em>({group.unknown})</em>}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="tat-doctor-cases">
                        {filteredCases.length === 0 && (
                          <div className="tat-cases-empty">暂无「{caseFilter}」状态的病例</div>
                        )}
                        {filteredCases.map((item) => {
                          const tat = item._tat;
                          const titleField = queueConfig.cardDisplay?.titleField || 'caseNo';
                          return (
                            <article
                              className={`tat-record tat-${tat.status}`}
                              key={item.id}
                              onClick={() => setSelected(item)}
                            >
                              <div className="tat-record-main">
                                <div className="tat-record-head">
                                  <h3>{item[titleField] || item.id}</h3>
                                  <span className={`tat-badge ${tatStatusClass(tat.status)}`}>
                                    {tatStatusLabel(tat.status)}
                                  </span>
                                </div>
                                <div className="tat-record-meta">
                                  {queueConfig.cardDisplay?.metaFields?.map((mf) => (
                                    mf !== 'doctor' && item[mf] ? <span key={mf}>{item[mf]}</span> : null
                                  ))}
                                  <span className={`priority-tag priority-${item[priorityField] || '常规'}`}>{item[priorityField] || '常规'}</span>
                                  <span className={'status ' + statusClass(queueConfig, item.status)}>{item.status}</span>
                                </div>
                              </div>
                              <div className="tat-record-times">
                                <div className="tat-time-item">
                                  <span className="tat-time-label">已等待</span>
                                  <span className="tat-time-value">{tat.hasStartTime ? formatDuration(tat.waitedMinutes) : '-'}</span>
                                </div>
                                <div className="tat-time-item">
                                  <span className="tat-time-label">剩余时间</span>
                                  <span className={`tat-time-value ${tat.status === TAT_STATUS.OVERDUE ? 'tat-overdue-text' : tat.status === TAT_STATUS.WARNING ? 'tat-warning-text' : ''}`}>
                                    {tat.isCompleted ? '已完成' : tat.hasStartTime ? formatDuration(tat.remainingMinutes) : '-'}
                                  </span>
                                </div>
                                <div className="tat-time-item">
                                  <span className="tat-time-label">TAT阈值</span>
                                  <span className="tat-time-value">{tat.threshold ? formatDuration(tat.threshold) : '-'}</span>
                                </div>
                              </div>
                              <div className="tat-progress">
                                <div
                                  className={`tat-progress-bar ${tatStatusClass(tat.status)}`}
                                  style={{ width: `${tat.hasStartTime && tat.threshold ? Math.min(100, (tat.waitedMinutes / tat.threshold) * 100) : 0}%` }}
                                />
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="workspace">
        <form className="panel form-panel" onSubmit={addRecord}>
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2>新增记录</h2>
          </div>
          <div className="form-grid">
            {queueConfig.fields.map((field) => (
              <label key={field.key} className={field.type === 'textarea' ? 'wide' : ''}>
                <span>{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} />
                )}
              </label>
            ))}
            <label>
              <span>当前状态</span>
              <select value={form.status || getPrimaryStatusName(queueConfig)} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {getStatusNames(queueConfig).map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" type="submit"><Plus size={18} />新增</button>
            <button className="secondary" type="button" onClick={() => setBatchOpen(true)}><FileUp size={18} />批量导入</button>
          </div>
          <p className="hint">{queueConfig.note || '录入病理信息后会按状态流转至对应工作台。'}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            {(queueConfig.filters || [])
              .filter((f) => f.enabled)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((filter) => {
                const value = filters[filter.id] ?? '';
                const onChange = (newValue) => {
                  setFilters((prev) => ({ ...prev, [filter.id]: newValue }));
                };

                if (filter.type === 'search') {
                  const searchFields = filter.searchFields || [];
                  const placeholders = searchFields
                    .map((fk) => queueConfig.fields?.find((f) => f.key === fk)?.label || fk)
                    .slice(0, 2)
                    .join('/');
                  return (
                    <div className="search" key={filter.id}>
                      <Search size={16} />
                      <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={filter.label || `搜索${placeholders}...`}
                      />
                    </div>
                  );
                }

                if (filter.type === 'status') {
                  return (
                    <select
                      key={filter.id}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    >
                      <option value="全部">全部{filter.label ? ` ${filter.label}` : ''}</option>
                      {getStatusNames(queueConfig).map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  );
                }

                if (filter.type === 'select') {
                  const field = queueConfig.fields?.find((f) => f.key === filter.field);
                  const options = field?.options || [];
                  return (
                    <select
                      key={filter.id}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    >
                      <option value="全部">全部{filter.label ? ` ${filter.label}` : ''}</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  );
                }

                return null;
              })}
          </div>

          <div className="records">
            {filteredRecords.map((item) => {
              const tat = calcTatInfo(queueConfig, item);
              const titleField = queueConfig.cardDisplay?.titleField || 'caseNo';
              const metaFields = queueConfig.cardDisplay?.metaFields || ['sampleType', 'priority', 'doctor'];
              const detailField = queueConfig.cardDisplay?.detailField || 'summary';
              const reviewStatus = queueConfig.statuses?.find((s) => s.order === 2)?.name;
              return (
              <article className={`record ${item.conflict || hasOverlap(item, records) ? 'conflict' : ''} tat-list-${tat.status}`} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item[titleField] || item.id}</h3>
                    <p>{metaFields.map((mf) => item[mf]).filter(Boolean).join(' · ')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <span className={'status ' + statusClass(queueConfig, item.status)}>{item.status}</span>
                    {tat.status !== TAT_STATUS.NORMAL && tat.status !== TAT_STATUS.UNKNOWN && (
                      <span className={`record-tat-badge ${tatStatusClass(tat.status)}`}>
                        {tatStatusLabel(tat.status)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="record-tat-info">
                  <Clock size={12} />
                  <span>已等待：{tat.hasStartTime ? formatDuration(tat.waitedMinutes) : '-'}</span>
                  {tat.hasStartTime && !tat.isCompleted && (
                    <span className={tat.status === TAT_STATUS.OVERDUE ? 'tat-overdue-text' : tat.status === TAT_STATUS.WARNING ? 'tat-warning-text' : ''}>
                      · 剩余：{formatDuration(tat.remainingMinutes)}
                    </span>
                  )}
                </div>
                <p className="record-detail">{item[detailField] || ''}</p>
                {item.status === reviewStatus && (item.reviews || []).length > 0 && (
                  <div className="record-review-hint">
                    <ShieldCheck size={13} />
                    <span>已复核（{(item.reviews || []).slice(-1)[0]?.conclusion}）</span>
                  </div>
                )}
                {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  {getStatusNames(queueConfig).map((status) => (
                    <button key={status} type="button" onClick={() => setStatusNoteAdding({ id: item.id, status })}>{status}</button>
                  ))}
                  <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>
                  <button className="ghost-danger" type="button" onClick={() => removeRecord(item.id)}><Trash2 size={14} /></button>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      </section>

      <section className="insights">
        <div className="panel">
          <div className="panel-title">
            <CalendarDays size={18} />
            <h2>分组视图</h2>
          </div>
          {false ? (
            <div className="directory">
              {Object.entries(directory).map(([issue, items]) => (
                <div key={issue} className="directory-group">
                  <strong>{issue}</strong>
                  {items.map((item, index) => <span key={item.id}>{index + 1}. {item.evidence}｜{item.purpose}</span>)}
                </div>
              ))}
            </div>
          ) : (
            <div className="date-groups">
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date} className="date-group">
                  <strong>{date}</strong>
                  <span>{items.length}条记录</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="panel detail-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h2>详情</h2>
          </div>
          {selected ? (
            <div className="detail">
              <h3>{selected.caseNo}</h3>
              <p>{`${selected.sampleType} · ${selected.priority} · ${selected.doctor}`}</p>
              <div className="detail-summary-section">
                <p className="detail-summary-text">{selected.summary || '暂无备注'}</p>
                <button
                  type="button"
                  className="phrase-add-btn"
                  onClick={() => {
                    setPhraseFilters({ query: '', sampleType: selected.sampleType || '全部' });
                    openPhrasePicker('summary');
                  }}
                >
                  <BookOpen size={14} />
                  插入短语
                </button>
              </div>

              {(() => {
                const tat = calcTatInfo(queueConfig, selected);
                return (
                  <div className={`detail-tat-section tat-detail-${tat.status}`}>
                    <div className="detail-tat-header">
                      <Clock size={16} />
                      <span>TAT时效</span>
                      <span className={`tat-badge ${tatStatusClass(tat.status)}`}>
                        {tatStatusLabel(tat.status)}
                      </span>
                    </div>
                    <div className="detail-tat-grid">
                      <div className="detail-tat-item">
                        <span className="detail-tat-label">已等待</span>
                        <span className="detail-tat-value">{tat.hasStartTime ? formatDuration(tat.waitedMinutes) : '-'}</span>
                      </div>
                      <div className="detail-tat-item">
                        <span className="detail-tat-label">剩余时间</span>
                        <span className={`detail-tat-value ${tat.status === TAT_STATUS.OVERDUE ? 'tat-overdue-text' : tat.status === TAT_STATUS.WARNING ? 'tat-warning-text' : ''}`}>
                          {tat.isCompleted ? '已完成' : tat.hasStartTime ? formatDuration(tat.remainingMinutes) : '-'}
                        </span>
                      </div>
                      <div className="detail-tat-item">
                        <span className="detail-tat-label">TAT阈值</span>
                        <span className="detail-tat-value">{tat.threshold ? formatDuration(tat.threshold) : '-'}</span>
                      </div>
                      <div className="detail-tat-item">
                        <span className="detail-tat-label">送检时间</span>
                        <span className="detail-tat-value">
                          {selected.sentAt ? new Date(selected.sentAt).toLocaleString('zh-CN') : '未填写'}
                        </span>
                      </div>
                    </div>
                    {tat.hasStartTime && tat.threshold && (
                      <div className="tat-progress detail-tat-progress">
                        <div
                          className={`tat-progress-bar ${tatStatusClass(tat.status)}`}
                          style={{ width: `${Math.min(100, (tat.waitedMinutes / tat.threshold) * 100)}%` }}
                        />
                      </div>
                    )}
                    {!tat.hasStartTime && (
                      <p className="detail-tat-hint">
                        <AlertCircle size={12} />
                        暂无送检时间，无法计算TAT
                      </p>
                    )}
                  </div>
                );
              })()}

              {selected.temps && (
                <div className="temp-chart">
                  {selected.temps.map((value, index) => <i key={index} style={{ height: Math.max(10, 56 + Number(value) * 8) }} title={String(value)} />)}
                </div>
              )}

              {(selected.status === '待复核' || (selected.reviews || []).length > 0) && (
                <div className="review-section">
                  <div className="review-header">
                    <div className="panel-title" style={{ margin: 0 }}>
                      <ShieldCheck size={16} />
                      <h2>复核意见</h2>
                      {selected.status !== '待复核' && <span className="review-readonly-tag">只读</span>}
                    </div>
                    {(selected.status === '待复核' && selected.reviews?.length > 0 && !reviewEditing) && (
                      <button type="button" className="review-edit-btn" onClick={handleReviewEdit}>
                        <Edit size={14} />编辑
                      </button>
                    )}
                  </div>

                  {(() => {
                    const latestReview = (selected.reviews || []).slice(-1)[0];

                    if (!latestReview && !reviewEditing) {
                      if (selected.status !== '待复核') return null;
                      return (
                        <div className="review-empty">
                          <Stethoscope size={32} />
                          <p>暂无复核意见</p>
                          <button type="button" className="primary" onClick={handleReviewEdit}>
                            <Plus size={14} />录入复核意见
                          </button>
                        </div>
                      );
                    }

                    if (reviewEditing && selected.status === '待复核') {
                      return (
                        <form className="review-form" onSubmit={handleReviewSubmit}>
                          <label>
                            <span><UserCheck size={13} />复核医生</span>
                            <input
                              type="text"
                              value={reviewForm.reviewDoctor}
                              onChange={(e) => setReviewForm({ ...reviewForm, reviewDoctor: e.target.value })}
                              placeholder="请输入复核医生姓名"
                              required
                            />
                          </label>
                          <label>
                            <span><FileCheck size={13} />复核结论</span>
                            <select
                              value={reviewForm.conclusion}
                              onChange={(e) => setReviewForm({ ...reviewForm, conclusion: e.target.value })}
                              required
                            >
                              <option value="">请选择结论</option>
                              {REVIEW_CONCLUSIONS.map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </label>
                          <label className="wide">
                            <span className="review-field-label">
                              <ClipboardList size={13} />补充说明
                              <button
                                type="button"
                                className="phrase-add-btn phrase-add-btn-sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPhraseFilters({ query: '', sampleType: selected.sampleType || '全部' });
                                  openPhrasePicker('review');
                                }}
                              >
                                <BookOpen size={12} />
                                插入短语
                              </button>
                            </span>
                            <textarea
                              value={reviewForm.remark}
                              onChange={(e) => setReviewForm({ ...reviewForm, remark: e.target.value })}
                              placeholder="请输入补充说明（选填）"
                              rows={3}
                            />
                          </label>
                          <div className="review-form-actions">
                            <button type="submit" className="primary" disabled={!reviewForm.reviewDoctor.trim() || !reviewForm.conclusion}>
                              <Save size={14} />提交
                            </button>
                            <button type="button" className="secondary" onClick={handleReviewCancel}>
                              <X size={14} />取消
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div className="review-display">
                        <div className="review-item">
                          <div className="review-item-header">
                            <span className={`review-conclusion conclusion-${latestReview.conclusion}`}>
                              {latestReview.conclusion}
                            </span>
                            <span className="review-date">
                              {new Date(latestReview.reviewedAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="review-item-doctor">
                            <UserCheck size={14} />
                            <span>复核医生：{latestReview.reviewDoctor}</span>
                          </div>
                          {latestReview.remark && (
                            <div className="review-item-remark">
                              <ClipboardList size={14} />
                              <span>{latestReview.remark}</span>
                            </div>
                          )}
                        </div>
                        {(selected.reviews || []).length > 1 && (
                          <div className="review-history-hint">
                            共 {(selected.reviews || []).length} 条复核记录，当前展示最近一条
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {(() => {
                const caseNotifies = getCaseNotifies(selected.caseNo, selected.id);
                return (
                  <div className="case-notify-section">
                    <div className="review-header" style={{ marginTop: '14px' }}>
                      <div className="panel-title" style={{ margin: 0 }}>
                        <Bell size={16} />
                        <h2 style={{ fontSize: '16px' }}>通知记录 ({caseNotifies.length})</h2>
                      </div>
                    </div>
                    {caseNotifies.length === 0 ? (
                      <div className="review-empty" style={{ padding: '16px 12px' }}>
                        <Bell size={28} />
                        <p>暂无通知记录</p>
                      </div>
                    ) : (
                      <div className="case-notify-list">
                        {caseNotifies.map((n) => {
                          const ns = calcNotifyStatus(n);
                          const MethodIcon = notifyMethodIcon(n.notifyMethod);
                          const overdue = isNotifyOverdue(n);
                          return (
                            <div key={n.id} className={`case-notify-item notify-item-${notifyStatusClass(ns)}`}>
                              <div className="case-notify-head">
                                <span className={`notify-badge ${notifyStatusClass(ns)}`}>{ns}</span>
                                <span className="case-notify-meta">
                                  <MethodIcon size={12} />{n.notifyMethod} · {n.notifyTarget}
                                </span>
                                {n.priority && (
                                  <span className={`priority-tag priority-${n.priority}`} style={{ fontSize: '11px', padding: '1px 6px' }}>{n.priority}</span>
                                )}
                              </div>
                              <div className="case-notify-times">
                                <span>发送：{formatDateTime(n.sentAt)}</span>
                                {n.confirmedAt ? (
                                  <span>确认：{formatDateTime(n.confirmedAt)}</span>
                                ) : (
                                  overdue && <span className="notify-overdue-inline"><Timer size={11} />超时{notifyOverdueMinutes(n)}分</span>
                                )}
                              </div>
                              {n.triggerReason && (
                                <div className="case-notify-reason">
                                  触发原因：{n.triggerReason}
                                </div>
                              )}
                              {n.remark && <div className="case-notify-remark">{n.remark}</div>}
                              {n.confirmedBy && (
                                <div className="notify-confirmed-by" style={{ marginTop: '6px', fontSize: '12px' }}>
                                  <UserCheck size={12} />确认人：{n.confirmedBy}
                                </div>
                              )}
                              {ns === CRITICAL_NOTIFY_STATUS.PENDING && (
                                <button
                                  className="wb-btn wb-btn-return"
                                  type="button"
                                  style={{ marginTop: '10px', padding: '5px 12px', fontSize: '12px' }}
                                  onClick={(e) => { e.stopPropagation(); confirmNotify(n); }}
                                >
                                  <CheckCircle2 size={13} />确认收到
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(selected.priority === '危急' || selected.status === '待复核') && (
                      <button
                        className="primary"
                        type="button"
                        style={{ marginTop: '12px', padding: '10px 16px', fontSize: '13px' }}
                        onClick={() => openNotifyModal(selected)}
                      >
                        <Bell size={15} />发送新通知
                      </button>
                    )}
                  </div>
                );
              })()}

              <div className="case-note-section">
                <div className="review-header">
                  <div className="panel-title" style={{ margin: 0 }}>
                    <MessageSquare size={16} />
                    <h2 style={{ fontSize: '16px' }}>关键事件备注</h2>
                  </div>
                  {!noteAdding && (
                    <button type="button" className="review-edit-btn" onClick={() => setNoteAdding(true)}>
                      <Plus size={14} />添加备注
                    </button>
                  )}
                </div>

                {noteAdding && (
                  <form className="note-form" onSubmit={handleNoteSubmit}>
                    <label>
                      <span><User size={13} />记录人</span>
                      <input
                        type="text"
                        value={noteForm.noteBy}
                        onChange={(e) => setNoteForm({ ...noteForm, noteBy: e.target.value })}
                        placeholder="请输入记录人姓名（选填）"
                      />
                    </label>
                    <label className="wide">
                      <span className="review-field-label">
                        <FileText size={13} />备注内容
                      </span>
                      <textarea
                        value={noteForm.noteText}
                        onChange={(e) => setNoteForm({ ...noteForm, noteText: e.target.value })}
                        placeholder="请输入关键事件备注..."
                        rows={3}
                        required
                        autoFocus
                      />
                    </label>
                    <div className="review-form-actions">
                      <button type="submit" className="primary" disabled={!noteForm.noteText.trim()}>
                        <Save size={14} />保存
                      </button>
                      <button type="button" className="secondary" onClick={handleNoteCancel}>
                        <X size={14} />取消
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="timeline">
                {getMergedTimelineWithNotify(selected).map((step, index) => {
                  const isReview = step.type === 'review-status' && step.status === '复核意见';
                  const isDispatch = step.status === '派单';
                  const isSlideBorrow = step.type === 'slide-borrow';
                  const isSlideReceive = step.type === 'slide-receive';
                  const isSlideReturn = step.type === 'slide-return';
                  const isSlideOverdue = step.type === 'slide-overdue';
                  const isNotifySent = step.type === 'critical-notify-sent';
                  const isNotifyConfirmed = step.type === 'critical-notify-confirmed';
                  const isCaseNote = step.type === 'case-note';
                  const hasNote = step.note && !isCaseNote;
                  const reviewForStep = isReview
                    ? (selected.reviews || []).find((r) => r.id === step.reviewId)
                    : null;
                  let displayText = `${step.at} · `;
                  if (step.type === 'review-status') {
                    displayText += step.status || '状态变更';
                  } else {
                    displayText += step.event || '事件';
                  }
                  if (isReview && reviewForStep) {
                    displayText += `（${reviewForStep.conclusion}）`;
                  }
                  if (isDispatch && step.fromDoctor && step.toDoctor) {
                    displayText += `：${step.fromDoctor} → ${step.toDoctor}`;
                  }
                  if (isSlideBorrow && step.department) {
                    displayText += `（${step.department}）`;
                  }
                  if (isSlideOverdue && step.borrower) {
                    displayText += `（借阅人：${step.borrower}）`;
                  }
                  if (isNotifySent && step.notifyTarget) {
                    displayText += `（${step.triggerReason || ''}→${step.notifyTarget}/${step.notifyMethod}）`;
                  }
                  if (isNotifyConfirmed && step.notifyTarget) {
                    displayText += `（${step.notifyMethod}→${step.notifyTarget}）`;
                  }
                  displayText += ` · ${step.by}`;
                  return (
                    <div key={index} className={`timeline-item
                      ${isReview ? 'timeline-review' : ''}
                      ${isDispatch ? 'timeline-dispatch' : ''}
                      ${isSlideBorrow ? 'timeline-slide-borrow' : ''}
                      ${isSlideReceive ? 'timeline-slide-receive' : ''}
                      ${isSlideReturn ? 'timeline-slide-return' : ''}
                      ${isSlideOverdue ? 'timeline-slide-overdue' : ''}
                      ${isNotifySent ? 'timeline-notify-sent' : ''}
                      ${isNotifyConfirmed ? 'timeline-notify-confirmed' : ''}
                      ${isCaseNote ? 'timeline-case-note' : ''}
                      ${hasNote ? 'timeline-has-note' : ''}
                    `}>
                      <span className="timeline-text">{displayText}</span>
                      {(isCaseNote || hasNote) && (
                        <div className="timeline-note-content">
                          <MessageSquare size={12} />
                          <span>{isCaseNote ? step.note : step.note}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="empty">点击任意记录查看详情和状态流转。</p>
          )}
        </aside>
      </section>
        </>
      )}

      {activeView === 'dispatch' && (
        <>
          <section className="dispatch-workload">
            <div className="dispatch-header">
              <div className="eyebrow"><Users size={18} />医生负荷概览</div>
              <div className="dispatch-summary">
                <span className="dispatch-summary-item"><strong>{unassignedCases.length}</strong> 条未分配</span>
                <span className="dispatch-summary-item"><strong>{pendingReassignCases.length}</strong> 条可改派</span>
                <span className="dispatch-summary-item"><strong>{doctorWorkload.length}</strong> 位医生</span>
              </div>
            </div>
            <div className="workload-grid">
              {doctorWorkload.length === 0 && (
                <div className="workload-empty">
                  <Users size={32} />
                  <p>暂无医生负荷数据</p>
                </div>
              )}
              {doctorWorkload.map((wl) => (
                <div
                  key={wl.doctor}
                  className={`workload-card ${selectedDoctorForDetail === wl.doctor ? 'selected' : ''}`}
                  onClick={() => setSelectedDoctorForDetail(selectedDoctorForDetail === wl.doctor ? null : wl.doctor)}
                >
                  <div className="workload-card-header">
                    <div className="workload-doctor">
                      <div className="workload-avatar">{wl.doctor.slice(0, 1)}</div>
                      <div>
                        <h3>{wl.doctor}</h3>
                        <p>共 {wl.total} 条病例</p>
                      </div>
                    </div>
                  </div>
                  <div className="workload-stats">
                    <div className="workload-stat pending">
                      <span className="stat-label">待阅片</span>
                      <strong>{wl.pending}</strong>
                    </div>
                    <div className="workload-stat reading">
                      <span className="stat-label">阅片中</span>
                      <strong>{wl.reading}</strong>
                    </div>
                    <div className="workload-stat reviewing">
                      <span className="stat-label">待复核</span>
                      <strong>{wl.reviewing}</strong>
                    </div>
                  </div>
                  {selectedDoctorForDetail === wl.doctor && (
                    <div className="workload-detail">
                      <div className="workload-detail-title">
                        <Info size={14} />
                        负责病例列表
                      </div>
                      <div className="workload-cases">
                        {wl.cases.slice(0, 5).map((item) => (
                          <div key={item.id} className="workload-case-item">
                            <span>{item.caseNo}</span>
                            <span className={`status ${statusClass(queueConfig, item.status)}`}>{item.status}</span>
                          </div>
                        ))}
                        {wl.cases.length > 5 && (
                          <div className="workload-case-more">还有 {wl.cases.length - 5} 条...</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="dispatch-main">
            <div className="panel">
              <div className="panel-title">
                <Send size={18} />
                <h2>病例派单</h2>
              </div>

              <div className="dispatch-toolbar">
                <div className="dispatch-filters">
                  <div className="search">
                    <Search size={16} />
                    <input
                      value={dispatchFilters.query}
                      onChange={(e) => setDispatchFilters({ ...dispatchFilters, query: e.target.value })}
                      placeholder="搜索病例号、备注..."
                    />
                  </div>
                  <select
                    value={dispatchFilters.priority}
                    onChange={(e) => setDispatchFilters({ ...dispatchFilters, priority: e.target.value })}
                  >
                    <option value="全部">全部优先级</option>
                    <option value="常规">常规</option>
                    <option value="加急">加急</option>
                    <option value="危急">危急</option>
                  </select>
                  <select
                    value={dispatchFilters.sampleType}
                    onChange={(e) => setDispatchFilters({ ...dispatchFilters, sampleType: e.target.value })}
                  >
                    <option value="全部">全部标本类型</option>
                    {sampleTypeList.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="dispatch-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={toggleSelectAllVisible}
                    disabled={allDispatchableCases.length === 0}
                  >
                    {allDispatchableCases.length > 0 && allDispatchableCases.every((c) => selectedCases.has(c.id)) ? (
                      <><CheckSquare size={14} />取消全选</>
                    ) : (
                      <><Square size={14} />全选当前</>
                    )}
                  </button>
                  {selectedCases.size > 0 && (
                    <button className="secondary" type="button" onClick={clearSelection}>
                      <X size={14} />清除选择
                    </button>
                  )}
                </div>
              </div>

              {selectedCases.size > 0 && (
                <div className="dispatch-selection-bar">
                  <div className="selection-info">
                    <CheckSquare size={16} />
                    <span>已选择 <strong>{selectedCases.size}</strong> 条病例</span>
                    {selectedCasesData.some((c) => c.doctor) && (
                      <span className="selection-hint">
                        (含 {selectedCasesData.filter((c) => c.doctor).length} 条改派)
                      </span>
                    )}
                  </div>
                  <div className="dispatch-assign">
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="doctor-select"
                    >
                      <option value="">选择目标医生...</option>
                      {doctorList.map((d) => {
                        const wl = doctorWorkload.find((w) => w.doctor === d);
                        return (
                          <option key={d} value={d}>
                            {d} (待阅{wl?.pending || 0} / 阅中{wl?.reading || 0} / 待复{wl?.reviewing || 0})
                          </option>
                        );
                      })}
                      <option value="__new__">+ 新医生...</option>
                    </select>
                    <button
                      className="primary"
                      type="button"
                      onClick={handleDispatch}
                      disabled={!selectedDoctor.trim()}
                    >
                      <Send size={16} />
                      批量派单
                    </button>
                  </div>
                </div>
              )}

              {dispatchResult && (
                <div className={`dispatch-result ${dispatchResult.failed > 0 || dispatchResult.skipped > 0 ? 'has-warnings' : ''}`}>
                  <div className="dispatch-result-header">
                    <CheckCircle2 size={18} />
                    <span>派单完成</span>
                    <button className="result-close" onClick={() => setDispatchResult(null)}><X size={14} /></button>
                  </div>
                  <div className="dispatch-result-stats">
                    <span className="result-success">成功 {dispatchResult.success} 条</span>
                    {dispatchResult.skipped > 0 && (
                      <span className="result-skipped">跳过 {dispatchResult.skipped} 条</span>
                    )}
                    {dispatchResult.failed > 0 && (
                      <span className="result-failed">失败 {dispatchResult.failed} 条</span>
                    )}
                  </div>
                  {(dispatchResult.skippedList.length > 0 || dispatchResult.failedList.length > 0) && (
                    <div className="dispatch-result-details">
                      {dispatchResult.skippedList.length > 0 && (
                        <div className="result-detail-group">
                          <div className="result-detail-title">跳过的病例：</div>
                          {dispatchResult.skippedList.map((item, idx) => (
                            <div key={idx} className="result-detail-item skipped">
                              <span>{item.caseNo}</span>
                              <span className="detail-reason">{item.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {dispatchResult.failedList.length > 0 && (
                        <div className="result-detail-group">
                          <div className="result-detail-title">失败的病例：</div>
                          {dispatchResult.failedList.map((item, idx) => (
                            <div key={idx} className="result-detail-item failed">
                              <span>{item.caseNo}</span>
                              <span className="detail-reason">{item.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="dispatch-tabs">
                <div className="dispatch-tab active">
                  未分配 <span className="tab-count">{unassignedCases.length}</span>
                </div>
                <div className="dispatch-tab">
                  待阅片可改派 <span className="tab-count">{pendingReassignCases.length}</span>
                </div>
              </div>

              <div className="dispatch-list">
                {allDispatchableCases.length === 0 && (
                  <div className="dispatch-empty">
                    <Layers size={32} />
                    <p>暂无符合条件的病例</p>
                  </div>
                )}
                {allDispatchableCases.map((item) => {
                  const tat = calcTatInfo(queueConfig, item);
                  const isSelected = selectedCases.has(item.id);
                  const isReassign = !!item.doctor;
                  return (
                    <div
                      key={item.id}
                      className={`dispatch-case ${isSelected ? 'selected' : ''} ${isReassign ? 'reassign' : ''}`}
                      onClick={() => toggleCaseSelection(item.id)}
                    >
                      <div className="case-checkbox">
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div className="case-main">
                        <div className="case-header">
                          <h3>{item.caseNo}</h3>
                          <span className={`priority-tag priority-${item.priority}`}>{item.priority}</span>
                          {isReassign && (
                            <span className="reassign-tag">
                              <UserCheck size={12} />
                              当前：{item.doctor}
                            </span>
                          )}
                          {!isReassign && (
                            <span className="unassigned-tag">未分配</span>
                          )}
                        </div>
                        <div className="case-meta">
                          <span>{item.sampleType}</span>
                          <span className={'status ' + statusClass(queueConfig, item.status)}>{item.status}</span>
                          {tat.status !== TAT_STATUS.NORMAL && tat.status !== TAT_STATUS.UNKNOWN && (
                            <span className={`tat-badge ${tatStatusClass(tat.status)}`}>
                              {tatStatusLabel(tat.status)}
                            </span>
                          )}
                        </div>
                        {item.summary && <p className="case-summary">{item.summary}</p>}
                        <div className="case-footer">
                          <span className="case-time">
                            <Clock size={12} />
                            送检：{item.sentAt ? new Date(item.sentAt).toLocaleString('zh-CN') : '未填写'}
                          </span>
                          <span className="case-wait">
                            等待：{waitDuration(queueConfig, item)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {activeView === 'slide-borrow' && (
        <>
          <section className="borrow-stats">
            <article className="metric borrow-metric borrow-metric-total">
              <span>借阅总数</span>
              <strong>{borrowStats.total}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-unreturned">
              <span>未归还</span>
              <strong>{borrowStats.unreturned}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-soon-overdue">
              <span>即将逾期</span>
              <strong>{borrowStats.soonOverdue}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-overdue">
              <span>已逾期</span>
              <strong>{borrowStats.overdue}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-returned">
              <span>已归还</span>
              <strong>{borrowStats.returned}</strong>
            </article>
          </section>

          <section className="workspace borrow-workspace">
            <form className="panel form-panel borrow-form-panel" onSubmit={handleBorrowSubmit}>
              <div className="panel-title">
                <Plus size={18} />
                <h2>{editingBorrow ? '编辑借阅记录' : '新增借阅记录'}</h2>
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span><FileText size={13} />病例号</span>
                  <input
                    type="text"
                    value={borrowForm.caseNo}
                    onChange={(e) => setBorrowForm({ ...borrowForm, caseNo: e.target.value })}
                    placeholder="请输入病例号，如 P2026061301"
                    required
                  />
                </label>
                <label>
                  <span><UserCheck size={13} />借阅人</span>
                  <input
                    type="text"
                    value={borrowForm.borrower}
                    onChange={(e) => setBorrowForm({ ...borrowForm, borrower: e.target.value })}
                    placeholder="请输入借阅人姓名"
                    required
                  />
                </label>
                <label>
                  <span><Building2 size={13} />科室</span>
                  <select
                    value={borrowForm.department}
                    onChange={(e) => setBorrowForm({ ...borrowForm, department: e.target.value })}
                  >
                    {departmentList.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label>
                  <span><CalendarClock size={13} />借出时间</span>
                  <input
                    type="datetime-local"
                    value={borrowForm.borrowTime}
                    onChange={(e) => setBorrowForm({ ...borrowForm, borrowTime: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span><Home size={13} />预计归还时间</span>
                  <input
                    type="datetime-local"
                    value={borrowForm.expectedReturnTime}
                    onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnTime: e.target.value })}
                    required
                  />
                </label>
                <label>
                  <span><CornerDownRight size={13} />接收时间</span>
                  <input
                    type="datetime-local"
                    value={borrowForm.receiveTime}
                    onChange={(e) => setBorrowForm({ ...borrowForm, receiveTime: e.target.value })}
                  />
                </label>
                <label>
                  <span><Undo2 size={13} />实际归还时间</span>
                  <input
                    type="datetime-local"
                    value={borrowForm.actualReturnTime}
                    onChange={(e) => setBorrowForm({ ...borrowForm, actualReturnTime: e.target.value })}
                  />
                </label>
                <label className="wide">
                  <span><ClipboardList size={13} />备注</span>
                  <textarea
                    value={borrowForm.remark}
                    onChange={(e) => setBorrowForm({ ...borrowForm, remark: e.target.value })}
                    placeholder="请输入备注信息（选填）"
                    rows={3}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  className="primary"
                  type="submit"
                  disabled={!borrowForm.caseNo.trim() || !borrowForm.borrower.trim() || !borrowForm.borrowTime || !borrowForm.expectedReturnTime}
                >
                  <Save size={18} />{editingBorrow ? '保存修改' : '新增借阅'}
                </button>
                {editingBorrow && (
                  <button className="secondary" type="button" onClick={closeBorrowModal}>
                    <X size={18} />取消
                  </button>
                )}
              </div>
              <p className="hint">围绕病例号记录玻片从病理科借出、接收、归还的流转。</p>
            </form>

            <section className="panel list-panel borrow-list-panel">
              <div className="toolbar borrow-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    value={slideBorrowFilters.query}
                    onChange={(e) => setSlideBorrowFilters({ ...slideBorrowFilters, query: e.target.value })}
                    placeholder="搜索病例号、借阅人、备注..."
                  />
                </div>
                <select
                  value={slideBorrowFilters.status}
                  onChange={(e) => setSlideBorrowFilters({ ...slideBorrowFilters, status: e.target.value })}
                >
                  {SLIDE_BORROW_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select
                  value={slideBorrowFilters.department}
                  onChange={(e) => setSlideBorrowFilters({ ...slideBorrowFilters, department: e.target.value })}
                >
                  <option>全部科室</option>
                  {departmentList.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>

              <div className="borrow-list">
                {filteredSlideBorrows.length === 0 && (
                  <div className="dispatch-empty">
                    <BookOpen size={32} />
                    <p>暂无符合条件的借阅记录</p>
                  </div>
                )}
                {filteredSlideBorrows.map((item) => {
                  const status = calcBorrowStatus(item);
                  const overdue = isOverdue(item);
                  const odDays = overdueDays(item);
                  const soonOverdue = isSoonOverdue(item);
                  const sdHours = soonOverdueHours(item);
                  return (
                    <article
                      key={item.id}
                      className={`borrow-card ${borrowStatusClass(status)} ${selectedBorrowForDetail?.id === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        const caseRecord = records.find((r) => r.caseNo === item.caseNo);
                        if (caseRecord) {
                          setSelected(caseRecord);
                        }
                        setSelectedBorrowForDetail(selectedBorrowForDetail?.id === item.id ? null : item);
                      }}
                    >
                      <div className="borrow-card-head">
                        <div>
                          <h3>{item.caseNo}</h3>
                          <p>{item.borrower} · {item.department}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                          <span className={`status borrow-status ${borrowStatusClass(status)}`}>{status}</span>
                          {soonOverdue && !overdue && (
                            <span className="borrow-soon-overdue-badge">
                              <Clock size={12} />
                              剩{sdHours}小时到期
                            </span>
                          )}
                          {overdue && (
                            <span className="borrow-overdue-badge">
                              <AlertTriangle size={12} />
                              逾期{odDays}天
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="borrow-card-times">
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">借出</span>
                          <span className="borrow-time-value">
                            {item.borrowTime ? new Date(item.borrowTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">预计归还</span>
                          <span className={`borrow-time-value ${overdue ? 'borrow-overdue-text' : soonOverdue ? 'borrow-soon-overdue-text' : ''}`}>
                            {item.expectedReturnTime ? new Date(item.expectedReturnTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">实际归还</span>
                          <span className="borrow-time-value">
                            {item.actualReturnTime ? new Date(item.actualReturnTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未归还'}
                          </span>
                        </div>
                      </div>
                      {item.remark && (
                        <p className="borrow-card-remark">{item.remark}</p>
                      )}
                      <div className="borrow-card-actions" onClick={(e) => e.stopPropagation()}>
                        {status === SLIDE_BORROW_STATUS.BORROWED && (
                          <button
                            className="wb-btn wb-btn-receive"
                            type="button"
                            onClick={() => handleReceiveSlide(item)}
                          >
                            <CornerDownRight size={13} />确认接收
                          </button>
                        )}
                        {(status === SLIDE_BORROW_STATUS.BORROWED || status === SLIDE_BORROW_STATUS.RECEIVED || status === SLIDE_BORROW_STATUS.OVERDUE) && (
                          <button
                            className="wb-btn wb-btn-return"
                            type="button"
                            onClick={() => handleReturnSlide(item)}
                          >
                            <Undo2 size={13} />确认归还
                          </button>
                        )}
                        <button
                          className="wb-btn"
                          type="button"
                          onClick={() => openBorrowModal(item)}
                        >
                          <Edit size={13} />编辑
                        </button>
                        <button
                          className="ghost-danger wb-btn"
                          type="button"
                          onClick={() => removeBorrowRecord(item.id)}
                        >
                          <Trash2 size={13} />删除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>

          {selectedBorrowForDetail && (
            <section className="insights">
              <div className="panel">
                <div className="panel-title">
                  <BookOpen size={18} />
                  <h2>借阅详情</h2>
                </div>
                <div className="borrow-detail">
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">病例号</span>
                    <span className="borrow-detail-value">{selectedBorrowForDetail.caseNo}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">借阅人</span>
                    <span className="borrow-detail-value">{selectedBorrowForDetail.borrower}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">科室</span>
                    <span className="borrow-detail-value">{selectedBorrowForDetail.department}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">借出时间</span>
                    <span className="borrow-detail-value">
                      {selectedBorrowForDetail.borrowTime ? new Date(selectedBorrowForDetail.borrowTime).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">接收时间</span>
                    <span className="borrow-detail-value">
                      {selectedBorrowForDetail.receiveTime ? new Date(selectedBorrowForDetail.receiveTime).toLocaleString('zh-CN') : '未接收'}
                    </span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">预计归还</span>
                    <span className={`borrow-detail-value ${isOverdue(selectedBorrowForDetail) ? 'borrow-overdue-text' : ''}`}>
                      {selectedBorrowForDetail.expectedReturnTime ? new Date(selectedBorrowForDetail.expectedReturnTime).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">实际归还</span>
                    <span className="borrow-detail-value">
                      {selectedBorrowForDetail.actualReturnTime ? new Date(selectedBorrowForDetail.actualReturnTime).toLocaleString('zh-CN') : '未归还'}
                    </span>
                  </div>
                  {selectedBorrowForDetail.remark && (
                    <div className="borrow-detail-item wide">
                      <span className="borrow-detail-label">备注</span>
                      <span className="borrow-detail-value">{selectedBorrowForDetail.remark}</span>
                    </div>
                  )}
                </div>
                <div className="timeline">
                  {getFullBorrowTimeline(selectedBorrowForDetail).map((event, index) => (
                    <span key={index} className={`timeline-${event.type}`}>
                      {event.at} · {event.event} · {event.by}
                      {event.department && `（${event.department}）`}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="panel detail-panel">
                <div className="panel-title">
                  <CheckCircle2 size={18} />
                  <h2>关联病例详情</h2>
                </div>
                {selected ? (
                  <div className="detail">
                    <h3>{selected.caseNo}</h3>
                    <p>{`${selected.sampleType} · ${selected.priority} · ${selected.doctor}`}</p>
                    <p>{selected.summary}</p>

                    <div className="timeline">
                      {getMergedTimeline(selected).map((step, index) => {
                        const isReview = step.type === 'review-status';
                        const isSlideBorrow = step.type === 'slide-borrow';
                        const isSlideReceive = step.type === 'slide-receive';
                        const isSlideReturn = step.type === 'slide-return';
                        const isSlideOverdue = step.type === 'slide-overdue';
                        const isDispatch = step.status === '派单';
                        const isCaseNote = step.type === 'case-note';
                        const hasNote = step.note && !isCaseNote;

                        let displayText = `${step.at} · `;
                        if (isReview) {
                          displayText += step.status || '状态变更';
                        } else {
                          displayText += step.event || '事件';
                        }

                        if (isDispatch && step.fromDoctor && step.toDoctor) {
                          displayText += `：${step.fromDoctor} → ${step.toDoctor}`;
                        }
                        if (isSlideBorrow && step.department) {
                          displayText += `（${step.department}）`;
                        }
                        if (isSlideOverdue && step.borrower) {
                          displayText += `（借阅人：${step.borrower}）`;
                        }

                        displayText += ` · ${step.by}`;

                        return (
                          <div
                            key={index}
                            className={`timeline-item
                              ${isReview && step.status === '复核意见' ? 'timeline-review' : ''}
                              ${isDispatch ? 'timeline-dispatch' : ''}
                              ${isSlideBorrow ? 'timeline-slide-borrow' : ''}
                              ${isSlideReceive ? 'timeline-slide-receive' : ''}
                              ${isSlideReturn ? 'timeline-slide-return' : ''}
                              ${isSlideOverdue ? 'timeline-slide-overdue' : ''}
                              ${isCaseNote ? 'timeline-case-note' : ''}
                              ${hasNote ? 'timeline-has-note' : ''}
                            `}
                          >
                            <span className="timeline-text">{displayText}</span>
                            {(isCaseNote || hasNote) && (
                              <div className="timeline-note-content">
                                <MessageSquare size={12} />
                                <span>{step.note}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="empty">点击左侧借阅记录查看关联病例详情。</p>
                )}
              </aside>
            </section>
          )}
        </>
      )}

      {activeView === 'critical-notify' && (
        <>
          <section className="borrow-stats">
            <article className="metric borrow-metric borrow-metric-total">
              <span>通知总数</span>
              <strong>{notifyStats.total}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-unreturned">
              <span>待确认</span>
              <strong>{notifyStats.pending}</strong>
              {notifyStats.overduePending > 0 && (
                <span className="notify-overdue-tag">
                  <AlertTriangle size={12} />
                  超{notifyStats.overduePending}条
                </span>
              )}
            </article>
            <article className="metric borrow-metric borrow-metric-overdue">
              <span>已超时</span>
              <strong>{notifyStats.expired}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-returned">
              <span>已确认</span>
              <strong>{notifyStats.confirmed}</strong>
            </article>
          </section>

          {showEscalateModal && (
            <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEscalateModal(); }}>
              <div className="modal-panel">
                <div className="panel-title">
                  <ArrowUpCircle size={18} />
                  <h2>升级通知</h2>
                  <button className="modal-close" type="button" onClick={closeEscalateModal}>
                    <X size={18} />
                  </button>
                </div>
                {escalateSourceNotify && (
                  <div className="escalate-source-info">
                    <div className="escalate-source-title">
                      <AlertTriangle size={14} />
                      原通知信息
                    </div>
                    <div className="escalate-source-grid">
                      <div><span>病例号：</span>{escalateSourceNotify.caseNo}</div>
                      <div><span>原通知对象：</span>{escalateSourceNotify.notifyTarget}</div>
                      <div><span>发送时间：</span>{formatDateTime(escalateSourceNotify.sentAt)}</div>
                      <div><span>已超时：</span>{notifyOverdueMinutes(escalateSourceNotify)}分钟</div>
                    </div>
                  </div>
                )}
                <form className="escalate-form" onSubmit={handleEscalateSubmit}>
                  <div className="form-grid">
                    <label className="wide">
                      <span><UserPlus size={13} />升级至</span>
                      <select
                        value={escalateForm.escalateTarget}
                        onChange={(e) => {
                          setEscalateForm({ ...escalateForm, escalateTarget: e.target.value });
                          setTimeout(checkEscalateDuplicate, 50);
                        }}
                      >
                        {NOTIFY_ESCALATE_TARGETS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>
                      <span><Phone size={13} />通知方式</span>
                      <select
                        value={escalateForm.notifyMethod}
                        onChange={(e) => setEscalateForm({ ...escalateForm, notifyMethod: e.target.value })}
                      >
                        {CRITICAL_NOTIFY_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </label>
                    <label>
                      <span><CalendarClock size={13} />发送时间</span>
                      <input
                        type="datetime-local"
                        value={escalateForm.sentAt}
                        onChange={(e) => setEscalateForm({ ...escalateForm, sentAt: e.target.value })}
                        required
                      />
                    </label>
                    <label className="wide">
                      <span><ClipboardList size={13} />升级备注</span>
                      <textarea
                        value={escalateForm.remark}
                        onChange={(e) => setEscalateForm({ ...escalateForm, remark: e.target.value })}
                        placeholder="请输入升级原因或备注信息"
                        rows={3}
                      />
                    </label>
                  </div>
                  {escalateWarning && (
                    <div className="notify-duplicate-warning">
                      <AlertTriangle size={16} />
                      <span>{escalateWarning}</span>
                    </div>
                  )}
                  <div className="form-actions">
                    <button
                      className="secondary"
                      type="button"
                      onClick={closeEscalateModal}
                    >
                      <X size={18} />取消
                    </button>
                    <button
                      className="primary wb-btn-escalate-primary"
                      type="submit"
                      disabled={!escalateForm.escalateTarget.trim() || !escalateForm.sentAt || !!escalateWarning}
                    >
                      <Send size={18} />确认升级
                    </button>
                  </div>
                  <p className="hint">
                    通知升级将发送给科室主任或医务科，同一对象{NOTIFY_ESCALATE_WINDOW_MINUTES}分钟内不可重复升级。
                    升级记录将同步进入病例时间线。
                  </p>
                </form>
              </div>
            </div>
          )}

          <section className="workspace borrow-workspace">
            <form className="panel form-panel borrow-form-panel" onSubmit={handleNotifySubmit}>
              <div className="panel-title">
                <Plus size={18} />
                <h2>创建危急通知</h2>
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span><FileText size={13} />病例号</span>
                  <input
                    type="text"
                    value={notifyForm.caseNo}
                    onChange={(e) => {
                      const matched = records.find((r) => r.caseNo === e.target.value.trim());
                      setNotifyDuplicateWarning('');
                      setNotifyForm({
                        ...notifyForm,
                        caseNo: e.target.value,
                        caseId: matched?.id || '',
                        notifyTarget: matched?.doctor || notifyForm.notifyTarget
                      });
                      setTimeout(checkNotifyDuplicate, 50);
                    }}
                    placeholder="请输入病例号，如 P2026061117"
                    list="notify-case-list"
                    required
                  />
                  <datalist id="notify-case-list">
                    {records
                      .filter((r) => r.priority === '危急' || r.status === '待复核')
                      .map((r) => (
                        <option key={r.id} value={r.caseNo}>
                          {r.caseNo} - {r.doctor} ({r.priority}/{r.status})
                        </option>
                      ))}
                  </datalist>
                </label>
                <label className="wide">
                  <span><UserCheck size={13} />通知对象</span>
                  <input
                    type="text"
                    value={notifyForm.notifyTarget}
                    onChange={(e) => {
                      setNotifyDuplicateWarning('');
                      setNotifyForm({ ...notifyForm, notifyTarget: e.target.value });
                      setTimeout(checkNotifyDuplicate, 50);
                    }}
                    placeholder="请输入通知对象姓名或岗位"
                    list="notify-target-list"
                    required
                  />
                  <datalist id="notify-target-list">
                    {NOTIFY_TARGET_PRESETS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                    {doctorList.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </label>
                <label>
                  <span><Phone size={13} />通知方式</span>
                  <select
                    value={notifyForm.notifyMethod}
                    onChange={(e) => setNotifyForm({ ...notifyForm, notifyMethod: e.target.value })}
                  >
                    {CRITICAL_NOTIFY_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label>
                  <span><CalendarClock size={13} />发送时间</span>
                  <input
                    type="datetime-local"
                    value={notifyForm.sentAt}
                    onChange={(e) => setNotifyForm({ ...notifyForm, sentAt: e.target.value })}
                    required
                  />
                </label>
                <label className="wide">
                  <span><AlertTriangle size={13} />触发原因</span>
                  <select
                    value={notifyForm.triggerReason}
                    onChange={(e) => setNotifyForm({ ...notifyForm, triggerReason: e.target.value })}
                  >
                    {CRITICAL_NOTIFY_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label className="wide">
                  <span><ClipboardList size={13} />处理备注</span>
                  <textarea
                    value={notifyForm.remark}
                    onChange={(e) => setNotifyForm({ ...notifyForm, remark: e.target.value })}
                    placeholder="请输入通知内容或处理备注（选填）"
                    rows={3}
                  />
                </label>
              </div>
              {notifyDuplicateWarning && (
                <div className="notify-duplicate-warning">
                  <AlertTriangle size={16} />
                  <span>{notifyDuplicateWarning}</span>
                </div>
              )}
              <div className="form-actions">
                <button
                  className="primary"
                  type="submit"
                  disabled={!notifyForm.caseNo.trim() || !notifyForm.notifyTarget.trim() || !notifyForm.sentAt || !!notifyDuplicateWarning}
                >
                  <Send size={18} />发送通知
                </button>
              </div>
              <p className="hint">
                当病例优先级为「危急」或状态进入「待复核」时发送通知。
                同一病例对同一通知对象{NOTIFY_DUPLICATE_WINDOW_MINUTES}分钟内不可重复发送未确认通知。
                未确认通知超过{NOTIFY_REMINDER_MINUTES}分钟将高亮提醒。
              </p>
            </form>

            <section className="panel list-panel borrow-list-panel">
              <div className="toolbar borrow-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    value={notifyFilters.query}
                    onChange={(e) => setNotifyFilters({ ...notifyFilters, query: e.target.value })}
                    placeholder="搜索病例号、通知对象、备注..."
                  />
                </div>
                <select
                  value={notifyFilters.status}
                  onChange={(e) => setNotifyFilters({ ...notifyFilters, status: e.target.value })}
                >
                  {CRITICAL_NOTIFY_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select
                  value={notifyFilters.priority}
                  onChange={(e) => setNotifyFilters({ ...notifyFilters, priority: e.target.value })}
                >
                  <option value="全部">全部优先级</option>
                  <option value="常规">常规</option>
                  <option value="加急">加急</option>
                  <option value="危急">危急</option>
                </select>
              </div>

              <div className="borrow-list">
                {filteredNotifies.length === 0 && (
                  <div className="dispatch-empty">
                    <Bell size={32} />
                    <p>暂无符合条件的通知记录</p>
                  </div>
                )}
                {filteredNotifies.map((item) => {
                  const status = calcNotifyStatus(item);
                  const overdue = isNotifyOverdue(item);
                  const odMins = notifyOverdueMinutes(item);
                  const mins = minutesSinceSent(item);
                  const MethodIcon = notifyMethodIcon(item.notifyMethod);
                  return (
                    <article
                      key={item.id}
                      className={`borrow-card notify-card ${notifyStatusClass(status)} ${selectedNotifyForDetail?.id === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        const caseRecord = records.find((r) => r.caseNo === item.caseNo || r.id === item.caseId);
                        if (caseRecord) {
                          setSelected(caseRecord);
                        }
                        setSelectedNotifyForDetail(selectedNotifyForDetail?.id === item.id ? null : item);
                      }}
                    >
                      <div className="borrow-card-head">
                        <div>
                          <h3>{item.caseNo}</h3>
                          <p>{item.notifyTarget} · {item.triggerReason}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                          <span className={`status borrow-status ${notifyStatusClass(status)}`}>{status}</span>
                          {item.priority && (
                            <span className={`priority-tag priority-${item.priority}`}>{item.priority}</span>
                          )}
                          {status === CRITICAL_NOTIFY_STATUS.PENDING && overdue && (
                            <span className="borrow-overdue-badge">
                              <Timer size={12} />
                              超{odMins}分
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="borrow-card-times">
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">发送方式</span>
                          <span className="borrow-time-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MethodIcon size={13} />{item.notifyMethod}
                          </span>
                        </div>
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">发送时间</span>
                          <span className="borrow-time-value">{formatDateTime(item.sentAt)}</span>
                        </div>
                        <div className="borrow-time-item">
                          <span className="borrow-time-label">确认时间</span>
                          <span className={`borrow-time-value ${status === CRITICAL_NOTIFY_STATUS.PENDING ? 'notify-pending-text' : ''}`}>
                            {item.confirmedAt ? formatDateTime(item.confirmedAt) : '未确认'}
                          </span>
                        </div>
                      </div>
                      {item.remark && (
                        <p className="borrow-card-remark">{item.remark}</p>
                      )}
                      {item.confirmedBy && (
                        <div className="notify-confirmed-by">
                          <UserCheck size={13} />确认人：{item.confirmedBy}
                        </div>
                      )}
                      {item.isEscalation && item.parentNotifyId && (
                        <div className="notify-escalate-badge">
                          <ArrowUpCircle size={13} />
                          升级通知（来自：{criticalNotifies.find(n => n.id === item.parentNotifyId)?.notifyTarget || '原通知'}）
                        </div>
                      )}
                      <div className="borrow-card-actions" onClick={(e) => e.stopPropagation()}>
                        {status === CRITICAL_NOTIFY_STATUS.PENDING && (
                          <button
                            className="wb-btn wb-btn-return"
                            type="button"
                            onClick={() => confirmNotify(item)}
                          >
                            <CheckCircle2 size={13} />确认收到
                          </button>
                        )}
                        {canEscalateNotify(item) && !item.isEscalation && (
                          <button
                            className="wb-btn wb-btn-escalate"
                            type="button"
                            onClick={() => openEscalateModal(item)}
                          >
                            <ArrowUpCircle size={13} />升级通知
                          </button>
                        )}
                        <button
                          className="wb-btn"
                          type="button"
                          onClick={() => openNotifyModal(records.find((r) => r.caseNo === item.caseNo || r.id === item.caseId))}
                        >
                          <Bell size={13} />再次通知
                        </button>
                        <button
                          className="ghost-danger wb-btn"
                          type="button"
                          onClick={() => removeNotifyRecord(item.id)}
                        >
                          <Trash2 size={13} />删除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>

          {selectedNotifyForDetail && (
            <section className="insights">
              <div className="panel">
                <div className="panel-title">
                  <BellRing size={18} />
                  <h2>通知详情</h2>
                </div>
                <div className="borrow-detail">
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">病例号</span>
                    <span className="borrow-detail-value">{selectedNotifyForDetail.caseNo}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">通知对象</span>
                    <span className="borrow-detail-value">{selectedNotifyForDetail.notifyTarget}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">通知方式</span>
                    <span className="borrow-detail-value">{selectedNotifyForDetail.notifyMethod}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">触发原因</span>
                    <span className="borrow-detail-value">{selectedNotifyForDetail.triggerReason}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">优先级</span>
                    <span className="borrow-detail-value">{selectedNotifyForDetail.priority || '常规'}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">通知状态</span>
                    <span className="borrow-detail-value">{calcNotifyStatus(selectedNotifyForDetail)}</span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">发送时间</span>
                    <span className="borrow-detail-value">
                      {selectedNotifyForDetail.sentAt ? new Date(selectedNotifyForDetail.sentAt).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                  <div className="borrow-detail-item">
                    <span className="borrow-detail-label">确认时间</span>
                    <span className="borrow-detail-value">
                      {selectedNotifyForDetail.confirmedAt ? new Date(selectedNotifyForDetail.confirmedAt).toLocaleString('zh-CN') : '未确认'}
                    </span>
                  </div>
                  {selectedNotifyForDetail.confirmedBy && (
                    <div className="borrow-detail-item">
                      <span className="borrow-detail-label">确认人</span>
                      <span className="borrow-detail-value">{selectedNotifyForDetail.confirmedBy}</span>
                    </div>
                  )}
                  {selectedNotifyForDetail.remark && (
                    <div className="borrow-detail-item wide">
                      <span className="borrow-detail-label">处理备注</span>
                      <span className="borrow-detail-value">{selectedNotifyForDetail.remark}</span>
                    </div>
                  )}
                  {selectedNotifyForDetail.isEscalation && selectedNotifyForDetail.parentNotifyId && (() => {
                    const parentNotify = criticalNotifies.find(n => n.id === selectedNotifyForDetail.parentNotifyId);
                    return (
                      <div className="borrow-detail-item wide">
                        <span className="borrow-detail-label">升级来源</span>
                        <span className="borrow-detail-value escalate-info">
                          <ArrowUpCircle size={14} />
                          由通知升级而来（原对象：{parentNotify?.notifyTarget || '未知'}）
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const escalations = getNotifyEscalations(selectedNotifyForDetail.id, criticalNotifies);
                    if (escalations.length === 0) return null;
                    return (
                      <div className="borrow-detail-item wide">
                        <span className="borrow-detail-label">升级记录</span>
                        <div className="escalation-list">
                          {escalations.map((esc) => {
                            const escStatus = calcNotifyStatus(esc);
                            return (
                              <div key={esc.id} className={`escalation-item escalation-${notifyStatusClass(escStatus)}`}>
                                <div className="escalation-head">
                                  <ArrowUpCircle size={12} />
                                  <span>升级至「{esc.notifyTarget}」</span>
                                  <span className={`notify-badge ${notifyStatusClass(escStatus)}`}>{escStatus}</span>
                                </div>
                                <div className="escalation-times">
                                  <span>发送：{formatDateTime(esc.sentAt)}</span>
                                  {esc.confirmedAt && <span>确认：{formatDateTime(esc.confirmedAt)}</span>}
                                  <span>方式：{esc.notifyMethod}</span>
                                </div>
                                {esc.remark && <div className="escalation-remark">{esc.remark}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="detail-actions" style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
                  {calcNotifyStatus(selectedNotifyForDetail) === CRITICAL_NOTIFY_STATUS.PENDING && (
                    <button
                      className="wb-btn wb-btn-return"
                      type="button"
                      onClick={() => confirmNotify(selectedNotifyForDetail)}
                    >
                      <CheckCircle2 size={14} />确认收到
                    </button>
                  )}
                  {canEscalateNotify(selectedNotifyForDetail) && !selectedNotifyForDetail.isEscalation && (
                    <button
                      className="wb-btn wb-btn-escalate"
                      type="button"
                      onClick={() => openEscalateModal(selectedNotifyForDetail)}
                    >
                      <ArrowUpCircle size={14} />升级通知
                    </button>
                  )}
                </div>
              </div>

              <aside className="panel detail-panel">
                <div className="panel-title">
                  <CheckCircle2 size={18} />
                  <h2>关联病例详情</h2>
                </div>
                {selected ? (
                  <div className="detail">
                    <h3>{selected.caseNo}</h3>
                    <p>{`${selected.sampleType} · ${selected.priority} · ${selected.doctor}`}</p>
                    <p>{selected.summary}</p>

                    {(() => {
                      const caseNotifies = getCaseNotifies(selected.caseNo, selected.id);
                      return (
                        <div className="case-notify-section">
                          <div className="panel-title" style={{ marginTop: '12px' }}>
                            <Bell size={16} />
                            <h2 style={{ fontSize: '16px' }}>通知记录 ({caseNotifies.length})</h2>
                          </div>
                          {caseNotifies.length === 0 ? (
                            <p className="empty" style={{ padding: '12px' }}>暂无通知记录</p>
                          ) : (
                            <div className="case-notify-list">
                              {caseNotifies.map((n) => {
                                const ns = calcNotifyStatus(n);
                                const MethodIcon = notifyMethodIcon(n.notifyMethod);
                                return (
                                  <div key={n.id} className={`case-notify-item notify-item-${notifyStatusClass(ns)}`}>
                                    <div className="case-notify-head">
                                      <span className={`notify-badge ${notifyStatusClass(ns)}`}>{ns}</span>
                                      <span className="case-notify-meta">
                                        <MethodIcon size={12} />{n.notifyMethod} · {n.notifyTarget}
                                      </span>
                                    </div>
                                    <div className="case-notify-times">
                                      <span>发送：{formatDateTime(n.sentAt)}</span>
                                      {n.confirmedAt && <span>确认：{formatDateTime(n.confirmedAt)}</span>}
                                    </div>
                                    {n.remark && <div className="case-notify-remark">{n.remark}</div>}
                                    {ns === CRITICAL_NOTIFY_STATUS.PENDING && (
                                      <button
                                        className="wb-btn wb-btn-return"
                                        type="button"
                                        style={{ marginTop: '8px', padding: '4px 10px', fontSize: '12px' }}
                                        onClick={(e) => { e.stopPropagation(); confirmNotify(n); }}
                                      >
                                        <CheckCircle2 size={12} />确认收到
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(selected.priority === '危急' || selected.status === '待复核') && (
                            <button
                              className="primary"
                              type="button"
                              style={{ marginTop: '12px' }}
                              onClick={() => openNotifyModal(selected)}
                            >
                              <Bell size={16} />发送新通知
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="timeline">
                      {getMergedTimelineWithNotify(selected).map((step, index) => {
                        const isReview = step.type === 'review-status';
                        const isSlideBorrow = step.type === 'slide-borrow';
                        const isSlideReceive = step.type === 'slide-receive';
                        const isSlideReturn = step.type === 'slide-return';
                        const isSlideOverdue = step.type === 'slide-overdue';
                        const isDispatch = step.status === '派单';
                        const isNotifySent = step.type === 'critical-notify-sent';
                        const isNotifyConfirmed = step.type === 'critical-notify-confirmed';
                        const isNotifyEscalated = step.type === 'critical-notify-escalated';
                        const isCaseNote = step.type === 'case-note';
                        const hasNote = step.note && !isCaseNote;

                        let displayText = `${step.at} · `;
                        if (isReview || step.type === 'review-status') {
                          displayText += step.status || '状态变更';
                        } else {
                          displayText += step.event || '事件';
                        }

                        if (isDispatch && step.fromDoctor && step.toDoctor) {
                          displayText += `：${step.fromDoctor} → ${step.toDoctor}`;
                        }
                        if (isSlideBorrow && step.department) {
                          displayText += `（${step.department}）`;
                        }
                        if (isSlideOverdue && step.borrower) {
                          displayText += `（借阅人：${step.borrower}）`;
                        }
                        if (isNotifySent && step.notifyTarget) {
                          displayText += `（${step.triggerReason || ''}→${step.notifyTarget}/${step.notifyMethod}）`;
                        }
                        if (isNotifyConfirmed && step.notifyTarget) {
                          displayText += `（${step.notifyMethod}→${step.notifyTarget}）`;
                        }
                        if (isNotifyEscalated && step.notifyTarget) {
                          displayText += `（${step.fromTarget || '原通知对象'} → ${step.notifyTarget}/${step.notifyMethod}）`;
                        }

                        displayText += ` · ${step.by}`;

                        return (
                          <div
                            key={index}
                            className={`timeline-item
                              ${isReview && step.status === '复核意见' ? 'timeline-review' : ''}
                              ${isDispatch ? 'timeline-dispatch' : ''}
                              ${isSlideBorrow ? 'timeline-slide-borrow' : ''}
                              ${isSlideReceive ? 'timeline-slide-receive' : ''}
                              ${isSlideReturn ? 'timeline-slide-return' : ''}
                              ${isSlideOverdue ? 'timeline-slide-overdue' : ''}
                              ${isNotifySent ? 'timeline-notify-sent' : ''}
                              ${isNotifyConfirmed ? 'timeline-notify-confirmed' : ''}
                              ${isNotifyEscalated ? 'timeline-notify-escalated' : ''}
                              ${isCaseNote ? 'timeline-case-note' : ''}
                              ${hasNote ? 'timeline-has-note' : ''}
                            `}
                          >
                            <span className="timeline-text">{displayText}</span>
                            {(isCaseNote || hasNote) && (
                              <div className="timeline-note-content">
                                <MessageSquare size={12} />
                                <span>{step.note}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="empty">点击左侧通知记录查看关联病例详情。</p>
                )}
              </aside>
            </section>
          )}
        </>
      )}

      {activeView === 'phrase-library' && (
        <>
          <section className="borrow-stats">
            <article className="metric borrow-metric borrow-metric-total">
              <span>短语总数</span>
              <strong>{phraseStats.total}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-unreturned">
              <span>已使用</span>
              <strong>{phraseStats.totalUsed}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-overdue">
              <span>总使用次数</span>
              <strong>{phraseStats.totalUseCount}</strong>
            </article>
            <article className="metric borrow-metric borrow-metric-returned">
              <span>当前显示</span>
              <strong>{filteredPhrases.length}</strong>
            </article>
          </section>

          <section className="workspace borrow-workspace">
            <form className="panel form-panel borrow-form-panel" onSubmit={handlePhraseSubmit}>
              <div className="panel-title">
                <Plus size={18} />
                <h2>{editingPhrase ? '编辑诊断短语' : '新增诊断短语'}</h2>
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span><FileText size={13} />诊断短语</span>
                  <textarea
                    value={phraseForm.phrase}
                    onChange={(e) => setPhraseForm({ ...phraseForm, phrase: e.target.value })}
                    placeholder="请输入诊断短语内容"
                    rows={4}
                    required
                  />
                </label>
                <label>
                  <span><Stethoscope size={13} />适用标本类型</span>
                  <select
                    value={phraseForm.sampleType}
                    onChange={(e) => setPhraseForm({ ...phraseForm, sampleType: e.target.value })}
                  >
                    {queueConfig.fields.find((f) => f.key === 'sampleType')?.options.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                {editingPhrase && (
                  <>
                    <label>
                      <span><Zap size={13} />使用次数</span>
                      <input type="text" value={editingPhrase.useCount || 0} disabled />
                    </label>
                    <label className="wide">
                      <span><Clock size={13} />最近使用</span>
                      <input
                        type="text"
                        value={editingPhrase.lastUsedAt ? new Date(editingPhrase.lastUsedAt).toLocaleString('zh-CN') : '未使用'}
                        disabled
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="primary"
                  type="submit"
                  disabled={!phraseForm.phrase.trim()}
                >
                  <Save size={18} />{editingPhrase ? '保存修改' : '新增短语'}
                </button>
                {editingPhrase && (
                  <button className="secondary" type="button" onClick={closePhraseModal}>
                    <X size={18} />取消
                  </button>
                )}
              </div>
              <p className="hint">维护常用的病理诊断短语，支持按标本类型分类，便于快速录入。</p>
            </form>

            <section className="panel list-panel borrow-list-panel">
              <div className="toolbar borrow-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    value={phraseFilters.query}
                    onChange={(e) => setPhraseFilters({ ...phraseFilters, query: e.target.value })}
                    placeholder="搜索诊断短语..."
                  />
                </div>
                <select
                  value={phraseFilters.sampleType}
                  onChange={(e) => setPhraseFilters({ ...phraseFilters, sampleType: e.target.value })}
                >
                  {PHRASE_SAMPLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="borrow-list">
                {filteredPhrases.length === 0 && (
                  <div className="dispatch-empty">
                    <BookOpen size={32} />
                    <p>暂无符合条件的诊断短语</p>
                  </div>
                )}
                {filteredPhrases.map((item) => (
                  <article
                    key={item.id}
                    className={`borrow-card phrase-card ${item.pinned ? 'phrase-card-pinned' : ''}`}
                  >
                    <div className="borrow-card-head">
                      <div className="phrase-content">
                        <div className="phrase-content-header">
                          {item.pinned && (
                            <span className="phrase-pinned-badge">
                              <Pin size={11} />置顶
                            </span>
                          )}
                        </div>
                        <p>{item.phrase}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        <span className={`priority-tag priority-${item.sampleType ? '常规' : '常规'}`} style={{ background: '#eef2ff', color: '#3730a3' }}>
                          {item.sampleType}
                        </span>
                        <span className="phrase-use-count">
                          使用 {item.useCount || 0} 次
                        </span>
                      </div>
                    </div>
                    {item.lastUsedAt && (
                      <p className="phrase-last-used">
                        最近使用：{new Date(item.lastUsedAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                    <div className="borrow-card-actions">
                      <button
                        className={`wb-btn phrase-pin-btn ${item.pinned ? 'is-pinned' : ''}`}
                        type="button"
                        onClick={() => togglePhrasePin(item.id)}
                        title={item.pinned ? '取消置顶' : '置顶'}
                      >
                        {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                        {item.pinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        className="wb-btn"
                        type="button"
                        onClick={() => openPhraseModal(item)}
                      >
                        <Edit size={13} />编辑
                      </button>
                      {phraseDeleteConfirm === item.id ? (
                        <>
                          <button
                            className="wb-btn wb-btn-return"
                            type="button"
                            onClick={() => removePhrase(item.id)}
                          >
                            <CheckCircle2 size={13} />确认删除
                          </button>
                          <button
                            className="ghost-danger wb-btn"
                            type="button"
                            onClick={cancelDeletePhrase}
                          >
                            <X size={13} />取消
                          </button>
                        </>
                      ) : (
                        <button
                          className="ghost-danger wb-btn"
                          type="button"
                          onClick={() => confirmDeletePhrase(item.id)}
                        >
                          <Trash2 size={13} />删除
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}

      {showNotifyModal && (
        <div className="batch-overlay" onClick={closeNotifyModal}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <BellRing size={18} />
                <h2>创建危急通知</h2>
              </div>
              <button className="batch-close" onClick={closeNotifyModal}><X size={18} /></button>
            </div>
            <div className="batch-body">
              <form onSubmit={handleNotifySubmit}>
                <div className="form-grid">
                  <label className="wide">
                    <span><FileText size={13} />病例号</span>
                    <input
                      type="text"
                      value={notifyForm.caseNo}
                      onChange={(e) => {
                        const matched = records.find((r) => r.caseNo === e.target.value.trim());
                        setNotifyDuplicateWarning('');
                        setNotifyForm({
                          ...notifyForm,
                          caseNo: e.target.value,
                          caseId: matched?.id || '',
                          notifyTarget: matched?.doctor || notifyForm.notifyTarget
                        });
                        setTimeout(checkNotifyDuplicate, 50);
                      }}
                      placeholder="请输入病例号"
                      list="modal-notify-case-list"
                      required
                    />
                    <datalist id="modal-notify-case-list">
                      {records
                        .filter((r) => r.priority === '危急' || r.status === '待复核')
                        .map((r) => (
                          <option key={r.id} value={r.caseNo}>
                            {r.caseNo} - {r.doctor} ({r.priority}/{r.status})
                          </option>
                        ))}
                    </datalist>
                  </label>
                  <label className="wide">
                    <span><UserCheck size={13} />通知对象</span>
                    <input
                      type="text"
                      value={notifyForm.notifyTarget}
                      onChange={(e) => {
                        setNotifyDuplicateWarning('');
                        setNotifyForm({ ...notifyForm, notifyTarget: e.target.value });
                        setTimeout(checkNotifyDuplicate, 50);
                      }}
                      placeholder="请输入通知对象姓名或岗位"
                      list="modal-notify-target-list"
                      required
                    />
                    <datalist id="modal-notify-target-list">
                      {NOTIFY_TARGET_PRESETS.map((p) => <option key={p} value={p} />)}
                      {doctorList.map((d) => <option key={d} value={d} />)}
                    </datalist>
                  </label>
                  <label>
                    <span><Phone size={13} />通知方式</span>
                    <select
                      value={notifyForm.notifyMethod}
                      onChange={(e) => setNotifyForm({ ...notifyForm, notifyMethod: e.target.value })}
                    >
                      {CRITICAL_NOTIFY_METHODS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <label>
                    <span><CalendarClock size={13} />发送时间</span>
                    <input
                      type="datetime-local"
                      value={notifyForm.sentAt}
                      onChange={(e) => setNotifyForm({ ...notifyForm, sentAt: e.target.value })}
                      required
                    />
                  </label>
                  <label className="wide">
                    <span><AlertTriangle size={13} />触发原因</span>
                    <select
                      value={notifyForm.triggerReason}
                      onChange={(e) => setNotifyForm({ ...notifyForm, triggerReason: e.target.value })}
                    >
                      {CRITICAL_NOTIFY_REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="wide">
                    <span><ClipboardList size={13} />处理备注</span>
                    <textarea
                      value={notifyForm.remark}
                      onChange={(e) => setNotifyForm({ ...notifyForm, remark: e.target.value })}
                      placeholder="请输入通知内容或处理备注（选填）"
                      rows={3}
                    />
                  </label>
                </div>
                {notifyDuplicateWarning && (
                  <div className="notify-duplicate-warning">
                    <AlertTriangle size={16} />
                    <span>{notifyDuplicateWarning}</span>
                  </div>
                )}
                <div className="batch-actions">
                  <button
                    className="primary"
                    type="submit"
                    disabled={!notifyForm.caseNo.trim() || !notifyForm.notifyTarget.trim() || !notifyForm.sentAt || !!notifyDuplicateWarning}
                  >
                    <Send size={16} />发送通知
                  </button>
                  <button className="secondary" type="button" onClick={closeNotifyModal}>
                    <X size={16} />取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDispatchConfirm && (() => {
        const targetWl = doctorWorkload.find((w) => w.doctor === selectedDoctor);
        const incomplete = targetWl?.incomplete || 0;
        const urgentCritical = targetWl?.urgentCritical || 0;
        const earliestSentAt = targetWl?.earliestSentAt;
        const isOverloaded = incomplete >= 10 || urgentCritical >= 3;
        return (
        <div className="batch-overlay" onClick={cancelDispatch}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <Send size={18} />
                <h2>确认批量派单</h2>
              </div>
              <button className="batch-close" onClick={cancelDispatch}><X size={18} /></button>
            </div>
            <div className="batch-body">
              <div className="confirm-info">
                <p>即将把 <strong>{selectedCases.size}</strong> 条病例派给 <strong>{selectedDoctor}</strong></p>

                <div className={`doctor-workload-alert ${isOverloaded ? 'overloaded' : ''}`}>
                  <div className="workload-alert-header">
                    {isOverloaded ? <AlertTriangle size={18} /> : <Info size={18} />}
                    <strong>医生当前工作量</strong>
                  </div>
                  <div className="workload-alert-stats">
                    <div className="workload-alert-stat">
                      <span className="stat-label">未完成病例</span>
                      <strong className={`stat-value ${incomplete >= 10 ? 'danger' : ''}`}>{incomplete} 条</strong>
                    </div>
                    <div className="workload-alert-stat">
                      <span className="stat-label">危急/加急</span>
                      <strong className={`stat-value ${urgentCritical >= 3 ? 'danger' : ''}`}>{urgentCritical} 条</strong>
                    </div>
                    <div className="workload-alert-stat">
                      <span className="stat-label">最早送检时间</span>
                      <strong className="stat-value">{earliestSentAt ? formatDateTime(earliestSentAt) : '-'}</strong>
                    </div>
                  </div>
                  {isOverloaded && (
                    <div className="workload-overload-warning">
                      <AlertTriangle size={14} />
                      <span>该医生当前工作量较大，建议确认后再派单</span>
                    </div>
                  )}
                </div>

                <div className="confirm-preview">
                  {selectedCasesData.slice(0, 5).map((item) => (
                    <div key={item.id} className="confirm-item">
                      <span>{item.caseNo}</span>
                      <span className={`priority-tag priority-${item.priority}`}>{item.priority}</span>
                      <span className={'status ' + statusClass(queueConfig, item.status)}>{item.status}</span>
                    </div>
                  ))}
                  {selectedCasesData.length > 5 && (
                    <div className="confirm-more">还有 {selectedCasesData.length - 5} 条...</div>
                  )}
                </div>
                <div className="confirm-warnings">
                  <AlertTriangle size={16} />
                  <div>
                    <p>系统将自动跳过：</p>
                    <ul>
                      <li>已由 {selectedDoctor} 负责的病例</li>
                      <li>状态为「阅片中」「待复核」「已完成」的病例</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="batch-actions">
                <button className="primary" type="button" onClick={confirmDispatch}>
                  <CheckCircle2 size={16} />确认派单
                </button>
                <button className="secondary" type="button" onClick={cancelDispatch}>取消</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {showPhrasePicker && (
        <div className="batch-overlay" onClick={closePhrasePicker}>
          <div className="batch-modal phrase-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <BookOpen size={18} />
                <h2>选择诊断短语</h2>
                <span className="review-readonly-tag" style={{ marginLeft: '8px' }}>
                  追加到：{phrasePickerTarget === 'summary' ? '病例备注' : '复核意见'}
                </span>
              </div>
              <button className="batch-close" onClick={closePhrasePicker}><X size={18} /></button>
            </div>
            <div className="batch-body phrase-picker-body">
              <div className="phrase-picker-filters">
                <div className="search">
                  <Search size={16} />
                  <input
                    value={phraseFilters.query}
                    onChange={(e) => setPhraseFilters({ ...phraseFilters, query: e.target.value })}
                    placeholder="搜索诊断短语..."
                    autoFocus
                  />
                </div>
                <select
                  value={phraseFilters.sampleType}
                  onChange={(e) => setPhraseFilters({ ...phraseFilters, sampleType: e.target.value })}
                >
                  {PHRASE_SAMPLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="phrase-picker-list">
                {filteredPhrases.length === 0 && (
                  <div className="dispatch-empty">
                    <BookOpen size={28} />
                    <p>暂无符合条件的诊断短语</p>
                  </div>
                )}
                {filteredPhrases.map((item) => (
                  <div
                    key={item.id}
                    className={`phrase-picker-item ${item.pinned ? 'phrase-picker-pinned' : ''}`}
                    onClick={() => applyPhrase(item)}
                  >
                    <div className="phrase-picker-item-head">
                      <div className="phrase-picker-item-content">
                        <div className="phrase-picker-item-tags">
                          {item.pinned && (
                            <span className="phrase-picker-pinned-tag">
                              <Pin size={10} />置顶
                            </span>
                          )}
                        </div>
                        <p>{item.phrase}</p>
                      </div>
                      <button
                        className={`phrase-picker-pin-btn ${item.pinned ? 'is-pinned' : ''}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePhrasePin(item.id); }}
                        title={item.pinned ? '取消置顶' : '置顶'}
                      >
                        {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                      </button>
                    </div>
                    <div className="phrase-picker-item-meta">
                      <span className="phrase-picker-tag">{item.sampleType}</span>
                      <span className="phrase-picker-count">使用{item.useCount || 0}次</span>
                      {item.lastUsedAt && (
                        <span className="phrase-picker-time">
                          {new Date(item.lastUsedAt).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showConflictModal && conflictInfo && (
        <div className="batch-overlay" style={{ zIndex: 200 }}>
          <div className="batch-modal conflict-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header conflict-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <ArrowRightLeft size={18} />
                <h2>多标签页数据冲突</h2>
              </div>
            </div>
            <div className="batch-body conflict-body">
              <div className="conflict-alert">
                <AlertTriangle size={20} />
                <div>
                  <strong>检测到其他标签页对阅片队列进行了修改</strong>
                  <p>本页数据与外部更新存在冲突，请选择处理方式。</p>
                </div>
              </div>

              <div className="conflict-summary">
                <div className="conflict-stat conflict-stat-danger">
                  <span className="conflict-stat-value">{conflictInfo.conflicts.length}</span>
                  <span className="conflict-stat-label">冲突病例</span>
                </div>
                <div className="conflict-stat">
                  <span className="conflict-stat-value">{conflictInfo.localOnlyAdditions.length}</span>
                  <span className="conflict-stat-label">本页新增</span>
                </div>
                <div className="conflict-stat">
                  <span className="conflict-stat-value">{conflictInfo.externalOnlyAdditions.length}</span>
                  <span className="conflict-stat-label">外部新增</span>
                </div>
                <div className="conflict-stat">
                  <span className="conflict-stat-value">{conflictInfo.localOnlyRemovals.length}</span>
                  <span className="conflict-stat-label">本页删除</span>
                </div>
                <div className="conflict-stat">
                  <span className="conflict-stat-value">{conflictInfo.externalOnlyRemovals.length}</span>
                  <span className="conflict-stat-label">外部删除</span>
                </div>
              </div>

              {conflictInfo.conflicts.length > 0 && (
                <div className="conflict-details">
                  <div className="conflict-details-title">
                    <AlertTriangle size={14} />
                    冲突病例详情
                  </div>
                  {conflictInfo.conflicts.map((c) => (
                    <div key={c.id} className="conflict-case-item">
                      <div className="conflict-case-header">
                        <span className="conflict-case-no">{c.caseNo}</span>
                        <span className={`conflict-type-badge conflict-type-${c.type}`}>
                          {c.type === 'modify-vs-modify' && '双方修改'}
                          {c.type === 'modify-vs-delete' && '本页修改/外部删除'}
                          {c.type === 'delete-vs-modify' && '本页删除/外部修改'}
                        </span>
                      </div>
                      {c.type === 'modify-vs-modify' && c.localRecord && c.externalRecord && (
                        <div className="conflict-case-compare">
                          <div className="conflict-case-side conflict-side-local">
                            <div className="conflict-side-label">本页版本</div>
                            <div className="conflict-side-content">
                              <span className={'status ' + statusClass(queueConfig, c.localRecord.status)}>{c.localRecord.status}</span>
                              <span>{c.localRecord.doctor}</span>
                              <span>{c.localRecord.priority}</span>
                              {(c.localRecord.reviews || []).length > 0 && (
                                <span className="conflict-review-count">
                                  <ShieldCheck size={11} />{(c.localRecord.reviews || []).length}条复核
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="conflict-case-side conflict-side-external">
                            <div className="conflict-side-label">外部版本</div>
                            <div className="conflict-side-content">
                              <span className={'status ' + statusClass(queueConfig, c.externalRecord.status)}>{c.externalRecord.status}</span>
                              <span>{c.externalRecord.doctor}</span>
                              <span>{c.externalRecord.priority}</span>
                              {(c.externalRecord.reviews || []).length > 0 && (
                                <span className="conflict-review-count">
                                  <ShieldCheck size={11} />{(c.externalRecord.reviews || []).length}条复核
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="conflict-strategies">
                <div className="conflict-strategies-title">选择处理方式</div>
                <div className="conflict-strategy-options">
                  <button
                    className="conflict-strategy-btn strategy-keep-local"
                    type="button"
                    onClick={() => handleConflictResolve('keep-local')}
                  >
                    <div className="strategy-icon"><Save size={20} /></div>
                    <div className="strategy-info">
                      <strong>保留本页</strong>
                      <p>丢弃外部更新，保留本页所有修改。外部标签页的更改将被覆盖。</p>
                    </div>
                  </button>
                  <button
                    className="conflict-strategy-btn strategy-adopt-latest"
                    type="button"
                    onClick={() => handleConflictResolve('adopt-latest')}
                  >
                    <div className="strategy-icon"><RotateCcw size={20} /></div>
                    <div className="strategy-info">
                      <strong>采用最新</strong>
                      <p>丢弃本页修改，采用外部标签页的最新数据。本页未保存的更改将丢失。</p>
                    </div>
                  </button>
                  <button
                    className="conflict-strategy-btn strategy-merge"
                    type="button"
                    onClick={() => handleConflictResolve('merge')}
                  >
                    <div className="strategy-icon"><Layers size={20} /></div>
                    <div className="strategy-info">
                      <strong>按病例合并</strong>
                      <p>智能合并双方修改：合并状态时间线、保留双方复核意见、按时间取最新标量字段、合并新增记录。删除冲突需人工确认。</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchOpen && (
        <div className="batch-overlay" onClick={handleBatchClose}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <FileUp size={18} />
                <h2>批量导入预检</h2>
              </div>
              <button className="batch-close" onClick={handleBatchClose}><X size={18} /></button>
            </div>

            <div className="batch-body">
              <label className="wide">
                <span>粘贴病例数据（Tab分隔：病例号 / 标本类型 / 优先级 / 送检时间 / 负责医生 / 备注）</span>
                <textarea
                  className="batch-textarea"
                  rows={6}
                  value={batchRaw}
                  onChange={(e) => setBatchRaw(e.target.value)}
                  placeholder={"P2026061302\t穿刺\t加急\t2026-06-13T09:00\t张医生\t关注切片\nP2026061303\t胃镜\t常规\t2026-06-13T10:30\t王医生\t"}
                />
              </label>
              <button className="primary" type="button" onClick={handleBatchParse} disabled={!batchRaw.trim()}>
                <ClipboardList size={16} />解析数据
              </button>

              {batchParsed.length > 0 && (
                <div className="batch-preview">
                  <div className="batch-summary">
                    <span>共解析 <strong>{batchParsed.length}</strong> 条</span>
                    {batchParsed.some((r) => r._missingRequired.length > 0) && (
                      <span className="warning"><AlertTriangle size={14} />{batchParsed.filter((r) => r._missingRequired.length > 0).length} 条缺失必填字段</span>
                    )}
                    {batchParsed.some((r) => r._duplicate) && (
                      <span className="warning"><AlertCircle size={14} />{batchParsed.filter((r) => r._duplicate).length} 条病例号重复</span>
                    )}
                    {batchParsed.filter((r) => !r._duplicate && !r._invalid).length < batchParsed.length && (
                      <span><CheckCircle2 size={14} />{batchParsed.filter((r) => !r._duplicate && !r._invalid).length} 条可导入</span>
                    )}
                  </div>

                  {batchColumns.length > 0 && (
                    <div className="field-mapping-section">
                      <div className="field-mapping-header">
                        <ArrowRightLeft size={16} />
                        <h3>字段映射调整</h3>
                        <div className="field-mapping-actions">
                          <span className={`detection-badge ${detectedHeader ? 'has-header' : 'no-header'}`}>
                            {detectedHeader ? '✓ 检测到表头' : '按位置顺序映射'}
                          </span>
                          <button
                            type="button"
                            className="mapping-action-btn"
                            onClick={() => {
                              const orderMap = fallbackOrderMapping(batchColumns);
                              setFieldMapping(orderMap);
                              const parsed = applyFieldMapping(rawParsed, batchColumns, orderMap, tempDefaultValues);
                              setBatchParsed(parsed);
                            }}
                            title="按列顺序依次映射到配置字段"
                          >
                            <Layers size={13} />顺序映射
                          </button>
                          <button
                            type="button"
                            className="mapping-action-btn"
                            onClick={() => {
                              const hasHeader = batchColumns.some((c) => c.originalName !== `列${c.index + 1}`);
                              const smartMap = guessFieldMapping(batchColumns, hasHeader);
                              setFieldMapping(smartMap);
                              const parsed = applyFieldMapping(rawParsed, batchColumns, smartMap, tempDefaultValues);
                              setBatchParsed(parsed);
                            }}
                            title="根据列名智能匹配字段"
                          >
                            <Zap size={13} />智能映射
                          </button>
                        </div>
                        <span className="hint">将原始列映射到目标字段，可忽略不需要的列或设置默认值</span>
                      </div>
                      <div className="field-mapping-grid">
                        {batchColumns.map((col) => {
                          const currentMapping = fieldMapping[col.index];
                          const mappedField = BATCH_FIELDS.find((f) => f.key === currentMapping);
                          const sampleValue = rawParsed[0]?.[`_col_${col.index}`] || '';
                          const isIgnored = currentMapping === '__ignore__';

                          return (
                            <div key={col.index} className={`field-mapping-row ${isIgnored ? 'ignored' : ''}`}>
                              <div className="source-col">
                                <div className="col-name">{col.name}</div>
                                {sampleValue && <div className="col-sample">示例: {sampleValue.slice(0, 20)}{sampleValue.length > 20 ? '...' : ''}</div>}
                              </div>
                              <div className="mapping-arrow">→</div>
                              <div className="target-field">
                                <select
                                  value={currentMapping || ''}
                                  onChange={(e) => handleFieldMappingChange(col.index, e.target.value || null)}
                                >
                                  <option value="">-- 不映射 --</option>
                                  <option value="__ignore__">-- 忽略此列 --</option>
                                  {BATCH_FIELDS.map((field) => {
                                    const isUsed = Object.values(fieldMapping).includes(field.key) && fieldMapping[col.index] !== field.key;
                                    return (
                                      <option key={field.key} value={field.key} disabled={isUsed}>
                                        {field.label}{field.required ? ' *' : ''}{isUsed ? ' (已映射)' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                                {mappedField?.required && isIgnored && (
                                  <span className="mapping-warning">必填字段被忽略</span>
                                )}
                              </div>
                              {isIgnored && <span className="ignore-badge">已忽略</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div className="default-values-section">
                        <div className="default-values-header">
                          <Edit size={14} />
                          <h4>默认值补充</h4>
                          <span className="hint">为缺失值的字段设置默认值</span>
                        </div>
                        <div className="default-values-grid">
                          {BATCH_FIELDS.map((field) => {
                            const isMapped = Object.values(fieldMapping).includes(field.key);
                            const currentValue = tempDefaultValues[field.key] || '';

                            return (
                              <div key={field.key} className="default-value-row">
                                <label className="default-value-label">
                                  {field.label}{field.required ? ' *' : ''}
                                  {!isMapped && <span className="not-mapped-badge">未映射</span>}
                                </label>
                                {field.type === 'select' && field.options?.length ? (
                                  <select
                                    value={currentValue}
                                    onChange={(e) => handleDefaultValueChange(field.key, e.target.value)}
                                    placeholder={`设置${field.label}默认值`}
                                  >
                                    <option value="">-- 无默认值 --</option>
                                    {field.options.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => handleDefaultValueChange(field.key, e.target.value)}
                                    placeholder={`设置${field.label}默认值`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="batch-list">
                    {batchParsed.map((r) => (
                      <article className={'record ' + (r._duplicate || r._invalid ? 'conflict' : '')} key={r._id}>
                        <div className="record-head">
                          <div>
                            <h3>{r.caseNo || '(无病例号)'}</h3>
                            <p>{[r.sampleType, r.priority, r.doctor].filter(Boolean).join(' · ') || '无详细信息'}</p>
                          </div>
                          <span className={'status ' + statusClass(queueConfig, r.status)}>{r.status}</span>
                        </div>
                        {r.summary && <p className="record-detail">{r.summary}</p>}
                        {r.sentAt && <p className="record-detail">送检时间：{r.sentAt}</p>}
                        {r._missingRequired.length > 0 && (
                          <div className="warning"><AlertTriangle size={14} />缺失必填：{r._missingRequired.join('、')}，导入时将跳过</div>
                        )}
                        {r._missingOptional.length > 0 && r._missingRequired.length === 0 && (
                          <div className="hint" style={{ marginTop: '8px', color: '#667085', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>未填写：{r._missingOptional.join('、')}</div>
                        )}
                        {r._duplicate && (
                          <div className="warning"><AlertCircle size={14} />病例号与已有记录重复，导入时将跳过</div>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="batch-actions">
                    <button className="primary" type="button" onClick={handleBatchConfirm} disabled={batchParsed.filter((r) => !r._duplicate && !r._invalid).length === 0}>
                      <CheckCircle2 size={16} />确认导入（{batchParsed.filter((r) => !r._duplicate && !r._invalid).length} 条有效）
                    </button>
                    <button className="secondary" type="button" onClick={handleBatchClose}>取消</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {statusNoteAdding && (
        <div className="batch-overlay" onClick={handleStatusNoteCancel}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-header">
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <MessageSquare size={18} />
                <h2>状态流转备注（选填）</h2>
              </div>
              <button className="batch-close" onClick={handleStatusNoteCancel}><X size={18} /></button>
            </div>

            <div className="batch-body">
              <p className="hint">
                即将流转至状态：<strong style={{ color: 'var(--accent)' }}>{statusNoteAdding.status}</strong>
                <br />
                可补充本次流转的备注说明，也可直接跳过。
              </p>
              <form className="note-form" onSubmit={(e) => handleStatusNoteSubmit(e, statusNoteAdding.id, statusNoteAdding.status)}>
                <label>
                  <span><User size={13} />操作人</span>
                  <input
                    type="text"
                    value={noteForm.noteBy}
                    onChange={(e) => setNoteForm({ ...noteForm, noteBy: e.target.value })}
                    placeholder="请输入操作人姓名（选填）"
                  />
                </label>
                <label>
                  <span>
                    <MessageSquare size={13} />备注说明
                  </span>
                  <textarea
                    value={noteForm.noteText}
                    onChange={(e) => setNoteForm({ ...noteForm, noteText: e.target.value })}
                    placeholder="请输入备注说明（选填）"
                    rows={3}
                    autoFocus
                  />
                </label>
                <div className="review-form-actions">
                  <button type="submit" className="primary">
                    <Save size={14} />确认流转{noteForm.noteText.trim() ? '并保存备注' : ''}
                  </button>
                  <button type="button" className="secondary" onClick={handleStatusNoteCancel}>
                    <X size={14} />取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfigManager
        isOpen={showConfigManager}
        onClose={() => setShowConfigManager(false)}
        onSave={handleConfigSave}
        initialConfig={queueConfig}
        sampleRecords={records}
      />
    </main>
  );
}

export default App;
