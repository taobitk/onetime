export function normalizeVn(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function kataToHira(str) {
  return (str || '').replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export function normalizeJp(str) {
  if (!str) return '';
  const noPunct = String(str)
    .toLowerCase()
    .replace(/[\s\u3000。、？！?!.,:;・〜~…「」『』（）()[\]【】"'`\-_/\\|*^%$#@+=<>]/g, '')
    .trim();
  return kataToHira(noPunct);
}

export function matchesAnyCandidate(userVal, candidateList) {
  const u = normalizeJp(userVal);
  if (!u) return false;
  const cands = (candidateList || []).map(c => normalizeJp(c)).filter(Boolean);
  if (cands.includes(u)) return true;
  return cands.some(c => (u.length >= 2 && c.includes(u)) || (c.length >= 2 && u.includes(c)));
}

export function hiraToKata(str) {
  return (str || '').replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

export function stripBrackets(str) {
  return (str || '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, '').trim();
}

const romajiMap = {
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', tsu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ', ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', nn: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  tte: 'って', tta: 'った', tto: 'っと', tti: 'っち', ttu: 'っつ',
  kke: 'っけ', kka: 'っか', kko: 'っこ', kki: 'っき', kku: 'っく',
  sshi: 'っし', ssu: 'っす', sse: 'っせ', sso: 'っそ', ssa: 'っさ',
  cchi: 'っち', ppte: 'って',
  nde: 'んで', nda: 'んだ', ndo: 'んど', ndi: 'んぢ', ndu: 'んづ'
};

const sortedRomajiKeys = Object.keys(romajiMap).sort((a, b) => b.length - a.length);

export function toHiragana(text) {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const key of sortedRomajiKeys) {
    result = result.replace(new RegExp(key, 'g'), romajiMap[key]);
  }
  return result;
}
