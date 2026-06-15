import { useEffect, useMemo, useRef, useState } from 'react';
import { TabSync, mergeNotifyRecord } from '../tabSync';
import {
  CRITICAL_NOTIFY_STORAGE,
  CRITICAL_NOTIFY_STATUS,
  CRITICAL_NOTIFY_STATUS_LIST,
  CRITICAL_NOTIFY_METHODS,
  CRITICAL_NOTIFY_REASONS,
  NOTIFY_TARGET_PRESETS,
  NOTIFY_DUPLICATE_WINDOW_MINUTES,
  NOTIFY_ESCALATE_WINDOW_MINUTES,
  NOTIFY_ESCALATE_TARGETS,
  loadCriticalNotifies,
  loadLatestCriticalNotifies,
  persistNotifies,
  hasDuplicateUnconfirmedNotify,
  canEscalateNotify,
  hasRecentEscalation,
  filterCriticalNotifies,
  calcNotifyStats,
  notifyStatusClass as notifyStatusClassFn,
  confirmNotifyRecord,
  createEscalateNotify,
  removeNotifyRecord as removeNotifyRecordPure
} from './criticalNotify';

export { notifyStatusClassFn as notifyStatusClass };

export function useCriticalNotify(tick, { onConflict } = {}) {
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

  const notifySyncRef = useRef(null);

  useEffect(() => {
    const initialNotifies = loadCriticalNotifies();
    const notifySync = new TabSync(CRITICAL_NOTIFY_STORAGE, {
      mergeOptions: {
        mergeRecordFn: mergeNotifyRecord,
        sortField: 'sentAt'
      },
      conflictOptions: {
        getDisplayLabel: (r) => `${r.caseNo} - ${r.notifyTarget}`
      },
      onExternalUpdate: (externalRecords) => {
        setCriticalNotifies(externalRecords);
        setSelectedNotifyForDetail((prevSelected) => {
          if (!prevSelected) return null;
          const updatedSelected = externalRecords.find((r) => r.id === prevSelected.id);
          return updatedSelected || null;
        });
      },
      onConflict: (conflictData) => {
        if (onConflict) onConflict(conflictData);
      }
    });
    notifySync.init(initialNotifies);
    notifySyncRef.current = notifySync;

    return () => {
      notifySync.destroy();
    };
  }, []);

  function persistCriticalNotifies(next) {
    setCriticalNotifies(next);
    if (notifySyncRef.current) {
      notifySyncRef.current.persist(next);
    } else {
      persistNotifies(next);
    }
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

  function removeNotifyRecord(id) {
    const next = removeNotifyRecordPure(id, criticalNotifies);
    persistCriticalNotifies(next);
    if (selectedNotifyForDetail?.id === id) {
      setSelectedNotifyForDetail(null);
    }
  }

  function getCaseNotifies(caseNo, caseId) {
    return criticalNotifies.filter((n) =>
      (caseId && n.caseId === caseId) || (caseNo && n.caseNo === caseNo)
    );
  }

  const filteredNotifies = useMemo(() => {
    void tick;
    return filterCriticalNotifies(criticalNotifies, notifyFilters);
  }, [criticalNotifies, notifyFilters, tick]);

  const notifyStats = useMemo(() => {
    void tick;
    return calcNotifyStats(criticalNotifies);
  }, [criticalNotifies, tick]);

  return {
    criticalNotifies,
    setCriticalNotifies,
    notifyFilters,
    setNotifyFilters,
    showNotifyModal,
    setShowNotifyModal,
    notifyForm,
    setNotifyForm,
    selectedNotifyForDetail,
    setSelectedNotifyForDetail,
    notifyDuplicateWarning,
    setNotifyDuplicateWarning,
    showEscalateModal,
    setShowEscalateModal,
    escalateSourceNotify,
    setEscalateSourceNotify,
    escalateForm,
    setEscalateForm,
    escalateWarning,
    setEscalateWarning,
    filteredNotifies,
    notifyStats,
    notifySyncRef,
    persistCriticalNotifies,
    openNotifyModal,
    closeNotifyModal,
    checkNotifyDuplicate,
    openEscalateModal,
    closeEscalateModal,
    checkEscalateDuplicate,
    getCaseNotifies,
    confirmNotifyRecord,
    createEscalateNotify,
    removeNotifyRecord
  };
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
