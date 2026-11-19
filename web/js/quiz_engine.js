import { nextTick } from './vue_exports.js';
import { normalizeJp, matchesAnyCandidate, stripBrackets } from './text_utils.js';
import { isBypassPattern } from './verbs_helper.js';

export function gradeQaCard(card, valQ, valA, inputMode, questionInputRef, answerInputRef) {
  const qMatched = matchesAnyCandidate(valQ, [
    card.question.romaji, card.question.reading, card.question.short,
    card.question.polite, ...(card.question.variants || []),
  ]);
  const aMatched = matchesAnyCandidate(valA, [
    card.answer.romaji, card.answer.reading, card.answer.short,
    ...(card.answer.variants || []),
  ]);

  if (inputMode === 'single') {
    if (aMatched) {
      return {
        passed: true,
        title: 'XUẤT SẮC! CÂU TRẢ LỜI CHÍNH XÁC.',
        desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> ➔ Đáp: <b>${card.answer.short}</b>.<br>Nghĩa: <b>${card.meaning}</b>.`,
      };
    }
    nextTick(() => { if (answerInputRef.value) answerInputRef.value.select(); });
    return {
      passed: false,
      title: 'CÂU TRẢ LỜI CHƯA CHÍNH XÁC!',
      desc: `Bạn gõ: "<b>${valA || '(trống)'}</b>". Đáp án chuẩn: <b>${card.answer.short}</b> (${card.answer.romaji}).`,
    };
  }

  if (qMatched && aMatched) {
    return {
      passed: true,
      title: 'XUẤT SẮC! CẢ CÂU HỎI VÀ ĐÁP ÁN ĐỀU ĐÚNG.',
      desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> - Đáp: <b>${card.answer.short}</b>.<br>Nghĩa: <b>${card.meaning}</b>.`,
    };
  }
  if (qMatched && !aMatched) {
    nextTick(() => { if (answerInputRef.value) answerInputRef.value.select(); });
    return {
      passed: false,
      title: 'ĐÚNG CÂU HỎI! CÂU TRẢ LỜI CHƯA CHÍNH XÁC',
      desc: `Đáp án chuẩn cho câu trả lời: <b>${card.answer.short}</b> (${card.answer.romaji}).`,
    };
  }
  if (!qMatched && aMatched) {
    nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
    return {
      passed: false,
      title: 'ĐÚNG CÂU TRẢ LỜI! CÂU HỎI CHƯA CHÍNH XÁC',
      desc: `Đáp án chuẩn cho câu hỏi: <b>${card.question.short || card.question.polite}</b> (${card.question.romaji}).`,
    };
  }
  nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
  return {
    passed: false,
    title: 'CHƯA ĐÚNG CÂU HỎI VÀ CÂU TRẢ LỜI!',
    desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> (${card.question.romaji})<br>Đáp: <b>${card.answer.short}</b> (${card.answer.romaji}).`,
  };
}

export function gradeVocabCard(card, valQ, practiceMode, meaningDesc, questionInputRef) {
  if (practiceMode === 'jp-to-vn') {
    const matched = matchesAnyCandidate(valQ, [
      card.romaji, stripBrackets(card.romaji),
      card.reading, stripBrackets(card.reading),
      card.term, stripBrackets(card.term),
    ]);
    if (matched) {
      return {
        passed: true,
        title: 'CHÍNH XÁC PHIÊN ÂM!',
        desc: `Từ: <b>${card.term}</b> (${card.reading}). Nghĩa: <b>${meaningDesc}</b>.`,
      };
    }
    nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
    return {
      passed: false,
      title: 'CHƯA ĐÚNG PHIÊN ÂM!',
      desc: `Bạn vừa nhập: "<b>${valQ || '(trống)'}</b>". Đáp án chuẩn: <b>${card.romaji}</b> (${card.reading}) - Nghĩa: <b>${meaningDesc}</b>.`,
    };
  }

  const userNorm = normalizeJp(valQ);
  const candidates = [
    normalizeJp(card.term), normalizeJp(stripBrackets(card.term)), normalizeJp((card.term || '').replace(/[\[\]()（）]/g, '')),
    normalizeJp(card.reading), normalizeJp(stripBrackets(card.reading)), normalizeJp((card.reading || '').replace(/[\[\]()（）]/g, '')),
    normalizeJp(card.romaji), normalizeJp(stripBrackets(card.romaji)), normalizeJp((card.romaji || '').replace(/[\[\]()（）]/g, '')),
  ].filter(Boolean);

  if (userNorm && candidates.includes(userNorm)) {
    return {
      passed: true,
      title: 'XUẤT SẮC! TIẾNG NHẬT CHÍNH XÁC.',
      desc: `Từ đúng: <b>${card.term}</b> (${card.reading}). Nghĩa: <b>${meaningDesc}</b>. Bấm <b>Phím 2</b> để đánh dấu thuộc!`,
    };
  }
  nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
  return {
    passed: false,
    title: 'CHƯA ĐÚNG TIẾNG NHẬT!',
    desc: `Bạn vừa nhập: "<b>${valQ || '(trống)'}</b>". Đáp án chuẩn: <b>${card.term}</b> (${card.reading} / ${card.romaji}).`,
  };
}

export function hasBypassInput(...vals) {
  return vals.some(v => isBypassPattern(v));
}
