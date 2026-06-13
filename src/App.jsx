import { useMemo, useState } from 'react';
import { Microscope, Plus, Search, Trash2, RotateCcw, CheckCircle2, AlertTriangle, ClipboardList, CalendarDays, FileUp, X, AlertCircle } from 'lucide-react';
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
  return items.map((item) => ({ id: uid(), timeline: item.timeline || [{ status: item.status, at: today, by: '系统' }], ...item }));
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

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(appConfig.defaultValues);
  const [filters, setFilters] = useState({ query: '', status: '全部' });
  const [selected, setSelected] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchRaw, setBatchRaw] = useState('');
  const [batchParsed, setBatchParsed] = useState([]);

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
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    let startIndex = 0;
    const firstLine = lines[0].toLowerCase();
    if (HEADER_KEYWORDS.some((kw) => firstLine.includes(kw))) {
      startIndex = 1;
    }

    const existingCaseNos = new Set(records.map((r) => r.caseNo));
    const seenCaseNos = new Set();
    const parsed = [];

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 1) continue;

      const record = {};
      BATCH_FIELDS.forEach((field, idx) => {
        record[field.key] = (parts[idx] || '').trim();
      });

      const missing = BATCH_FIELDS
        .filter((f) => f.required && !record[f.key])
        .map((f) => f.label);

      const duplicate = record.caseNo && (existingCaseNos.has(record.caseNo) || seenCaseNos.has(record.caseNo));

      if (record.caseNo) seenCaseNos.add(record.caseNo);

      parsed.push({
        _id: uid(),
        ...record,
        status: appConfig.primaryStatus,
        _missing: missing,
        _duplicate: duplicate,
        _invalid: missing.length > 0,
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
      timeline: [{ status: appConfig.primaryStatus, at: today, by: '批量导入' }],
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
      timeline: [{ status: form.status || appConfig.primaryStatus, at: today, by: '录入' }]
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
    const next = records.map((item) => item.id === id ? {
      ...item,
      status,
      timeline: [...(item.timeline || []), { status, at: today, by: '操作员' }]
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
    const copied = { ...item, id: uid(), status: appConfig.primaryStatus, timeline: [{ status: appConfig.primaryStatus, at: today, by: '复制' }] };
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
            {filteredRecords.map((item) => (
              <article className={'record ' + (item.conflict || hasOverlap(item, records) ? 'conflict' : '')} key={item.id} onClick={() => setSelected(item)}>
                <div className="record-head">
                  <div>
                    <h3>{item.caseNo}</h3>
                    <p>{`${item.sampleType} · ${item.priority} · ${item.doctor}`}</p>
                  </div>
                  <span className={'status ' + statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="record-detail">{item.summary}</p>
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
            ))}
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
              {selected.temps && (
                <div className="temp-chart">
                  {selected.temps.map((value, index) => <i key={index} style={{ height: Math.max(10, 56 + Number(value) * 8) }} title={String(value)} />)}
                </div>
              )}
              <div className="timeline">
                {(selected.timeline || []).map((step, index) => (
                  <span key={index}>{step.at} · {step.status} · {step.by}</span>
                ))}
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
                    {batchParsed.some((r) => r._missing.length > 0) && (
                      <span className="warning"><AlertTriangle size={14} />{batchParsed.filter((r) => r._missing.length > 0).length} 条缺失必填字段</span>
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
                        {r._missing.length > 0 && (
                          <div className="warning"><AlertTriangle size={14} />缺失：{r._missing.join('、')}，导入时将跳过</div>
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
