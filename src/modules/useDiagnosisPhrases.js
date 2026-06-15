import { useEffect, useMemo, useRef, useState } from 'react';
import { TabSync, mergePhraseRecord } from '../tabSync';
import {
  PHRASE_LIBRARY_STORAGE,
  PHRASE_SAMPLE_TYPES,
  loadPhrases,
  persistPhrases,
  filterPhrases,
  calcPhraseStats,
  submitPhrase,
  recordPhraseUsage as recordPhraseUsagePure,
  togglePhrasePin as togglePhrasePinPure,
  removePhrase as removePhrasePure
} from './diagnosisPhrases';

export function useDiagnosisPhrases(tick, { onConflict } = {}) {
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

  const phraseSyncRef = useRef(null);

  useEffect(() => {
    const initialPhrases = loadPhrases();
    const phraseSync = new TabSync(PHRASE_LIBRARY_STORAGE, {
      mergeOptions: {
        mergeRecordFn: mergePhraseRecord,
        sortField: 'createdAt'
      },
      conflictOptions: {
        getDisplayLabel: (r) => (r.phrase || '').slice(0, 30) + '...'
      },
      onExternalUpdate: (externalRecords) => {
        setPhrases(externalRecords);
      },
      onConflict: (conflictData) => {
        if (onConflict) onConflict(conflictData);
      }
    });
    phraseSync.init(initialPhrases);
    phraseSyncRef.current = phraseSync;

    return () => {
      phraseSync.destroy();
    };
  }, []);

  function handlePhrasesPersist(next) {
    setPhrases(next);
    if (phraseSyncRef.current) {
      phraseSyncRef.current.persist(next);
    } else {
      persistPhrases(next);
    }
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
    const next = submitPhrase(phraseForm, phrases, editingPhrase);
    if (!next) return;
    handlePhrasesPersist(next);
    closePhraseModal();
  }

  function confirmDeletePhrase(id) {
    setPhraseDeleteConfirm(id);
  }

  function cancelDeletePhrase() {
    setPhraseDeleteConfirm(null);
  }

  function removePhrase(id) {
    const next = removePhrasePure(id, phrases);
    handlePhrasesPersist(next);
    setPhraseDeleteConfirm(null);
  }

  function recordPhraseUsage(id) {
    const next = recordPhraseUsagePure(id, phrases);
    handlePhrasesPersist(next);
  }

  function togglePhrasePin(id) {
    const next = togglePhrasePinPure(id, phrases);
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

  const filteredPhrases = useMemo(() => {
    return filterPhrases(phrases, phraseFilters);
  }, [phrases, phraseFilters]);

  const phraseStats = useMemo(() => {
    return calcPhraseStats(phrases);
  }, [phrases]);

  return {
    phrases,
    setPhrases,
    phraseFilters,
    setPhraseFilters,
    showPhraseModal,
    setShowPhraseModal,
    editingPhrase,
    setEditingPhrase,
    phraseForm,
    setPhraseForm,
    phraseDeleteConfirm,
    setPhraseDeleteConfirm,
    phrasePickerTarget,
    setPhrasePickerTarget,
    showPhrasePicker,
    setShowPhrasePicker,
    filteredPhrases,
    phraseStats,
    phraseSyncRef,
    handlePhrasesPersist,
    openPhraseModal,
    closePhraseModal,
    handlePhraseSubmit,
    confirmDeletePhrase,
    cancelDeletePhrase,
    removePhrase,
    recordPhraseUsage,
    togglePhrasePin,
    openPhrasePicker,
    closePhrasePicker
  };
}
