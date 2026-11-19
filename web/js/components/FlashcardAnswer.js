import { inject } from '../vue_exports.js';

export const FlashcardAnswer = {
  setup() {
    return inject('app');
  },
  template: `
    <div class="hidden lg:flex lg:col-span-6 xl:col-span-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-3xl border border-indigo-100/90 shadow-md p-5 sm:p-7 flex-col justify-between gap-4 min-h-[380px]">
      <div v-if="isAnswerRevealed" class="flex flex-col gap-4 flex-1 justify-between animate-fade-in">
        <div class="flex flex-col gap-3.5">
          <div class="flex items-center justify-between border-b border-indigo-100 pb-2">
            <span class="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>💡</span><span>ĐÁP ÁN CHI TIẾT</span>
            </span>
            <span class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
              {{ currentCard.level }} • {{ currentCard.type }}
            </span>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex flex-col gap-1.5">
            <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TỪ VỰNG & PHIÊN ÂM</div>
            <div class="text-xl sm:text-2xl font-black text-slate-900 font-jp flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span>{{ currentCard.term }}</span>
                <span class="text-sm font-normal text-slate-500 font-sans">({{ currentCard.reading }})</span>
              </div>
              <button @click="speak(currentCard.reading || currentCard.term)" class="text-indigo-600 hover:text-indigo-800 p-1 text-sm shrink-0" title="Nghe lại">🔊</button>
            </div>
            <div class="text-xs font-mono text-indigo-600">/{{ currentCard.romaji }}/</div>

            <div v-if="currentCard.meanings && currentCard.meanings.length > 1" class="flex flex-col gap-1.5 mt-1 pt-2.5 border-t border-slate-100">
              <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CÁC NGHĨA CỦA TỪ:</div>
              <div v-for="(m, mIdx) in currentCard.meanings" :key="mIdx"
                class="text-xs sm:text-sm text-slate-800 flex items-start gap-2 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                <span class="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{{ mIdx + 1 }}</span>
                <span class="font-medium text-slate-800">{{ m }}</span>
              </div>
            </div>
            <div v-else class="text-sm sm:text-base text-slate-800 font-bold mt-1 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <span class="text-xs font-normal text-slate-400">Nghĩa:</span>
              <span class="text-indigo-900">{{ currentCard.meaning }}</span>
            </div>
          </div>

          <div v-if="currentCard.tags && currentCard.tags.length" class="flex flex-wrap gap-1.5 items-center">
            <span class="text-[10px] uppercase font-bold text-slate-400 mr-1">Thẻ:</span>
            <span v-for="tag in currentCard.tags" :key="tag"
              class="text-[11px] px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium">{{ tag }}</span>
          </div>
        </div>

        <div v-if="cardExamples(currentCard).length" class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
            <span>CÂU VÍ DỤ MINH HỌA ({{ cardExamples(currentCard).length }})</span>
          </div>
          <div v-for="(ex, exIdx) in cardExamples(currentCard)" :key="exIdx"
            class="bg-white p-3.5 sm:p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex flex-col gap-2">
            <div class="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-600">
              <span class="bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Ví dụ {{ exIdx + 1 }}</span>
              <button @click="speakExample(ex.japanese, currentCard, exIdx)"
                class="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-semibold lowercase">
                <span>🔊 Nghe câu</span>
              </button>
            </div>
            <div class="text-base sm:text-lg text-slate-900 font-jp leading-relaxed" v-html="ex.ruby || ex.japanese"></div>
            <div class="text-xs sm:text-sm text-slate-600 italic border-t border-slate-50 pt-1.5">{{ ex.vietnamese }}</div>
          </div>
        </div>
      </div>

      <div v-else class="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400 border-2 border-dashed border-indigo-200/70 rounded-2xl bg-white/50">
        <div class="text-4xl mb-2">🎯</div>
        <div class="font-bold text-slate-700 text-sm sm:text-base">Đáp án chi tiết đang ẩn</div>
        <div class="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Nhập phiên âm ở ô bên trái hoặc bấm nút <b>Xem đáp án (Space)</b> để mở khóa câu ví dụ có Furigana &amp; nghĩa tiếng Việt!
        </div>
        <button @click="handleCheckOrNext"
          class="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition-all">
          Mở đáp án ngay (Space)
        </button>
      </div>
    </div>
  `,
};
