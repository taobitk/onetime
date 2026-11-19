import { ref, computed } from './vue_exports.js';
import { hiraToKata, stripBrackets } from './text_utils.js';
import { createSpeakerState, getSpeakerIcon } from './speaker_store.js';

export const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://localhost:8000';

export function cardExamples(card) {
  if (!card) return [];
  if (Array.isArray(card.examples) && card.examples.length) return card.examples;
  if (card.example && card.example.japanese) return [card.example];
  return [];
}

export function createAudioTts({ allCards, activeList, currentIndex, currentLesson, speechRate, sanitizeLessonName }) {
  const customTtsText = ref('');
  const showTtsBar = ref(false);
  const edgeStatus = ref('synced');
  const edgeSyncMsg = ref('VOICEVOX GPU Streaming (RAM Cache)');
  const edgeUpdatedCount = ref(0);
  let activeAudio = null;

  function updateAudioPaths() {
    const speakerId = spk.selectedSpeakerId.value || 3;
    allCards.value.forEach((card) => {
      const cleanWord = stripBrackets(card.reading || card.term || '').replace(/<[^>]*>/g, '').trim();
      card.audioWord = `${API_BASE}/api/voicevox?text=${encodeURIComponent(cleanWord)}&speaker=${speakerId}&is_word=1`;
      card.audioExamples = cardExamples(card).map((ex) => {
        const exText = (ex?.japanese || '').replace(/<[^>]*>/g, '').trim();
        return `${API_BASE}/api/voicevox?text=${encodeURIComponent(exText)}&speaker=${speakerId}&is_word=0`;
      });
      card.audioExample = card.audioExamples[0] || '';
    });
  }

  const spk = createSpeakerState({
    API_BASE, speechRate, updateAudioPaths,
    getActiveAudio: () => activeAudio,
    setActiveAudio: (a) => { activeAudio = a; },
  });

  const edgeIcon = computed(() => (spk.selectedVoice.value === 'voicevox' ? getSpeakerIcon(spk.selectedSpeakerName.value) : (spk.selectedVoice.value === 'webspeech' ? '🌐' : '⚡')));
  const edgeStatusText = computed(() => {
    if (spk.selectedVoice.value === 'voicevox') return `${spk.selectedSpeakerName.value} (${spk.selectedSpeakerStyle.value}) - GPU Stream trực tiếp (RTX 3060)`;
    if (spk.selectedVoice.value === 'edge') return 'Edge-TTS (Stream trực tiếp)';
    return spk.selectedVoice.value === 'webspeech' ? 'Web Speech (Trình duyệt)' : 'GPU Stream trực tiếp';
  });
  const edgeBadgeClass = computed(() => {
    if (edgeStatus.value === 'syncing') return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
    if (spk.selectedVoice.value === 'voicevox') {
      if (spk.selectedSpeakerName.value.includes('ずんだもん')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (spk.selectedSpeakerName.value.includes('めたん')) return 'bg-pink-50 text-pink-700 border-pink-200';
      if (spk.selectedSpeakerName.value.includes('つむぎ')) return 'bg-amber-50 text-amber-700 border-amber-200';
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return spk.selectedVoice.value === 'edge' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200';
  });

  function fallbackWebSpeech(text, isSentence = false) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) { resolve(); return; }
      window.speechSynthesis.cancel();
      let cleanText = (isSentence ? text : stripBrackets(text)).replace(/<[^>]*>/g, '').trim();
      if (!isSentence && !/[。、！？!?]/.test(cleanText) && /^[\u3040-\u309F\s・~ー]+$/.test(cleanText)) {
        cleanText = hiraToKata(cleanText);
      }
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = 'ja-JP';
      utter.rate = speechRate.value;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }

  function playAudioSequence(urlList, text, isSentence) {
    return new Promise((resolve) => {
      if (!urlList || !urlList.length) { fallbackWebSpeech(text, isSentence).then(resolve); return; }
      if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; }
      let idx = 0, settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      function tryNext() {
        if (idx >= urlList.length) { fallbackWebSpeech(text, isSentence).then(done); return; }
        const audio = new Audio(urlList[idx++]);
        audio.playbackRate = speechRate.value;
        activeAudio = audio;
        audio.onended = done;
        audio.onerror = () => tryNext();
        const p = audio.play();
        if (p !== undefined) p.catch(() => tryNext());
      }
      tryNext();
    });
  }

  function prefetchNextCard() {
    const nextIdx = currentIndex.value + 1;
    if (!activeList.value || nextIdx >= activeList.value.length || spk.selectedVoice.value !== 'voicevox') return;
    const nextCardObj = activeList.value[nextIdx];
    const word = nextCardObj ? stripBrackets(nextCardObj.reading || nextCardObj.term || '').replace(/<[^>]*>/g, '').trim() : '';
    if (word) fetch(`${API_BASE}/api/voicevox?text=${encodeURIComponent(word)}&speaker=${spk.selectedSpeakerId.value || 3}&is_word=1`, { cache: 'force-cache' }).catch(() => {});
  }

  async function speak(text, isSentence = false) {
    if (!text) return;
    if (spk.selectedVoice.value === 'webspeech') { await fallbackWebSpeech(text, isSentence); return; }
    const cleanText = isSentence ? text.replace(/<[^>]*>/g, '').trim() : stripBrackets(text).replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return;
    const url = spk.selectedVoice.value === 'voicevox'
      ? `${API_BASE}/api/voicevox?text=${encodeURIComponent(cleanText)}&speaker=${spk.selectedSpeakerId.value || 3}&is_word=${isSentence ? 0 : 1}`
      : `${API_BASE}/api/edge?text=${encodeURIComponent(cleanText)}`;
    prefetchNextCard();
    await playAudioSequence([url], cleanText, isSentence);
  }

  async function verifySessionCache(_lesson, cards) {
    if (!cards || !cards.length) return null;
    edgeStatus.value = 'synced';
    edgeSyncMsg.value = 'VOICEVOX GPU Streaming (RAM Cache)';
    return null;
  }

  return {
    ...spk, customTtsText, showTtsBar, toggleTtsBar: () => { showTtsBar.value = !showTtsBar.value; },
    edgeStatus, edgeSyncMsg, edgeUpdatedCount, edgeIcon, edgeStatusText, edgeBadgeClass,
    speakCustomText: () => { const t = (customTtsText.value || '').trim(); if (t) speak(t, true); },
    updateAudioPaths, attachAudioPaths: (lesson) => { currentLesson.value = sanitizeLessonName(lesson); updateAudioPaths(); },
    speak, speakExample: (text) => speak(text, true), prefetchNextCard,
    verifySessionCache, syncEdgeAudio: verifySessionCache,
    retrySyncAudio: () => verifySessionCache(currentLesson.value, allCards.value),
  };
}
