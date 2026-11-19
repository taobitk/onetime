import { ref, computed, nextTick } from './vue_exports.js';
import { toHiragana } from './text_utils.js';
import { getCardForms, isMatchForm, isBypassPattern } from './verbs_helper.js';

export function createVerbs3Engine({
  currentCard, isAnswerRevealed, isLastCheckPassed, validationFeedback,
  speak, onNextAfterPass,
}) {
  const inputMasu = ref('');
  const inputVru = ref('');
  const inputVte = ref('');
  const statusMasu = ref('idle');
  const statusVru = ref('idle');
  const statusVte = ref('idle');
  const masuInputRef = ref(null);
  const vruInputRef = ref(null);
  const vteInputRef = ref(null);
  const isPlayingChain = ref(false);
  const currentForms = computed(() => getCardForms(currentCard.value));

  function resetVerbs3State() {
    inputMasu.value = '';
    inputVru.value = '';
    inputVte.value = '';
    statusMasu.value = 'idle';
    statusVru.value = 'idle';
    statusVte.value = 'idle';
  }

  function makeInputHandler(inputRef, statusRef) {
    return (e) => {
      const val = e.target.value;
      const converted = toHiragana(val);
      if (converted !== val) inputRef.value = converted;
      if (statusRef.value === 'wrong') statusRef.value = 'idle';
    };
  }

  function speakForm(formType) {
    const card = currentCard.value;
    if (!card) return;
    const forms = currentForms.value;
    if (!forms || !forms[formType]) {
      speak(card.reading || card.term);
      return;
    }
    const target = forms[formType];
    speak(target.kana || target.kanji);
  }

  async function play3FormsChain() {
    const card = currentCard.value;
    if (!card) return;
    const forms = currentForms.value;
    if (!forms) {
      await speak(card.reading || card.term);
      return;
    }
    if (isPlayingChain.value) return;
    isPlayingChain.value = true;
    const waitPause = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await speak(forms.masu.kana || forms.masu.kanji);
      await waitPause(350);
      await speak(forms.vru.kana || forms.vru.kanji);
      await waitPause(350);
      await speak(forms.vte.kana || forms.vte.kanji);
    } finally {
      isPlayingChain.value = false;
    }
  }

  function format3FormsDesc(forms) {
    return `① ます: <b>${forms.masu.kanji}</b> (${forms.masu.kana})<br>` +
      `② 辞書: <b>${forms.vru.kanji}</b> (${forms.vru.kana})<br>` +
      `③ て形: <b>${forms.vte.kanji}</b> (${forms.vte.kana})<br>` +
      `Bấm <b>Enter</b> hoặc <b>Space</b> để sang động từ tiếp theo!`;
  }

  function bypass3Forms() {
    const forms = currentForms.value;
    if (!currentCard.value || !forms) return;
    inputMasu.value = forms.masu.kana;
    inputVru.value = forms.vru.kana;
    inputVte.value = forms.vte.kana;
    statusMasu.value = 'correct';
    statusVru.value = 'correct';
    statusVte.value = 'correct';
    isAnswerRevealed.value = true;
    isLastCheckPassed.value = true;
    validationFeedback.value = {
      passed: true,
      title: 'ĐÃ BỎ QUA THẺ (LỆNH TẮT ~~) ⚡',
      desc: format3FormsDesc(forms),
    };
    play3FormsChain();
  }

  function check3FormsAnswers() {
    const forms = currentForms.value;
    if (!currentCard.value || !forms) return;
    const mPass = isMatchForm(inputMasu.value, forms.masu);
    const rPass = isMatchForm(inputVru.value, forms.vru);
    const tPass = isMatchForm(inputVte.value, forms.vte);

    statusMasu.value = mPass ? 'correct' : 'wrong';
    statusVru.value = rPass ? 'correct' : 'wrong';
    statusVte.value = tPass ? 'correct' : 'wrong';

    if (mPass && rPass && tPass) {
      isAnswerRevealed.value = true;
      isLastCheckPassed.value = true;
      validationFeedback.value = {
        passed: true,
        title: 'XUẤT SẮC! ĐÚNG CẢ 3 THỂ ĐỘNG TỪ 🎉',
        desc: format3FormsDesc(forms),
      };
      play3FormsChain();
    } else {
      isLastCheckPassed.value = false;
      const errors = [];
      if (!mPass) errors.push('Thể Masu (①)');
      if (!rPass) errors.push('Thể Từ điển (②)');
      if (!tPass) errors.push('Thể て (③)');
      validationFeedback.value = {
        passed: false,
        title: 'CHƯA CHÍNH XÁC',
        desc: `Kiểm tra lại: <b>${errors.join(', ')}</b>. Gõ <b>~~</b> nếu muốn xem đáp án ngay!`,
      };
      nextTick(() => {
        if (!mPass && masuInputRef.value) masuInputRef.value.focus();
        else if (!rPass && vruInputRef.value) vruInputRef.value.focus();
        else if (!tPass && vteInputRef.value) vteInputRef.value.focus();
      });
    }
  }

  function handleEnterStep(inputRef, formKey, nextElRef) {
    if (isAnswerRevealed.value && isLastCheckPassed.value) { onNextAfterPass(); return; }
    if (isBypassPattern(inputRef.value)) { bypass3Forms(); return; }
    const forms = currentForms.value;
    if (forms && inputRef.value.trim()) {
      const ok = isMatchForm(inputRef.value, forms[formKey]);
      if (formKey === 'masu') statusMasu.value = ok ? 'correct' : 'wrong';
      if (formKey === 'vru') statusVru.value = ok ? 'correct' : 'wrong';
    }
    if (nextElRef && nextElRef.value) nextElRef.value.focus();
  }

  function handleEnterVte() {
    if (isAnswerRevealed.value && isLastCheckPassed.value) { onNextAfterPass(); return; }
    if (isBypassPattern(inputVte.value)) { bypass3Forms(); return; }
    check3FormsAnswers();
  }

  return {
    inputMasu, inputVru, inputVte,
    statusMasu, statusVru, statusVte,
    masuInputRef, vruInputRef, vteInputRef,
    isPlayingChain, currentForms, resetVerbs3State,
    handleInputMasu: makeInputHandler(inputMasu, statusMasu),
    handleInputVru: makeInputHandler(inputVru, statusVru),
    handleInputVte: makeInputHandler(inputVte, statusVte),
    handleEnterMasu: () => handleEnterStep(inputMasu, 'masu', vruInputRef),
    handleEnterVru: () => handleEnterStep(inputVru, 'vru', vteInputRef),
    handleEnterVte,
    check3FormsAnswers, bypass3Forms, speakForm, play3FormsChain,
  };
}
