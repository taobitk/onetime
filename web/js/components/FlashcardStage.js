import { inject } from '../vue_exports.js';
import { FlashcardPrompt } from './FlashcardPrompt.js';
import { FlashcardTyping } from './FlashcardTyping.js';
import { FlashcardAnswer } from './FlashcardAnswer.js';

export const FlashcardStage = {
  components: { FlashcardPrompt, FlashcardTyping, FlashcardAnswer },
  setup() {
    return inject('app');
  },
  template: `
    <div v-if="currentCard" class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
      <div class="lg:col-span-6 xl:col-span-6 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md p-4 sm:p-7 flex flex-col justify-between gap-3 sm:gap-4 relative">
        <div class="flex items-center justify-between gap-2 sm:gap-3 text-xs border-b border-slate-100 pb-2.5 sm:pb-3">
          <div class="font-semibold text-slate-600 flex items-center gap-1.5">
            <span class="bg-slate-100 text-slate-700 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg">Thẻ {{ currentIndex + 1 }} / {{ activeList.length }}</span>
            <span class="text-slate-400 font-mono text-[11px]">(#{{ currentCard.id }})</span>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <button @click="toggleFocusMode"
              :class="isFocusMode ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
              class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs">
              <span>🎯</span><span>{{ isFocusMode ? 'Thoát Focus' : 'Tập trung' }}</span>
            </button>
            <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[10px] sm:text-[11px] uppercase tracking-wide">{{ currentCard.type }}</span>
            <span v-if="isCardMastered(currentCard.term)" class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] sm:text-[11px] flex items-center gap-1">
              ✓ <span class="hidden sm:inline">Đã thuộc</span><span class="sm:hidden">Thuộc</span>
            </span>
            <span v-else class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] sm:text-[11px] flex items-center gap-1">
              ● <span class="hidden sm:inline">Cần ôn</span><span class="sm:hidden">Ôn</span>
            </span>
          </div>
        </div>

        <flashcard-prompt></flashcard-prompt>
        <flashcard-typing></flashcard-typing>

        <!-- MOBILE INLINE REVEAL -->
        <div v-if="isAnswerRevealed" class="lg:hidden flex flex-col gap-2.5 pt-2 border-t border-slate-100 animate-fade-in">
          <div class="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100/90 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-baseline flex-wrap gap-1.5">
                <span class="text-lg font-black text-slate-900 font-jp">{{ currentCard.term }}</span>
                <span class="text-xs font-semibold text-indigo-700 font-jp">({{ currentCard.reading }})</span>
                <span class="text-[11px] font-mono text-slate-400">/{{ currentCard.romaji }}/</span>
              </div>
              <button @click="speak(currentCard.reading || currentCard.term)" class="text-indigo-600 hover:text-indigo-800 p-1 text-sm shrink-0">🔊</button>
            </div>
            <div v-if="currentCard.meanings && currentCard.meanings.length > 1" class="flex flex-col gap-1 pt-1.5 border-t border-indigo-100/60">
              <div class="text-[10px] uppercase font-bold text-slate-400">Các nghĩa:</div>
              <div v-for="(m, mIdx) in currentCard.meanings" :key="mIdx" class="text-xs text-slate-800 flex items-start gap-1.5">
                <span class="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{{ mIdx + 1 }}</span>
                <span class="font-medium text-slate-800">{{ m }}</span>
              </div>
            </div>
            <div v-else class="text-xs sm:text-sm text-slate-800 font-bold pt-1 border-t border-indigo-100/60 flex items-center gap-1.5">
              <span class="text-[11px] font-normal text-slate-400">Nghĩa:</span>
              <span class="text-indigo-900">{{ currentCard.meaning }}</span>
            </div>
          </div>

          <div v-if="cardExamples(currentCard).length" class="flex flex-col gap-2">
            <div class="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">CÂU VÍ DỤ MINH HỌA ({{ cardExamples(currentCard).length }})</div>
            <div v-for="(ex, exIdx) in cardExamples(currentCard)" :key="exIdx" class="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-600">
                <span>Ví dụ {{ exIdx + 1 }}</span>
                <button @click="speakExample(ex.japanese, currentCard, exIdx)" class="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-semibold lowercase">🔊 Nghe câu</button>
              </div>
              <div class="text-sm sm:text-base text-slate-900 font-jp leading-relaxed" v-html="ex.ruby || ex.japanese"></div>
              <div class="text-[11px] sm:text-xs text-slate-600 italic border-t border-slate-100 pt-1">{{ ex.vietnamese }}</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-1.5 sm:gap-2 pt-2 border-t border-slate-100">
          <button @click="prevCard" :disabled="currentIndex === 0"
            class="px-2.5 sm:px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs shrink-0">
            <span>←</span><span class="hidden sm:inline">Trước</span>
          </button>
          <button @click="handleCheckOrNext"
            class="flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-200 flex items-center justify-center gap-1">
            <span>{{ isAnswerRevealed ? (isLastCheckPassed ? 'Tiếp theo →' : 'Kiểm tra lại') : 'Xem đáp án' }}</span>
            <span class="hidden sm:inline text-[10px] text-indigo-200 font-mono">(Space)</span>
          </button>
          <button @click="toggleCardMastery(currentCard.term)"
            :class="isCardMastered(currentCard.term) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
            class="px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs shrink-0">
            <span class="hidden sm:inline">{{ isCardMastered(currentCard.term) ? '✓ Đã thuộc' : '● Cần ôn' }}</span>
            <span class="sm:hidden">{{ isCardMastered(currentCard.term) ? '✓ Thuộc' : '● Ôn' }}</span>
          </button>
          <button @click="nextCard" :disabled="currentIndex >= activeList.length - 1"
            class="px-2.5 sm:px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-2xs shrink-0">
            <span class="hidden sm:inline">Tiếp</span><span>→</span>
          </button>
        </div>

        <div class="hidden sm:flex text-[10px] text-slate-400 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 pt-1">
          <span>Phím tắt:</span>
          <span><kbd class="px-1 rounded bg-slate-100 border text-slate-600 font-mono">A</kbd> Trước</span>
          <span><kbd class="px-1 rounded bg-slate-100 border text-slate-600 font-mono">D</kbd> Sau</span>
          <span><kbd class="px-1 rounded bg-slate-100 border text-slate-600 font-mono">Space</kbd> Lật</span>
          <span><kbd class="px-1 rounded bg-slate-100 border text-slate-600 font-mono">1</kbd> Ôn</span>
          <span><kbd class="px-1 rounded bg-slate-100 border text-slate-600 font-mono">2</kbd> Thuộc</span>
        </div>
      </div>

      <flashcard-answer></flashcard-answer>
    </div>

    <div v-else-if="allCards.length > 0" class="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs flex flex-col items-center gap-3">
      <div class="text-4xl">🎉</div>
      <div class="text-base font-bold text-slate-800">Không có thẻ nào trong mục này!</div>
      <div class="text-xs text-slate-500">Bạn đã hoàn thành hoặc chưa có thẻ phù hợp với bộ lọc hiện tại.</div>
      <button @click="setScope('all')" class="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Xem tất cả ({{ enabledCards.length }} từ)</button>
    </div>
  `,
};
