import { useEffect, useMemo, useState } from 'react';
import { Microscope, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileUp, X, AlertCircle, Clock, Zap, Eye, ShieldCheck, CircleCheckBig, Stethoscope, FileCheck, Edit, Save, UserCheck, Users, Send, CheckSquare, Square, Layers, UserPlus, Info } from 'lucide-react';
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
  const [activeView, setActiveView] = useState('workbench');
  const [dispatchFilters, setDispatchFilters] = useState({ query: '', priority: '全部', sampleType: '全部' });
  const [selectedCases, setSelectedCases] = useState(new Set());
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [selectedDoctorForDetail, setSelectedDoctorForDetail] = useState(null);

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

    const next = records.map((item) => {
      if (!selectedCases.has(item.id)) return item;

      if (item.doctor && item.doctor.trim() === targetDoctor && item.status !== '已完成') {
        skipped.push({
          caseNo: item.caseNo,
          reason: `已由${targetDoctor}负责`
        });
        return item;
      }

      if (item.status === '阅片中' || item.status === '待复核' || item.status === '已完成') {
        skipped.push({
          caseNo: item.caseNo,
          reason: `当前状态为「${item.status}」，不可重新派单`
        });
        return item;
      }

      try {
        const updatedItem = {
          ...item,
          doctor: targetDoctor,
          timeline: [
            ...(item.timeline || []),
            {
              status: '派单',
              at: today,
              by: '调度员',
              changedAt: now,
              action: 'assign',
              fromDoctor: item.doctor || '未分配',
              toDoctor: targetDoctor
            }
          ]
        };
        success.push({ caseNo: item.caseNo });
        return updatedItem;
      } catch (error) {
        failed.push({
          caseNo: item.caseNo,
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
        if (successIds.has(item.caseNo)) {
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

  const sampleTypeList = useMemo(() => {
    const types = new Set();
    records.forEach((item) => {
      if (item.sampleType) types.add(item.sampleType);
    });
    return Array.from(types).sort();
  }, [records]);

  const doctorWorkload = useMemo(() => {
    void tick;
    const workload = {};
    records.forEach((item) => {
      if (!item.doctor) return;
      if (!workload[item.doctor]) {
        workload[item.doctor] = {
          doctor: item.doctor,
          pending: 0,
          reading: 0,
          reviewing: 0,
          total: 0,
          cases: []
        };
      }
      workload[item.doctor].total++;
      workload[item.doctor].cases.push(item);
      if (item.status === '待阅片') workload[item.doctor].pending++;
      else if (item.status === '阅片中') workload[item.doctor].reading++;
      else if (item.status === '待复核') workload[item.doctor].reviewing++;
    });
    return Object.values(workload).sort((a, b) => b.total - a.total);
  }, [records, tick]);

  const unassignedCases = useMemo(() => {
    void tick;
    return records
      .filter((item) => !item.doctor || item.doctor.trim() === '')
      .filter((item) => !dispatchFilters.query || `${item.caseNo}${item.summary}`.includes(dispatchFilters.query))
      .filter((item) => dispatchFilters.priority === '全部' || item.priority === dispatchFilters.priority)
      .filter((item) => dispatchFilters.sampleType === '全部' || item.sampleType === dispatchFilters.sampleType)
      .sort((a, b) => {
        const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (rankDiff !== 0) return rankDiff;
        const aTime = a.sentAt || a.createdAt || '';
        const bTime = b.sentAt || b.createdAt || '';
        return String(aTime).localeCompare(String(bTime));
      });
  }, [records, dispatchFilters, tick]);

  const pendingReassignCases = useMemo(() => {
    void tick;
    return records
      .filter((item) => item.doctor && item.status === '待阅片')
      .filter((item) => !dispatchFilters.query || `${item.caseNo}${item.doctor}${item.summary}`.includes(dispatchFilters.query))
      .filter((item) => dispatchFilters.priority === '全部' || item.priority === dispatchFilters.priority)
      .filter((item) => dispatchFilters.sampleType === '全部' || item.sampleType === dispatchFilters.sampleType)
      .sort((a, b) => {
        const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (rankDiff !== 0) return rankDiff;
        const aTime = a.sentAt || a.createdAt || '';
        const bTime = b.sentAt || b.createdAt || '';
        return String(aTime).localeCompare(String(bTime));
      });
  }, [records, dispatchFilters, tick]);

  const allDispatchableCases = useMemo(() => {
    return [...unassignedCases, ...pendingReassignCases];
  }, [unassignedCases, pendingReassignCases]);

  const selectedCasesData = useMemo(() => {
    return records.filter((item) => selectedCases.has(item.id));
  }, [records, selectedCases]);

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
                  const isDispatch = step.status === '派单';
                  const reviewForStep = isReview
                    ? (selected.reviews || []).find((r) => r.id === step.reviewId)
                    : null;
                  let displayText = `${step.at} · ${step.status}`;
                  if (isReview && reviewForStep) {
                    displayText += `（${reviewForStep.conclusion}）`;
                  }
                  if (isDispatch && step.fromDoctor && step.toDoctor) {
                    displayText += `：${step.fromDoctor} → ${step.toDoctor}`;
                  }
                  displayText += ` · ${step.by}`;
                  return (
                    <span key={index} className={`${isReview ? 'timeline-review' : ''} ${isDispatch ? 'timeline-dispatch' : ''}`}>
                      {displayText}
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
                            <span className={`status ${statusClass(item.status)}`}>{item.status}</span>
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
                  const tat = calcTatInfo(item);
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
                          <span className={'status ' + statusClass(item.status)}>{item.status}</span>
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
                            等待：{waitDuration(item)}
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

      {showDispatchConfirm && (
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
                <div className="confirm-preview">
                  {selectedCasesData.slice(0, 5).map((item) => (
                    <div key={item.id} className="confirm-item">
                      <span>{item.caseNo}</span>
                      <span className={`priority-tag priority-${item.priority}`}>{item.priority}</span>
                      <span className={'status ' + statusClass(item.status)}>{item.status}</span>
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
