import { normalizeVn } from './text_utils.js';
import { validateCardsData, normalizeCardsData } from './verbs_helper.js';

export function sanitizeLessonName(name) {
  if (!name) return 'bai_4';
  const clean = normalizeVn(name)
    .replace(/^bai(\d+)/i, 'bai_$1')
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
  return clean || 'bai_4';
}

export function createLessonLoader({
  allCards, currentLesson, currentIndex, studyMode, loadError,
  sessionStore, tts, resetCardState,
}) {
  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const urlLessonParam = params.get('lesson') || params.get('file');
    const cached = sessionStore.loadActiveSession();

    if (!urlLessonParam && cached && cached.lesson && cached.isUploaded && Array.isArray(cached.cards) && cached.cards.length > 0) {
      sessionStore.setRestoring(true);
      currentLesson.value = cached.lesson;
      sessionStore.loadMasteredState();
      sessionStore.loadDisabledState();
      allCards.value = normalizeCardsData(cached.cards);
      loadError.value = false;
      tts.attachAudioPaths(cached.lesson.split('+')[0], allCards.value);
      tts.edgeStatus.value = 'synced';
      tts.edgeSyncMsg.value = `VOICEVOX GPU Streaming (${cached.lesson})`;
      sessionStore.applyRestoredViewState(cached, cached.lesson);
      return;
    }

    let rawLesson = urlLessonParam || (cached && cached.lesson) || 'bai_4';
    rawLesson = rawLesson.replace(/\.json$/i, '');
    const lessonName = sanitizeLessonName(rawLesson);
    const fileToLoad = `${lessonName}.json`;

    try {
      const res = await fetch(`/data/vocab/${encodeURIComponent(fileToLoad)}?t=` + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Fetch failed HTTP ' + res.status);
      const data = await res.json();
      currentLesson.value = lessonName;
      sessionStore.loadMasteredState();
      sessionStore.loadDisabledState();
      allCards.value = normalizeCardsData(data);
      if (lessonName.includes('dong_tu_3_the') || allCards.value.some(c => c.forms)) {
        studyMode.value = 'verbs3';
      }
      loadError.value = false;
      tts.attachAudioPaths(lessonName, allCards.value);
      sessionStore.applyRestoredViewState(cached, lessonName);
      sessionStore.saveActiveSession(false);
      tts.verifySessionCache(lessonName, allCards.value);
    } catch (e) {
      console.warn(`Could not auto-fetch ${fileToLoad}:`, e);
      if (fileToLoad !== 'bai_4.json') {
        try {
          const resB4 = await fetch('/data/vocab/bai_4.json?t=' + Date.now(), { cache: 'no-store' });
          if (resB4.ok) {
            const dataB4 = await resB4.json();
            currentLesson.value = 'bai_4';
            sessionStore.loadMasteredState();
            sessionStore.loadDisabledState();
            allCards.value = normalizeCardsData(dataB4);
            loadError.value = false;
            tts.attachAudioPaths('bai_4', allCards.value);
            tts.verifySessionCache('bai_4', allCards.value);
            return;
          }
        } catch (_) {}
      }
      loadError.value = true;
      tts.edgeStatus.value = 'fallback';
      tts.edgeSyncMsg.value = 'Chưa chọn file bài học';
    }
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (!/^[a-z0-9_]+\.json$/i.test(file.name)) {
        alert(`❌ Tên file không đúng chuẩn quy ước: "${file.name}"\n\nVui lòng dùng chữ thường, không dấu, nối bằng dấu _ (VD: bai_4.json).`);
        event.target.value = '';
        return;
      }
    }

    try {
      const loadedCards = [];
      const lessonNames = [];
      for (const file of files) {
        let rawJson;
        try {
          rawJson = JSON.parse(await file.text());
        } catch (e) {
          alert(`❌ Lỗi định dạng JSON trong file "${file.name}":\n${e.message}`);
          event.target.value = '';
          return;
        }
        const valResult = validateCardsData(rawJson, file.name);
        if (!valResult.valid) {
          alert(`❌ FILE BỊ TỪ CHỐI DO SAI CẤU TRÚC JSON:\n\n${valResult.error}`);
          event.target.value = '';
          return;
        }
        const lessonName = sanitizeLessonName(file.name.replace(/\.json$/i, ''));
        lessonNames.push(lessonName);
        loadedCards.push(...normalizeCardsData(rawJson).map(c => ({ ...c, lessonSource: lessonName })));
      }

      allCards.value = loadedCards;
      if (lessonNames.some(l => l.includes('dong_tu_3_the')) || loadedCards.some(c => c.forms)) {
        studyMode.value = 'verbs3';
      }
      currentLesson.value = lessonNames.length === 1 ? lessonNames[0] : lessonNames.join('+');
      sessionStore.loadMasteredState();
      sessionStore.loadDisabledState();
      loadError.value = false;
      currentIndex.value = 0;
      resetCardState();
      tts.attachAudioPaths(lessonNames[0], loadedCards);
      sessionStore.saveActiveSession(true);
      tts.edgeStatus.value = 'synced';
      tts.edgeSyncMsg.value = `VOICEVOX GPU: Đã nạp ${loadedCards.length} từ (${lessonNames.length} bài)`;
    } catch (err) {
      alert('Lỗi nạp file: ' + err.message);
    } finally {
      event.target.value = '';
    }
  }

  return { loadData, handleFileUpload };
}
