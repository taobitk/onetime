import { ref, computed } from './vue_exports.js';

export function getSpeakerIcon(name) {
  if (!name) return '✨';
  if (name.includes('ずんだもん')) return '💚';
  if (name.includes('めたん')) return '🌸';
  if (name.includes('つむぎ')) return '🎀';
  if (name.includes('きりたん')) return '🎧';
  if (name.includes('リツ')) return '👑';
  if (name.includes('龍星') || name.includes('武宏') || name.includes('虎太郎') || name.includes('宗麟')) return '🎙️';
  if (name.includes('うさぎ') || name.includes('あんこもん')) return '🐰';
  if (name.includes('ミコ') || name.includes('ナナ') || name.includes('はう')) return '🍭';
  return '✨';
}

export function getSpeakerCategory(name) {
  const maleNames = ['青山龍星', '玄野武宏', '白上虎太郎', '剣崎雌雄', '後鬼', 'ちび式じい', '雀松朱司', '麒ヶ島宗麟', '栗田まろん', '黒沢冴白'];
  const mascotNames = ['ずんだもん', '中国うさぎ', 'あんこもん', 'もち子さん'];
  if (maleNames.includes(name)) return 'male';
  if (mascotNames.includes(name)) return 'mascot';
  return 'female';
}

export function createSpeakerState({ API_BASE, speechRate, updateAudioPaths, getActiveAudio, setActiveAudio }) {
  const storedVoice = localStorage.getItem('preferred_voice') || 'voicevox';
  const selectedVoice = ref((storedVoice === 'zundamon' || storedVoice === 'shikoku_metan_normal') ? 'voicevox' : storedVoice);

  let initId = 3, initName = 'ずんだもん', initStyle = 'ノーマル';
  if (storedVoice === 'shikoku_metan_normal') {
    initId = 2; initName = '四国めたん'; initStyle = 'ノーマル';
  } else {
    if (localStorage.getItem('preferred_speaker_id')) initId = parseInt(localStorage.getItem('preferred_speaker_id'));
    if (localStorage.getItem('preferred_speaker_name')) initName = localStorage.getItem('preferred_speaker_name');
    if (localStorage.getItem('preferred_speaker_style')) initStyle = localStorage.getItem('preferred_speaker_style');
  }

  const selectedSpeakerId = ref(initId);
  const selectedSpeakerName = ref(initName);
  const selectedSpeakerStyle = ref(initStyle);
  const allSpeakers = ref([]);
  const speakerSearch = ref('');
  const speakerCategory = ref('all');
  const showSpeakerModal = ref(false);
  const isPreviewLoading = ref(false);

  const filteredSpeakers = computed(() => {
    let list = allSpeakers.value;
    if (speakerCategory.value !== 'all') list = list.filter(s => getSpeakerCategory(s.name) === speakerCategory.value);
    const q = speakerSearch.value.trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => s.name.toLowerCase().includes(q) || (s.styles || []).some(st => (st.name || '').toLowerCase().includes(q)));
  });

  async function fetchSpeakers() {
    try {
      const res = await fetch(`${API_BASE}/api/speakers`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) allSpeakers.value = list;
      }
    } catch (e) { console.warn('Không thể tải danh sách speakers:', e); }
  }

  function previewVoicevoxSpeaker(speakerId, customText = null) {
    const text = customText || `こんにちは！${selectedSpeakerName.value}です。`;
    const url = `${API_BASE}/api/voicevox?text=${encodeURIComponent(text)}&speaker=${speakerId}&is_word=0`;
    const prev = getActiveAudio();
    if (prev) { prev.pause(); prev.currentTime = 0; }
    const audio = new Audio(url);
    audio.playbackRate = speechRate.value;
    setActiveAudio(audio);
    isPreviewLoading.value = true;
    audio.onended = () => { isPreviewLoading.value = false; };
    audio.onerror = () => { isPreviewLoading.value = false; };
    audio.play().then(() => { isPreviewLoading.value = false; }).catch(() => { isPreviewLoading.value = false; });
  }

  function selectVoicevoxSpeaker(speaker, style) {
    selectedSpeakerId.value = style.id;
    selectedSpeakerName.value = speaker.name;
    selectedSpeakerStyle.value = style.name;
    selectedVoice.value = 'voicevox';
    localStorage.setItem('preferred_voice', 'voicevox');
    localStorage.setItem('preferred_speaker_id', String(style.id));
    localStorage.setItem('preferred_speaker_name', speaker.name);
    localStorage.setItem('preferred_speaker_style', style.name);
    updateAudioPaths();
    previewVoicevoxSpeaker(style.id, `こんにちは！${speaker.name}です。`);
  }

  function setVoice(voice, speakerId = null, speakerName = null, speakerStyle = null) {
    selectedVoice.value = voice;
    if (voice === 'voicevox' && speakerId !== null) {
      selectedSpeakerId.value = speakerId;
      selectedSpeakerName.value = speakerName || 'VOICEVOX';
      selectedSpeakerStyle.value = speakerStyle || 'ノーマル';
      localStorage.setItem('preferred_speaker_id', String(speakerId));
      localStorage.setItem('preferred_speaker_name', selectedSpeakerName.value);
      localStorage.setItem('preferred_speaker_style', selectedSpeakerStyle.value);
    }
    localStorage.setItem('preferred_voice', selectedVoice.value);
    updateAudioPaths();
  }

  return {
    selectedVoice, selectedSpeakerId, selectedSpeakerName, selectedSpeakerStyle,
    allSpeakers, speakerSearch, speakerCategory, showSpeakerModal, isPreviewLoading,
    filteredSpeakers, getSpeakerIcon, getSpeakerCategory,
    fetchSpeakers, selectVoicevoxSpeaker, previewVoicevoxSpeaker, setVoice,
  };
}
