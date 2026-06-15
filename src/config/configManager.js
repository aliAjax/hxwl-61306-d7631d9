import { DEFAULT_QUEUE_CONFIG, QUEUE_CONFIG_STORAGE } from './defaultConfig';

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return Object.assign({}, obj);
  }
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function ensureObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function ensureNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function validateConfig(config) {
  const warnings = [];
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['配置不是有效对象'], warnings: [] };
  }

  const statuses = ensureArray(config.statuses, []);
  const statusNames = statuses.map((s) => ensureString(s?.name || s));
  const uniqueStatusNames = new Set(statusNames.filter(Boolean));
  if (uniqueStatusNames.size !== statusNames.filter(Boolean).length) {
    warnings.push('存在重复的状态名称，已自动去重');
  }

  const primaryStatus = statuses.find((s) => s?.primary) || statuses[0];
  if (!primaryStatus) {
    errors.push('至少需要配置一个状态');
  }

  const fields = ensureArray(config.fields, []);
  const fieldKeys = fields.map((f) => ensureString(f?.key));
  const uniqueKeys = new Set(fieldKeys.filter(Boolean));
  if (uniqueKeys.size !== fieldKeys.filter(Boolean).length) {
    warnings.push('存在重复的字段key，已自动去重');
  }

  const titleField = ensureString(config.cardDisplay?.titleField);
  if (titleField && !uniqueKeys.has(titleField)) {
    warnings.push(`卡片标题字段「${titleField}」不存在于字段列表中，将自动回退到第一个字段`);
  }

  const sortPrimary = ensureString(config.sortConfig?.primaryField);
  if (sortPrimary && !uniqueKeys.has(sortPrimary)) {
    warnings.push(`排序主字段「${sortPrimary}」不存在于字段列表中，将使用默认排序`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function sanitizeConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return deepClone(DEFAULT_QUEUE_CONFIG);
  }

  const base = deepClone(DEFAULT_QUEUE_CONFIG);

  try {
    const config = ensureObject(rawConfig, base);

    const result = {
      ...base,
      version: Math.max(ensureNumber(config.version, 1), base.version),
      id: ensureString(config.id, base.id),
      title: ensureString(config.title, base.title),
      subtitle: ensureString(config.subtitle, base.subtitle),
      domain: ensureString(config.domain, base.domain),
      storage: ensureString(config.storage, base.storage),
      accent: ensureString(config.accent, base.accent),
      note: ensureString(config.note, base.note)
    };

    result.fields = sanitizeFields(config.fields, base.fields);
    result.statuses = sanitizeStatuses(config.statuses, base.statuses);
    result.sortConfig = sanitizeSortConfig(config.sortConfig, base.sortConfig, result.fields);
    result.priorityConfig = sanitizePriorityConfig(config.priorityConfig, base.priorityConfig, result.fields);
    result.metrics = sanitizeMetrics(config.metrics, base.metrics);
    result.filters = sanitizeFilters(config.filters, base.filters, result.fields);
    result.cardDisplay = sanitizeCardDisplay(config.cardDisplay, base.cardDisplay, result.fields);
    result.batchImport = sanitizeBatchImport(config.batchImport, base.batchImport, result.fields);
    result.defaultValues = sanitizeDefaultValues(config.defaultValues, base.defaultValues, result.fields);
    result.seedData = ensureArray(config.seedData, base.seedData);
    result.businessRules = sanitizeBusinessRules(config.businessRules, base.businessRules, result.fields, result.statuses);

    const { warnings } = validateConfig(result);
    if (warnings.length > 0) {
      console.warn('[ConfigSanitizer] Warnings:', warnings);
    }

    return result;
  } catch (error) {
    console.error('[ConfigSanitizer] Fatal error, falling back to default:', error);
    return deepClone(DEFAULT_QUEUE_CONFIG);
  }
}

function sanitizeFields(rawFields, defaultFields) {
  const fields = ensureArray(rawFields, defaultFields);
  const seenKeys = new Set();
  const sanitized = [];

  fields.forEach((field, idx) => {
    if (!field || typeof field !== 'object') return;

    const key = ensureString(field.key).trim();
    if (!key) return;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const def = defaultFields.find((d) => d.key === key) || {};

    sanitized.push({
      id: ensureString(field.id, def.id || `f_${uid()}`),
      key,
      label: ensureString(field.label, def.label || key),
      type: ['input', 'select', 'textarea', 'datetime-local', 'number', 'date'].includes(field.type)
        ? field.type
        : (def.type || 'input'),
      placeholder: ensureString(field.placeholder, def.placeholder || ''),
      options: ensureArray(field.options, def.options || []),
      required: typeof field.required === 'boolean' ? field.required : (!!def.required || false),
      searchable: typeof field.searchable === 'boolean' ? field.searchable : (!!def.searchable || false),
      showInCard: typeof field.showInCard === 'boolean' ? field.showInCard : (!!def.showInCard || false),
      cardPosition: ['title', 'meta', 'detail', ''].includes(field.cardPosition)
        ? field.cardPosition
        : (def.cardPosition || ''),
      order: Number.isFinite(field.order) ? field.order : (Number.isFinite(def.order) ? def.order : idx),
      sortable: typeof field.sortable === 'boolean' ? field.sortable : (!!def.sortable || false),
      sortWeights: ensureObject(field.sortWeights, def.sortWeights || {}),
      dateKey: typeof field.dateKey === 'boolean' ? field.dateKey : (!!def.dateKey || false)
    });
  });

  if (sanitized.length === 0) {
    return deepClone(defaultFields);
  }

  sanitized.sort((a, b) => a.order - b.order);
  return sanitized;
}

function sanitizeStatuses(rawStatuses, defaultStatuses) {
  const statuses = ensureArray(rawStatuses, defaultStatuses);
  const seenNames = new Set();
  const sanitized = [];

  statuses.forEach((status, idx) => {
    if (!status) return;
    const name = ensureString(typeof status === 'string' ? status : status?.name).trim();
    if (!name) return;
    if (seenNames.has(name)) return;
    seenNames.add(name);

    const obj = typeof status === 'object' ? status : {};
    const def = defaultStatuses.find((d) => d.name === name) || {};

    sanitized.push({
      id: ensureString(obj.id, def.id || `s_${uid()}`),
      name,
      color: ensureString(obj.color, def.color || '#6b7280'),
      icon: ensureString(obj.icon, def.icon || 'CircleDot'),
      order: Number.isFinite(obj.order) ? obj.order : (Number.isFinite(def.order) ? def.order : idx),
      primary: typeof obj.primary === 'boolean' ? obj.primary : (!!def.primary || (idx === 0 && sanitized.length === 0)),
      terminal: typeof obj.terminal === 'boolean' ? obj.terminal : (!!def.terminal || false),
      tatTrigger: typeof obj.tatTrigger === 'boolean' ? obj.tatTrigger : (!!def.tatTrigger || false)
    });
  });

  if (sanitized.length === 0) {
    return deepClone(defaultStatuses);
  }

  sanitized.sort((a, b) => a.order - b.order);
  if (!sanitized.some((s) => s.primary)) {
    sanitized[0].primary = true;
  }

  return sanitized;
}

function sanitizeSortConfig(rawConfig, defaultConfig, fields) {
  const config = ensureObject(rawConfig, defaultConfig);
  const fieldKeys = fields.map((f) => f.key);
  const hasPriority = fieldKeys.includes('priority');

  return {
    primaryField: fieldKeys.includes(config.primaryField)
      ? config.primaryField
      : (hasPriority ? 'priority' : (fieldKeys[0] || defaultConfig.primaryField)),
    secondaryField: fieldKeys.includes(config.secondaryField)
      ? config.secondaryField
      : (defaultConfig.secondaryField || 'createdAt'),
    direction: ['asc', 'desc'].includes(config.direction) ? config.direction : 'asc'
  };
}

function sanitizePriorityConfig(rawConfig, defaultConfig, fields) {
  const config = ensureObject(rawConfig, defaultConfig);
  const fieldKeys = fields.map((f) => f.key);

  return {
    fieldKey: fieldKeys.includes(config.fieldKey) ? config.fieldKey : (fieldKeys.includes('priority') ? 'priority' : ''),
    order: ensureArray(config.order, defaultConfig.order),
    tatThresholds: ensureObject(config.tatThresholds, defaultConfig.tatThresholds)
  };
}

function sanitizeMetrics(rawMetrics, defaultMetrics) {
  const metrics = ensureArray(rawMetrics, defaultMetrics);
  const sanitized = [];

  metrics.forEach((metric, idx) => {
    if (!metric || typeof metric !== 'object') return;
    if (!ensureString(metric.label)) return;
    if (!['count', 'filter', 'sum', 'avg'].includes(metric.type)) return;

    sanitized.push({
      id: ensureString(metric.id, `m_${uid()}`),
      label: ensureString(metric.label),
      type: metric.type,
      filter: ensureObject(metric.filter, {}),
      field: ensureString(metric.field, ''),
      enabled: typeof metric.enabled === 'boolean' ? metric.enabled : true,
      order: Number.isFinite(metric.order) ? metric.order : idx
    });
  });

  if (sanitized.length === 0) {
    return deepClone(defaultMetrics);
  }

  sanitized.sort((a, b) => a.order - b.order);
  return sanitized;
}

function sanitizeFilters(rawFilters, defaultFilters, fields) {
  const filters = ensureArray(rawFilters, defaultFilters);
  const sanitized = [];
  const fieldKeys = fields.map((f) => f.key);

  filters.forEach((filter, idx) => {
    if (!filter || typeof filter !== 'object') return;

    const type = ensureString(filter.type);
    if (!['search', 'status', 'select'].includes(type)) return;

    const searchFields = ensureArray(filter.searchFields, []).filter((f) => fieldKeys.includes(f));

    sanitized.push({
      id: ensureString(filter.id, `fl_${uid()}`),
      label: ensureString(filter.label, type === 'search' ? '搜索' : '状态'),
      type,
      field: fieldKeys.includes(filter.field) ? filter.field : '',
      searchFields: type === 'search' ? (searchFields.length > 0 ? searchFields : fieldKeys.slice(0, 2)) : [],
      enabled: typeof filter.enabled === 'boolean' ? filter.enabled : true,
      order: Number.isFinite(filter.order) ? filter.order : idx
    });
  });

  if (sanitized.length === 0) {
    return deepClone(defaultFilters);
  }

  sanitized.sort((a, b) => a.order - b.order);
  return sanitized;
}

function sanitizeCardDisplay(rawConfig, defaultConfig, fields) {
  const config = ensureObject(rawConfig, defaultConfig);
  const fieldKeys = fields.map((f) => f.key);

  return {
    titleField: fieldKeys.includes(config.titleField) ? config.titleField : (fieldKeys[0] || defaultConfig.titleField),
    metaFields: ensureArray(config.metaFields, defaultConfig.metaFields).filter((f) => fieldKeys.includes(f)),
    detailField: fieldKeys.includes(config.detailField) ? config.detailField : defaultConfig.detailField
  };
}

function sanitizeBatchImport(rawConfig, defaultConfig, fields) {
  const config = ensureObject(rawConfig, defaultConfig);
  const fieldKeys = fields.map((f) => f.key);

  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
    fields: ensureArray(config.fields, defaultConfig.fields)
      .filter((f) => fieldKeys.includes(f?.key))
      .map((f) => ({
        key: f.key,
        label: ensureString(f.label, f.key),
        required: !!f.required
      })),
    headerKeywords: ensureArray(config.headerKeywords, defaultConfig.headerKeywords)
  };
}

function sanitizeDefaultValues(rawValues, defaultValues, fields) {
  const values = ensureObject(rawValues, defaultValues);
  const fieldKeys = fields.map((f) => f.key);
  const result = {};

  fieldKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      result[key] = values[key];
    } else if (Object.prototype.hasOwnProperty.call(defaultValues, key)) {
      result[key] = defaultValues[key];
    } else {
      result[key] = '';
    }
  });

  return result;
}

function sanitizeBusinessRules(rawRules, defaultRules, fields, statuses) {
  const rules = ensureObject(rawRules, defaultRules);
  const fieldKeys = fields.map((f) => f.key);
  const statusNames = statuses.map((s) => s.name);

  const cn = ensureObject(rules.criticalNotify, defaultRules.criticalNotify);
  return {
    criticalNotify: {
      enabled: typeof cn.enabled === 'boolean' ? cn.enabled : true,
      priorityField: fieldKeys.includes(cn.priorityField) ? cn.priorityField : (fieldKeys.includes('priority') ? 'priority' : ''),
      criticalValues: ensureArray(cn.criticalValues, defaultRules.criticalNotify.criticalValues),
      tatTriggerStatuses: ensureArray(cn.tatTriggerStatuses, defaultRules.criticalNotify.tatTriggerStatuses)
        .filter((s) => statusNames.includes(s))
    }
  };
}

export function migrateLegacyRecords(records, config) {
  if (!Array.isArray(records)) return [];

  const fieldKeys = new Set(config.fields.map((f) => f.key));
  const statusNames = new Set(config.statuses.map((s) => s.name));
  const primaryStatus = config.statuses.find((s) => s.primary)?.name || config.statuses[0]?.name || '';

  return records.map((record) => {
    if (!record || typeof record !== 'object') return null;

    const migrated = { ...record };

    if (!migrated.id) {
      migrated.id = uid();
    }

    if (!statusNames.has(migrated.status)) {
      migrated.status = primaryStatus;
    }

    if (!Array.isArray(migrated.timeline)) {
      migrated.timeline = [{
        status: migrated.status,
        at: new Date().toISOString().slice(0, 10),
        by: '系统迁移',
        changedAt: migrated.createdAt || new Date().toISOString()
      }];
    }

    fieldKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(migrated, key)) {
        if (Object.prototype.hasOwnProperty.call(config.defaultValues, key)) {
          migrated[key] = config.defaultValues[key];
        } else {
          migrated[key] = '';
        }
      }
    });

    return migrated;
  }).filter(Boolean);
}

export function loadConfig() {
  const raw = localStorage.getItem(QUEUE_CONFIG_STORAGE);
  if (!raw) {
    return deepClone(DEFAULT_QUEUE_CONFIG);
  }

  try {
    const parsed = JSON.parse(raw);
    return sanitizeConfig(parsed);
  } catch (error) {
    console.error('[ConfigManager] Failed to parse stored config, using default:', error);
    return deepClone(DEFAULT_QUEUE_CONFIG);
  }
}

export function persistConfig(config) {
  const sanitized = sanitizeConfig(config);
  try {
    localStorage.setItem(QUEUE_CONFIG_STORAGE, JSON.stringify(sanitized));
    return sanitized;
  } catch (error) {
    console.error('[ConfigManager] Failed to persist config:', error);
    return sanitized;
  }
}

export function resetConfig() {
  localStorage.removeItem(QUEUE_CONFIG_STORAGE);
  return deepClone(DEFAULT_QUEUE_CONFIG);
}

export function exportConfig(config) {
  return JSON.stringify(config, null, 2);
}

export function importConfig(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeConfig(parsed);
  } catch (error) {
    throw new Error('配置文件格式无效: ' + error.message);
  }
}

export function evaluateMetric(metric, records) {
  try {
    const validRecords = ensureArray(records, []);

    switch (metric.type) {
      case 'count':
        return validRecords.length;

      case 'filter': {
        const { field, operator, value } = ensureObject(metric.filter, {});
        if (!field) return validRecords.length;
        return validRecords.filter((item) => applyFilter(item, field, operator, value)).length;
      }

      case 'sum': {
        const field = ensureString(metric.field);
        if (!field) return 0;
        return validRecords.reduce((sum, item) => {
          const v = Number(item?.[field]);
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0);
      }

      case 'avg': {
        const field = ensureString(metric.field);
        if (!field) return 0;
        const values = validRecords
          .map((item) => Number(item?.[field]))
          .filter((v) => Number.isFinite(v));
        if (values.length === 0) return 0;
        return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
      }

      default:
        return validRecords.length;
    }
  } catch (error) {
    console.error('[ConfigManager] evaluateMetric error:', error);
    return 0;
  }
}

export function applyFilter(item, field, operator, value) {
  try {
    const itemValue = item?.[field];
    const itemStr = String(itemValue ?? '');
    const valueStr = String(value ?? '');

    switch (operator) {
      case 'eq':
        return itemValue == value;
      case 'neq':
        return itemValue != value;
      case 'contains':
        return itemStr.toLowerCase().includes(valueStr.toLowerCase());
      case 'gt':
        return Number(itemValue) > Number(value);
      case 'lt':
        return Number(itemValue) < Number(value);
      case 'gte':
        return Number(itemValue) >= Number(value);
      case 'lte':
        return Number(itemValue) <= Number(value);
      default:
        return true;
    }
  } catch {
    return true;
  }
}

export function getStatusNames(config) {
  return ensureArray(config?.statuses, []).map((s) => s?.name).filter(Boolean);
}

export function getPrimaryStatusName(config) {
  const primary = ensureArray(config?.statuses, []).find((s) => s?.primary);
  return primary?.name || config?.statuses?.[0]?.name || '';
}

export function getStatusColor(config, statusName) {
  const status = ensureArray(config?.statuses, []).find((s) => s?.name === statusName);
  return status?.color || '#6b7280';
}

export function getStatusIndex(config, statusName) {
  return Math.max(0, ensureArray(config?.statuses, []).findIndex((s) => s?.name === statusName));
}

export function nextStatusName(config, currentStatus) {
  const list = getStatusNames(config);
  const idx = list.indexOf(currentStatus);
  if (idx < 0 || idx >= list.length - 1) return null;
  return list[idx + 1];
}

export function prevStatusName(config, currentStatus) {
  const list = getStatusNames(config);
  const idx = list.indexOf(currentStatus);
  if (idx <= 0) return null;
  return list[idx - 1];
}

export function buildStatusClass(config, statusName) {
  const idx = getStatusIndex(config, statusName);
  const classes = ['status-a', 'status-b', 'status-c', 'status-d', 'status-e'];
  return classes[idx % classes.length] || 'status-a';
}

export function buildPriorityRankFn(config) {
  const pc = config?.priorityConfig;
  if (!pc?.fieldKey || !pc?.order?.length) {
    return () => 9;
  }
  const orderMap = {};
  pc.order.forEach((v, i) => { orderMap[v] = i; });

  return (value) => {
    if (value === undefined || value === null) return 9;
    const rank = orderMap[value];
    return rank === undefined ? 9 : rank;
  };
}

export function getTatThresholds(config, priority) {
  const thresholds = config?.priorityConfig?.tatThresholds || {};
  return thresholds[priority] || thresholds['常规'] || { timeout: 4320, warning: 2880 };
}

export function buildSearchFields(config) {
  const searchFilter = ensureArray(config?.filters, []).find((f) => f?.type === 'search');
  if (searchFilter?.searchFields?.length) {
    return searchFilter.searchFields;
  }
  return config?.fields?.filter((f) => f?.searchable).map((f) => f.key) || [];
}

export function isCriticalEligible(config, record) {
  if (!record || !config?.businessRules?.criticalNotify?.enabled) return false;
  const rules = config.businessRules.criticalNotify;

  if (rules.priorityField && record[rules.priorityField]) {
    if (rules.criticalValues?.includes(record[rules.priorityField])) {
      return true;
    }
  }

  if (rules.tatTriggerStatuses?.includes(record.status)) {
    return true;
  }

  return false;
}

export function safeEvalCardTemplate(template, item, fallback = '') {
  try {
    if (!template || typeof template !== 'string') return fallback;
    if (!item) return fallback;
    return String(template.split('.').reduce((obj, key) => (obj?.[key] ?? fallback), item) ?? fallback);
  } catch {
    return fallback;
  }
}

export function buildCardMeta(config, item) {
  try {
    const metaFields = config?.cardDisplay?.metaFields || [];
    return metaFields.map((f) => String(item?.[f] ?? '')).filter(Boolean).join(' · ');
  } catch {
    return '';
  }
}

export function diffConfig(oldConfig, newConfig) {
  const result = {
    hasChanges: false,
    fields: { added: [], removed: [], modified: [] },
    statuses: { added: [], removed: [], modified: [], renamed: [] },
    metrics: { added: [], removed: [], modified: [] },
    filters: { added: [], removed: [], modified: [] },
    otherChanges: [],
    requiresMigration: false,
    migrationImpact: {
      recordsAffected: '未知',
      description: ''
    }
  };

  if (!oldConfig || !newConfig) return result;

  const oldFields = ensureArray(oldConfig.fields, []);
  const newFields = ensureArray(newConfig.fields, []);
  const oldFieldMap = new Map(oldFields.map((f) => [f.key, f]));
  const newFieldMap = new Map(newFields.map((f) => [f.key, f]));
  const oldFieldIds = new Set(oldFields.map((f) => f.id));
  const newFieldIds = new Set(newFields.map((f) => f.id));

  newFields.forEach((f) => {
    if (!oldFieldIds.has(f.id)) {
      result.fields.added.push({ key: f.key, label: f.label, type: f.type });
    } else {
      const old = oldFieldMap.get(f.key);
      if (old) {
        const changes = [];
        if (old.label !== f.label) changes.push(`标签: "${old.label}" → "${f.label}"`);
        if (old.type !== f.type) changes.push(`类型: ${old.type} → ${f.type}`);
        if (old.required !== f.required) changes.push(`必填: ${old.required ? '是' : '否'} → ${f.required ? '是' : '否'}`);
        if (old.searchable !== f.searchable) changes.push(`搜索: ${old.searchable ? '是' : '否'} → ${f.searchable ? '是' : '否'}`);
        if (old.showInCard !== f.showInCard) changes.push(`卡片显示: ${old.showInCard ? '是' : '否'} → ${f.showInCard ? '是' : '否'}`);
        if (old.sortable !== f.sortable) changes.push(`可排序: ${old.sortable ? '是' : '否'} → ${f.sortable ? '是' : '否'}`);
        if (old.dateKey !== f.dateKey) changes.push(`时间字段: ${old.dateKey ? '是' : '否'} → ${f.dateKey ? '是' : '否'}`);
        if (JSON.stringify(old.options || []) !== JSON.stringify(f.options || [])) changes.push('选项变更');
        if (changes.length > 0) {
          result.fields.modified.push({ key: f.key, label: f.label, changes });
        }
      }
    }
  });

  oldFields.forEach((f) => {
    if (!newFieldIds.has(f.id)) {
      result.fields.removed.push({ key: f.key, label: f.label, type: f.type });
    }
  });

  const oldStatuses = ensureArray(oldConfig.statuses, []);
  const newStatuses = ensureArray(newConfig.statuses, []);
  const oldStatusIds = new Set(oldStatuses.map((s) => s.id));
  const newStatusIds = new Set(newStatuses.map((s) => s.id));
  const oldStatusNameMap = new Map(oldStatuses.map((s) => [s.name, s]));

  newStatuses.forEach((s) => {
    if (!oldStatusIds.has(s.id)) {
      result.statuses.added.push({ name: s.name, color: s.color });
    } else {
      const old = oldStatuses.find((os) => os.id === s.id);
      if (old) {
        const changes = [];
        if (old.name !== s.name) {
          changes.push(`名称: "${old.name}" → "${s.name}"`);
          result.statuses.renamed.push({ oldName: old.name, newName: s.name });
        }
        if (old.color !== s.color) changes.push(`颜色: ${old.color} → ${s.color}`);
        if (old.primary !== s.primary) changes.push(`初始状态: ${old.primary ? '是' : '否'} → ${s.primary ? '是' : '否'}`);
        if (old.terminal !== s.terminal) changes.push(`终态: ${old.terminal ? '是' : '否'} → ${s.terminal ? '是' : '否'}`);
        if (old.tatTrigger !== s.tatTrigger) changes.push(`TAT触发: ${old.tatTrigger ? '是' : '否'} → ${s.tatTrigger ? '是' : '否'}`);
        if (changes.length > 0) {
          result.statuses.modified.push({ name: s.name, changes });
        }
      }
    }
  });

  oldStatuses.forEach((s) => {
    if (!newStatusIds.has(s.id)) {
      result.statuses.removed.push({ name: s.name, color: s.color });
    }
  });

  const oldMetrics = ensureArray(oldConfig.metrics, []);
  const newMetrics = ensureArray(newConfig.metrics, []);
  const oldMetricIds = new Set(oldMetrics.map((m) => m.id));
  const newMetricIds = new Set(newMetrics.map((m) => m.id));

  newMetrics.forEach((m) => {
    if (!oldMetricIds.has(m.id)) {
      result.metrics.added.push({ label: m.label, type: m.type });
    } else {
      const old = oldMetrics.find((om) => om.id === m.id);
      if (old) {
        const changes = [];
        if (old.label !== m.label) changes.push(`名称: "${old.label}" → "${m.label}"`);
        if (old.type !== m.type) changes.push(`类型: ${old.type} → ${m.type}`);
        if (old.enabled !== m.enabled) changes.push(`启用: ${old.enabled ? '是' : '否'} → ${m.enabled ? '是' : '否'}`);
        if (old.field !== m.field) changes.push(`字段: ${old.field || '无'} → ${m.field || '无'}`);
        if (JSON.stringify(old.filter || {}) !== JSON.stringify(m.filter || {})) changes.push('筛选条件变更');
        if (changes.length > 0) {
          result.metrics.modified.push({ label: m.label, changes });
        }
      }
    }
  });

  oldMetrics.forEach((m) => {
    if (!newMetricIds.has(m.id)) {
      result.metrics.removed.push({ label: m.label, type: m.type });
    }
  });

  const oldFilters = ensureArray(oldConfig.filters, []);
  const newFilters = ensureArray(newConfig.filters, []);
  const oldFilterIds = new Set(oldFilters.map((f) => f.id));
  const newFilterIds = new Set(newFilters.map((f) => f.id));

  newFilters.forEach((f) => {
    if (!oldFilterIds.has(f.id)) {
      result.filters.added.push({ label: f.label, type: f.type });
    } else {
      const old = oldFilters.find((of) => of.id === f.id);
      if (old) {
        const changes = [];
        if (old.label !== f.label) changes.push(`名称: "${old.label}" → "${f.label}"`);
        if (old.type !== f.type) changes.push(`类型: ${old.type} → ${f.type}`);
        if (old.enabled !== f.enabled) changes.push(`启用: ${old.enabled ? '是' : '否'} → ${f.enabled ? '是' : '否'}`);
        if (old.field !== f.field) changes.push(`字段: ${old.field || '无'} → ${f.field || '无'}`);
        if (JSON.stringify(old.searchFields || []) !== JSON.stringify(f.searchFields || [])) changes.push('搜索字段变更');
        if (changes.length > 0) {
          result.filters.modified.push({ label: f.label, changes });
        }
      }
    }
  });

  oldFilters.forEach((f) => {
    if (!newFilterIds.has(f.id)) {
      result.filters.removed.push({ label: f.label, type: f.type });
    }
  });

  if (oldConfig.title !== newConfig.title) result.otherChanges.push('系统标题');
  if (oldConfig.subtitle !== newConfig.subtitle) result.otherChanges.push('副标题');
  if (oldConfig.accent !== newConfig.accent) result.otherChanges.push('主题色');
  if (oldConfig.note !== newConfig.note) result.otherChanges.push('提示说明');
  if (JSON.stringify(oldConfig.sortConfig || {}) !== JSON.stringify(newConfig.sortConfig || {})) result.otherChanges.push('排序配置');
  if (JSON.stringify(oldConfig.priorityConfig || {}) !== JSON.stringify(newConfig.priorityConfig || {})) result.otherChanges.push('优先级配置');
  if (JSON.stringify(oldConfig.cardDisplay || {}) !== JSON.stringify(newConfig.cardDisplay || {})) result.otherChanges.push('卡片显示配置');
  if (JSON.stringify(oldConfig.businessRules || {}) !== JSON.stringify(newConfig.businessRules || {})) result.otherChanges.push('业务规则配置');
  if (JSON.stringify(oldConfig.defaultValues || {}) !== JSON.stringify(newConfig.defaultValues || {})) result.otherChanges.push('默认值配置');
  if (JSON.stringify(oldConfig.batchImport || {}) !== JSON.stringify(newConfig.batchImport || {})) result.otherChanges.push('批量导入配置');

  result.hasChanges =
    result.fields.added.length > 0 ||
    result.fields.removed.length > 0 ||
    result.fields.modified.length > 0 ||
    result.statuses.added.length > 0 ||
    result.statuses.removed.length > 0 ||
    result.statuses.modified.length > 0 ||
    result.metrics.added.length > 0 ||
    result.metrics.removed.length > 0 ||
    result.metrics.modified.length > 0 ||
    result.filters.added.length > 0 ||
    result.filters.removed.length > 0 ||
    result.filters.modified.length > 0 ||
    result.otherChanges.length > 0;

  result.requiresMigration =
    result.fields.removed.length > 0 ||
    result.statuses.removed.length > 0 ||
    result.statuses.renamed.length > 0 ||
    result.fields.added.length > 0;

  if (result.requiresMigration) {
    const impacts = [];
    if (result.fields.removed.length > 0) {
      impacts.push(`删除 ${result.fields.removed.length} 个字段，相关病例数据将保留但不再显示`);
    }
    if (result.fields.added.length > 0) {
      impacts.push(`新增 ${result.fields.added.length} 个字段，历史病例将填充默认值`);
    }
    if (result.statuses.removed.length > 0) {
      impacts.push(`删除 ${result.statuses.removed.length} 个状态，相关病例将重置为初始状态`);
    }
    if (result.statuses.renamed.length > 0) {
      impacts.push(`重命名 ${result.statuses.renamed.length} 个状态，相关病例状态将同步更新`);
    }
    result.migrationImpact.description = impacts.join('；');
  }

  return result;
}
