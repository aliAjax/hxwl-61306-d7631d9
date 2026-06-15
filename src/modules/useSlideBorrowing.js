import { useEffect, useMemo, useRef, useState } from 'react';
import { TabSync, mergeBorrowRecord } from '../tabSync';
import {
  SLIDE_BORROW_STORAGE,
  SLIDE_BORROW_STATUS,
  DEFAULT_DEPARTMENTS,
  loadSlideBorrows,
  filterSlideBorrows,
  calcBorrowStats,
  calcDepartmentList,
  submitBorrow,
  returnSlide,
  receiveSlide,
  removeBorrowRecord as removeBorrowRecordPure,
  getFullBorrowTimeline
} from './slideBorrowing';

export function useSlideBorrowing(tick, { onConflict } = {}) {
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

  const borrowSyncRef = useRef(null);

  useEffect(() => {
    const initialBorrows = loadSlideBorrows();
    const borrowSync = new TabSync(SLIDE_BORROW_STORAGE, {
      mergeOptions: {
        mergeRecordFn: mergeBorrowRecord,
        sortField: 'borrowTime'
      },
      conflictOptions: {
        getDisplayLabel: (r) => r.caseNo || r.id
      },
      onExternalUpdate: (externalRecords) => {
        setSlideBorrows(externalRecords);
        setSelectedBorrowForDetail((prevSelected) => {
          if (!prevSelected) return null;
          const updatedSelected = externalRecords.find((r) => r.id === prevSelected.id);
          return updatedSelected || null;
        });
      },
      onConflict: (conflictData) => {
        if (onConflict) onConflict(conflictData);
      }
    });
    borrowSync.init(initialBorrows);
    borrowSyncRef.current = borrowSync;

    return () => {
      borrowSync.destroy();
    };
  }, []);

  function persistBorrows(next) {
    setSlideBorrows(next);
    if (borrowSyncRef.current) {
      borrowSyncRef.current.persist(next);
    } else {
      localStorage.setItem(SLIDE_BORROW_STORAGE, JSON.stringify(next));
    }
  }

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
    const next = submitBorrow(borrowForm, slideBorrows, editingBorrow);
    if (!next) return;
    persistBorrows(next);
    closeBorrowModal();
  }

  function handleReturnSlide(item) {
    const next = returnSlide(item, slideBorrows);
    persistBorrows(next);
  }

  function handleReceiveSlide(item) {
    const next = receiveSlide(item, slideBorrows);
    persistBorrows(next);
  }

  function removeBorrowRecord(id) {
    const next = removeBorrowRecordPure(id, slideBorrows);
    persistBorrows(next);
  }

  const filteredSlideBorrows = useMemo(() => {
    void tick;
    return filterSlideBorrows(slideBorrows, slideBorrowFilters);
  }, [slideBorrows, slideBorrowFilters, tick]);

  const borrowStats = useMemo(() => {
    void tick;
    return calcBorrowStats(slideBorrows);
  }, [slideBorrows, tick]);

  const departmentList = useMemo(() => {
    return calcDepartmentList(slideBorrows);
  }, [slideBorrows]);

  const getCaseBorrowRecords = useMemo(() => {
    return (caseNo) => {
      return slideBorrows.filter((b) => b.caseNo === caseNo);
    };
  }, [slideBorrows]);

  return {
    slideBorrows,
    setSlideBorrows,
    slideBorrowFilters,
    setSlideBorrowFilters,
    showBorrowModal,
    setShowBorrowModal,
    editingBorrow,
    setEditingBorrow,
    borrowForm,
    setBorrowForm,
    selectedBorrowForDetail,
    setSelectedBorrowForDetail,
    filteredSlideBorrows,
    borrowStats,
    departmentList,
    getCaseBorrowRecords,
    openBorrowModal,
    closeBorrowModal,
    handleBorrowSubmit,
    handleReturnSlide,
    handleReceiveSlide,
    removeBorrowRecord,
    borrowSyncRef,
    persistBorrows,
    getFullBorrowTimeline
  };
}
