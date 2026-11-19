import { nextTick, watch } from './vue_exports.js';

const ACTIVE_SESSION_KEY = 'minna_active_session_v1';

export function createSessionStore({
  allCards, currentLesson, studyMode, currentIndex, scopeFilter, selectedTypeFilter,
  masteredTerms, disabledTerms, activeList,
}) {
  let isRestoringSession = false;

  function getStorageKey(suffix) {
    const safe = (currentLesson.value || 'bai_4').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `minna_${safe}_${suffix}`;
  }

  function loadMasteredState() {
    try {
      const key = getStorageKey('mastered');
      let raw = localStorage.getItem(key);
      if (!raw && (currentLesson.value === 'bai_4' || currentLesson.value === 'bai4')) {
        raw = localStorage.getItem('minna_b4_mastered') || localStorage.getItem('minna_bai4_mastered');
      }
      const parsed = raw ? JSON.parse(raw) : null;
      masteredTerms.value = Array.isArray(parsed)
        ? parsed.filter(t => t && t !== 'undefined' && t !== 'null')
        : [];
    } catch (e) {
      masteredTerms.value = [];
    }
  }

  function saveMasteredState() {
    try {
      localStorage.setItem(getStorageKey('mastered'), JSON.stringify(masteredTerms.value));
    } catch (e) {
      console.warn('Cannot save localStorage', e);
    }
  }

  function loadDisabledState() {
    try {
      const key = getStorageKey('disabled_terms');
      let raw = localStorage.getItem(key);
      if (!raw && (currentLesson.value === 'bai_4' || currentLesson.value === 'bai4')) {
        raw = localStorage.getItem('minna_b4_disabled_terms') || localStorage.getItem('minna_bai4_disabled_terms');
      }
      const parsed = raw ? JSON.parse(raw) : null;
      disabledTerms.value = Array.isArray(parsed)
        ? parsed.filter(t => t && t !== 'undefined' && t !== 'null')
        : [];
    } catch (e) {
      disabledTerms.value = [];
    }
  }

  function saveDisabledState() {
    try {
      localStorage.setItem(getStorageKey('disabled_terms'), JSON.stringify(disabledTerms.value));
    } catch (e) {
      console.warn('Cannot save localStorage disabled words', e);
    }
  }

  function loadActiveSession() {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveActiveSession(includeCards = false) {
    if (isRestoringSession) return;
    try {
      const prev = loadActiveSession();
      const payload = {
        lesson: currentLesson.value,
        studyMode: studyMode.value,
        currentIndex: currentIndex.value,
        scopeFilter: scopeFilter.value,
        selectedTypeFilter: selectedTypeFilter.value,
        updatedAt: Date.now(),
      };
      if (includeCards) {
        payload.isUploaded = true;
        payload.cards = allCards.value;
      } else if (prev && prev.lesson === currentLesson.value && prev.isUploaded && Array.isArray(prev.cards)) {
        payload.isUploaded = true;
        payload.cards = prev.cards;
      }
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not save active session to localStorage:', e);
    }
  }

  function applyRestoredViewState(cached, lessonName) {
    if (!cached || cached.lesson !== lessonName) return;
    isRestoringSession = true;
    try {
      if (cached.studyMode) studyMode.value = cached.studyMode;
      if (cached.scopeFilter) scopeFilter.value = cached.scopeFilter;
      if (cached.selectedTypeFilter) selectedTypeFilter.value = cached.selectedTypeFilter;
      nextTick(() => {
        const maxIdx = Math.max(0, activeList.value.length - 1);
        const idx = typeof cached.currentIndex === 'number' ? cached.currentIndex : 0;
        currentIndex.value = Math.min(Math.max(0, idx), maxIdx);
        isRestoringSession = false;
      });
    } catch (e) {
      isRestoringSession = false;
    }
  }

  function setRestoring(val) {
    isRestoringSession = val;
  }

  watch([studyMode, currentIndex, scopeFilter, selectedTypeFilter], () => {
    if (allCards.value.length > 0 && currentLesson.value) {
      saveActiveSession(false);
    }
  });

  return {
    loadMasteredState, saveMasteredState,
    loadDisabledState, saveDisabledState,
    loadActiveSession, saveActiveSession,
    applyRestoredViewState, setRestoring,
  };
}
