import { QUEUE_CONFIG_STORAGE, VIEW_STORAGE_KEY, ACTIVE_VIEW_STORAGE_KEY } from './defaultConfig';
import { ensureArray, ensureObject, ensureString, sanitizeConfig, loadConfig, uid } from './configManager';

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return Object.assign({}, obj);
  }
}

export function validateView(view) {
  const warnings = [];
  const errors = [];

  if (!view || typeof view !== 'object') {
    return { valid: false, errors: ['视图不是有效对象'], warnings: [] };
  }

  if (!ensureString(view.id)) {
    errors.push('视图缺少唯一ID');
  }

  if (!ensureString(view.name)) {
    errors.push('视图名称不能为空');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function sanitizeView(rawView, config) {
  if (!rawView || typeof rawView !== 'object') {
    return null;
  }

  const fields = ensureArray(config?.fields, []);
  const statuses = ensureArray(config?.statuses, []);
  const fieldKeys = new Set(fields.map((f) => f.key));
  const statusNames = new Set(statuses.map((s) => s.name));
  const filters = ensureArray(config?.filters, []);
  const filterIds = new Set(filters.map((f) => f.id));

  const sanitizedFilters = {};
  const rawFilters = ensureObject(rawView.filters, {});

  filters.forEach((filter) => {
    if (!filter.enabled) return;

    const filterId = filter.id;
    const rawValue = rawFilters[filterId];

    if (filter.type === 'search') {
      sanitizedFilters[filterId] = ensureString(rawValue, '');
    } else if (filter.type === 'status') {
      if (rawValue === '全部' || statusNames.has(rawValue)) {
        sanitizedFilters[filterId] = rawValue;
      } else {
        sanitizedFilters[filterId] = '全部';
      }
    } else if (filter.type === 'select') {
      const fieldDef = fields.find((f) => f.key === filter.field);
      const options = fieldDef?.options || [];
      if (rawValue === '全部' || options.includes(rawValue)) {
        sanitizedFilters[filterId] = rawValue;
      } else {
        sanitizedFilters[filterId] = '全部';
      }
    }
  });

  const sortConfig = ensureObject(rawView.sortConfig, {});
  const validSortFields = fields.filter((f) => f.sortable).map((f) => f.key);
  const allFieldKeys = fields.map((f) => f.key);

  const sanitizedSort = {
    primaryField: validSortFields.includes(sortConfig.primaryField)
      ? sortConfig.primaryField
      : (validSortFields[0] || allFieldKeys[0] || ''),
    secondaryField: ['createdAt', ...allFieldKeys].includes(sortConfig.secondaryField)
      ? sortConfig.secondaryField
      : 'createdAt',
    direction: ['asc', 'desc'].includes(sortConfig.direction) ? sortConfig.direction : 'asc'
  };

  const viewTypes = ['workbench', 'table', 'kanban', 'dispatch', 'slide-borrow', 'critical-notify', 'phrase-library'];
  const activeView = viewTypes.includes(rawView.activeView) ? rawView.activeView : 'workbench';

  const collapsedZones = ensureArray(rawView.collapsedZones, [])
    .filter((zone) => statusNames.has(zone));

  return {
    id: ensureString(rawView.id, `v_${uid()}`),
    name: ensureString(rawView.name, '未命名视图'),
    icon: ensureString(rawView.icon, 'Layers'),
    filters: sanitizedFilters,
    sortConfig: sanitizedSort,
    activeView: activeView,
    collapsedZones: collapsedZones,
    createdAt: ensureString(rawView.createdAt, new Date().toISOString()),
    updatedAt: ensureString(rawView.updatedAt, new Date().toISOString()),
    configVersion: config?.version || 1
  };
}

export function migrateView(view, oldConfig, newConfig) {
  if (!view || !newConfig) return view;

  const migrated = deepClone(view);

  const fieldRenames = [];
  const oldFields = ensureArray(oldConfig?.fields, []);
  const newFields = ensureArray(newConfig.fields, []);
  const oldFieldIdMap = new Map(oldFields.map((f) => [f.id, f]));

  newFields.forEach((field) => {
    const oldField = oldFieldIdMap.get(field.id);
    if (oldField && oldField.key !== field.key) {
      fieldRenames.push({ oldKey: oldField.key, newKey: field.key });
    }
  });

  const statusRenames = [];
  const oldStatuses = ensureArray(oldConfig?.statuses, []);
  const newStatuses = ensureArray(newConfig.statuses, []);
  const oldStatusIdMap = new Map(oldStatuses.map((s) => [s.id, s]));

  newStatuses.forEach((status) => {
    const oldStatus = oldStatusIdMap.get(status.id);
    if (oldStatus && oldStatus.name !== status.name) {
      statusRenames.push({ oldName: oldStatus.name, newName: status.name });
    }
  });

  if (fieldRenames.length > 0 && migrated.filters) {
    const newFilters = ensureArray(newConfig.filters, []);
    const oldFilters = ensureArray(oldConfig?.filters, []);
    const oldFilterIdMap = new Map(oldFilters.map((f) => [f.id, f]));

    newFilters.forEach((newFilter) => {
      const oldFilter = oldFilterIdMap.get(newFilter.id);
      if (!oldFilter) return;

      if (newFilter.type === 'select' && oldFilter.type === 'select') {
        fieldRenames.forEach(({ oldKey, newKey }) => {
          if (oldFilter.field === oldKey && newFilter.field === newKey) {
            const oldValue = migrated.filters[oldFilter.id];
            if (oldValue !== undefined) {
              const fieldDef = newFields.find((f) => f.key === newKey);
              const options = fieldDef?.options || [];
              if (oldValue === '全部' || options.includes(oldValue)) {
                migrated.filters[newFilter.id] = oldValue;
              } else {
                migrated.filters[newFilter.id] = '全部';
              }
            }
          }
        });
      }

      if (newFilter.type === 'search' && oldFilter.type === 'search') {
        if (migrated.filters[newFilter.id] === undefined) {
          migrated.filters[newFilter.id] = migrated.filters[oldFilter.id] || '';
        }
      }
    });
  }

  if (statusRenames.length > 0 && migrated.filters) {
    const newFilters = ensureArray(newConfig.filters, []);
    newFilters.forEach((filter) => {
      if (filter.type === 'status') {
        const value = migrated.filters[filter.id];
        if (value) {
          const rename = statusRenames.find((r) => r.oldName === value);
          if (rename) {
            migrated.filters[filter.id] = rename.newName;
          }
        }
      }
    });
  }

  if (statusRenames.length > 0 && migrated.collapsedZones) {
    migrated.collapsedZones = migrated.collapsedZones.map((zone) => {
      const rename = statusRenames.find((r) => r.oldName === zone);
      return rename ? rename.newName : zone;
    });
  }

  const validStatusNames = new Set(newStatuses.map((s) => s.name));
  if (migrated.collapsedZones) {
    migrated.collapsedZones = migrated.collapsedZones.filter((zone) => validStatusNames.has(zone));
  }

  const validSortFields = newFields.filter((f) => f.sortable).map((f) => f.key);
  const allNewFieldKeys = newFields.map((f) => f.key);

  if (migrated.sortConfig) {
    if (!validSortFields.includes(migrated.sortConfig.primaryField)) {
      migrated.sortConfig.primaryField = validSortFields[0] || allNewFieldKeys[0] || '';
    }
    if (!['createdAt', ...allNewFieldKeys].includes(migrated.sortConfig.secondaryField)) {
      migrated.sortConfig.secondaryField = 'createdAt';
    }
  }

  migrated.configVersion = newConfig.version || 1;
  migrated.updatedAt = new Date().toISOString();

  return sanitizeView(migrated, newConfig);
}

export function loadViews(config) {
  const raw = localStorage.getItem(VIEW_STORAGE_KEY);
  const currentConfig = config || loadConfig();

  if (!raw) {
    return createDefaultViews(currentConfig);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return createDefaultViews(currentConfig);
    }

    return parsed
      .map((view) => sanitizeView(view, currentConfig))
      .filter(Boolean);
  } catch (error) {
    console.error('[ViewManager] Failed to load views:', error);
    return createDefaultViews(currentConfig);
  }
}

export function persistViews(views, config) {
  const currentConfig = config || loadConfig();
  const sanitized = views
    .map((v) => sanitizeView(v, currentConfig))
    .filter(Boolean);

  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch (error) {
    console.error('[ViewManager] Failed to persist views:', error);
    return sanitized;
  }
}

export function loadActiveViewId() {
  try {
    return localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function persistActiveViewId(viewId) {
  try {
    localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, viewId || '');
  } catch (error) {
    console.error('[ViewManager] Failed to persist active view:', error);
  }
}

export function createView(name, currentState, config) {
  const currentConfig = config || loadConfig();
  const now = new Date().toISOString();

  const view = {
    id: `v_${uid()}`,
    name: name || '新视图',
    icon: 'Layers',
    filters: deepClone(currentState.filters || {}),
    sortConfig: deepClone(currentState.sortConfig || currentConfig.sortConfig || {}),
    activeView: currentState.activeView || 'workbench',
    collapsedZones: deepClone(currentState.collapsedZones || []),
    createdAt: now,
    updatedAt: now,
    configVersion: currentConfig.version || 1
  };

  return sanitizeView(view, currentConfig);
}

export function updateView(viewId, updates, views, config) {
  const currentConfig = config || loadConfig();
  const now = new Date().toISOString();

  return views.map((view) => {
    if (view.id !== viewId) return view;

    const updated = {
      ...view,
      ...updates,
      updatedAt: now,
      configVersion: currentConfig.version || 1
    };

    return sanitizeView(updated, currentConfig);
  }).filter(Boolean);
}

export function deleteView(viewId, views, activeViewId) {
  const remaining = views.filter((v) => v.id !== viewId);
  let newActiveViewId = activeViewId;

  if (activeViewId === viewId) {
    newActiveViewId = remaining.length > 0 ? remaining[0].id : '';
    persistActiveViewId(newActiveViewId);
  }

  return { views: remaining, activeViewId: newActiveViewId };
}

export function createDefaultViews(config) {
  const currentConfig = config || loadConfig();
  const now = new Date().toISOString();
  const statuses = ensureArray(currentConfig.statuses, []);
  const primaryStatus = statuses.find((s) => s.primary) || statuses[0];

  const defaultFilters = {};
  const filters = ensureArray(currentConfig.filters, []);
  filters.forEach((filter) => {
    if (!filter.enabled) return;
    if (filter.type === 'search') {
      defaultFilters[filter.id] = '';
    } else {
      defaultFilters[filter.id] = '全部';
    }
  });

  const priorityField = currentConfig.priorityConfig?.fieldKey;
  const priorityFilter = filters.find((f) => f.type === 'select' && f.field === priorityField);
  const urgentFilter = { ...defaultFilters };
  if (priorityFilter) {
    urgentFilter[priorityFilter.id] = '加急';
  }

  const statusFilter = filters.find((f) => f.type === 'status');
  const pendingFilter = { ...defaultFilters };
  if (statusFilter && primaryStatus) {
    pendingFilter[statusFilter.id] = primaryStatus.name;
  }

  const defaultViews = [
    {
      id: 'v_default_all',
      name: '全部病例',
      icon: 'ClipboardList',
      filters: defaultFilters,
      sortConfig: deepClone(currentConfig.sortConfig || {}),
      activeView: 'workbench',
      collapsedZones: [],
      createdAt: now,
      updatedAt: now,
      configVersion: currentConfig.version || 1
    },
    {
      id: 'v_default_urgent',
      name: '加急处理',
      icon: 'Zap',
      filters: urgentFilter,
      sortConfig: deepClone(currentConfig.sortConfig || {}),
      activeView: 'workbench',
      collapsedZones: [],
      createdAt: now,
      updatedAt: now,
      configVersion: currentConfig.version || 1
    },
    {
      id: 'v_default_pending',
      name: '待阅片',
      icon: 'Clock',
      filters: pendingFilter,
      sortConfig: deepClone(currentConfig.sortConfig || {}),
      activeView: 'workbench',
      collapsedZones: [],
      createdAt: now,
      updatedAt: now,
      configVersion: currentConfig.version || 1
    }
  ];

  return defaultViews.map((v) => sanitizeView(v, currentConfig)).filter(Boolean);
}

export function getViewById(views, viewId) {
  return views.find((v) => v.id === viewId) || null;
}

export function migrateAllViews(views, oldConfig, newConfig) {
  const migrated = views.map((view) => migrateView(view, oldConfig, newConfig));
  return persistViews(migrated, newConfig);
}

export class ViewSync {
  constructor(options = {}) {
    this.onViewsUpdate = options.onViewsUpdate || (() => {});
    this.onActiveViewChange = options.onActiveViewChange || (() => {});
    this.tabId = this._getTabId();
    this._storageHandler = null;
    this._listenersBound = false;
  }

  _getTabId() {
    let id = null;
    try {
      id = sessionStorage.getItem('hxwl-61306-view-tab-id');
    } catch {}
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      try {
        sessionStorage.setItem('hxwl-61306-view-tab-id', id);
      } catch {}
    }
    return id;
  }

  init() {
    this._bindListeners();
  }

  _bindListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    this._storageHandler = (event) => {
      if (event.key === VIEW_STORAGE_KEY && event.newValue) {
        try {
          const meta = JSON.parse(event.newValue);
          if (meta && meta._tabId === this.tabId) return;

          const views = JSON.parse(event.newValue);
          if (Array.isArray(views)) {
            this.onViewsUpdate(views);
          }
        } catch {
          return;
        }
      }

      if (event.key === ACTIVE_VIEW_STORAGE_KEY && event.newValue) {
        try {
          const meta = JSON.parse(event.newValue);
          if (meta && meta._tabId === this.tabId) return;

          this.onActiveViewChange(event.newValue);
        } catch {
          this.onActiveViewChange(event.newValue);
        }
      }
    };

    window.addEventListener('storage', this._storageHandler);
  }

  persistViews(views, config) {
    const payload = {
      _tabId: this.tabId,
      _timestamp: Date.now(),
      views: views
    };

    const sanitized = persistViews(views, config);

    try {
      localStorage.setItem(VIEW_STORAGE_KEY + '_meta', JSON.stringify(payload));
    } catch {}

    return sanitized;
  }

  persistActiveView(viewId) {
    const payload = {
      _tabId: this.tabId,
      _timestamp: Date.now(),
      viewId: viewId
    };

    persistActiveViewId(viewId);

    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY + '_meta', JSON.stringify(payload));
    } catch {}
  }

  destroy() {
    if (this._storageHandler) {
      window.removeEventListener('storage', this._storageHandler);
      this._storageHandler = null;
    }
    this._listenersBound = false;
  }
}
