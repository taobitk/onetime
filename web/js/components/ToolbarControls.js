import { inject } from '../vue_exports.js';

export const ToolbarControls = {
  setup() {
    return inject('app');
  },
  template: `
    <div>
      <div v-if="allCards.length > 0 && isToolbarHidden && !isFocusMode" class="flex justify-center -my-1">
        <button @click="toggleToolbar"
          class="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full shadow-2xs text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition-all">
          <span>⚙️ Hiện thanh công cụ</span><span>▼</span>
        </button>
      </div>

      <div v-show="allCards.length > 0 && !isFocusMode && !isToolbarHidden"
        class="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs flex flex-col gap-2 transition-all">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <div class="flex items-center gap-0.5 sm:gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button @click="setScope('all')"
                :class="scopeFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                class="px-2 sm:px-2.5 py-1 rounded-lg transition-all">Tất cả ({{ enabledCards.length }})</button>
              <button @click="setScope('unlearned')"
                :class="scopeFilter === 'unlearned' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-600'"
                class="px-2 sm:px-2.5 py-1 rounded-lg transition-all">Cần ôn ({{ stats.unlearned }})</button>
              <button @click="setScope('learned')"
                :class="scopeFilter === 'learned' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-600'"
                class="px-2 sm:px-2.5 py-1 rounded-lg transition-all">Đã nhớ ({{ stats.learned }})</button>
            </div>

            <div class="relative inline-flex items-center">
              <select v-model="selectedTypeFilter" @change="setTypeFilter(selectedTypeFilter)"
                class="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-2.5 sm:px-3 py-1.5 pr-7 rounded-xl border border-slate-200/80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs">
                <option v-for="t in typeFiltersList" :key="t.key" :value="t.key">🏷️ {{ t.label }} ({{ t.count }})</option>
              </select>
              <span class="pointer-events-none absolute right-2 text-[10px] text-slate-400">▼</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 sm:gap-2">
            <button @click="showLookupModal = true"
              class="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer">
              <span>📖</span><span>Kho từ</span>
              <span class="bg-slate-700 text-[10px] px-1.5 py-0.2 rounded-full">{{ enabledCards.length }}</span>
            </button>
            <label class="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <span>📂</span><span class="hidden sm:inline">Nạp bài</span>
              <input type="file" multiple accept=".json" class="hidden" @change="handleFileUpload">
            </label>
            <a href="/pages/luyen_the_te.html"
              class="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <span>⚡</span><span class="hidden sm:inline">Luyện thể て</span>
            </a>
            <button @click="toggleToolbar"
              class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Thu gọn thanh công cụ">▲</button>
          </div>
        </div>

        <div class="h-px bg-slate-100 w-full"></div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <div class="flex items-center gap-0.5 sm:gap-1 bg-slate-100 p-1 rounded-xl">
              <button @click="setMode('jp-to-vn')"
                :class="practiceMode === 'jp-to-vn' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-500'"
                class="px-2 sm:px-2.5 py-1 text-xs rounded-lg transition-all">🇯🇵 → 🇻🇳</button>
              <button @click="setMode('vn-to-jp')"
                :class="practiceMode === 'vn-to-jp' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-500'"
                class="px-2 sm:px-2.5 py-1 text-xs rounded-lg transition-all">🇻🇳 → 🇯🇵</button>
            </div>

            <button @click="toggleFurigana"
              :class="showFurigana ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-transparent'"
              class="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1 cursor-pointer">
              <span class="font-jp font-bold">ふ</span>
              <span class="text-[10px] px-1 rounded font-bold" :class="showFurigana ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'">
                {{ showFurigana ? 'BẬT' : 'TẮT' }}
              </span>
            </button>

            <button @click="toggleShuffle"
              :class="isShuffle ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold' : 'bg-slate-100 text-slate-500 border-transparent'"
              class="p-1.5 sm:px-2.5 sm:py-1.5 text-xs rounded-xl border transition-all flex items-center gap-1 cursor-pointer">
              <span>🔀</span><span class="hidden sm:inline">Trộn thẻ</span>
            </button>

            <button @click="toggleBlindMode"
              :class="isBlindMode ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-2xs' : 'bg-slate-100 text-slate-500 border-transparent'"
              class="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1 cursor-pointer">
              <span>🎧</span><span class="hidden sm:inline">Nghe ẩn</span>
              <span class="text-[10px] px-1 rounded font-bold" :class="isBlindMode ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'">
                {{ isBlindMode ? 'BẬT' : 'TẮT' }}
              </span>
            </button>

            <button @click="toggleVietnamese"
              :class="showVietnamese ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold' : 'bg-slate-100 text-slate-500 border-transparent'"
              class="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1 cursor-pointer">
              <span>🇻🇳</span><span class="hidden sm:inline">Dịch:</span>
              <span class="text-[10px] px-1 rounded font-bold" :class="showVietnamese ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'">
                {{ showVietnamese ? 'BẬT' : 'TẮT' }}
              </span>
            </button>

            <div class="relative inline-flex items-center">
              <select :value="studyMode" @change="setStudyMode($event.target.value)"
                :class="studyMode === 'verbs3' ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold focus:ring-amber-500' : (studyMode === 'qa' ? 'bg-purple-50 text-purple-800 border-purple-300 font-bold focus:ring-purple-500' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border-slate-200/80 focus:ring-indigo-500')"
                class="appearance-none text-xs px-2.5 sm:px-3 py-1.5 pr-7 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 transition-all shadow-2xs">
                <option value="vocab">🗂️ Chế độ: Học từ mới</option>
                <option value="qa">💬 Chế độ: Phản xạ Q&A</option>
                <option value="verbs3">⚡ Chế độ: Ôn 3 thể động từ</option>
              </select>
              <span class="pointer-events-none absolute right-2 text-[10px] opacity-60">▼</span>
            </div>
          </div>

          <div class="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button @click="showSpeakerModal = true"
              class="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <span>{{ getSpeakerIcon(selectedSpeakerName) }}</span>
              <span class="font-bold max-w-[90px] sm:max-w-[130px] truncate">{{ selectedVoice === 'edge' ? 'Edge-TTS' : (selectedSpeakerName || 'Shikoku Metan') }}</span>
              <span class="text-[10px] bg-purple-200/80 text-purple-800 px-1.5 py-0.2 rounded font-medium hidden sm:inline">{{ selectedVoice === 'edge' ? 'Tự nhiên' : (selectedSpeakerStyle || 'Nữ') }}</span>
              <span class="text-[10px] text-purple-400">▾</span>
            </button>
            <button @click="cycleSpeechRate"
              class="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all flex items-center gap-1 cursor-pointer">
              <span>🔊</span><span>{{ speechRate }}x</span>
            </button>
            <button @click="toggleTtsBar"
              :class="showTtsBar ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer">
              <span>🎙️</span><span class="hidden sm:inline">Thử giọng</span>
            </button>
          </div>
        </div>
      </div>

      <div v-show="showTtsBar && !isFocusMode"
        class="mt-3 bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-indigo-50/90 border border-emerald-200/80 rounded-2xl p-2 sm:p-2.5 shadow-xs flex items-center gap-2 transition-all">
        <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs">🎙️</div>
        <input v-model="customTtsText" @keyup.enter="speakCustomText" type="text"
          placeholder="Nhập bất kỳ từ hoặc câu tiếng Nhật nào để nghe đọc thử (nhấn Enter)..."
          class="flex-1 bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
        <button @click="speakCustomText" :disabled="!customTtsText.trim()"
          class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0">
          <span>▶</span><span>Đọc luôn</span>
        </button>
      </div>
    </div>
  `,
};
