import { inject } from '../vue_exports.js';

export const FlashcardPrompt = {
  setup() {
    return inject('app');
  },
  template: `
    <div class="text-center py-2 sm:py-3 flex flex-col items-center justify-center min-h-[90px] sm:min-h-[120px]">
      <div v-if="practiceMode === 'jp-to-vn'" class="flex flex-col items-center gap-1.5 sm:gap-2 w-full">

        <!-- CHẾ ĐỘ 3: ÔN 3 THỂ ĐỘNG TỪ -->
        <div v-if="studyMode === 'verbs3'" class="w-full flex flex-col items-center py-1 animate-fade-in text-center">
          <div class="flex flex-col items-center gap-1.5 max-w-lg w-full">
            <div class="flex items-center gap-2 flex-wrap justify-center">
              <span class="bg-amber-500 text-white text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-lg shadow-2xs">
                {{ currentForms ? ('NHÓM ' + currentForms.group) : 'ĐỘNG TỪ' }}
              </span>
              <span v-if="currentCard.lesson" class="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                Bài {{ currentCard.lesson }}
              </span>
              <button type="button" @click="play3FormsChain" :disabled="isPlayingChain"
                class="px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all">
                <span :class="{'animate-spin': isPlayingChain}">🔊</span>
                <span>{{ isPlayingChain ? 'Đang phát...' : 'Phát 3 thể' }}</span>
              </button>
            </div>
            <div class="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {{ (currentCard.meaning || '').replace(/\\s*\\[Nhóm.*?\\]/, '') }}
            </div>
            <div v-if="isAnswerRevealed && currentForms" class="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full mt-2 animate-fade-in">
              <div class="p-2 rounded-xl bg-blue-50 border border-blue-200 text-left flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold text-blue-600">① MASU</div>
                  <div class="text-base font-black text-slate-900 font-jp">{{ currentForms.masu.kanji }}</div>
                  <div class="text-xs text-blue-700 font-jp">({{ currentForms.masu.kana }})</div>
                </div>
                <button @click="speakForm('masu')" class="p-1 text-sm text-blue-600 hover:text-blue-800">🔊</button>
              </div>
              <div class="p-2 rounded-xl bg-amber-50 border border-amber-200 text-left flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold text-amber-700">② TỪ ĐIỂN (-U)</div>
                  <div class="text-base font-black text-slate-900 font-jp">{{ currentForms.vru.kanji }}</div>
                  <div class="text-xs text-amber-800 font-jp">({{ currentForms.vru.kana }})</div>
                </div>
                <button @click="speakForm('vru')" class="p-1 text-sm text-amber-700 hover:text-amber-900">🔊</button>
              </div>
              <div class="p-2 rounded-xl bg-purple-50 border border-purple-200 text-left flex items-center justify-between">
                <div>
                  <div class="text-[10px] font-bold text-purple-700">③ THỂ て (TE)</div>
                  <div class="text-base font-black text-slate-900 font-jp">{{ currentForms.vte.kanji }}</div>
                  <div class="text-xs text-purple-800 font-jp">({{ currentForms.vte.kana }})</div>
                </div>
                <button @click="speakForm('vte')" class="p-1 text-sm text-purple-700 hover:text-purple-900">🔊</button>
              </div>
            </div>
          </div>
        </div>

        <!-- CHẾ ĐỘ 1: LUYỆN PHẢN XẠ Q&A -->
        <div v-else-if="studyMode === 'qa' && currentCard.question" class="w-full flex flex-col items-center">
          <div v-if="!isAnswerRevealed" class="flex flex-col items-center gap-2 py-1 w-full max-w-lg animate-fade-in text-center">
            <div v-if="inputMode === 'single'"
              class="w-full bg-indigo-50/70 p-3 sm:p-4 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3 text-left shadow-2xs">
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">HỎI</span>
                  <span class="text-lg sm:text-2xl font-black text-slate-900 font-jp tracking-tight">{{ currentCard.question.short || currentCard.question.polite }}</span>
                  <span class="text-xs sm:text-sm text-indigo-700 font-jp font-medium">({{ currentCard.question.reading }})</span>
                  <span v-if="currentCard.question.polite && currentCard.question.short"
                    class="text-[10px] font-semibold text-indigo-600 bg-white/80 px-1.5 py-0.5 rounded border border-indigo-200">
                    {{ currentCard.question.short ? 'Có thể ngắn' : 'Lịch sự' }}
                  </span>
                </div>
                <div v-if="showVietnamese" class="text-xs sm:text-sm text-slate-600 font-medium pl-8 animate-fade-in">"{{ currentCard.question.vietnamese }}"</div>
              </div>
              <button type="button" @click="speakQuestion"
                class="w-10 h-10 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex items-center justify-center text-lg shrink-0 shadow-2xs cursor-pointer border border-indigo-200/80 active:scale-95"
                title="Nghe câu hỏi">🔊</button>
            </div>
            <div v-else class="flex flex-col items-center gap-2 py-2">
              <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold shadow-2xs">
                <span>🎧</span><span>PHẢN XẠ NGHE &amp; GÕ CẢ 2 CÂU (CHẾ ĐỘ THỬ THÁCH 2 Ô)</span>
              </div>
              <div class="text-xs sm:text-sm text-slate-500 max-w-sm">Bấm loa 1 nghe câu hỏi &amp; loa 2 nghe câu đáp rồi gõ cả 2 ô</div>
            </div>
          </div>

          <div v-else class="flex flex-col items-center gap-2 w-full max-w-lg animate-fade-in">
            <div class="w-full flex flex-col gap-2.5 bg-indigo-50/60 p-3 sm:p-4 rounded-2xl border border-indigo-100 text-left">
              <div class="flex items-start justify-between gap-2">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-baseline flex-wrap gap-2">
                    <span class="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">HỎI</span>
                    <span class="text-base sm:text-xl font-black text-slate-900 font-jp">{{ currentCard.question.short || currentCard.question.polite }}</span>
                    <span class="text-xs text-indigo-700 font-jp">({{ currentCard.question.reading }})</span>
                  </div>
                  <div v-if="showVietnamese" class="text-xs text-slate-500 font-medium pl-8 animate-fade-in">"{{ currentCard.question.vietnamese }}"</div>
                </div>
                <button @click="speakQuestion" class="w-8 h-8 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex items-center justify-center text-sm shrink-0 shadow-2xs cursor-pointer" title="Nghe câu hỏi">🔊</button>
              </div>
              <div class="flex items-start justify-between gap-2 pt-2 border-t border-indigo-100/80">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-baseline flex-wrap gap-2">
                    <span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 shadow-2xs">ĐÁP</span>
                    <span class="text-base sm:text-xl font-black text-slate-900 font-jp">{{ currentCard.answer.short }}</span>
                    <span class="text-xs text-emerald-700 font-jp">({{ currentCard.answer.reading }})</span>
                  </div>
                  <div v-if="showVietnamese" class="text-xs text-emerald-800 font-medium pl-8 animate-fade-in">"{{ currentCard.answer.vietnamese }}"</div>
                </div>
                <button @click="speakAnswer" class="w-8 h-8 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center text-sm shrink-0 shadow-2xs cursor-pointer" title="Nghe câu đáp">🔊</button>
              </div>
            </div>
          </div>
        </div>

        <!-- CHẾ ĐỘ 2: HỌC TỪ MỚI -->
        <div v-else class="flex flex-col items-center gap-2 py-1 w-full animate-fade-in">
          <div class="flex items-center justify-center gap-2 sm:gap-3">
            <div :class="['font-black text-slate-900 font-jp tracking-tight text-center vocab-ruby-wrap', getVocabFontSizeClass(currentCard)]"
              v-html="getPromptRubyHtml(currentCard)"></div>
            <button @click="speak(currentCard.reading || currentCard.term)"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs cursor-pointer transition-all active:scale-95"
              title="Nghe phát âm từ vựng">🔊</button>
          </div>
          <div v-if="showVietnamese && isAnswerRevealed" class="text-sm sm:text-base font-semibold text-emerald-700 animate-fade-in">
            "{{ currentCard.meaning }}"
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-1 sm:gap-2">
        <div class="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ý NGHĨA TIẾNG VIỆT</div>
        <div class="text-xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{{ currentCard.meaning }}</div>
        <div class="text-xs text-indigo-600 font-medium">({{ currentCard.type }})</div>
      </div>
    </div>
  `,
};
