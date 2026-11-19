import { inject } from '../vue_exports.js';

export const FlashcardTyping = {
  setup() {
    return inject('app');
  },
  template: `
    <div>
      <!-- Practice Typing Box: Chế độ 3 Thể -->
      <div v-if="studyMode === 'verbs3'" class="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <span class="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <span>⚡</span><span>LUYỆN GÕ 3 THỂ ĐỘNG TỪ (1/VERB)</span>
          </span>
          <button type="button" @click="play3FormsChain" :disabled="isPlayingChain"
            class="px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 active:scale-95">
            <span>🔊</span><span>Nghe chuỗi 3 thể</span>
          </button>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-blue-700">① Thể Masu (〜ます)</span>
              <span class="text-[10px] text-slate-400 font-medium">(Gõ romaji tự ra hiragana)</span>
            </div>
            <span v-if="statusMasu === 'correct'" class="text-[10px] font-bold text-emerald-600">✓ ĐÚNG</span>
            <span v-else-if="statusMasu === 'wrong'" class="text-[10px] font-bold text-rose-600">✗ SAI</span>
          </div>
          <div class="flex items-center gap-2">
            <input :ref="(el) => setInputRef('masu', el)" type="text" v-model="inputMasu" @input="handleInputMasu"
              @keydown.enter.prevent="handleEnterMasu" :disabled="isAnswerRevealed && isLastCheckPassed"
              placeholder="Gõ thể masu (VD: okimasu ➔ おきます)..."
              :class="{'border-emerald-400 bg-emerald-50/40 text-emerald-900': statusMasu === 'correct', 'border-rose-400 bg-rose-50/40 text-rose-900': statusMasu === 'wrong', 'border-blue-200 focus:border-blue-500 bg-white': statusMasu === 'idle'}"
              class="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border shadow-2xs font-jp">
            <button type="button" @click="speakForm('masu')"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all flex items-center justify-center text-base shrink-0 shadow-2xs cursor-pointer border border-blue-200/60 active:scale-95"
              title="Nghe Thể Masu (Phím 1)">🔊</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-amber-700">② Thể -u / Thể Từ điển (辞書形)</span>
              <span class="text-[10px] text-slate-400 font-medium">(Gõ romaji tự ra hiragana)</span>
            </div>
            <span v-if="statusVru === 'correct'" class="text-[10px] font-bold text-emerald-600">✓ ĐÚNG</span>
            <span v-else-if="statusVru === 'wrong'" class="text-[10px] font-bold text-rose-600">✗ SAI</span>
          </div>
          <div class="flex items-center gap-2">
            <input :ref="(el) => setInputRef('vru', el)" type="text" v-model="inputVru" @input="handleInputVru"
              @keydown.enter.prevent="handleEnterVru" :disabled="isAnswerRevealed && isLastCheckPassed"
              placeholder="Gõ thể từ điển (VD: okiru ➔ おきる)..."
              :class="{'border-emerald-400 bg-emerald-50/40 text-emerald-900': statusVru === 'correct', 'border-rose-400 bg-rose-50/40 text-rose-900': statusVru === 'wrong', 'border-amber-200 focus:border-amber-500 bg-white': statusVru === 'idle'}"
              class="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border shadow-2xs font-jp">
            <button type="button" @click="speakForm('vru')"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all flex items-center justify-center text-base shrink-0 shadow-2xs cursor-pointer border border-amber-200/60 active:scale-95"
              title="Nghe Thể Từ điển (Phím 2)">🔊</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-purple-700">③ Thể て (V-te)</span>
              <span class="text-[10px] text-slate-400 font-medium">(Gõ romaji tự ra hiragana)</span>
            </div>
            <span v-if="statusVte === 'correct'" class="text-[10px] font-bold text-emerald-600">✓ ĐÚNG</span>
            <span v-else-if="statusVte === 'wrong'" class="text-[10px] font-bold text-rose-600">✗ SAI</span>
          </div>
          <div class="flex items-center gap-2">
            <input :ref="(el) => setInputRef('vte', el)" type="text" v-model="inputVte" @input="handleInputVte"
              @keydown.enter.prevent="handleEnterVte" :disabled="isAnswerRevealed && isLastCheckPassed"
              placeholder="Gõ thể te (VD: okite ➔ おきて)..."
              :class="{'border-emerald-400 bg-emerald-50/40 text-emerald-900': statusVte === 'correct', 'border-rose-400 bg-rose-50/40 text-rose-900': statusVte === 'wrong', 'border-purple-200 focus:border-purple-500 bg-white': statusVte === 'idle'}"
              class="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border shadow-2xs font-jp">
            <button type="button" @click="speakForm('vte')"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-all flex items-center justify-center text-base shrink-0 shadow-2xs cursor-pointer border border-purple-200/60 active:scale-95"
              title="Nghe Thể て (Phím 3)">🔊</button>
          </div>
        </div>

        <div v-if="validationFeedback"
          :class="validationFeedback.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'"
          class="p-2 sm:p-2.5 rounded-xl border flex items-start gap-2 text-xs">
          <span class="text-base sm:text-lg shrink-0">{{ validationFeedback.passed ? '🎉' : '❌' }}</span>
          <div class="flex-1">
            <div class="font-bold">{{ validationFeedback.title }}</div>
            <div class="mt-0.5 opacity-90 text-[11px] sm:text-xs" v-html="validationFeedback.desc"></div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400 flex-wrap gap-1">
          <span><b>Enter:</b> Chuyển ô / Chấm</span>
          <span><b>Space / Enter:</b> Từ tiếp (khi đúng)</span>
          <span><b>~~:</b> Bỏ qua</span>
          <span><b>Phím 1/2/3:</b> Loa từng thể</span>
        </div>
      </div>

      <!-- Practice Typing Box: Học từ mới / Q&A -->
      <div v-else class="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-2.5 sm:gap-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <span class="text-xs font-black uppercase tracking-wider text-slate-700">
            <span v-if="studyMode === 'qa' && currentCard && currentCard.question">LUYỆN GÕ PHẢN XẠ Q&amp;A</span>
            <span v-else>LUYỆN GÕ TỪ VỰNG</span>
          </span>
          <button v-if="studyMode === 'qa' && currentCard && currentCard.question" type="button" @click="toggleInputMode"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border active:scale-95"
            :class="inputMode === 'single' ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'">
            <span v-if="inputMode === 'single'">⚡ 1 Ô: Trả lời nhanh (Mặc định)</span>
            <span v-else>✍️ 2 Ô: Cả Hỏi &amp; Đáp</span>
            <span class="text-[10px] opacity-60">⇄</span>
          </button>
        </div>

        <div v-if="currentForms" class="flex items-center justify-between p-2 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs gap-2">
          <span class="font-medium">💡 Động từ này có đủ 3 thể (Masu, U, Te)!</span>
          <button type="button" @click="setStudyMode('verbs3')"
            class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0">
            ⚡ Bật Ôn 3 thể ngay
          </button>
        </div>

        <div v-if="studyMode === 'vocab' || !currentCard.question || inputMode === 'dual'">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-slate-800">
                <span v-if="studyMode === 'vocab' || !currentCard.question">1. Từ vựng</span>
                <span v-else>1. Câu hỏi</span>
              </span>
              <span v-if="studyMode === 'qa' && currentCard && currentCard.question" class="text-[10px] font-bold px-2 py-0.5 rounded-md"
                :class="currentCard.question.polite && !currentCard.question.short ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'">
                {{ currentCard.question.polite && !currentCard.question.short ? 'Thể lịch sự' : 'Thể ngắn (Thông thường)' }}
              </span>
              <span v-else class="text-[10px] text-slate-400 font-medium">(Romaji hoặc Hiragana)</span>
            </div>
            <span class="text-[10px] text-slate-400 font-normal">Gõ "~~" để pass</span>
          </div>
          <div class="flex items-center gap-2">
            <input :ref="(el) => setInputRef('question', el)" type="text" v-model="inputQuestion"
              @keydown.enter.prevent="handleCheckOrNext" :disabled="isAnswerRevealed && isLastCheckPassed"
              :placeholder="(studyMode === 'qa' && currentCard && currentCard.question) ? 'Bấm loa nghe câu hỏi rồi gõ Romaji/Kana...' : 'Nhập Romaji hoặc Hiragana của từ vựng (VD: kantan, かんたん)...'"
              :class="inputQuestionStatusClass"
              class="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border shadow-2xs font-jp">
            <button v-if="studyMode === 'qa' && currentCard && currentCard.question" type="button" @click="speakQuestion"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-all flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs cursor-pointer border border-indigo-200/60 active:scale-95"
              title="Nghe câu hỏi (Loa 1)">🔊</button>
          </div>
        </div>

        <div v-if="studyMode === 'qa' && currentCard && currentCard.question">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-slate-800">{{ inputMode === 'single' ? 'Câu trả lời phản xạ' : '2. Câu trả lời' }}</span>
              <span class="text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">Từ vựng mục tiêu</span>
            </div>
            <span class="text-[10px] text-slate-400 font-normal">Gõ "~~" để pass</span>
          </div>
          <div class="flex items-center gap-2">
            <input :ref="(el) => setInputRef('answer', el)" type="text" v-model="inputAnswer" @keydown.enter.prevent="handleCheckOrNext"
              :disabled="isAnswerRevealed && isLastCheckPassed"
              :placeholder="inputMode === 'single' ? 'Gõ câu trả lời / từ vựng (Romaji hoặc Kana)...' : 'Bấm loa nghe câu trả lời rồi gõ Romaji/Kana...'"
              :class="inputAnswerStatusClass"
              class="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border shadow-2xs font-jp">
            <button type="button" @click="speakAnswer"
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-all flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs cursor-pointer border border-emerald-200/60 active:scale-95"
              title="Nghe câu trả lời (Loa 2)">🔊</button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-800">
              {{ (studyMode === 'qa' && currentCard && currentCard.question && inputMode === 'dual') ? '3. Nghĩa tiếng Việt (tự nhớ)' : '2. Nghĩa tiếng Việt (tự nhớ)' }}
            </span>
            <span class="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">✓ Luôn Pass (Không chấm điểm)</span>
          </div>
          <input type="text" v-model="inputMeaning" @keydown.enter.prevent="handleCheckOrNext"
            :disabled="isAnswerRevealed && isLastCheckPassed"
            placeholder="Gõ nghĩa tiếng Việt để tự nhớ / đối chiếu (Enter để kiểm tra)..."
            class="w-full px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm rounded-xl focus:outline-none transition-all border border-slate-200 bg-white text-slate-800 focus:border-indigo-400 shadow-2xs">
        </div>

        <div v-if="validationFeedback"
          :class="validationFeedback.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'"
          class="p-2 sm:p-2.5 rounded-xl border flex items-start gap-2 text-xs">
          <span class="text-base sm:text-lg shrink-0">{{ validationFeedback.passed ? '🎉' : '❌' }}</span>
          <div class="flex-1">
            <div class="font-bold">{{ validationFeedback.title }}</div>
            <div class="mt-0.5 opacity-90 text-[11px] sm:text-xs" v-html="validationFeedback.desc"></div>
          </div>
        </div>
      </div>
    </div>
  `,
};
