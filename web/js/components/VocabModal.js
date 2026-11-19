import { inject } from '../vue_exports.js';

export const VocabModal = {
  setup() {
    return inject('app');
  },
  template: `
    <div v-if="showLookupModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <div class="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">📖</span>
            <div>
              <h2 class="font-bold text-slate-900 text-sm sm:text-base">Kho Từ Vựng</h2>
              <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Đang học: <b class="text-indigo-600">{{ enabledCards.length }}</b> / {{ allCards.length }} từ</span>
                <span v-if="disabledTerms.length > 0" class="text-rose-600 font-semibold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full text-[11px]">{{ disabledTerms.length }} từ đã tắt</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button @click="vocabFilter = 'enabled'"
                :class="vocabFilter === 'enabled' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                <span>🟢 Đang bật</span><span class="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">{{ enabledCards.length }}</span>
              </button>
              <button @click="vocabFilter = 'disabled'"
                :class="vocabFilter === 'disabled' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                <span>⚪ Đã tắt</span><span class="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">{{ disabledTerms.length }}</span>
              </button>
              <button @click="vocabFilter = 'all'"
                :class="vocabFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                <span>📋 Tất cả</span><span class="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">{{ allCards.length }}</span>
              </button>
            </div>
            <button @click="showLookupModal = false" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition-all ml-1">✕</button>
          </div>
        </div>

        <div class="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 flex-1 min-w-[220px] bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span class="text-slate-400">🔍</span>
            <input type="text" v-model="searchQuery" placeholder="Tìm kiếm theo từ vựng, romaji, kanji hoặc nghĩa tiếng Việt..."
              class="w-full bg-transparent text-xs sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400">
            <button v-if="searchQuery" @click="searchQuery = ''" class="text-xs text-slate-400 hover:text-slate-600 px-1">Xóa</button>
          </div>

          <div class="flex items-center flex-wrap gap-2 shrink-0">
            <button @click="enableAllWords" class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center gap-1 shadow-2xs">✅ Bật tất cả</button>
            <button @click="disableAllWords" class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all flex items-center gap-1 shadow-2xs">🚫 Tắt tất cả</button>
            <button @click="toggleAllMastery" class="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1 shadow-2xs"
              :class="isAllMastered ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'">
              <span>{{ isAllMastered ? '🔄 Cần ôn tất cả' : '✓ Thuộc tất cả' }}</span>
            </button>
          </div>
        </div>

        <div v-if="vocabFilter === 'enabled' && disabledTerms.length > 0"
          class="bg-amber-50/90 border-b border-amber-200/70 px-4 py-2 text-xs text-amber-800 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5"><span>💡</span><span>Đang ẩn <b>{{ disabledTerms.length }}</b> từ bị tắt khỏi kho từ và flashcard.</span></div>
          <button @click="vocabFilter = 'disabled'" class="text-indigo-600 hover:text-indigo-800 font-bold underline shrink-0">Xem danh sách từ đã tắt ({{ disabledTerms.length }}) →</button>
        </div>

        <div class="flex-1 overflow-y-auto p-2 sm:p-4">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 pb-2">
                <th class="p-2.5 w-12 text-center">#</th>
                <th class="p-2.5 w-20 text-center font-bold text-slate-600">Bật / Tắt</th>
                <th class="p-2.5">Từ vựng (Kanji/Kana)</th>
                <th class="p-2.5">Nghĩa tiếng Việt</th>
                <th class="p-2.5 hidden md:table-cell">Ví dụ minh họa</th>
                <th class="p-2.5 w-28 text-center font-bold text-slate-600">Trạng thái</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="filteredLookupList.length === 0">
                <td colspan="6" class="p-10 text-center text-slate-400">
                  <div class="text-2xl mb-1">📭</div>
                  <div class="font-bold text-slate-600">Không có từ vựng nào trong mục này</div>
                  <button v-if="vocabFilter === 'enabled' && disabledTerms.length > 0" @click="enableAllWords"
                    class="mt-3 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold">Bật lại tất cả từ vựng</button>
                </td>
              </tr>
              <tr v-for="(item, index) in filteredLookupList" :key="item.term || item.id || index"
                @click="onRowClick(item)" class="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                :class="!isWordEnabled(item.term) ? 'bg-slate-50/70 opacity-60' : ''">
                <td class="p-2.5 text-center font-mono text-xs text-slate-400 group-hover:text-indigo-600 font-bold">#{{ item.id || (index + 1) }}</td>
                <td class="p-2.5 text-center" @click.stop>
                  <button type="button" @click.stop="toggleWordEnabled(item.term)"
                    :class="isWordEnabled(item.term) ? 'bg-emerald-500' : 'bg-slate-300'"
                    class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none">
                    <span :class="isWordEnabled(item.term) ? 'translate-x-4' : 'translate-x-0'"
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                  </button>
                </td>
                <td class="p-2.5">
                  <div class="font-bold text-slate-900 font-jp text-sm sm:text-base flex items-center gap-1.5">
                    <span :class="!isWordEnabled(item.term) ? 'line-through text-slate-400' : ''">{{ item.term }}</span>
                    <button @click.stop="speak(item.reading || item.term, false, item)" class="text-slate-400 hover:text-indigo-600 p-1 text-xs">🔊</button>
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">{{ item.reading }} <span v-if="item.romaji">({{ item.romaji }})</span></div>
                  <div class="text-[10px] font-semibold text-indigo-600 mt-0.5">{{ item.type }}</div>
                </td>
                <td class="p-2.5 font-medium text-slate-800" :class="!isWordEnabled(item.term) ? 'text-slate-400' : ''">
                  <div v-if="item.meanings && item.meanings.length > 1" class="flex flex-col gap-1">
                    <div v-for="(m, mIdx) in item.meanings" :key="mIdx" class="text-xs flex items-start gap-1">
                      <span class="text-indigo-600 font-bold shrink-0">{{ mIdx + 1 }}.</span><span>{{ m }}</span>
                    </div>
                  </div>
                  <div v-else>{{ item.meaning }}</div>
                </td>
                <td class="p-2.5 hidden md:table-cell text-xs text-slate-600 max-w-xs">
                  <div v-if="cardExamples(item).length" class="flex flex-col gap-2">
                    <div v-for="(ex, exIdx) in cardExamples(item)" :key="exIdx" class="flex flex-col gap-0.5 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                      <div class="font-jp text-slate-800 flex items-center justify-between gap-1">
                        <span v-html="ex.ruby || ex.japanese"></span>
                        <button @click.stop="speakExample(ex.japanese, item, exIdx)" class="text-slate-400 hover:text-indigo-600 p-0.5 text-xs shrink-0">🔊</button>
                      </div>
                      <div class="text-[11px] text-slate-400 italic">{{ ex.vietnamese }}</div>
                    </div>
                  </div>
                </td>
                <td class="p-2.5 text-center" @click.stop="toggleCardMastery(item.term)">
                  <span v-if="isCardMastered(item.term)" class="inline-block px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200 transition-colors">✓ Đã nhớ</span>
                  <span v-else class="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold hover:bg-slate-200 transition-colors">Cần ôn</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
          <span>Gạt công tắc ở cột <b>Bật/Tắt</b> để ẩn/hiện từng từ • Bấm vào hàng để luyện thẻ Flashcard</span>
          <button @click="showLookupModal = false" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors">Đóng</button>
        </div>
      </div>
    </div>
  `,
};
