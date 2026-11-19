import { VERBS_MASTER_DICT } from './verbs_dict.js';
import { stripBrackets, toHiragana } from './text_utils.js';

export function getCardForms(card) {
  if (!card) return null;
  if (card.forms) return card.forms;

  const t = stripBrackets(card.term || '');
  const r = stripBrackets(card.reading || '');
  if (!t && !r) return null;

  const found = VERBS_MASTER_DICT.find(v =>
    v.masu_kanji === t || v.vru_kanji === t ||
    v.masu_kana === r || v.vru_kana === r ||
    v.masu_kanji === r || v.vru_kanji === r
  );
  if (found) {
    return {
      masu: { kanji: found.masu_kanji, kana: found.masu_kana, romaji: found.masu_romaji },
      vru: { kanji: found.vru_kanji, kana: found.vru_kana, romaji: found.vru_romaji },
      vte: { kanji: found.vte_kanji, kana: found.vte_kana, romaji: found.vte_romaji },
      group: found.group,
      rule: found.rule
    };
  }
  return null;
}

export function isMatchForm(userVal, formObj) {
  if (!userVal || !formObj) return false;
  const raw = userVal.trim();
  if (!raw) return false;

  const cleanUser = raw.replace(/\s+/g, '');
  const targetKanji = (formObj.kanji || '').replace(/\s+/g, '');
  const targetKana = (formObj.kana || '').replace(/\s+/g, '');

  if (cleanUser === targetKanji || cleanUser === targetKana) return true;

  const hira = toHiragana(raw).replace(/\s+/g, '');
  if (hira === targetKana) return true;

  const cleanRomaji = raw.toLowerCase().replace(/[^a-z]/g, '');
  const targetRomaji = (formObj.romaji || '').toLowerCase().replace(/[^a-z]/g, '');
  if (cleanRomaji && cleanRomaji === targetRomaji) return true;

  return false;
}

const ALLOWED_TYPES = new Set([
  'Danh từ', 'Động từ', 'Tính từ -i', 'Tính từ -na', 'Phó từ',
  'Lượng từ', 'Trợ từ', 'Liên từ', 'Cụm từ', 'Danh từ riêng', 'Đại từ', 'Từ để hỏi'
]);

export function isBypassPattern(val) {
  return /^~~\s*$/.test(val || '');
}

export function validateCardsData(data, filename = 'tệp JSON') {
  if (!Array.isArray(data)) {
    return { valid: false, error: `Dữ liệu trong "${filename}" không phải là một danh sách (Array).` };
  }
  if (data.length === 0) {
    return { valid: false, error: `Tệp "${filename}" không có mục từ vựng nào.` };
  }
  const requiredFields = ['id', 'term', 'reading', 'romaji', 'meaning', 'type'];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const itemLabel = `Mục #${item.id || (i + 1)} ("${item.term || 'trống'}")`;
    for (const f of requiredFields) {
      if (item[f] === undefined || item[f] === null || item[f] === '') {
        return { valid: false, error: `[${filename}] ${itemLabel}: Thiếu trường bắt buộc '${f}'!` };
      }
    }
    if (typeof item.id !== 'number' && !/^\d+$/.test(String(item.id))) {
      return { valid: false, error: `[${filename}] ${itemLabel}: Trường 'id' phải là số nguyên (nhận được: ${typeof item.id})!` };
    }
    if (!ALLOWED_TYPES.has(item.type)) {
      return {
        valid: false,
        error: `[${filename}] ${itemLabel}: Loại từ "${item.type}" không hợp lệ!\n\nChỉ chấp nhận các loại từ trong danh mục chuẩn.`
      };
    }
  }
  return { valid: true };
}

export function normalizeCardsData(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item, idx) => {
    const id = (item.id !== undefined && item.id !== null && item.id !== '') ? item.id : (idx + 1);
    const examples = Array.isArray(item.examples) && item.examples.length
      ? item.examples
      : (item.example && item.example.japanese ? [item.example] : []);
    const meanings = Array.isArray(item.meanings) && item.meanings.length
      ? item.meanings
      : (item.meaning ? [item.meaning] : []);
    return {
      ...item,
      id,
      meanings,
      examples,
      example: examples[0] || item.example || null
    };
  });
}
