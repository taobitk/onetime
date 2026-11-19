import { inject } from '../vue_exports.js';

export const SpeakerModal = {
  setup() {
    return inject('app');
  },
  template: `
    <div v-if="showSpeakerModal" class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full h-[90vh] sm:h-[86vh] flex flex-col overflow-hidden">
        <div class="p-3.5 sm:p-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/20">🎙️</div>
            <div>
              <div class="font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>Kho Model &amp; Phong Cách VOICEVOX</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900 font-black tracking-wider uppercase">Direct GPU Stream</span>
              </div>
              <div class="text-xs text-purple-200/90 mt-0.5">40+ nhân vật &amp; 120+ biểu cảm • Phát on-the-fly qua NVIDIA GeForce RTX 3060 DirectML</div>
            </div>
          </div>
          <button @click="showSpeakerModal = false" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all text-sm cursor-pointer" title="Đóng (ESC)">✕</button>
        </div>

        <div class="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div class="relative flex-1 min-w-[200px]">
            <span class="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
            <input v-model="speakerSearch" type="text"
              placeholder="Tìm theo tên nhân vật hoặc phong cách (zunda, metan, kiritan, tsundere, thì thầm...)"
              class="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-slate-800 placeholder-slate-400">
            <button v-if="speakerSearch" @click="speakerSearch = ''" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>

          <div class="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button @click="speakerCategory = 'all'" :class="speakerCategory === 'all' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'" class="px-2.5 py-1 rounded-lg transition-all cursor-pointer">Tất cả ({{ allSpeakers.length }})</button>
            <button @click="speakerCategory = 'female'" :class="speakerCategory === 'female' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'" class="px-2.5 py-1 rounded-lg transition-all cursor-pointer">🌸 Nữ</button>
            <button @click="speakerCategory = 'male'" :class="speakerCategory === 'male' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'" class="px-2.5 py-1 rounded-lg transition-all cursor-pointer">🎙️ Nam</button>
            <button @click="speakerCategory = 'mascot'" :class="speakerCategory === 'mascot' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'" class="px-2.5 py-1 rounded-lg transition-all cursor-pointer">🐰 Linh vật</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 sm:p-5">
          <div v-if="filteredSpeakers.length === 0" class="p-12 text-center text-slate-400">
            <div class="text-3xl mb-2">🔍</div>
            <div class="font-bold text-slate-700 text-sm">Không tìm thấy model hoặc phong cách nào khớp</div>
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
            <div v-for="spk in filteredSpeakers" :key="spk.speaker_uuid || spk.name"
              class="bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 shadow-2xs hover:shadow-sm p-3.5 flex flex-col justify-between gap-3 transition-all">
              <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div class="flex items-center gap-2.5">
                  <span class="text-2xl">{{ getSpeakerIcon(spk.name) }}</span>
                  <div>
                    <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <span>{{ spk.name }}</span>
                      <span v-if="selectedVoice === 'voicevox' && selectedSpeakerName === spk.name" class="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">Đang chọn</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-medium">{{ (spk.styles || []).length }} phong cách biểu cảm</div>
                  </div>
                </div>
                <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                  :class="getSpeakerCategory(spk.name) === 'male' ? 'bg-blue-50 text-blue-700' : (getSpeakerCategory(spk.name) === 'mascot' ? 'bg-emerald-50 text-emerald-700' : 'bg-pink-50 text-pink-700')">
                  {{ getSpeakerCategory(spk.name) === 'male' ? 'Giọng Nam' : (getSpeakerCategory(spk.name) === 'mascot' ? 'Linh Vật' : 'Anime Nữ') }}
                </span>
              </div>
              <div class="flex flex-wrap gap-1.5 items-center">
                <button v-for="st in (spk.styles || [])" :key="st.id" @click="selectVoicevoxSpeaker(spk, st)"
                  :class="(selectedVoice === 'voicevox' && selectedSpeakerId === st.id) ? 'bg-purple-600 text-white font-bold shadow-xs ring-2 ring-purple-600/30' : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200/60'"
                  class="px-2.5 py-1 text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  :title="'Chọn phong cách ' + st.name + ' (id=' + st.id + ')'">
                  <span>{{ st.name }}</span><span class="text-[9px] opacity-60 font-mono">#{{ st.id }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 sm:p-4 bg-slate-50 border-t border-slate-200/70 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-slate-500">Giọng hiện tại:</span>
            <span class="font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <span>{{ getSpeakerIcon(selectedSpeakerName) }}</span>
              <span>{{ selectedSpeakerName }} - {{ selectedSpeakerStyle }} (ID: {{ selectedSpeakerId }})</span>
            </span>
          </div>
          <button @click="showSpeakerModal = false" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">Hoàn tất</button>
        </div>
      </div>
    </div>
  `,
};
