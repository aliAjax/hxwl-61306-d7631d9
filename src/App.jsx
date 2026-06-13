import { useEffect, useMemo, useState } from 'react';
import { Microscope, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileUp, X, AlertCircle, Clock, Zap, Eye, ShieldCheck, CircleCheckBig, Stethoscope, FileCheck, Edit, Save, UserCheck } from 'lucide-react';
import './App.css';

const appConfig = {
  "id": "hxwl-61306",
  "port": 61306,
  "title": "病理科玻片阅片队列",
  "subtitle": "优先级、等待时间、阅片状态与详情抽屉",
  "domain": "病理科",
  "icon": "Microscope",
  "storage": "hxwl-61306-pathology-slides",
  "accent": "#7c3aed",
  "statuses": [
    "待阅片",
    "阅片中",
    "待复核",
    "已完成"
  ],
  "primaryStatus": "待阅片",
  "fields": [
    {
      "key": "caseNo",
      "label": "病例号",
      "type": "input",
      "placeholder": "P2026061301",
      "options": []
    },
    {
      "key": "sampleType",
      "label": "标本类型",
      "type": "select",
      "placeholder": "穿刺",
      "options": [
        "穿刺",
        "胃镜",
        "肠镜",
        "手术切除",
        "细胞学"
      ]
    },
    {
      "key": "priority",
      "label": "优先级",
      "type": "select",
      "placeholder": "加急",
      "options": [
        "常规",
        "加急",
        "危急"
      ]
    },
    {
      "key": "sentAt",
      "label": "送检时间",
      "type": "datetime-local",
      "placeholder": "",
      "options": []
    },
    {
      "key": "doctor",
      "label": "负责医生",
      "type": "input",
      "placeholder": "李医生",
      "options": []
    },
    {
      "key": "summary",
      "label": "备注",
      "type": "textarea",
      "placeholder": "需关注切缘情况",
      "options": []
    }
  ],
  "seed": [
    {
      "caseNo": "P2026061301",
      "sampleType": "穿刺",
      "priority": "加急",
      "sentAt": "2026-06-13T08:30",
      "doctor": "李医生",
      "summary": "需关注切缘情况",
      "status": "待阅片"
    },
    {
      "caseNo": "P2026061208",
      "sampleType": "胃镜",
      "priority": "常规",
      "sentAt": "2026-06-12T15:10",
      "doctor": "王医生",
      "summary": "慢性炎症复核",
      "status": "阅片中"
    },
    {
      "caseNo": "P2026061117",
      "sampleType": "手术切除",
      "priority": "危急",
      "sentAt": "2026-06-11T10:20",
      "doctor": "周医生",
      "summary": "疑似恶性，等待复核",
      "status": "待复核"
    }
  ],
  "metrics": [
    [
      "队列病例",
      "records.length"
    ],
    [
      "危急/加急",
      "records.filter((item) => item.priority !== '常规').length"
    ],
    [
      "待复核",
      "records.filter((item) => item.status === '待复核').length"
    ]
  ],
  "filters": [
    {
      "key": "query",
      "label": "病例/医生",
      "type": "search",
      "match": "`${item.caseNo}${item.doctor}`.includes(filters.query)"
    },
    {
      "key": "status",
      "label": "阅片状态",
      "type": "status"
    }
  ],
  "cardTitle": "item.caseNo",
  "cardMeta": "`${item.sampleType} · ${item.priority} · ${item.doctor}`",
  "cardDetail": "item.summary",
  "dateKey": "sentAt",
  "sort": "priority",
  "note": "首页按优先级和等待时间排序，并提供详情抽屉。",
  "defaultValues": {
    "caseNo": "P2026061301",
    "sampleType": "穿刺",
    "priority": "加急",
    "sentAt": "",
    "doctor": "李医生",
    "summary": "需关注切缘情况",
    "status": "待阅片"
  }
};

const today = new Date().toISOString().slice(0, 10);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function withIds(items) {
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统', changedAt: new Date().toISOString() }], ...item }));
}

function loadRecords() {
  const raw = localStorage.getItem(appConfig.storage);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return withIds(appConfig.seed);
    }
  }
  return withIds(appConfig.seed);
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

function priorityRank(value) {
  return { 危急: 0, 加急: 1, 常规: 2, 高: 0, 中: 1, 低: 2 }[value] ?? 9;
}

function hasOverlap(target, records) {
  if (!target.bed || !target.date || !target.start || !target.end) return false;
  return records.some((item) => item.id !== target.id && item.bed === target.bed && item.date === target.date && target.start < item.end && target.end > item.start);
}

function statusClass(status) {
  const index = appConfig.statuses.indexOf(status);
  return ['status-a', 'status-b', 'status-c', 'status-d'][index] || 'status-a';
}

const WORKBENCH_ZONES = [
  { key: 'urgent', label: '优先处理', status: '待阅片', icon: Zap, color: '#ef4444' },
  { key: 'reading', label: '正在阅片', status: '阅片中', icon: Eye, color: '#7c3aed' },
  { key: 'review', label: '等待复核', status: '待复核', icon: ShieldCheck, color: '#f59e0b' },
  { key: 'done', label: '已完成', status: '已完成', icon: CircleCheckBig, color: '#10b981' },
];

function waitDuration(item) {
  const now = Date.now();
  const timeline = item.timeline || [];
  const lastEntry = timeline[timeline.length - 1];
  const startMs = [item.sentAt, item.createdAt, lastEntry?.changedAt]
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

function nextStatus(current) {
  const idx = appConfig.statuses.indexOf(current);
  if (idx < 0 || idx >= appConfig.statuses.length - 1) return null;
  return appConfig.statuses[idx + 1];
}

function prevStatus(current) {
  const idx = appConfig.statuses.indexOf(current);
  if (idx <= 0) return null;
  return appConfig.statuses[idx - 1];
}

const REVIEW_CONCLUSIONS = ['通过', '修改后通过', '退回重审'];

const TAT_THRESHOLDS = {
  '危急': { timeout: 2 * 60, warning: 1 * 60 },
  '加急': { timeout: 24 * 60, warning: 12 * 60 },
  '常规': { timeout: 72 * 60, warning: 48 * 60 },
};

const TAT_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  OVERDUE: 'overdue',
  UNKNOWN: 'unknown',
};

function getTatThresholds(priority) {
  return TAT_THRESHOLDS[priority] || TAT_THRESHOLDS['常规'];
}

function getStartTime(item) {
  const timeline = item.timeline || [];
  const firstEntry = timeline[0];
  const candidates = [item.sentAt, item.createdAt, firstEntry?.changedAt];
  for (const value of candidates) {
    if (value) {
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

function getEndTime(item) {
  if (item.status !== '已完成') return null;
  const timeline = item.timeline || [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].status === '已完成') {
      const ms = new Date(timeline[i].changedAt).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }
  return null;
}

function calcTatInfo(item) {
  const startMs = getStartTime(item);
  const now = Date.now();

  if (!startMs) {
    return {
      status: TAT_STATUS.UNKNOWN,
      waitedMinutes: 0,
      remainingMinutes: null,
      threshold: null,
      hasStartTime: false,
    };
  }

  const endMs = getEndTime(item);
  const refMs = endMs || now;
  const waitedMinutes = Math.floor((refMs - startMs) / 60000);
  const thresholds = getTatThresholds(item.priority);
  const timeoutMinutes = thresholds.timeout;
  const warningMinutes = thresholds.warning;

  if (item.status === '已完成') {
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

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRaw, setBatchRaw] = useState('');
  const [batchParsed, setBatchParsed] = useState([]);
  const [tick, setTick] = useState(0);
  const [reviewForm, setReviewForm] = useState({ reviewDoctor: '', conclusion: '', remark: '' });
  const [reviewEditing, setReviewEditing] = useState(false);
  const [tatFilters, setTatFilters] = useState({ doctor: '全部', status: '全部', tatStatus: '全部' });
  const [showTatBoard, setShowTatBoard] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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
            status: '复核意见',
            at: today,
            by: reviewForm.reviewDoctor.trim(),
            changedAt: now,
            reviewId: reviewRecord.id
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

  const BATCH_FIELDS = [
    { key: 'caseNo', label: '病例号', required: true },
    { key: 'sampleType', label: '标本类型', required: false },
    { key: 'priority', label: '优先级', required: false },
    { key: 'sentAt', label: '送检时间', required: false },
    { key: 'doctor', label: '负责医生', required: false },
    { key: 'summary', label: '备注', required: false },
  ];

  const HEADER_KEYWORDS = ['病例号', '标本类型', '优先级', '送检时间', '负责医生', '备注', 'caseno', 'sampletype', 'priority', 'sentat', 'doctor', 'summary'];

  function parseBatchLines(raw) {
    const lines = raw.split('\n').map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) return [];

    let startIndex = 0;
    const firstLine = lines[0].toLowerCase();
    if (HEADER_KEYWORDS.some((kw) => firstLine.includes(kw))) {
      startIndex = 1;
    }

    const fieldCount = BATCH_FIELDS.length;
    const existingCaseNos = new Set(records.map((r) => r.caseNo));
    const seenCaseNos = new Set();
    const parsed = [];

    for (let i = startIndex; i < lines.length; i++) {
      const rawLine = lines[i];
      let parts = rawLine.split('\t');
      if (parts.length < fieldCount) {
        parts = parts.concat(new Array(fieldCount - parts.length).fill(''));
      } else if (parts.length > fieldCount) {
        const extra = parts.slice(fieldCount - 1).join(' ');
        parts = parts.slice(0, fieldCount - 1).concat([extra]);
      }
      parts = parts.map((p) => (p || '').trim());

      const record = {};
      BATCH_FIELDS.forEach((field, idx) => {
        record[field.key] = parts[idx] || '';
      });

      const missingRequired = BATCH_FIELDS
        .filter((f) => f.required && !record[f.key])
        .map((f) => f.label);

      const missingOptional = BATCH_FIELDS
        .filter((f) => !f.required && !record[f.key])
        .map((f) => f.label);

      const duplicate = record.caseNo && (existingCaseNos.has(record.caseNo) || seenCaseNos.has(record.caseNo));

      if (record.caseNo) seenCaseNos.add(record.caseNo);

      parsed.push({
        _id: uid(),
        ...record,
        status: appConfig.primaryStatus,
        _missingRequired: missingRequired,
        _missingOptional: missingOptional,
        _duplicate: duplicate,
        _invalid: missingRequired.length > 0,
      });
    }

    return parsed;
  }

  function handleBatchParse() {
    const parsed = parseBatchLines(batchRaw);
    setBatchParsed(parsed);
  }

  function handleBatchConfirm() {
    const valid = batchParsed.filter((r) => !r._duplicate && !r._invalid);
    if (!valid.length) return;

    const now = new Date().toISOString();
    const newRecords = valid.map((r) => ({
      id: uid(),
      caseNo: r.caseNo,
      sampleType: r.sampleType || '',
      priority: r.priority || '常规',
      sentAt: r.sentAt || '',
      doctor: r.doctor || '',
      summary: r.summary || '',
      status: appConfig.primaryStatus,
      createdAt: now,
      timeline: [{ status: appConfig.primaryStatus, at: today, by: '批量导入', changedAt: new Date().toISOString() }],
    }));

    persist([...newRecords, ...records]);
    setBatchOpen(false);
    setBatchRaw('');
    setBatchParsed([]);
  }

  function handleBatchClose() {
    setBatchOpen(false);
    setBatchRaw('');
    setBatchParsed([]);
  }

  function persist(next) {
    setRecords(next);
    localStorage.setItem(appConfig.storage, JSON.stringify(next));
  }

  function addRecord(event) {
    event.preventDefault();
    const nextRecord = {
      id: uid(),
      ...form,
      status: form.status || appConfig.primaryStatus,
      createdAt: new Date().toISOString(),
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入', changedAt: new Date().toISOString() }]
    };

    if (appConfig.conflict === 'date-slot' && records.some((item) => item.date === nextRecord.date && item.slot === nextRecord.slot)) {
      nextRecord.conflict = true;
    }
    if (appConfig.conflict === 'bed-time' && hasOverlap(nextRecord, records)) {
      nextRecord.conflict = true;
    }
    if (appConfig.chart) {
      const temp = Number(nextRecord.temperature || 0);
      nextRecord.temps = [temp];
      if (temp > 2) nextRecord.status = '异常';
    }

    persist([nextRecord, ...records]);
    setForm(appConfig.defaultValues);
    setSelected(nextRecord);
  }

  function updateStatus(id, status) {
    const now = new Date().toISOString();
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员', changedAt: now }]
    } : item);
    persist(next);
    if (selected?.id === id) setSelected(next.find((item) => item.id === id));
  }

  function removeRecord(id) {
    const next = records.filter((item) => item.id !== id);
    persist(next);
    if (selected?.id === id) setSelected(null);
  }

  function duplicateRecord(item) {
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制', changedAt: new Date().toISOString() }] };
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
    return records
      .filter((item) => !filters.query || `${item.caseNo}${item.doctor}`.includes(filters.query))
      .filter((item) => filters.status === '全部' || item.status === filters.status)
      .sort((a, b) => {
        if (appConfig.sort === 'priority') {
          const rank = priorityRank(a.priority) - priorityRank(b.priority);
          if (rank !== 0) return rank;
        }
        const aDate = a[appConfig.dateKey] || a.sentAt || a.createdAt || '';
        const bDate = b[appConfig.dateKey] || b.sentAt || b.createdAt || '';
        return String(aDate).localeCompare(String(bDate));
      });
  }, [records, filters]);

  const metrics = [
    { label: "队列病例", value: records.length },
    { label: "危急/加急", value: records.filter((item) => item.priority !== '常规').length },
    { label: "待复核", value: records.filter((item) => item.status === '待复核').length },
  ];

  const groupedByDate = useMemo(() => {
    return filteredRecords.reduce((acc, item) => {
      const key = item[appConfig.dateKey] || item.date || item.enrollDate || '未排期';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [filteredRecords]);

  const directory = useMemo(() => {
    return records.reduce((acc, item) => {
      const key = item.issue || '未分类';
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
  }, [records]);

  const workbenchGroups = useMemo(() => {
    void tick;
    return WORKBENCH_ZONES.map((zone) => ({
      ...zone,
      items: records
        .filter((item) => item.status === zone.status)
        .sort((a, b) => {
          if (zone.status === '待阅片') {
            const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
            if (rankDiff !== 0) return rankDiff;
          }
          const aTime = a.sentAt || a.createdAt || '';
          const bTime = b.sentAt || b.createdAt || '';
          return String(aTime).localeCompare(String(bTime));
        }),
    }));
  }, [records, tick]);

  const doctorList = useMemo(() => {
    const doctors = new Set();
    records.forEach((item) => {
      if (item.doctor) doctors.add(item.doctor);
    });
    return Array.from(doctors).sort();
  }, [records]);

  const tatFilteredRecords = useMemo(() => {
    void tick;
    return records
      .filter((item) => tatFilters.doctor === '全部' || item.doctor === tatFilters.doctor)
      .filter((item) => tatFilters.status === '全部' || item.status === tatFilters.status)
      .filter((item) => {
        if (tatFilters.tatStatus === '全部') return true;
        const tat = calcTatInfo(item);
        if (tatFilters.tatStatus === '已超时') return tat.status === TAT_STATUS.OVERDUE;
        if (tatFilters.tatStatus === '即将超时') return tat.status === TAT_STATUS.WARNING;
        if (tatFilters.tatStatus === '正常') return tat.status === TAT_STATUS.NORMAL;
        if (tatFilters.tatStatus === '待计时') return tat.status === TAT_STATUS.UNKNOWN;
        return true;
      })
      .sort((a, b) => {
        const tatA = calcTatInfo(a);
        const tatB = calcTatInfo(b);
        const rankA = { [TAT_STATUS.OVERDUE]: 0, [TAT_STATUS.WARNING]: 1, [TAT_STATUS.NORMAL]: 2, [TAT_STATUS.UNKNOWN]: 3 }[tatA.status] ?? 9;
        const rankB = { [TAT_STATUS.OVERDUE]: 0, [TAT_STATUS.WARNING]: 1, [TAT_STATUS.NORMAL]: 2, [TAT_STATUS.UNKNOWN]: 3 }[tatB.status] ?? 9;
        if (rankA !== rankB) return rankA - rankB;
        const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return (tatA.waitedMinutes || 0) - (tatB.waitedMinutes || 0);
      });
  }, [records, tatFilters, tick]);

  const tatStats = useMemo(() => {
    void tick;
    let overdue = 0;
    let warning = 0;
    let normal = 0;
    let unknown = 0;
    const waitTimes = [];

    tatFilteredRecords.forEach((item) => {
      const tat = calcTatInfo(item);
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
    <main className="shell" style={{ '--accent': appConfig.accent }}>
      <section className="hero">
        <div>
          <div className="eyebrow"><Microscope size={18} />{appConfig.domain}</div>
          <h1>{appConfig.title}</h1>
          <p>{appConfig.subtitle}</p>
        </div>
        <div className="port-card">
          <span>Local Port</span>
          <strong>{appConfig.port}</strong>
        </div>
      </section>

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
            const ZoneIcon = zone.icon;
            return (
              <div className="workbench-column" key={zone.key}>
                <div className="workbench-column-header" style={{ '--zone-color': zone.color }}>
                  <ZoneIcon size={16} />
                  <span>{zone.label}</span>
                  <strong>{zone.items.length}</strong>
                </div>
                <div className="workbench-cards">
                  {zone.items.length === 0 && (
                    <p className="workbench-empty">暂无病例</p>
                  )}
                  {zone.items.map((item) => {
                    const tat = calcTatInfo(item);
                    return (
                    <div className={`workbench-card tat-card-${tat.status}`} key={item.id} onClick={() => setSelected(item)}>
                      <div className="workbench-card-top">
                        <h3>{item.caseNo}</h3>
                        <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                      </div>
                      <div className="workbench-card-meta">
                        <span>{item.sampleType}</span>
                        <span>{item.doctor}</span>
                        {zone.key === 'review' && (item.reviews || []).length > 0 && (
                          <span className="wb-review-badge">已复核</span>
                        )}
                        {zone.key === 'review' && !(item.reviews || []).length && (
                          <span className="wb-review-badge wb-review-pending">待录入</span>
                        )}
                      </div>
                      <div className="workbench-card-wait">
                        <Clock size={13} />
                        <span>{waitDuration(item)}</span>
                        {tat.status !== TAT_STATUS.NORMAL && tat.status !== TAT_STATUS.UNKNOWN && (
                          <span className={`wb-tat-badge ${tatStatusClass(tat.status)}`}>
                            {tatStatusLabel(tat.status)}
                          </span>
                        )}
                      </div>
                      <div className="workbench-card-actions" onClick={(e) => e.stopPropagation()}>
                        {prevStatus(item.status) && (
                          <button className="wb-btn wb-btn-prev" type="button" onClick={() => updateStatus(item.id, prevStatus(item.status))}>
                            ← {prevStatus(item.status)}
                          </button>
                        )}
                        {nextStatus(item.status) && (
                          <button className="wb-btn wb-btn-next" type="button" style={{ '--zone-color': zone.color }} onClick={() => updateStatus(item.id, nextStatus(item.status))}>
                            {nextStatus(item.status)} →
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
            <div className="eyebrow"><Clock size={18} />TAT超时预警看板</div>
            <div className="tat-filters">
              <select value={tatFilters.tatStatus} onChange={(e) => setTatFilters({ ...tatFilters, tatStatus: e.target.value })}>
                <option value="全部">全部状态</option>
                <option value="已超时">已超时</option>
                <option value="即将超时">即将超时</option>
                <option value="正常">正常</option>
                <option value="待计时">待计时</option>
              </select>
              <select value={tatFilters.doctor} onChange={(e) => setTatFilters({ ...tatFilters, doctor: e.target.value })}>
                <option value="全部">全部医生</option>
                {doctorList.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select value={tatFilters.status} onChange={(e) => setTatFilters({ ...tatFilters, status: e.target.value })}>
                <option value="全部">全部阅片状态</option>
                {appConfig.statuses.map((s) => <option key={s}>{s}</option>)}
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

          <div className="tat-thresholds">
            <span className="tat-thresholds-label">TAT阈值：</span>
            {Object.entries(TAT_THRESHOLDS).map(([priority, th]) => (
              <span key={priority} className="tat-threshold-item">
                <strong>{priority}</strong>：{formatDuration(th.warning)}预警 / {formatDuration(th.timeout)}超时
              </span>
            ))}
          </div>

          <div className="tat-list">
            {tatFilteredRecords.length === 0 && (
              <div className="tat-empty">暂无符合条件的病例</div>
            )}
            {tatFilteredRecords.map((item) => {
              const tat = calcTatInfo(item);
              return (
                <article
                  className={`tat-record tat-${tat.status}`}
                  key={item.id}
                  onClick={() => setSelected(item)}
                >
                  <div className="tat-record-main">
                    <div className="tat-record-head">
                      <h3>{item.caseNo}</h3>
                      <span className={`tat-badge ${tatStatusClass(tat.status)}`}>
                        {tatStatusLabel(tat.status)}
                      </span>
                    </div>
                    <div className="tat-record-meta">
                      <span>{item.sampleType}</span>
                      <span className={`priority-tag priority-${item.priority}`}>{item.priority}</span>
                      <span>{item.doctor}</span>
                      <span className={'status ' + statusClass(item.status)}>{item.status}</span>
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
        </section>
      )}

      <section className="workspace">
        <form className="panel form-panel" onSubmit={addRecord}>
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2>新增记录</h2>
          </div>
          <div className="form-grid">
            {appConfig.fields.map((field) => (
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
              <select value={form.status || appConfig.primaryStatus} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="primary" type="submit"><Plus size={18} />新增</button>
            <button className="secondary" type="button" onClick={() => setBatchOpen(true)}><FileUp size={18} />批量导入</button>
          </div>
          <p className="hint">{appConfig.note}</p>
        </form>

        <section className="panel list-panel">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder={appConfig.filters[0]?.label || '搜索'} />
            </div>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option>全部</option>
              {appConfig.statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          <div className="records">
            {filteredRecords.map((item) => {
              const tat = calcTatInfo(item);
              return (
              <article className={`record ${item.conflict || hasOverlap(item, records) ? 'conflict' : ''} tat-list-${tat.status}`} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item.caseNo}</h3>
                    <p>{`${item.sampleType} · ${item.priority} · ${item.doctor}`}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <span className={'status ' + statusClass(item.status)}>{item.status}</span>
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
                <p className="record-detail">{item.summary}</p>
                {item.status === '待复核' && (item.reviews || []).length > 0 && (
                  <div className="record-review-hint">
                    <ShieldCheck size={13} />
                    <span>已复核（{(item.reviews || []).slice(-1)[0]?.conclusion}）</span>
                  </div>
                )}
                {(item.conflict || hasOverlap(item, records)) && <div className="warning"><AlertTriangle size={15} />发现冲突</div>}
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  {appConfig.statuses.map((status) => (
                    <button key={status} type="button" onClick={() => updateStatus(item.id, status)}>{status}</button>
                  ))}
                  {appConfig.action === 'copyRecipe' && <button type="button" onClick={() => duplicateRecord(item)}><RotateCcw size={14} />复制</button>}
                  {appConfig.chart && <button type="button" onClick={() => addTemperature(item)}>加温度</button>}
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
            <h2>{appConfig.directory ? '证据目录预览' : appConfig.board ? '床位看板' : '分组视图'}</h2>
          </div>
          {appConfig.directory ? (
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
              <p>{selected.summary}</p>

              {(() => {
                const tat = calcTatInfo(selected);
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
                            <span><ClipboardList size={13} />补充说明</span>
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

              <div className="timeline">
                {(selected.timeline || []).map((step, index) => {
                  const isReview = step.status === '复核意见';
                  const reviewForStep = isReview
                    ? (selected.reviews || []).find((r) => r.id === step.reviewId)
                    : null;
                  return (
                    <span key={index} className={isReview ? 'timeline-review' : ''}>
                      {step.at} · {step.status}{isReview && reviewForStep ? `（${reviewForStep.conclusion}）` : ''} · {step.by}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="empty">点击任意记录查看详情和状态流转。</p>
          )}
        </aside>
      </section>

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

                  <div className="batch-list">
                    {batchParsed.map((r) => (
                      <article className={'record ' + (r._duplicate || r._invalid ? 'conflict' : '')} key={r._id}>
                        <div className="record-head">
                          <div>
                            <h3>{r.caseNo || '(无病例号)'}</h3>
                            <p>{[r.sampleType, r.priority, r.doctor].filter(Boolean).join(' · ') || '无详细信息'}</p>
                          </div>
                          <span className={'status ' + statusClass(r.status)}>{r.status}</span>
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
    </main>
  );
}

export default App;
