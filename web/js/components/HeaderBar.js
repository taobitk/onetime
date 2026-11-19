import { inject } from '../vue_exports.js';

export const HeaderBar = {
  setup() {
    return inject('app');
  },
  template: `
    <div>
      <div v-if="isFocusMode" class="fixed top-2.5 right-2.5 z-40 animate-fade-in">
        <button @click="toggleFocusMode"
          class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg text-xs font-bold flex items-center gap-1.5 transition-all">
          <span>🎯</span><span>Thoát tập trung</span>
        </button>
      </div>
      <div v-else-if="isHeaderHidden" class="fixed top-0 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
        <button @click="toggleHeader"
          class="bg-white/95 backdrop-blur-xs border-b border-x border-slate-200/80 rounded-b-xl px-3 py-1 shadow-xs flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition-all cursor-pointer">
          <span>▼ Hiện tiêu đề</span>
        </button>
      </div>

      <header v-show="!isFocusMode && !isHeaderHidden"
        class="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs backdrop-blur-md bg-white/95 transition-all">
        <div class="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-sm shadow-indigo-200 shrink-0 uppercase">
              {{ currentLessonBadge }}
            </div>
            <div>
              <h1 class="text-sm sm:text-base font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                <span>Từ vựng</span>
                <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 hidden md:inline">{{ currentLessonDisplay }}</span>
              </h1>
              <div class="text-[10px] sm:text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span>{{ currentLessonTitle }}</span>
                <span class="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{{ allCards.length }} mục từ</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 sm:gap-4">
            <div class="hidden md:flex flex-col items-end gap-1 w-36">
              <div class="flex justify-between w-full text-[11px] font-semibold text-slate-500">
                <span>Tiến độ</span>
                <span class="text-indigo-600 font-bold">{{ stats.progressPercent }}%</span>
              </div>
              <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300 rounded-full"
                  :style="{ width: stats.progressPercent + '%' }"></div>
              </div>
            </div>

            <div class="flex items-center gap-1 sm:gap-3 bg-slate-100/90 p-1 sm:p-1.5 rounded-xl border border-slate-200/60 text-center text-xs">
              <div class="px-1.5 sm:px-2 py-0.5">
                <div class="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-600 tracking-wider">ĐÃ NHỚ</div>
                <div class="text-xs sm:text-base font-extrabold text-emerald-700">{{ stats.learned }}</div>
              </div>
              <div class="h-5 sm:h-6 w-px bg-slate-200"></div>
              <div class="px-1.5 sm:px-2 py-0.5">
                <div class="text-[9px] sm:text-[10px] uppercase font-bold text-rose-500 tracking-wider">CẦN ÔN</div>
                <div class="text-xs sm:text-base font-extrabold text-rose-600">{{ stats.unlearned }}</div>
              </div>
            </div>

            <button @click="toggleHeader"
              class="p-1 sm:p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              title="Thu gọn thanh tiêu đề">▲</button>
          </div>
        </div>
      </header>
    </div>
  `,
};
