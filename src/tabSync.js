const TAB_SYNC_PREFIX = '__tab_sync__';
const TAB_HEARTBEAT_KEY = TAB_SYNC_PREFIX + 'heartbeat';
const HEARTBEAT_INTERVAL = 5000;
const TAB_TIMEOUT = 15000;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function computeRecordMap(records) {
  const map = new Map();
  records.forEach((r) => { if (r.id) map.set(r.id, r); });
  return map;
}

export function diffRecordMaps(baseMap, currentMap) {
  const added = [];
  const removed = [];
  const modified = [];
  const seenIds = new Set();
  for (const [id, record] of currentMap) {
    seenIds.add(id);
    if (!baseMap.has(id)) {
      added.push(record);
    } else {
      const baseRecord = baseMap.get(id);
      if (JSON.stringify(baseRecord) !== JSON.stringify(record)) {
        modified.push({ id, local: record, base: baseRecord });
      }
    }
  }
  for (const [id, record] of baseMap) {
    if (!seenIds.has(id)) {
      removed.push(record);
    }
  }
  return { added, removed, modified };
}

export function mergeTimelines(localTimeline, externalTimeline) {
  const seen = new Set();
  const merged = [];
  const allEntries = [...(localTimeline || []), ...(externalTimeline || [])];
  for (const entry of allEntries) {
    const key = `${entry.changedAt || ''}|${entry.status || ''}|${entry.by || ''}|${entry.type || ''}|${entry.reviewId || ''}|${entry.action || ''}|${entry.event || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(entry);
    }
  }
  merged.sort((a, b) => {
    const ta = new Date(a.changedAt || a.at || 0).getTime();
    const tb = new Date(b.changedAt || b.at || 0).getTime();
    return ta - tb;
  });
  return merged;
}

export function mergeReviews(localReviews, externalReviews) {
  const byId = new Map();
  const ordered = [];
  const allReviews = [...(externalReviews || []), ...(localReviews || [])];
  for (const review of allReviews) {
    if (review.id && !byId.has(review.id)) {
      byId.set(review.id, review);
      ordered.push(review);
    } else if (!review.id) {
      ordered.push(review);
    }
  }
  ordered.sort((a, b) => {
    const ta = new Date(a.reviewedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.reviewedAt || b.createdAt || 0).getTime();
    return ta - tb;
  });
  return ordered;
}

export function mergeCaseRecord(localRecord, externalRecord) {
  if (!localRecord) return { ...externalRecord };
  if (!externalRecord) return { ...localRecord };

  const localTimeline = localRecord.timeline || [];
  const externalTimeline = externalRecord.timeline || [];
  const localReviews = localRecord.reviews || [];
  const externalReviews = externalRecord.reviews || [];

  const localModifiedAt = localRecord._modifiedAt || localRecord.updatedAt || localRecord.createdAt || '';
  const externalModifiedAt = externalRecord._modifiedAt || externalRecord.updatedAt || externalRecord.createdAt || '';
  const localTime = new Date(localModifiedAt).getTime();
  const externalTime = new Date(externalModifiedAt).getTime();

  const latestStatus = localTime >= externalTime
    ? localRecord.status
    : externalRecord.status;

  const mergedTimeline = mergeTimelines(localTimeline, externalTimeline);
  const mergedReviews = mergeReviews(localReviews, externalReviews);

  const scalarFields = ['caseNo', 'sampleType', 'priority', 'sentAt', 'doctor', 'summary'];
  const result = { ...externalRecord };

  for (const field of scalarFields) {
    const localVal = localRecord[field];
    const extVal = externalRecord[field];
    if (localVal && extVal && localVal !== extVal) {
      result[field] = localTime >= externalTime ? localVal : extVal;
    } else if (localVal && !extVal) {
      result[field] = localVal;
    } else if (!localVal && extVal) {
      result[field] = extVal;
    }
  }

  const localCreatedAt = localRecord.createdAt || '';
  const externalCreatedAt = externalRecord.createdAt || '';
  result.createdAt = localCreatedAt || externalCreatedAt;

  const localUpdatedAt = localRecord.updatedAt || localModifiedAt;
  const externalUpdatedAt = externalRecord.updatedAt || externalModifiedAt;
  result.updatedAt = new Date(Math.max(
    new Date(localUpdatedAt || 0).getTime(),
    new Date(externalUpdatedAt || 0).getTime()
  )).toISOString();

  result.status = latestStatus;
  result.timeline = mergedTimeline;
  result.reviews = mergedReviews;

  return result;
}

export function mergeRecordLists(localRecords, externalRecords, baseRecords = []) {
  const localMap = computeRecordMap(localRecords);
  const externalMap = computeRecordMap(externalRecords);
  const baseMap = computeRecordMap(baseRecords);

  const localIds = new Set(localRecords.map((r) => r.id));
  const externalIds = new Set(externalRecords.map((r) => r.id));
  const baseIds = new Set(baseRecords.map((r) => r.id));

  const locallyDeletedIds = new Set();
  for (const id of baseIds) {
    if (!localIds.has(id)) locallyDeletedIds.add(id);
  }

  const externallyDeletedIds = new Set();
  for (const id of baseIds) {
    if (!externalIds.has(id)) externallyDeletedIds.add(id);
  }

  const allIds = new Set([...localIds, ...externalIds]);
  const merged = [];

  for (const id of allIds) {
    const local = localMap.get(id);
    const ext = externalMap.get(id);
    const base = baseMap.get(id);

    const localDeleted = locallyDeletedIds.has(id);
    const externalDeleted = externallyDeletedIds.has(id);

    if (localDeleted && externalDeleted) {
      continue;
    }

    if (localDeleted && !externalDeleted) {
      if (base && ext) {
        const baseStr = JSON.stringify(base);
        const extStr = JSON.stringify(ext);
        if (baseStr !== extStr) {
          merged.push(mergeCaseRecord(null, ext));
          continue;
        }
      }
      continue;
    }

    if (!localDeleted && externalDeleted) {
      if (base && local) {
        const baseStr = JSON.stringify(base);
        const localStr = JSON.stringify(local);
        if (baseStr !== localStr) {
          merged.push(mergeCaseRecord(local, null));
          continue;
        }
      }
      continue;
    }

    if (local && ext) {
      merged.push(mergeCaseRecord(local, ext));
    } else if (local) {
      merged.push({ ...local });
    } else if (ext) {
      merged.push({ ...ext });
    }
  }

  const localOrder = new Map();
  localRecords.forEach((r, idx) => localOrder.set(r.id, idx));
  const externalOrder = new Map();
  externalRecords.forEach((r, idx) => externalOrder.set(r.id, idx));

  merged.sort((a, b) => {
    const aLocalIdx = localOrder.has(a.id) ? localOrder.get(a.id) : Infinity;
    const bLocalIdx = localOrder.has(b.id) ? localOrder.get(b.id) : Infinity;
    const aExtIdx = externalOrder.has(a.id) ? externalOrder.get(a.id) : Infinity;
    const bExtIdx = externalOrder.has(b.id) ? externalOrder.get(b.id) : Infinity;

    const aMin = Math.min(aLocalIdx, aExtIdx);
    const bMin = Math.min(bLocalIdx, bExtIdx);

    if (aMin !== bMin) return aMin - bMin;

    const aTime = a.sentAt || a.createdAt || '';
    const bTime = b.sentAt || b.createdAt || '';
    return String(bTime).localeCompare(String(aTime));
  });

  return merged;
}

export function detectConflicts(localRecords, externalRecords, baseRecords) {
  const baseMap = computeRecordMap(baseRecords);
  const localMap = computeRecordMap(localRecords);
  const externalMap = computeRecordMap(externalRecords);

  const localDiff = diffRecordMaps(baseMap, localMap);
  const externalDiff = diffRecordMaps(baseMap, externalMap);

  const hasLocalChanges = localDiff.added.length > 0 || localDiff.removed.length > 0 || localDiff.modified.length > 0;
  const hasExternalChanges = externalDiff.added.length > 0 || externalDiff.removed.length > 0 || externalDiff.modified.length > 0;

  if (!hasLocalChanges || !hasExternalChanges) {
    return {
      hasConflicts: false,
      hasLocalChanges,
      hasExternalChanges,
      conflicts: [],
      localOnlyAdditions: localDiff.added,
      externalOnlyAdditions: externalDiff.added,
      localOnlyRemovals: localDiff.removed,
      externalOnlyRemovals: externalDiff.removed,
      localDiff,
      externalDiff
    };
  }

  const localChangedIds = new Set([
    ...localDiff.added.map((r) => r.id),
    ...localDiff.removed.map((r) => r.id),
    ...localDiff.modified.map((d) => d.id)
  ]);
  const externalChangedIds = new Set([
    ...externalDiff.added.map((r) => r.id),
    ...externalDiff.removed.map((r) => r.id),
    ...externalDiff.modified.map((d) => d.id)
  ]);

  const conflictIds = new Set([...localChangedIds].filter((id) => externalChangedIds.has(id)));
  const conflicts = [];

  for (const id of conflictIds) {
    const local = localMap.get(id);
    const ext = externalMap.get(id);
    const base = baseMap.get(id);

    if (!local && ext) {
      conflicts.push({
        id,
        caseNo: ext.caseNo,
        type: 'delete-vs-modify',
        localRecord: null,
        externalRecord: ext,
        baseRecord: base
      });
    } else if (local && !ext) {
      conflicts.push({
        id,
        caseNo: local.caseNo,
        type: 'modify-vs-delete',
        localRecord: local,
        externalRecord: null,
        baseRecord: base
      });
    } else if (local && ext) {
      conflicts.push({
        id,
        caseNo: local.caseNo,
        type: 'modify-vs-modify',
        localRecord: local,
        externalRecord: ext,
        baseRecord: base
      });
    }
  }

  const localOnlyAdditions = localDiff.added.filter((r) => !externalChangedIds.has(r.id));
  const externalOnlyAdditions = externalDiff.added.filter((r) => !localChangedIds.has(r.id));
  const localOnlyRemovals = localDiff.removed.filter((r) => !externalChangedIds.has(r.id));
  const externalOnlyRemovals = externalDiff.removed.filter((r) => !localChangedIds.has(r.id));

  return {
    hasConflicts: conflicts.length > 0,
    hasLocalChanges: true,
    hasExternalChanges: true,
    conflicts,
    localOnlyAdditions,
    externalOnlyAdditions,
    localOnlyRemovals,
    externalOnlyRemovals,
    localDiff,
    externalDiff
  };
}

export function resolveConflict(strategy, localRecords, externalRecords, baseRecords) {
  switch (strategy) {
    case 'keep-local':
      return localRecords;
    case 'adopt-latest':
      return externalRecords;
    case 'merge':
      return mergeRecordLists(localRecords, externalRecords, baseRecords);
    default:
      return localRecords;
  }
}

export class TabSync {
  constructor(storageKey, options = {}) {
    this.storageKey = storageKey;
    this.tabId = uid();
    this.onExternalUpdate = options.onExternalUpdate || (() => {});
    this.onConflict = options.onConflict || (() => {});
    this.onTabListChange = options.onTabListChange || (() => {});
    this.baseSnapshot = [];
    this.currentRecords = [];
    this.hasLocalMutations = false;
    this._storageHandler = null;
    this._heartbeatTimer = null;
    this._listenersBound = false;
  }

  init(initialRecords) {
    this.baseSnapshot = JSON.parse(JSON.stringify(initialRecords));
    this.currentRecords = JSON.parse(JSON.stringify(initialRecords));
    this._bindListeners();
    this._startHeartbeat();
    this._notifyTabListChange();
  }

  updateCurrentRecords(records) {
    this.currentRecords = JSON.parse(JSON.stringify(records));
  }

  persist(records) {
    this.currentRecords = JSON.parse(JSON.stringify(records));
    this.hasLocalMutations = true;
    const payload = {
      tabId: this.tabId,
      records: records,
      timestamp: Date.now()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(records));
    localStorage.setItem(this.storageKey + '_meta', JSON.stringify(payload));
  }

  _updateBaseSnapshot(records) {
    this.baseSnapshot = JSON.parse(JSON.stringify(records));
    this.currentRecords = JSON.parse(JSON.stringify(records));
    this.hasLocalMutations = false;
  }

  _bindListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    this._storageHandler = (event) => {
      if (event.key !== this.storageKey && event.key !== this.storageKey + '_meta') return;
      if (!event.newValue) return;

      if (event.key === this.storageKey + '_meta') {
        try {
          const meta = JSON.parse(event.newValue);
          if (meta.tabId === this.tabId) return;
          this._notifyTabListChange();
          if (Array.isArray(meta.records)) {
            this._handleExternalChange(meta.records);
          }
        } catch {
          return;
        }
      }

      if (event.key === this.storageKey) {
        try {
          const externalRecords = JSON.parse(event.newValue);
          if (!Array.isArray(externalRecords)) return;
          this._handleExternalChange(externalRecords);
        } catch {
          return;
        }
      }
    };

    window.addEventListener('storage', this._storageHandler);
    window.addEventListener('beforeunload', () => this._cleanupHeartbeat());
  }

  _handleExternalChange(externalRecords) {
    const currentRecords = this.currentRecords;
    const baseRecords = this.baseSnapshot;

    const conflictInfo = detectConflicts(currentRecords, externalRecords, baseRecords);
    conflictInfo.externalRecords = externalRecords;
    conflictInfo.localRecords = currentRecords;
    conflictInfo.baseRecords = baseRecords;

    const externalDiffersFromCurrent = JSON.stringify(currentRecords) !== JSON.stringify(externalRecords);
    if (!this.hasLocalMutations && !conflictInfo.hasLocalChanges && conflictInfo.hasExternalChanges) {
      this._updateBaseSnapshot(externalRecords);
      this.onExternalUpdate(externalRecords, conflictInfo);
      return;
    }

    if ((conflictInfo.hasLocalChanges || this.hasLocalMutations) && externalDiffersFromCurrent) {
      this._lastExternalRecords = externalRecords;
      this.onConflict(conflictInfo);
    }
  }

  _startHeartbeat() {
    if (this._heartbeatTimer) return;
    const heartbeat = () => {
      try {
        const raw = localStorage.getItem(TAB_HEARTBEAT_KEY);
        const heartbeats = raw ? JSON.parse(raw) : {};
        heartbeats[this.tabId] = {
          lastSeen: Date.now(),
          storageKey: this.storageKey
        };
        const now = Date.now();
        Object.keys(heartbeats).forEach((id) => {
          if (now - heartbeats[id].lastSeen > TAB_TIMEOUT) {
            delete heartbeats[id];
          }
        });
        localStorage.setItem(TAB_HEARTBEAT_KEY, JSON.stringify(heartbeats));
      } catch {}
    };
    heartbeat();
    this._heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL);
  }

  _cleanupHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    try {
      const raw = localStorage.getItem(TAB_HEARTBEAT_KEY);
      const heartbeats = raw ? JSON.parse(raw) : {};
      delete heartbeats[this.tabId];
      localStorage.setItem(TAB_HEARTBEAT_KEY, JSON.stringify(heartbeats));
    } catch {}
  }

  _notifyTabListChange() {
    try {
      const raw = localStorage.getItem(TAB_HEARTBEAT_KEY);
      const heartbeats = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      const activeTabs = Object.keys(heartbeats).filter((id) => {
        if (id === this.tabId) return true;
        return now - heartbeats[id].lastSeen <= TAB_TIMEOUT;
      });
      this.onTabListChange(activeTabs.length, activeTabs);
    } catch {
      this.onTabListChange(1, [this.tabId]);
    }
  }

  resolve(strategy) {
    const externalRecords = this._lastExternalRecords || this.currentRecords;
    const resolved = resolveConflict(
      strategy,
      this.currentRecords,
      externalRecords,
      this.baseSnapshot
    );
    this._updateBaseSnapshot(resolved);
    localStorage.setItem(this.storageKey, JSON.stringify(resolved));
    const payload = {
      tabId: this.tabId,
      records: resolved,
      timestamp: Date.now()
    };
    localStorage.setItem(this.storageKey + '_meta', JSON.stringify(payload));
    this._lastExternalRecords = null;
    return resolved;
  }

  destroy() {
    this._cleanupHeartbeat();
    if (this._storageHandler) {
      window.removeEventListener('storage', this._storageHandler);
      this._storageHandler = null;
    }
    this._listenersBound = false;
  }
}
