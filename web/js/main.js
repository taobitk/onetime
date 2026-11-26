import { createApp, ref, computed, onMounted, onUnmounted, nextTick, provide } from './vue_exports.js';
import { createAudioTts, cardExamples } from './audio_tts.js';
import { createSessionStore } from './session_store.js';
import { createLessonLoader, sanitizeLessonName } from './lesson_loader.js';
import { createVerbs3Engine } from './verbs3_engine.js';
import { gradeQaCard, gradeVocabCard, hasBypassInput } from './quiz_engine.js';
import { createVocabHelpers } from './vocab_helpers.js';
import { HeaderBar } from './components/HeaderBar.js';
import { ToolbarControls } from './components/ToolbarControls.js';
import { FlashcardStage } from './components/FlashcardStage.js';
import { VocabModal } from './components/VocabModal.js';
import { SpeakerModal } from './components/SpeakerModal.js';

createApp({
  components: { HeaderBar, ToolbarControls, FlashcardStage, VocabModal, SpeakerModal },
  setup() {
    const allCards = ref([]), currentIndex = ref(0), practiceMode = ref('jp-to-vn');
    const scopeFilter = ref('all'), showFurigana = ref(true);
    const showVietnamese = ref(localStorage.getItem('minna_show_vn') !== 'false');
    const isShuffle = ref(false), speechRate = ref(1.0), showLookupModal = ref(false);
    const vocabFilter = ref('enabled'), searchQuery = ref(''), loadError = ref(false);
    const currentLesson = ref('bai_4'), selectedTypeFilter = ref('all');
    const isBlindMode = ref(false), isBlindRevealed = ref(false);
    const isFocusMode = ref(false), isHeaderHidden = ref(false), isToolbarHidden = ref(false);
    const studyMode = ref(localStorage.getItem('minna_study_mode') || 'vocab');
    const inputMode = ref(localStorage.getItem('minna_input_mode') || 'single');
    const isAnswerRevealed = ref(false), inputQuestion = ref(''), inputAnswer = ref(''), inputMeaning = ref('');
    const isLastCheckPassed = ref(false), validationFeedback = ref(null);
    const questionInputRef = ref(null), answerInputRef = ref(null);
    const masteredTerms = ref([]), disabledTerms = ref([]);

    const currentLessonDisplay = computed(() => {
      const l = currentLesson.value || 'bai_4';
      return l.includes('+') ? l.split('+').map(p => p.replace(/_/g, ' ')).join(', ') : l.replace(/_/g, ' ');
    });
    const currentLessonBadge = computed(() => {
      const l = currentLesson.value || '';
      if (l.includes('+')) {
        const parts = l.split('+');
        return parts.length > 2 ? `${parts.length}B` : parts.map(p => (p.match(/\d+/) ? 'B' + p.match(/\d+/)[0] : p.slice(0, 2).toUpperCase())).join('+');
      }
      const m = l.match(/\d+/);
      return m ? `B${m[0]}` : (l ? l.slice(0, 2).toUpperCase() : 'N5');
    });
    const currentLessonTitle = computed(() => {
      const l = currentLesson.value || '';
      if (l.includes('+')) return `Đa bài học (${l.split('+').length} bài)`;
      const m = l.match(/\d+/);
      return m ? `Bài ${m[0]}` : currentLessonDisplay.value;
    });

    const enabledCards = computed(() => allCards.value.filter(c => !disabledTerms.value.includes(c.term)));
    const disabledCards = computed(() => allCards.value.filter(c => disabledTerms.value.includes(c.term)));

    const activeList = computed(() => {
      let list = [...enabledCards.value];
      if (scopeFilter.value === 'learned') list = list.filter(c => masteredTerms.value.includes(c.term));
      else if (scopeFilter.value === 'unlearned') list = list.filter(c => !masteredTerms.value.includes(c.term));
      if (selectedTypeFilter.value !== 'all') {
        if (selectedTypeFilter.value === 'Tính từ') list = list.filter(c => (c.type || '').startsWith('Tính từ'));
        else if (selectedTypeFilter.value === 'Khác') list = list.filter(c => !['Danh từ', 'Động từ', 'Phó từ', 'Từ để hỏi', 'Cụm từ'].includes(c.type) && !(c.type || '').startsWith('Tính từ'));
        else list = list.filter(c => c.type === selectedTypeFilter.value);
      }
      return list;
    });

    const currentCard = computed(() => {
      if (activeList.value.length === 0) return null;
      if (currentIndex.value >= activeList.value.length) currentIndex.value = 0;
      return activeList.value[currentIndex.value];
    });

    const stats = computed(() => {
      const total = enabledCards.value.length;
      const learned = enabledCards.value.filter(c => masteredTerms.value.includes(c.term)).length;
      return { total, learned, unlearned: total - learned, progressPercent: total > 0 ? Math.round((learned / total) * 100) : 0 };
    });

    const inputStatusClass = computed(() => {
      if (!validationFeedback.value) return 'border-slate-200 bg-white text-slate-800';
      return validationFeedback.value.passed ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800' : 'bg-rose-50 border-2 border-rose-500 text-rose-800 shake-effect';
    });

    const tts = createAudioTts({ allCards, activeList, currentIndex, currentLesson, speechRate, sanitizeLessonName });
    const sessionStore = createSessionStore({ allCards, currentLesson, studyMode, currentIndex, scopeFilter, selectedTypeFilter, masteredTerms, disabledTerms, activeList });
    const verbs3 = createVerbs3Engine({
      currentCard, isAnswerRevealed, isLastCheckPassed, validationFeedback,
      speak: tts.speak,
      onNextAfterPass: () => (currentIndex.value < activeList.value.length - 1 ? nextCard() : verbs3.play3FormsChain()),
    });

    function resetCardState() {
      isAnswerRevealed.value = false; isBlindRevealed.value = false;
      inputQuestion.value = ''; inputAnswer.value = ''; inputMeaning.value = '';
      verbs3.resetVerbs3State(); isLastCheckPassed.value = false; validationFeedback.value = null;
      tts.prefetchNextCard();
      if (isBlindMode.value && currentCard.value) speakQuestion();
      nextTick(() => {
        if (studyMode.value === 'verbs3') verbs3.masuInputRef.value?.focus();
        else if (studyMode.value === 'qa' && inputMode.value === 'single' && currentCard.value?.question) answerInputRef.value?.focus();
        else questionInputRef.value?.focus();
      });
    }

    const vocabHelpers = createVocabHelpers({
      allCards, masteredTerms, disabledTerms, scopeFilter, selectedTypeFilter,
      vocabFilter, searchQuery, currentIndex, activeList, showLookupModal, sessionStore, resetCardState,
    });
    const loader = createLessonLoader({ allCards, currentLesson, currentIndex, studyMode, loadError, sessionStore, tts, resetCardState });

    const speakQuestion = () => currentCard.value && (currentCard.value.question ? tts.speak(currentCard.value.question.reading || currentCard.value.question.short || currentCard.value.question.polite, true) : tts.speak(currentCard.value.reading || currentCard.value.term));
    const speakAnswer = () => currentCard.value && (currentCard.value.answer ? tts.speak(currentCard.value.answer.reading || currentCard.value.answer.short, true) : tts.speak(currentCard.value.reading || currentCard.value.term));
    const nextCard = () => { if (currentIndex.value < activeList.value.length - 1) { currentIndex.value++; resetCardState(); } };
    const prevCard = () => { if (currentIndex.value > 0) { currentIndex.value--; resetCardState(); } };

    function handleCheckOrNext() {
      const card = currentCard.value;
      if (!card) return;
      if (studyMode.value === 'verbs3') {
        if (isAnswerRevealed.value && isLastCheckPassed.value) return (currentIndex.value < activeList.value.length - 1 ? nextCard() : verbs3.play3FormsChain());
        if (hasBypassInput(verbs3.inputMasu.value, verbs3.inputVru.value, verbs3.inputVte.value)) return verbs3.bypass3Forms();
        return verbs3.check3FormsAnswers();
      }
      if (isAnswerRevealed.value && isLastCheckPassed.value) {
        return currentIndex.value < activeList.value.length - 1 ? nextCard() : (studyMode.value === 'qa' && card.answer ? speakAnswer() : tts.speak(card.reading || card.term));
      }
      const meaningDesc = (card.meanings && card.meanings.length > 1) ? card.meanings.map((m, i) => `${i + 1}. ${m}`).join(' | ') : card.meaning;
      if (hasBypassInput(inputQuestion.value, inputAnswer.value, inputMeaning.value)) {
        isAnswerRevealed.value = true; isLastCheckPassed.value = true;
        studyMode.value === 'qa' && card.answer ? speakAnswer() : tts.speak(card.reading || card.term);
        validationFeedback.value = { passed: true, title: 'ĐÃ BỎ QUA THẺ (LỆNH TẮT ~~)', desc: `Từ: <b>${card.term}</b> (${card.reading}). Nghĩa: <b>${meaningDesc}</b>.` };
        return;
      }
      isAnswerRevealed.value = true;
      studyMode.value === 'qa' && card.answer ? speakAnswer() : tts.speak(card.reading || card.term);
      const fb = (practiceMode.value === 'jp-to-vn' && studyMode.value === 'qa' && card.question && card.answer)
        ? gradeQaCard(card, inputQuestion.value.trim(), inputAnswer.value.trim(), inputMode.value, questionInputRef, answerInputRef)
        : gradeVocabCard(card, inputQuestion.value.trim(), practiceMode.value, meaningDesc, questionInputRef);
      isLastCheckPassed.value = fb.passed;
      validationFeedback.value = fb;
    }

    function setInputRef(name, el) {
      if (name === 'masu') verbs3.masuInputRef.value = el;
      else if (name === 'vru') verbs3.vruInputRef.value = el;
      else if (name === 'vte') verbs3.vteInputRef.value = el;
      else if (name === 'question') questionInputRef.value = el;
      else if (name === 'answer') answerInputRef.value = el;
    }

    function handleKeydown(e) {
      if (tts.showSpeakerModal.value) { if (e.key === 'Escape') tts.showSpeakerModal.value = false; return; }
      if (showLookupModal.value) { if (e.key === 'Escape') showLookupModal.value = false; return; }
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (studyMode.value === 'verbs3') {
        if (e.key === '1') { e.preventDefault(); verbs3.speakForm('masu'); return; }
        if (e.key === '2') { e.preventDefault(); verbs3.speakForm('vru'); return; }
        if (e.key === '3') { e.preventDefault(); verbs3.speakForm('vte'); return; }
        if (e.key === '4' || e.key.toLowerCase() === 'p') { e.preventDefault(); verbs3.play3FormsChain(); return; }
      }
      if (e.code === 'KeyA' || e.key === 'ArrowLeft') { e.preventDefault(); prevCard(); }
      else if (e.code === 'KeyD' || e.key === 'ArrowRight') { e.preventDefault(); nextCard(); }
      else if (e.code === 'Space') { e.preventDefault(); handleCheckOrNext(); }
      else if (e.key === '1' && currentCard.value) { e.preventDefault(); const i = masteredTerms.value.indexOf(currentCard.value.term); if (i >= 0) { masteredTerms.value.splice(i, 1); sessionStore.saveMasteredState(); } }
      else if (e.key === '2' && currentCard.value) { e.preventDefault(); if (!vocabHelpers.isCardMastered(currentCard.value.term)) { masteredTerms.value.push(currentCard.value.term); sessionStore.saveMasteredState(); } }
    }

    let pingTimer = null;
    onMounted(() => { sessionStore.loadMasteredState(); sessionStore.loadDisabledState(); loader.loadData(); tts.fetchSpeakers(); window.addEventListener('keydown', handleKeydown); pingTimer = setInterval(() => fetch('/api/ping').catch(() => {}), 30000); });
    onUnmounted(() => { window.removeEventListener('keydown', handleKeydown); if (pingTimer) clearInterval(pingTimer); });

    const ctx = {
      allCards, currentIndex, practiceMode, scopeFilter, showFurigana, showVietnamese, isShuffle,
      speechRate, showLookupModal, vocabFilter, searchQuery, loadError, currentLesson,
      selectedTypeFilter, isBlindMode, isBlindRevealed, isFocusMode, isHeaderHidden, isToolbarHidden,
      studyMode, inputMode, isAnswerRevealed, inputQuestion, inputAnswer, inputMeaning,
      isLastCheckPassed, validationFeedback, questionInputRef, answerInputRef, masteredTerms, disabledTerms,
      currentLessonDisplay, currentLessonBadge, currentLessonTitle, enabledCards, disabledCards,
      activeList, currentCard, stats, inputQuestionStatusClass: inputStatusClass, inputAnswerStatusClass: inputStatusClass, inputStatusClass,
      cardExamples, setInputRef, speakQuestion, speakAnswer, nextCard, prevCard, handleCheckOrNext,
      toggleVietnamese: () => { showVietnamese.value = !showVietnamese.value; localStorage.setItem('minna_show_vn', showVietnamese.value); },
      toggleFocusMode: () => { isFocusMode.value = !isFocusMode.value; },
      toggleHeader: () => { isHeaderHidden.value = !isHeaderHidden.value; },
      toggleToolbar: () => { isToolbarHidden.value = !isToolbarHidden.value; },
      toggleFurigana: () => { showFurigana.value = !showFurigana.value; },
      toggleBlindMode: () => { isBlindMode.value = !isBlindMode.value; if (isBlindMode.value && currentCard.value) tts.speak(currentCard.value.reading || currentCard.value.term); },
      toggleInputMode: () => { inputMode.value = inputMode.value === 'single' ? 'dual' : 'single'; localStorage.setItem('minna_input_mode', inputMode.value); resetCardState(); },
      setStudyMode: (m) => { studyMode.value = m; localStorage.setItem('minna_study_mode', m); resetCardState(); },
      setScope: (s) => { scopeFilter.value = s; currentIndex.value = 0; resetCardState(); },
      setTypeFilter: (t) => { selectedTypeFilter.value = t; currentIndex.value = 0; resetCardState(); },
      setMode: (m) => { practiceMode.value = m; resetCardState(); },
      toggleShuffle: () => { isShuffle.value = !isShuffle.value; allCards.value.sort(isShuffle.value ? () => Math.random() - 0.5 : (a, b) => (a.id || 0) - (b.id || 0)); currentIndex.value = 0; resetCardState(); },
      cycleSpeechRate: () => { const r = [0.8, 1.0, 1.2]; speechRate.value = r[(r.indexOf(speechRate.value) + 1) % r.length]; },
      getPromptRubyHtml: (card) => (!card ? '' : ((!showFurigana.value && !isAnswerRevealed.value) || !card.reading || card.reading === card.term ? card.term : `<ruby>${card.term}<rt>${card.reading}</rt></ruby>`)),
      getVocabFontSizeClass: (card) => { const m = Math.max((card?.term || '').length, (card?.reading || '').length); return m <= 4 ? 'text-3xl sm:text-5xl' : (m <= 7 ? 'text-2xl sm:text-4xl' : (m <= 11 ? 'text-xl sm:text-3xl' : (m <= 16 ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'))); },
      ...vocabHelpers, ...tts, ...loader, ...verbs3,
    };

    provide('app', ctx);
    return ctx;
  },
}).mount('#app');
