import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, ChevronUp, ChevronDown, RotateCcw, Download, Upload, AlertTriangle, CheckCircle, Settings, Layers, BarChart3, Filter, ArrowUpDown, AlertCircle, Eye, Database, RefreshCw, PlusCircle, MinusCircle, Edit3 } from 'lucide-react';
import {
  sanitizeConfig,
  validateConfig,
  persistConfig,
  resetConfig,
  exportConfig,
  importConfig,
  uid,
  evaluateMetric,
  diffConfig
} from '../config/configManager';
import { FIELD_TYPES, METRIC_TYPES, FILTER_OPERATORS } from '../config/defaultConfig';
import './ConfigManager.css';

const TABS = [
  { key: 'basic', label: '基础设置', icon: Settings },
  { key: 'fields', label: '字段管理', icon: Layers },
  { key: 'statuses', label: '状态流转', icon: ArrowUpDown },
  { key: 'metrics', label: '统计卡片', icon: BarChart3 },
  { key: 'filters', label: '筛选排序', icon: Filter }
];

const PRESET_ICONS = ['Zap', 'Eye', 'ShieldCheck', 'CircleCheckBig', 'CircleDot', 'Clock', 'AlertTriangle', 'CheckCircle', 'FileCheck', 'Stethoscope'];

export function ConfigManager({ isOpen, onClose, initialConfig, onSave, sampleRecords = [] }) {
  const [config, setConfig] = useState(() => sanitizeConfig(initialConfig));
  const [activeTab, setActiveTab] = useState('basic');
  const [warnings, setWarnings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfig(sanitizeConfig(initialConfig));
      setImportError('');
    }
  }, [isOpen, initialConfig]);

  useEffect(() => {
    const { errors: errs, warnings: warns } = validateConfig(config);
    setErrors(errs);
    setWarnings(warns);
  }, [config]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(sanitizeConfig(initialConfig)) !== JSON.stringify(config);
  }, [initialConfig, config]);

  const configDiff = useMemo(() => {
    return diffConfig(sanitizeConfig(initialConfig), config);
  }, [initialConfig, config]);

  function handleSave() {
    setShowPreview(true);
  }

  function confirmSave() {
    const sanitized = sanitizeConfig(config);
    const persisted = persistConfig(sanitized);
    onSave?.(persisted);
    setShowPreview(false);
    onClose();
  }

  function handleReset() {
    const fresh = resetConfig();
    setConfig(fresh);
    setShowConfirmReset(false);
  }

  function handleExport() {
    const data = exportConfig(config);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = importConfig(ev.target.result);
        setConfig(imported);
      } catch (err) {
        setImportError(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function updateRoot(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function updateField(id, patch) {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id ? { ...f, ...patch } : f))
    }));
  }

  function moveField(id, direction) {
    setConfig((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.fields.length) return prev;
      const next = [...prev.fields];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...prev, fields: next.map((f, i) => ({ ...f, order: i })) };
    });
  }

  function addField() {
    setConfig((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id: `f_${uid()}`,
          key: `field_${Date.now()}`,
          label: '新字段',
          type: 'input',
          placeholder: '',
          options: [],
          required: false,
          searchable: false,
          showInCard: false,
          cardPosition: '',
          order: prev.fields.length,
          sortable: false,
          sortWeights: {},
          dateKey: false
        }
      ]
    }));
  }

  function removeField(id) {
    setConfig((prev) => {
      if (prev.fields.length <= 1) return prev;
      const removed = prev.fields.find((f) => f.id === id);
      const nextFields = prev.fields.filter((f) => f.id !== id).map((f, i) => ({ ...f, order: i }));

      const nextConfig = { ...prev, fields: nextFields };

      if (nextConfig.cardDisplay.titleField === removed?.key) {
        nextConfig.cardDisplay = { ...nextConfig.cardDisplay, titleField: nextFields[0]?.key || '' };
      }
      if (nextConfig.cardDisplay.detailField === removed?.key) {
        nextConfig.cardDisplay = { ...nextConfig.cardDisplay, detailField: '' };
      }
      nextConfig.cardDisplay = {
        ...nextConfig.cardDisplay,
        metaFields: nextConfig.cardDisplay.metaFields.filter((k) => k !== removed?.key)
      };

      if (nextConfig.sortConfig.primaryField === removed?.key) {
        nextConfig.sortConfig = { ...nextConfig.sortConfig, primaryField: nextFields.find((f) => f.sortable)?.key || nextFields[0]?.key || '' };
      }
      if (nextConfig.sortConfig.secondaryField === removed?.key) {
        nextConfig.sortConfig = { ...nextConfig.sortConfig, secondaryField: 'createdAt' };
      }
      if (nextConfig.priorityConfig.fieldKey === removed?.key) {
        nextConfig.priorityConfig = { ...nextConfig.priorityConfig, fieldKey: '' };
      }
      if (nextConfig.businessRules.criticalNotify.priorityField === removed?.key) {
        nextConfig.businessRules = {
          ...nextConfig.businessRules,
          criticalNotify: { ...nextConfig.businessRules.criticalNotify, priorityField: '' }
        };
      }

      nextConfig.metrics = nextConfig.metrics.map((m) => {
        if (m.filter?.field === removed?.key || m.field === removed?.key) {
          return { ...m, enabled: false };
        }
        return m;
      });

      nextConfig.filters = nextConfig.filters.map((f) => {
        if (f.field === removed?.key) {
          return { ...f, enabled: false };
        }
        if (f.searchFields) {
          return { ...f, searchFields: f.searchFields.filter((k) => k !== removed?.key) };
        }
        return f;
      });

      nextConfig.batchImport = {
        ...nextConfig.batchImport,
        fields: nextConfig.batchImport.fields.filter((f) => f.key !== removed?.key)
      };

      const newDefaultValues = { ...nextConfig.defaultValues };
      delete newDefaultValues[removed?.key];
      nextConfig.defaultValues = newDefaultValues;

      return nextConfig;
    });
  }

  function updateStatus(id, patch) {
    setConfig((prev) => ({
      ...prev,
      statuses: prev.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s))
    }));
  }

  function moveStatus(id, direction) {
    setConfig((prev) => {
      const idx = prev.statuses.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.statuses.length) return prev;
      const next = [...prev.statuses];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...prev, statuses: next.map((s, i) => ({ ...s, order: i })) };
    });
  }

  function setPrimaryStatus(id) {
    setConfig((prev) => ({
      ...prev,
      statuses: prev.statuses.map((s) => ({ ...s, primary: s.id === id }))
    }));
  }

  function addStatus() {
    setConfig((prev) => ({
      ...prev,
      statuses: [
        ...prev.statuses,
        {
          id: `s_${uid()}`,
          name: `新状态${prev.statuses.length + 1}`,
          color: '#6b7280',
          icon: 'CircleDot',
          order: prev.statuses.length,
          primary: false,
          terminal: false,
          tatTrigger: false
        }
      ]
    }));
  }

  function removeStatus(id) {
    setConfig((prev) => {
      if (prev.statuses.length <= 1) return prev;
      const removed = prev.statuses.find((s) => s.id === id);
      let nextStatuses = prev.statuses.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));

      if (removed?.primary && nextStatuses.length > 0) {
        nextStatuses[0].primary = true;
      }

      const newPrimaryName = nextStatuses.find((s) => s.primary)?.name || nextStatuses[0]?.name;
      const nextSeed = prev.seedData.map((r) => (r.status === removed?.name ? { ...r, status: newPrimaryName } : r));

      return {
        ...prev,
        statuses: nextStatuses,
        seedData: nextSeed,
        businessRules: {
          ...prev.businessRules,
          criticalNotify: {
            ...prev.businessRules.criticalNotify,
            tatTriggerStatuses: prev.businessRules.criticalNotify.tatTriggerStatuses.filter((n) => n !== removed?.name)
          }
        }
      };
    });
  }

  function updateMetric(id, patch) {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.map((m) => (m.id === id ? { ...m, ...patch } : m))
    }));
  }

  function moveMetric(id, direction) {
    setConfig((prev) => {
      const idx = prev.metrics.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.metrics.length) return prev;
      const next = [...prev.metrics];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...prev, metrics: next.map((m, i) => ({ ...m, order: i })) };
    });
  }

  function addMetric() {
    setConfig((prev) => ({
      ...prev,
      metrics: [
        ...prev.metrics,
        {
          id: `m_${uid()}`,
          label: '新统计',
          type: 'count',
          filter: { field: '', operator: 'eq', value: '' },
          field: '',
          enabled: true,
          order: prev.metrics.length
        }
      ]
    }));
  }

  function removeMetric(id) {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics
        .filter((m) => m.id !== id)
        .map((m, i) => ({ ...m, order: i }))
    }));
  }

  function updateFilter(id, patch) {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.id === id ? { ...f, ...patch } : f))
    }));
  }

  function addFilter() {
    setConfig((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          id: `fl_${uid()}`,
          label: '新筛选',
          type: 'select',
          field: prev.fields[0]?.key || '',
          searchFields: [],
          enabled: true,
          order: prev.filters.length
        }
      ]
    }));
  }

  function removeFilter(id) {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters
        .filter((f) => f.id !== id)
        .map((f, i) => ({ ...f, order: i }))
    }));
  }

  if (!isOpen) return null;

  const fieldKeys = config.fields.map((f) => f.key);
  const statusNames = config.statuses.map((s) => s.name);

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-header">
          <div className="cm-header-title">
            <Settings size={20} />
            <h2>队列配置管理</h2>
            {hasChanges && <span className="cm-dirty-badge">未保存</span>}
          </div>
          <div className="cm-header-actions">
            <label className="cm-btn cm-btn-secondary">
              <Upload size={14} />
              导入
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
            <button className="cm-btn cm-btn-secondary" onClick={handleExport}>
              <Download size={14} />导出
            </button>
            <button className="cm-btn cm-btn-secondary" onClick={() => setShowConfirmReset(true)}>
              <RotateCcw size={14} />重置
            </button>
            <button className="cm-btn cm-btn-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {importError && (
          <div className="cm-error-banner">
            <AlertCircle size={16} />{importError}
          </div>
        )}

        <div className="cm-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`cm-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </div>

        <div className="cm-body">
          {activeTab === 'basic' && (
            <BasicTab config={config} onChange={updateRoot} />
          )}

          {activeTab === 'fields' && (
            <FieldsTab
              fields={config.fields}
              onUpdate={updateField}
              onMove={moveField}
              onAdd={addField}
              onRemove={removeField}
              fieldKeys={fieldKeys}
            />
          )}

          {activeTab === 'statuses' && (
            <StatusesTab
              statuses={config.statuses}
              onUpdate={updateStatus}
              onMove={moveStatus}
              onSetPrimary={setPrimaryStatus}
              onAdd={addStatus}
              onRemove={removeStatus}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsTab
              metrics={config.metrics}
              fields={config.fields}
              statusNames={statusNames}
              onUpdate={updateMetric}
              onMove={moveMetric}
              onAdd={addMetric}
              onRemove={removeMetric}
              sampleRecords={sampleRecords}
            />
          )}

          {activeTab === 'filters' && (
            <FiltersTab
              filters={config.filters}
              fields={config.fields}
              statusNames={statusNames}
              sortConfig={config.sortConfig}
              priorityConfig={config.priorityConfig}
              cardDisplay={config.cardDisplay}
              businessRules={config.businessRules}
              onUpdateFilter={updateFilter}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onSortConfigChange={(patch) => updateRoot('sortConfig', { ...config.sortConfig, ...patch })}
              onPriorityConfigChange={(patch) => updateRoot('priorityConfig', { ...config.priorityConfig, ...patch })}
              onCardDisplayChange={(patch) => updateRoot('cardDisplay', { ...config.cardDisplay, ...patch })}
              onBusinessRulesChange={(patch) => updateRoot('businessRules', {
                ...config.businessRules,
                criticalNotify: { ...config.businessRules.criticalNotify, ...patch }
              })}
            />
          )}
        </div>

        <div className="cm-footer">
          <div className="cm-footer-warnings">
            {errors.length > 0 && (
              <div className="cm-warn cm-warn-error">
                <AlertTriangle size={14} />
                {errors[0]}
              </div>
            )}
            {warnings.length > 0 && errors.length === 0 && (
              <div className="cm-warn cm-warn-warning">
                <AlertCircle size={14} />
                {warnings[0]}
                {warnings.length > 1 && ` （共${warnings.length}条）`}
              </div>
            )}
            {errors.length === 0 && warnings.length === 0 && (
              <div className="cm-warn cm-warn-ok">
                <CheckCircle size={14} />配置验证通过
              </div>
            )}
          </div>
          <div className="cm-footer-actions">
            <button className="cm-btn cm-btn-secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="cm-btn cm-btn-primary"
              onClick={handleSave}
              disabled={errors.length > 0}
            >
              <Save size={14} />保存配置
            </button>
          </div>
        </div>

        {showConfirmReset && (
          <div className="cm-confirm-overlay" onClick={() => setShowConfirmReset(false)}>
            <div className="cm-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cm-confirm-icon"><AlertTriangle size={28} /></div>
              <h3>确认重置配置？</h3>
              <p>此操作将恢复为默认病理科配置，<strong>所有自定义设置将丢失</strong>。本地存储的病例数据不会被删除。</p>
              <div className="cm-confirm-actions">
                <button className="cm-btn cm-btn-secondary" onClick={() => setShowConfirmReset(false)}>取消</button>
                <button className="cm-btn cm-btn-danger" onClick={handleReset}>确认重置</button>
              </div>
            </div>
          </div>
        )}

        {showPreview && (
          <ConfigPreviewModal
            diff={configDiff}
            onConfirm={confirmSave}
            onCancel={() => setShowPreview(false)}
          />
        )}
      </div>
    </div>
  );
}

function BasicTab({ config, onChange }) {
  return (
    <div className="cm-section">
      <div className="cm-form-grid">
        <Field label="系统标题">
          <input value={config.title} onChange={(e) => onChange('title', e.target.value)} />
        </Field>
        <Field label="副标题">
          <input value={config.subtitle} onChange={(e) => onChange('subtitle', e.target.value)} />
        </Field>
        <Field label="业务域">
          <input value={config.domain} onChange={(e) => onChange('domain', e.target.value)} />
        </Field>
        <Field label="主题色">
          <div className="cm-color-row">
            <input type="color" value={config.accent} onChange={(e) => onChange('accent', e.target.value)} />
            <input value={config.accent} onChange={(e) => onChange('accent', e.target.value)} />
          </div>
        </Field>
        <Field label="提示说明" full>
          <textarea value={config.note} onChange={(e) => onChange('note', e.target.value)} rows={2} />
        </Field>
      </div>
      <div className="cm-hint-block">
        <Info size={14} />
        <p>基础设置控制页面标题、主题色等外观元素。修改字段、状态、统计卡片请使用其他标签页。</p>
      </div>
    </div>
  );
}

function FieldsTab({ fields, onUpdate, onMove, onAdd, onRemove, fieldKeys }) {
  return (
    <div className="cm-section">
      <div className="cm-section-header">
        <h3>表单字段定义 <span className="cm-count">({fields.length}个)</span></h3>
        <button className="cm-btn cm-btn-primary-sm" onClick={onAdd}>
          <Plus size={14} />新增字段
        </button>
      </div>
      <div className="cm-field-list">
        {fields.map((field, idx) => (
          <div key={field.id} className="cm-field-card">
            <div className="cm-field-card-header">
              <span className="cm-field-order">{idx + 1}</span>
              <strong>{field.label}</strong>
              <span className={`cm-type-tag cm-type-${field.type}`}>{field.type}</span>
              <span className="cm-key-hint">key: {field.key}</span>
              <div className="cm-spacer" />
              <div className="cm-field-card-actions">
                <button className="cm-icon-btn" onClick={() => onMove(field.id, 'up')} disabled={idx === 0}>
                  <ChevronUp size={16} />
                </button>
                <button className="cm-icon-btn" onClick={() => onMove(field.id, 'down')} disabled={idx === fields.length - 1}>
                  <ChevronDown size={16} />
                </button>
                <button
                  className="cm-icon-btn cm-icon-danger"
                  onClick={() => onRemove(field.id)}
                  disabled={fields.length <= 1}
                  title={fields.length <= 1 ? '至少保留1个字段' : '删除字段'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="cm-form-grid">
              <Field label="字段名 (key)">
                <input
                  value={field.key}
                  onChange={(e) => onUpdate(field.id, { key: e.target.value })}
                  disabled={fieldKeys.filter((k) => k === field.key).length <= 1 ? false : true}
                />
              </Field>
              <Field label="显示标签">
                <input value={field.label} onChange={(e) => onUpdate(field.id, { label: e.target.value })} />
              </Field>
              <Field label="控件类型">
                <select value={field.type} onChange={(e) => onUpdate(field.id, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="占位提示">
                <input value={field.placeholder} onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })} />
              </Field>
              {field.type === 'select' && (
                <Field label="选项 (逗号分隔)" full>
                  <input
                    value={(field.options || []).join(', ')}
                    onChange={(e) => onUpdate(field.id, {
                      options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    })}
                    placeholder="选项1, 选项2, 选项3"
                  />
                </Field>
              )}
            </div>
            <div className="cm-checkbox-row">
              <Checkbox
                label="必填"
                checked={field.required}
                onChange={(v) => onUpdate(field.id, { required: v })}
              />
              <Checkbox
                label="参与搜索"
                checked={field.searchable}
                onChange={(v) => onUpdate(field.id, { searchable: v })}
              />
              <Checkbox
                label="卡片中显示"
                checked={field.showInCard}
                onChange={(v) => onUpdate(field.id, { showInCard: v })}
              />
              <Checkbox
                label="可排序"
                checked={field.sortable}
                onChange={(v) => onUpdate(field.id, { sortable: v })}
              />
              <Checkbox
                label="作为时间字段"
                checked={field.dateKey}
                onChange={(v) => onUpdate(field.id, { dateKey: v })}
              />
              {field.type === 'select' && field.sortable && (
                <Field label="排序权重 (优先级从高到低)">
                  <input
                    value={(field.sortWeights ? Object.entries(field.sortWeights).map(([k]) => k) : []).join(', ')}
                    onChange={(e) => {
                      const keys = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      const weights = {};
                      keys.forEach((k, i) => { weights[k] = i; });
                      onUpdate(field.id, { sortWeights: weights });
                    }}
                    placeholder={(field.options || []).join(', ')}
                  />
                </Field>
              )}
              {field.showInCard && (
                <Field label="卡片位置">
                  <select
                    value={field.cardPosition}
                    onChange={(e) => onUpdate(field.id, { cardPosition: e.target.value })}
                  >
                    <option value="">不显示</option>
                    <option value="title">标题 (仅1个)</option>
                    <option value="meta">副标题</option>
                    <option value="detail">详情内容</option>
                  </select>
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusesTab({ statuses, onUpdate, onMove, onSetPrimary, onAdd, onRemove }) {
  return (
    <div className="cm-section">
      <div className="cm-section-header">
        <h3>状态流转定义 <span className="cm-count">({statuses.length}个)</span></h3>
        <button className="cm-btn cm-btn-primary-sm" onClick={onAdd}>
          <Plus size={14} />新增状态
        </button>
      </div>
      <div className="cm-hint-block">
        <Info size={14} />
        <p>顺序决定状态流转方向：上一个 → 下一个。默认状态（标★）是新病例的初始状态。</p>
      </div>
      <div className="cm-status-flow">
        {statuses.map((status, idx) => (
          <div key={status.id} className="cm-status-card">
            <div className="cm-status-flow-arrow-row">
              {idx > 0 && <div className="cm-flow-arrow">→</div>}
              <div className="cm-status-card-inner" style={{ borderColor: status.color }}>
                <div className="cm-status-card-header">
                  <div className="cm-status-name-row">
                    {status.primary && <span className="cm-primary-star" title="初始状态">★</span>}
                    <strong style={{ color: status.color }}>{status.name}</strong>
                  </div>
                  <div className="cm-field-card-actions">
                    <button className="cm-icon-btn" onClick={() => onMove(status.id, 'up')} disabled={idx === 0}>
                      <ChevronUp size={16} />
                    </button>
                    <button className="cm-icon-btn" onClick={() => onMove(status.id, 'down')} disabled={idx === statuses.length - 1}>
                      <ChevronDown size={16} />
                    </button>
                    <button
                      className="cm-icon-btn cm-icon-danger"
                      onClick={() => onRemove(status.id)}
                      disabled={statuses.length <= 1}
                      title={statuses.length <= 1 ? '至少保留1个状态' : '删除状态'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="cm-form-grid">
                  <Field label="状态名称">
                    <input value={status.name} onChange={(e) => onUpdate(status.id, { name: e.target.value })} />
                  </Field>
                  <Field label="颜色">
                    <div className="cm-color-row">
                      <input type="color" value={status.color} onChange={(e) => onUpdate(status.id, { color: e.target.value })} />
                      <input value={status.color} onChange={(e) => onUpdate(status.id, { color: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="图标">
                    <select value={status.icon} onChange={(e) => onUpdate(status.id, { icon: e.target.value })}>
                      {PRESET_ICONS.map((i) => <option key={i}>{i}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="cm-checkbox-row">
                  <Checkbox
                    label="初始状态 ★"
                    checked={status.primary}
                    onChange={(v) => v && onSetPrimary(status.id)}
                    disabled={status.primary}
                  />
                  <Checkbox
                    label="终态 (不允许流转)"
                    checked={status.terminal}
                    onChange={(v) => onUpdate(status.id, { terminal: v })}
                  />
                  <Checkbox
                    label="触发TAT/通知"
                    checked={status.tatTrigger}
                    onChange={(v) => onUpdate(status.id, { tatTrigger: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsTab({ metrics, fields, statusNames, onUpdate, onMove, onAdd, onRemove, sampleRecords }) {
  return (
    <div className="cm-section">
      <div className="cm-section-header">
        <h3>统计卡片 <span className="cm-count">({metrics.filter((m) => m.enabled).length}个启用)</span></h3>
        <button className="cm-btn cm-btn-primary-sm" onClick={onAdd}>
          <Plus size={14} />新增统计
        </button>
      </div>
      <div className="cm-field-list">
        {metrics.map((metric, idx) => (
          <div key={metric.id} className="cm-field-card">
            <div className="cm-field-card-header">
              <span className="cm-field-order">{idx + 1}</span>
              <strong>{metric.label}</strong>
              <span className={`cm-type-tag cm-type-${metric.type}`}>{METRIC_TYPES.find((t) => t.value === metric.type)?.label}</span>
              <span className="cm-preview-badge">预览值: {evaluateMetric(metric, sampleRecords)}</span>
              <div className="cm-spacer" />
              <div className="cm-field-card-actions">
                <button className="cm-icon-btn" onClick={() => onMove(metric.id, 'up')} disabled={idx === 0}>
                  <ChevronUp size={16} />
                </button>
                <button className="cm-icon-btn" onClick={() => onMove(metric.id, 'down')} disabled={idx === metrics.length - 1}>
                  <ChevronDown size={16} />
                </button>
                <button
                  className="cm-icon-btn cm-icon-danger"
                  onClick={() => onRemove(metric.id)}
                  title="删除统计"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="cm-form-grid">
              <Field label="统计名称">
                <input value={metric.label} onChange={(e) => onUpdate(metric.id, { label: e.target.value })} />
              </Field>
              <Field label="统计类型">
                <select value={metric.type} onChange={(e) => onUpdate(metric.id, { type: e.target.value })}>
                  {METRIC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Checkbox
                label="启用"
                checked={metric.enabled}
                onChange={(v) => onUpdate(metric.id, { enabled: v })}
              />
              {(metric.type === 'filter' || metric.type === 'sum' || metric.type === 'avg') && (
                <Field label="目标字段">
                  <select
                    value={metric.field || metric.filter?.field || ''}
                    onChange={(e) => {
                      if (metric.type === 'filter') {
                        onUpdate(metric.id, { filter: { ...(metric.filter || {}), field: e.target.value } });
                      } else {
                        onUpdate(metric.id, { field: e.target.value });
                      }
                    }}
                  >
                    <option value="">请选择字段</option>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    <option value="status">状态</option>
                  </select>
                </Field>
              )}
              {metric.type === 'filter' && (
                <>
                  <Field label="运算符">
                    <select
                      value={metric.filter?.operator || 'eq'}
                      onChange={(e) => onUpdate(metric.id, { filter: { ...(metric.filter || {}), operator: e.target.value } })}
                    >
                      {FILTER_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </Field>
                  <Field label="比较值">
                    {(() => {
                      const filterField = metric.filter?.field;
                      const fieldDef = fields.find((f) => f.key === filterField);
                      if (fieldDef?.type === 'select' && fieldDef.options?.length) {
                        return (
                          <select
                            value={metric.filter?.value || ''}
                            onChange={(e) => onUpdate(metric.id, { filter: { ...(metric.filter || {}), value: e.target.value } })}
                          >
                            <option value="">请选择</option>
                            {fieldDef.options.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        );
                      }
                      if (filterField === 'status') {
                        return (
                          <select
                            value={metric.filter?.value || ''}
                            onChange={(e) => onUpdate(metric.id, { filter: { ...(metric.filter || {}), value: e.target.value } })}
                          >
                            <option value="">请选择</option>
                            {statusNames.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        );
                      }
                      return (
                        <input
                          value={metric.filter?.value || ''}
                          onChange={(e) => onUpdate(metric.id, { filter: { ...(metric.filter || {}), value: e.target.value } })}
                        />
                      );
                    })()}
                  </Field>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FiltersTab({
  filters, fields, statusNames, sortConfig, priorityConfig, cardDisplay, businessRules,
  onUpdateFilter, onAddFilter, onRemoveFilter,
  onSortConfigChange, onPriorityConfigChange, onCardDisplayChange, onBusinessRulesChange
}) {
  const sortableFields = fields.filter((f) => f.sortable);
  const allFieldKeys = fields.map((f) => f.key);

  return (
    <div className="cm-section">
      <h3 className="cm-subheading">筛选器配置</h3>
      <div className="cm-section-header">
        <span />
        <button className="cm-btn cm-btn-primary-sm" onClick={onAddFilter}>
          <Plus size={14} />新增筛选器
        </button>
      </div>
      <div className="cm-field-list">
        {filters.map((filter, idx) => (
          <div key={filter.id} className="cm-field-card">
            <div className="cm-field-card-header">
              <span className="cm-field-order">{idx + 1}</span>
              <strong>{filter.label}</strong>
              <span className={`cm-type-tag cm-type-${filter.type}`}>
                {filter.type === 'search' ? '搜索' : filter.type === 'status' ? '状态筛选' : '字段筛选'}
              </span>
              <div className="cm-spacer" />
              <div className="cm-field-card-actions">
                <button
                  className="cm-icon-btn cm-icon-danger"
                  onClick={() => onRemoveFilter(filter.id)}
                  title="删除筛选器"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="cm-form-grid">
              <Field label="筛选器名称">
                <input value={filter.label} onChange={(e) => onUpdateFilter(filter.id, { label: e.target.value })} />
              </Field>
              <Field label="类型">
                <select value={filter.type} onChange={(e) => onUpdateFilter(filter.id, { type: e.target.value })}>
                  <option value="search">文本搜索</option>
                  <option value="status">状态筛选</option>
                  <option value="select">字段下拉筛选</option>
                </select>
              </Field>
              <Checkbox
                label="启用"
                checked={filter.enabled}
                onChange={(v) => onUpdateFilter(filter.id, { enabled: v })}
              />
              {filter.type === 'search' && (
                <Field label="搜索字段 (可多选)" full>
                  <div className="cm-multi-check">
                    {fields.map((f) => (
                      <label key={f.key} className="cm-inline-check">
                        <input
                          type="checkbox"
                          checked={(filter.searchFields || []).includes(f.key)}
                          onChange={(e) => {
                            const current = new Set(filter.searchFields || []);
                            if (e.target.checked) current.add(f.key); else current.delete(f.key);
                            onUpdateFilter(filter.id, { searchFields: Array.from(current) });
                          }}
                        />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              {filter.type === 'select' && (
                <Field label="筛选字段">
                  <select value={filter.field || ''} onChange={(e) => onUpdateFilter(filter.id, { field: e.target.value })}>
                    <option value="">请选择</option>
                    {fields.filter((f) => f.type === 'select').map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>
        ))}
      </div>

      <h3 className="cm-subheading">排序配置</h3>
      <div className="cm-form-grid">
        <Field label="主排序字段">
          <select value={sortConfig.primaryField || ''} onChange={(e) => onSortConfigChange({ primaryField: e.target.value })}>
            {sortableFields.length > 0 ? (
              sortableFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)
            ) : (
              allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)
            )}
          </select>
        </Field>
        <Field label="次排序字段">
          <select value={sortConfig.secondaryField || ''} onChange={(e) => onSortConfigChange({ secondaryField: e.target.value })}>
            <option value="createdAt">创建时间</option>
            {allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="方向">
          <select value={sortConfig.direction} onChange={(e) => onSortConfigChange({ direction: e.target.value })}>
            <option value="asc">升序 (优先级高在前)</option>
            <option value="desc">降序</option>
          </select>
        </Field>
      </div>

      <h3 className="cm-subheading">优先级与TAT阈值</h3>
      <div className="cm-form-grid">
        <Field label="优先级字段">
          <select value={priorityConfig.fieldKey || ''} onChange={(e) => onPriorityConfigChange({ fieldKey: e.target.value })}>
            <option value="">无</option>
            {fields.filter((f) => f.type === 'select').map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </Field>
      </div>
      {priorityConfig.fieldKey && (() => {
        const pf = fields.find((f) => f.key === priorityConfig.fieldKey);
        const opts = pf?.options || [];
        return (
          <div className="cm-tat-table">
            <div className="cm-tat-row cm-tat-head">
              <span>优先级</span>
              <span>顺序 (上=高)</span>
              <span>预警 (分钟)</span>
              <span>超时 (分钟)</span>
            </div>
            {opts.map((opt) => {
              const orderIdx = priorityConfig.order.indexOf(opt);
              const th = priorityConfig.tatThresholds[opt] || { warning: 720, timeout: 1440 };
              return (
                <div key={opt} className="cm-tat-row">
                  <span className="cm-tat-priority">{opt}</span>
                  <span>
                    <input
                      type="number"
                      min="0"
                      value={orderIdx >= 0 ? orderIdx : 99}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const newOrder = [...priorityConfig.order].filter((o) => o !== opt);
                        newOrder.splice(Math.min(val, newOrder.length), 0, opt);
                        onPriorityConfigChange({ order: newOrder });
                      }}
                      className="cm-num-input"
                    />
                  </span>
                  <span>
                    <input
                      type="number"
                      min="0"
                      value={th.warning}
                      onChange={(e) => {
                        const newTh = { ...priorityConfig.tatThresholds };
                        newTh[opt] = { ...(newTh[opt] || {}), warning: Number(e.target.value) || 0 };
                        onPriorityConfigChange({ tatThresholds: newTh });
                      }}
                      className="cm-num-input"
                    />
                  </span>
                  <span>
                    <input
                      type="number"
                      min="0"
                      value={th.timeout}
                      onChange={(e) => {
                        const newTh = { ...priorityConfig.tatThresholds };
                        newTh[opt] = { ...(newTh[opt] || {}), timeout: Number(e.target.value) || 0 };
                        onPriorityConfigChange({ tatThresholds: newTh });
                      }}
                      className="cm-num-input"
                    />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      <h3 className="cm-subheading">卡片显示字段</h3>
      <div className="cm-form-grid">
        <Field label="标题字段">
          <select value={cardDisplay.titleField || ''} onChange={(e) => onCardDisplayChange({ titleField: e.target.value })}>
            {allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="详情字段">
          <select value={cardDisplay.detailField || ''} onChange={(e) => onCardDisplayChange({ detailField: e.target.value })}>
            <option value="">无</option>
            {allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="副标题字段 (可多选)" full>
          <div className="cm-multi-check">
            {allFieldKeys.map((k) => (
              <label key={k} className="cm-inline-check">
                <input
                  type="checkbox"
                  checked={(cardDisplay.metaFields || []).includes(k)}
                  onChange={(e) => {
                    const current = new Set(cardDisplay.metaFields || []);
                    if (e.target.checked) current.add(k); else current.delete(k);
                    onCardDisplayChange({ metaFields: Array.from(current) });
                  }}
                />
                <span>{k}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>

      <h3 className="cm-subheading">危急通知触发规则</h3>
      <div className="cm-checkbox-row">
        <Checkbox
          label="启用危急通知判断"
          checked={businessRules.criticalNotify.enabled}
          onChange={(v) => onBusinessRulesChange({ enabled: v })}
        />
      </div>
      {businessRules.criticalNotify.enabled && (
        <>
          <div className="cm-form-grid">
            <Field label="优先级字段">
              <select
                value={businessRules.criticalNotify.priorityField || ''}
                onChange={(e) => onBusinessRulesChange({ priorityField: e.target.value })}
              >
                <option value="">无</option>
                {fields.filter((f) => f.type === 'select').map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </Field>
          </div>
          {businessRules.criticalNotify.priorityField && (
            <div className="cm-multi-check">
              <label className="cm-hint-inline">危急值：</label>
              {(fields.find((f) => f.key === businessRules.criticalNotify.priorityField)?.options || []).map((opt) => (
                <label key={opt} className="cm-inline-check">
                  <input
                    type="checkbox"
                    checked={(businessRules.criticalNotify.criticalValues || []).includes(opt)}
                    onChange={(e) => {
                      const current = new Set(businessRules.criticalNotify.criticalValues || []);
                      if (e.target.checked) current.add(opt); else current.delete(opt);
                      onBusinessRulesChange({ criticalValues: Array.from(current) });
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}
          <div className="cm-multi-check">
            <label className="cm-hint-inline">触发状态：</label>
            {statusNames.map((s) => (
              <label key={s} className="cm-inline-check">
                <input
                  type="checkbox"
                  checked={(businessRules.criticalNotify.tatTriggerStatuses || []).includes(s)}
                  onChange={(e) => {
                    const current = new Set(businessRules.criticalNotify.tatTriggerStatuses || []);
                    if (e.target.checked) current.add(s); else current.delete(s);
                    onBusinessRulesChange({ tatTriggerStatuses: Array.from(current) });
                  }}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children, full = false }) {
  return (
    <label className={`cm-form-field ${full ? 'full' : ''}`}>
      <span className="cm-form-label">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange, disabled = false }) {
  return (
    <label className={`cm-checkbox ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Info({ size }) {
  return <AlertCircle size={size} />;
}

function ConfigPreviewModal({ diff, onConfirm, onCancel }) {
  const hasFieldChanges = diff.fields.added.length > 0 || diff.fields.removed.length > 0 || diff.fields.modified.length > 0 || diff.fields.renamed.length > 0;
  const hasStatusChanges = diff.statuses.added.length > 0 || diff.statuses.removed.length > 0 || diff.statuses.modified.length > 0 || diff.statuses.renamed.length > 0;
  const hasMetricChanges = diff.metrics.added.length > 0 || diff.metrics.removed.length > 0 || diff.metrics.modified.length > 0;
  const hasFilterChanges = diff.filters.added.length > 0 || diff.filters.removed.length > 0 || diff.filters.modified.length > 0;
  const hasOtherChanges = diff.otherChanges.length > 0;

  const totalChanges =
    diff.fields.added.length + diff.fields.removed.length + diff.fields.modified.length +
    diff.statuses.added.length + diff.statuses.removed.length + diff.statuses.modified.length +
    diff.metrics.added.length + diff.metrics.removed.length + diff.metrics.modified.length +
    diff.filters.added.length + diff.filters.removed.length + diff.filters.modified.length +
    diff.otherChanges.length +
    diff.fields.renamed.filter(r => !diff.fields.modified.find(m => m.key === r.newKey)).length +
    diff.statuses.renamed.filter(r => !diff.statuses.modified.find(m => m.name === r.newName)).length;

  return (
    <div className="cm-preview-overlay" onClick={onCancel}>
      <div className="cm-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-preview-header">
          <div className="cm-preview-title">
            <Eye size={20} />
            <h3>配置变更预览</h3>
            <span className="cm-preview-count">共 {totalChanges} 项变更</span>
          </div>
          <button className="cm-icon-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="cm-preview-body">
          {diff.requiresMigration && (
            <div className="cm-preview-migration">
              <div className="cm-preview-migration-icon">
                <Database size={20} />
              </div>
              <div className="cm-preview-migration-content">
                <h4>将触发历史病例迁移</h4>
                <p>{diff.migrationImpact.description}</p>
              </div>
              <RefreshCw size={18} className="cm-preview-migration-spin" />
            </div>
          )}

          {hasFieldChanges && (
            <div className="cm-preview-section">
              <div className="cm-preview-section-title">
                <Layers size={16} />
                <span>病例字段</span>
                <span className="cm-preview-section-count">
                  {diff.fields.added.length + diff.fields.removed.length + Math.max(diff.fields.modified.length, diff.fields.renamed.length)} 项
                </span>
              </div>
              <div className="cm-preview-list">
                {diff.fields.added.map((f) => (
                <div key={`add-${f.key}`} className="cm-preview-item cm-preview-item-add">
                  <PlusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">新增字段</span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <span className="cm-preview-item-type">{f.key}</span>
                    <span className="cm-preview-item-type">{f.type}</span>
                  </div>
                </div>
              ))}
              {diff.fields.removed.map((f) => (
                <div key={`del-${f.key}`} className="cm-preview-item cm-preview-item-remove">
                  <MinusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">删除字段</span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <span className="cm-preview-item-type">{f.key}</span>
                    <span className="cm-preview-item-type">{f.type}</span>
                  </div>
                </div>
              ))}
              {diff.fields.modified.map((f) => (
                <div key={`mod-${f.key}`} className={`cm-preview-item ${diff.fields.renamed.some(r => r.newKey === f.key) ? 'cm-preview-item-rename' : 'cm-preview-item-modify'}`}>
                  {diff.fields.renamed.some(r => r.newKey === f.key) ? <RefreshCw size={16} /> : <Edit3 size={16} />}
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">
                      {diff.fields.renamed.some(r => r.newKey === f.key) ? '字段Key变更' : '修改字段'}
                    </span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <div className="cm-preview-item-changes">
                      {f.changes.map((c, i) => (
                      <span key={i} className={`cm-preview-change-tag ${c.startsWith('字段key') ? 'cm-preview-change-tag-warning' : ''}`}>{c}</span>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {hasStatusChanges && (
            <div className="cm-preview-section">
              <div className="cm-preview-section-title">
                <ArrowUpDown size={16} />
                <span>状态流转</span>
                <span className="cm-preview-section-count">
                  {diff.statuses.added.length + diff.statuses.removed.length + Math.max(diff.statuses.modified.length, diff.statuses.renamed.length)} 项
                </span>
              </div>
              <div className="cm-preview-list">
                {diff.statuses.added.map((s) => (
                <div key={`add-${s.name}`} className="cm-preview-item cm-preview-item-add">
                  <PlusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">新增状态</span>
                    <span className="cm-preview-item-name" style={{ color: s.color }}>{s.name}</span>
                  </div>
                </div>
              ))}
              {diff.statuses.removed.map((s) => (
                <div key={`del-${s.name}`} className="cm-preview-item cm-preview-item-remove">
                  <MinusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">删除状态</span>
                    <span className="cm-preview-item-name" style={{ color: s.color }}>{s.name}</span>
                  </div>
                </div>
              ))}
              {diff.statuses.modified.map((s) => {
                const isRenamed = diff.statuses.renamed.some(r => r.newName === s.name || r.oldName === s.name);
                return (
                  <div key={`mod-${s.name}`} className={`cm-preview-item ${isRenamed ? 'cm-preview-item-rename' : 'cm-preview-item-modify'}`}>
                    {isRenamed ? <RefreshCw size={16} /> : <Edit3 size={16} />}
                    <div className="cm-preview-item-content">
                      <span className="cm-preview-item-label">
                        {isRenamed ? '状态名称变更' : '修改状态'}
                      </span>
                      <span className="cm-preview-item-name">{s.name}</span>
                      <div className="cm-preview-item-changes">
                        {s.changes.map((c, i) => (
                        <span key={i} className={`cm-preview-change-tag ${c.startsWith('名称') ? 'cm-preview-change-tag-warning' : ''}`}>{c}</span>
                      ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {hasFilterChanges && (
            <div className="cm-preview-section">
              <div className="cm-preview-section-title">
                <Filter size={16} />
                <span>筛选项</span>
                <span className="cm-preview-section-count">
                  {diff.filters.added.length + diff.filters.removed.length + diff.filters.modified.length} 项
                </span>
              </div>
              <div className="cm-preview-list">
                {diff.filters.added.map((f) => (
                <div key={`add-${f.label}`} className="cm-preview-item cm-preview-item-add">
                  <PlusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">新增筛选</span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <span className="cm-preview-item-type">{f.type}</span>
                  </div>
                </div>
              ))}
              {diff.filters.removed.map((f) => (
                <div key={`del-${f.label}`} className="cm-preview-item cm-preview-item-remove">
                  <MinusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">删除筛选</span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <span className="cm-preview-item-type">{f.type}</span>
                  </div>
                </div>
              ))}
              {diff.filters.modified.map((f) => (
                <div key={`mod-${f.label}`} className="cm-preview-item cm-preview-item-modify">
                  <Edit3 size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">修改筛选</span>
                    <span className="cm-preview-item-name">{f.label}</span>
                    <div className="cm-preview-item-changes">
                      {f.changes.map((c, i) => (
                      <span key={i} className="cm-preview-change-tag">{c}</span>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {hasMetricChanges && (
            <div className="cm-preview-section">
              <div className="cm-preview-section-title">
                <BarChart3 size={16} />
                <span>统计卡片</span>
                <span className="cm-preview-section-count">
                  {diff.metrics.added.length + diff.metrics.removed.length + diff.metrics.modified.length} 项
                </span>
              </div>
              <div className="cm-preview-list">
                {diff.metrics.added.map((m) => (
                <div key={`add-${m.label}`} className="cm-preview-item cm-preview-item-add">
                  <PlusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">新增统计</span>
                    <span className="cm-preview-item-name">{m.label}</span>
                    <span className="cm-preview-item-type">{m.type}</span>
                  </div>
                </div>
              ))}
              {diff.metrics.removed.map((m) => (
                <div key={`del-${m.label}`} className="cm-preview-item cm-preview-item-remove">
                  <MinusCircle size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">删除统计</span>
                    <span className="cm-preview-item-name">{m.label}</span>
                    <span className="cm-preview-item-type">{m.type}</span>
                  </div>
                </div>
              ))}
              {diff.metrics.modified.map((m) => (
                <div key={`mod-${m.label}`} className="cm-preview-item cm-preview-item-modify">
                  <Edit3 size={16} />
                  <div className="cm-preview-item-content">
                    <span className="cm-preview-item-label">修改统计</span>
                    <span className="cm-preview-item-name">{m.label}</span>
                    <div className="cm-preview-item-changes">
                      {m.changes.map((c, i) => (
                      <span key={i} className="cm-preview-change-tag">{c}</span>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {hasOtherChanges && (
            <div className="cm-preview-section">
              <div className="cm-preview-section-title">
                <Settings size={16} />
                <span>其他设置</span>
                <span className="cm-preview-section-count">{diff.otherChanges.length} 项</span>
              </div>
              <div className="cm-preview-list">
                {diff.otherChanges.map((item, i) => (
                  <div key={i} className="cm-preview-item cm-preview-item-modify">
                    <Edit3 size={16} />
                    <div className="cm-preview-item-content">
                      <span className="cm-preview-item-name">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!diff.hasChanges && (
            <div className="cm-preview-empty">
            <CheckCircle size={32} />
            <p>配置没有变更</p>
          </div>
          )}
        </div>

        <div className="cm-preview-footer">
          <div className="cm-preview-hint">
            <Info size={14} />
            <span>确认保存后，配置将立即生效并刷新队列显示。</span>
          </div>
          <div className="cm-preview-actions">
            <button className="cm-btn cm-btn-secondary" onClick={onCancel}>
              返回修改
            </button>
            <button className="cm-btn cm-btn-primary" onClick={onConfirm}>
              <Save size={14} />确认保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
