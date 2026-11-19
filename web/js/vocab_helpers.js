import { computed, nextTick } from './vue_exports.js';
import { normalizeVn, normalizeJp } from './text_utils.js';

export function createVocabHelpers({
  allCards, masteredTerms, disabledTerms, scopeFilter, selectedTypeFilter,
  vocabFilter, searchQuery, currentIndex, activeList, showLookupModal,
  sessionStore, resetCardState,
}) {
  const isCardMastered = (term) => masteredTerms.value.includes(term);
  const isWordEnabled = (term) => Boolean(term) && !disabledTerms.value.includes(term);

  const typeFiltersList = computed(() => {
    const cards = allCards.value.filter(c => !disabledTerms.value.includes(c.term));
    const filters = [
      { key: 'all', label: 'Tất cả', count: cards.length },
      { key: 'Động từ', label: 'Động từ', count: cards.filter(c => c.type === 'Động từ').length },
      { key: 'Tính từ', label: 'Tính từ', count: cards.filter(c => (c.type || '').startsWith('Tính từ')).length },
      { key: 'Danh từ', label: 'Danh từ', count: cards.filter(c => c.type === 'Danh từ').length },
      { key: 'Phó từ', label: 'Phó từ', count: cards.filter(c => c.type === 'Phó từ').length },
      { key: 'Từ để hỏi', label: 'Từ để hỏi', count: cards.filter(c => c.type === 'Từ để hỏi').length },
    ];
    const countCumTu = cards.filter(c => c.type === 'Cụm từ').length;
    const countKhac = cards.filter(c => !['Động từ', 'Danh từ', 'Phó từ', 'Từ để hỏi', 'Cụm từ'].includes(c.type) && !(c.type || '').startsWith('Tính từ')).length;
    if (countCumTu > 0) filters.push({ key: 'Cụm từ', label: 'Cụm từ', count: countCumTu });
    if (countKhac > 0) filters.push({ key: 'Khác', label: 'Khác', count: countKhac });
    return filters;
  });

  const filteredLookupList = computed(() => {
    const enabled = allCards.value.filter(c => !disabledTerms.value.includes(c.term));
    const disabled = allCards.value.filter(c => disabledTerms.value.includes(c.term));
    const baseList = vocabFilter.value === 'enabled' ? enabled : (vocabFilter.value === 'disabled' ? disabled : allCards.value);
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return baseList;
    const qVn = normalizeVn(q), qJp = normalizeJp(q);
    return baseList.filter(c =>
      (c.id && String(c.id).includes(q)) || normalizeJp(c.term).includes(qJp) ||
      normalizeJp(c.reading).includes(qJp) || normalizeJp(c.romaji).includes(qJp) ||
      normalizeVn(c.meaning).includes(qVn) ||
      (c.example && (normalizeJp(c.example.japanese).includes(qJp) || normalizeVn(c.example.vietnamese).includes(qVn)))
    );
  });

  const isAllMastered = computed(() => filteredLookupList.value.length > 0 && filteredLookupList.value.every(c => isCardMastered(c.term)));

  function toggleCardMastery(term) {
    const i = masteredTerms.value.indexOf(term);
    i >= 0 ? masteredTerms.value.splice(i, 1) : masteredTerms.value.push(term);
    sessionStore.saveMasteredState();
  }

  function toggleWordEnabled(term) {
    if (!term) return;
    const i = disabledTerms.value.indexOf(term);
    i >= 0 ? disabledTerms.value.splice(i, 1) : disabledTerms.value.push(term);
    sessionStore.saveDisabledState();
    resetCardState();
  }

  function enableAllWords() { disabledTerms.value = []; sessionStore.saveDisabledState(); resetCardState(); }
  function disableAllWords() { disabledTerms.value = allCards.value.map(c => c.term).filter(Boolean); sessionStore.saveDisabledState(); resetCardState(); }

  function toggleAllMastery() {
    if (isAllMastered.value) {
      const cur = filteredLookupList.value.map(c => c.term);
      masteredTerms.value = masteredTerms.value.filter(t => !cur.includes(t));
    } else {
      filteredLookupList.value.forEach(c => { if (!masteredTerms.value.includes(c.term)) masteredTerms.value.push(c.term); });
    }
    sessionStore.saveMasteredState();
  }

  function onRowClick(item) {
    if (!isWordEnabled(item.term)) {
      const i = disabledTerms.value.indexOf(item.term);
      if (i >= 0) disabledTerms.value.splice(i, 1);
      sessionStore.saveDisabledState();
      return;
    }
    const idx = activeList.value.findIndex(c => c.term === item.term);
    if (idx >= 0) currentIndex.value = idx;
    else { scopeFilter.value = 'all'; nextTick(() => { const ni = activeList.value.findIndex(c => c.term === item.term); if (ni >= 0) currentIndex.value = ni; }); }
    showLookupModal.value = false;
    resetCardState();
  }

  return {
    isCardMastered, isWordEnabled, typeFiltersList, filteredLookupList, isAllMastered,
    toggleCardMastery, toggleWordEnabled, enableAllWords, disableAllWords, toggleAllMastery, onRowClick,
  };
}
