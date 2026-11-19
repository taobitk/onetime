const { createApp, ref, computed, onMounted, onUnmounted, nextTick, watch } = Vue;

function normalizeVn(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function kataToHira(str) {
  return (str || '').replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// Bỏ qua toàn bộ khoảng trắng, dấu câu các kiểu theo yêu cầu của user
function normalizeJp(str) {
  if (!str) return '';
  const noPunct = String(str)
    .toLowerCase()
    .replace(/[\s\u3000。、？！?!.,:;・〜~…「」『』（）()[\]【】"'`\-_/\\|*^%$#@+=<>]/g, '')
    .trim();
  return kataToHira(noPunct);
}

function matchesAnyCandidate(userVal, candidateList) {
  const u = normalizeJp(userVal);
  if (!u) return false;
  const cands = (candidateList || []).map(c => normalizeJp(c)).filter(Boolean);

  // 1. So khớp chính xác sau khi bỏ dấu câu & khoảng trắng
  if (cands.includes(u)) return true;

  // 2. So khớp linh hoạt (chứa nhau) nếu chuỗi từ 2 ký tự trở lên
  return cands.some(c => (u.length >= 2 && c.includes(u)) || (c.length >= 2 && u.includes(c)));
}

function hiraToKata(str) {
  return (str || '').replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function stripBrackets(str) {
  return (str || '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, '').trim();
}

const romajiMap = {
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  'wa': 'わ', 'wo': 'を', 'nn': 'ん',
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  // Sokuon
  'tte': 'って', 'tta': 'った', 'tto': 'っと', 'tti': 'っち', 'ttu': 'っつ',
  'kke': 'っけ', 'kka': 'っか', 'kko': 'っこ', 'kki': 'っき', 'kku': 'っく',
  'sshi': 'っし', 'ssu': 'っす', 'sse': 'っせ', 'sso': 'っそ', 'ssa': 'っさ',
  'cchi': 'っち', 'ppte': 'って',
  // Hatsuan
  'nde': 'んで', 'nda': 'んだ', 'ndo': 'んど', 'ndi': 'んぢ', 'ndu': 'んづ'
};

const sortedRomajiKeys = Object.keys(romajiMap).sort((a, b) => b.length - a.length);

function toHiragana(text) {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const key of sortedRomajiKeys) {
    const regex = new RegExp(key, 'g');
    result = result.replace(regex, romajiMap[key]);
  }
  return result;
}

const VERBS_MASTER_DICT = [{ "lesson": 4, "id": 1, "group": 2, "masu_kanji": "起きます", "masu_kana": "おきます", "masu_romaji": "okimasu", "vru_kanji": "起きる", "vru_kana": "おきる", "vru_romaji": "okiru", "vte_kanji": "起きて", "vte_kana": "おきて", "vte_romaji": "okite", "rule": "Nhóm 2 (đặc biệt đuôi -i): Bỏ ます thêm て (hoặc 起きる: bỏ る thêm て)", "global_id": 1 }, { "lesson": 4, "id": 2, "group": 2, "masu_kanji": "寝ます", "masu_kana": "ねます", "masu_romaji": "nemasu", "vru_kanji": "寝る", "vru_kana": "ねる", "vru_romaji": "neru", "vte_kanji": "寝て", "vte_kana": "ねて", "vte_romaji": "nete", "rule": "Nhóm 2: Bỏ ます thêm て (hoặc 寝る: bỏ る thêm て)", "global_id": 2 }, { "lesson": 4, "id": 3, "group": 1, "masu_kanji": "働きます", "masu_kana": "はたらきます", "masu_romaji": "hatarakimasu", "vru_kanji": "働く", "vru_kana": "はたらく", "vru_romaji": "hataraku", "vte_kanji": "働いて", "vte_kana": "はたらいて", "vte_romaji": "hataraite", "rule": "Nhóm 1: き (ki) / く (ku) → いて (ite)", "global_id": 3 }, { "lesson": 4, "id": 4, "group": 1, "masu_kanji": "休みます", "masu_kana": "やすみます", "masu_romaji": "yasumimasu", "vru_kanji": "休む", "vru_kana": "やすむ", "vru_romaji": "yasumu", "vte_kanji": "休んで", "vte_kana": "やすんで", "vte_romaji": "yasunde", "rule": "Nhóm 1: み (mi) / む (mu) → んで (nde)", "global_id": 4 }, { "lesson": 4, "id": 5, "group": 3, "masu_kanji": "勉強します", "masu_kana": "べんきょうします", "masu_romaji": "benkyoushimasu", "vru_kanji": "勉強する", "vru_kana": "べんきょうする", "vru_romaji": "benkyousuru", "vte_kanji": "勉強して", "vte_kana": "べんきょうして", "vte_romaji": "benkyoushite", "rule": "Nhóm 3: します / する → して", "global_id": 5 }, { "lesson": 4, "id": 6, "group": 1, "masu_kanji": "終わります", "masu_kana": "おわります", "masu_romaji": "owarimasu", "vru_kanji": "終わる", "vru_kana": "おわる", "vru_romaji": "owaru", "vte_kanji": "終わって", "vte_kana": "おわって", "vte_romaji": "owatte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 6 }, { "lesson": 5, "id": 1, "group": 1, "masu_kanji": "行きます", "masu_kana": "いきます", "masu_romaji": "ikimasu", "vru_kanji": "行く", "vru_kana": "いく", "vru_romaji": "iku", "vte_kanji": "行って", "vte_kana": "いって", "vte_romaji": "itte", "rule": "ĐẶC BIỆT Nhóm 1: 行く → 行って (itte)", "global_id": 7 }, { "lesson": 5, "id": 2, "group": 3, "masu_kanji": "来ます", "masu_kana": "きます", "masu_romaji": "kimasu", "vru_kanji": "来る", "vru_kana": "くる", "vru_romaji": "kuru", "vte_kanji": "来て", "vte_kana": "きて", "vte_romaji": "kite", "rule": "Nhóm 3: 来ます (kimasu) / 来る (kuru) → 来て (kite)", "global_id": 8 }, { "lesson": 5, "id": 3, "group": 1, "masu_kanji": "帰ります", "masu_kana": "かえります", "masu_romaji": "kaerimasu", "vru_kanji": "帰る", "vru_kana": "かえる", "vru_romaji": "kaeru", "vte_kanji": "帰って", "vte_kana": "かえって", "vte_romaji": "kaette", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 9 }, { "lesson": 6, "id": 1, "group": 2, "masu_kanji": "食べます", "masu_kana": "たべます", "masu_romaji": "tabemasu", "vru_kanji": "食べる", "vru_kana": "たべる", "vru_romaji": "taberu", "vte_kanji": "食べて", "vte_kana": "たべて", "vte_romaji": "tabete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 10 }, { "lesson": 6, "id": 2, "group": 1, "masu_kanji": "飲みます", "masu_kana": "のみます", "masu_romaji": "nomimasu", "vru_kanji": "飲む", "vru_kana": "のむ", "vru_romaji": "nomu", "vte_kanji": "飲んで", "vte_kana": "のんで", "vte_romaji": "nonde", "rule": "Nhóm 1: み (mi) / む (mu) → んで (nde)", "global_id": 11 }, { "lesson": 6, "id": 3, "group": 1, "masu_kanji": "吸います", "masu_kana": "すいます", "masu_romaji": "suimasu", "vru_kanji": "吸う", "vru_kana": "すう", "vru_romaji": "suu", "vte_kanji": "吸って", "vte_kana": "すって", "vte_romaji": "sutte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 12 }, { "lesson": 6, "id": 4, "group": 2, "masu_kanji": "見ます", "masu_kana": "みます", "masu_romaji": "mimasu", "vru_kanji": "見る", "vru_kana": "みる", "vru_romaji": "miru", "vte_kanji": "見て", "vte_kana": "みて", "vte_romaji": "mite", "rule": "Nhóm 2 (đặc biệt đuôi -i): Bỏ ます / bỏ る thêm て", "global_id": 13 }, { "lesson": 6, "id": 5, "group": 1, "masu_kanji": "聞きます", "masu_kana": "ききます", "masu_romaji": "kikimasu", "vru_kanji": "聞く", "vru_kana": "きく", "vru_romaji": "kiku", "vte_kanji": "聞いて", "vte_kana": "きいて", "vte_romaji": "kiite", "rule": "Nhóm 1: き (ki) / く (ku) → いて (ite)", "global_id": 14 }, { "lesson": 6, "id": 6, "group": 1, "masu_kanji": "読みます", "masu_kana": "よみます", "masu_romaji": "yomimasu", "vru_kanji": "読む", "vru_kana": "よむ", "vru_romaji": "yomu", "vte_kanji": "読んで", "vte_kana": "よんで", "vte_romaji": "yonde", "rule": "Nhóm 1: み (mi) / む (mu) → んで (nde)", "global_id": 15 }, { "lesson": 6, "id": 7, "group": 1, "masu_kanji": "書きます", "masu_kana": "かきます", "masu_romaji": "kakimasu", "vru_kanji": "書く", "vru_kana": "かく", "vru_romaji": "kaku", "vte_kanji": "書いて", "vte_kana": "かいて", "vte_romaji": "kaite", "rule": "Nhóm 1: き (ki) / く (ku) → いて (ite)", "global_id": 16 }, { "lesson": 6, "id": 8, "group": 1, "masu_kanji": "買います", "masu_kana": "かいます", "masu_romaji": "kaimasu", "vru_kanji": "買う", "vru_kana": "かう", "vru_romaji": "kau", "vte_kanji": "買って", "vte_kana": "かって", "vte_romaji": "katte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 17 }, { "lesson": 6, "id": 9, "group": 1, "masu_kanji": "撮ります", "masu_kana": "とります", "masu_romaji": "torimasu", "vru_kanji": "撮る", "vru_kana": "とる", "vru_romaji": "toru", "vte_kanji": "撮って", "vte_kana": "とって", "vte_romaji": "totte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 18 }, { "lesson": 6, "id": 10, "group": 3, "masu_kanji": "します", "masu_kana": "します", "masu_romaji": "shimasu", "vru_kanji": "する", "vru_kana": "する", "vru_romaji": "suru", "vte_kanji": "して", "vte_kana": "して", "vte_romaji": "shite", "rule": "Nhóm 3: します / する → して", "global_id": 19 }, { "lesson": 6, "id": 11, "group": 1, "masu_kanji": "会います", "masu_kana": "あいます", "masu_romaji": "aimasu", "vru_kanji": "会う", "vru_kana": "あう", "vru_romaji": "au", "vte_kanji": "会って", "vte_kana": "あって", "vte_romaji": "atte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 20 }, { "lesson": 7, "id": 1, "group": 1, "masu_kanji": "切ります", "masu_kana": "きります", "masu_romaji": "kirimasu", "vru_kanji": "切る", "vru_kana": "きる", "vru_romaji": "kiru", "vte_kanji": "切って", "vte_kana": "きって", "vte_romaji": "kitte", "rule": "Nhóm 1 (ngoại lệ âm i): り (ri) / る (ru) → って (tte)", "global_id": 21 }, { "lesson": 7, "id": 2, "group": 1, "masu_kanji": "送ります", "masu_kana": "おくります", "masu_romaji": "okurimasu", "vru_kanji": "送る", "vru_kana": "おくる", "vru_romaji": "okuru", "vte_kanji": "送って", "vte_kana": "おくって", "vte_romaji": "okutte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 22 }, { "lesson": 7, "id": 3, "group": 2, "masu_kanji": "あげます", "masu_kana": "あげます", "masu_romaji": "agemasu", "vru_kanji": "あげる", "vru_kana": "あげる", "vru_romaji": "ageru", "vte_kanji": "あげて", "vte_kana": "あげて", "vte_romaji": "agete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 23 }, { "lesson": 7, "id": 4, "group": 1, "masu_kanji": "もらいます", "masu_kana": "もらいます", "masu_romaji": "moraimasu", "vru_kanji": "もらう", "vru_kana": "もらう", "vru_romaji": "morau", "vte_kanji": "もらって", "vte_kana": "もらって", "vte_romaji": "moratte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 24 }, { "lesson": 7, "id": 5, "group": 1, "masu_kanji": "貸します", "masu_kana": "かします", "masu_romaji": "kashimasu", "vru_kanji": "貸す", "vru_kana": "かす", "vru_romaji": "kasu", "vte_kanji": "貸して", "vte_kana": "かして", "vte_romaji": "kashite", "rule": "Nhóm 1: し (shi) / す (su) → して (shite)", "global_id": 25 }, { "lesson": 7, "id": 6, "group": 2, "masu_kanji": "借ります", "masu_kana": "かります", "masu_romaji": "karimasu", "vru_kanji": "借りる", "vru_kana": "かりる", "vru_romaji": "kariru", "vte_kanji": "借りて", "vte_kana": "かりて", "vte_romaji": "karite", "rule": "Nhóm 2 (đặc biệt đuôi -i): Bỏ ます / bỏ る thêm て", "global_id": 26 }, { "lesson": 7, "id": 7, "group": 2, "masu_kanji": "教えます", "masu_kana": "おしえます", "masu_romaji": "oshiemasu", "vru_kanji": "教える", "vru_kana": "おしえる", "vru_romaji": "oshieru", "vte_kanji": "教えて", "vte_kana": "おしえて", "vte_romaji": "oshiete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 27 }, { "lesson": 7, "id": 8, "group": 1, "masu_kanji": "習います", "masu_kana": "ならいます", "masu_romaji": "naraimasu", "vru_kanji": "習う", "vru_kana": "ならう", "vru_romaji": "narau", "vte_kanji": "習って", "vte_kana": "ならって", "vte_romaji": "naratte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 28 }, { "lesson": 7, "id": 9, "group": 2, "masu_kanji": "かけます", "masu_kana": "かけます", "masu_romaji": "kakemasu", "vru_kanji": "かける", "vru_kana": "かける", "vru_romaji": "kakeru", "vte_kanji": "かけて", "vte_kana": "かけて", "vte_romaji": "kakete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 29 }, { "lesson": 9, "id": 1, "group": 1, "masu_kanji": "わかります", "masu_kana": "わかります", "masu_romaji": "wakarimasu", "vru_kanji": "わかる", "vru_kana": "わかる", "vru_romaji": "wakaru", "vte_kanji": "わかって", "vte_kana": "わかって", "vte_romaji": "wakatte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 30 }, { "lesson": 9, "id": 2, "group": 1, "masu_kanji": "あります", "masu_kana": "あります", "masu_romaji": "arimasu", "vru_kanji": "ある", "vru_kana": "ある", "vru_romaji": "aru", "vte_kanji": "あって", "vte_kana": "あって", "vte_romaji": "atte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 31 }, { "lesson": 10, "id": 1, "group": 2, "masu_kanji": "います", "masu_kana": "います", "masu_romaji": "imasu", "vru_kanji": "いる", "vru_kana": "いる", "vru_romaji": "iru", "vte_kanji": "いて", "vte_kana": "いて", "vte_romaji": "ite", "rule": "Nhóm 2 (đặc biệt đuôi -i): Bỏ ます / bỏ る thêm て", "global_id": 32 }, { "lesson": 11, "id": 3, "group": 1, "masu_kanji": "かかります", "masu_kana": "かかります", "masu_romaji": "kakarimasu", "vru_kanji": "かかる", "vru_kana": "かかる", "vru_romaji": "kakaru", "vte_kanji": "かかって", "vte_kana": "かかって", "vte_romaji": "kakatte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 33 }, { "lesson": 13, "id": 1, "group": 1, "masu_kanji": "遊びます", "masu_kana": "あそびます", "masu_romaji": "asobimasu", "vru_kanji": "遊ぶ", "vru_kana": "あそぶ", "vru_romaji": "asobu", "vte_kanji": "遊んで", "vte_kana": "あそんで", "vte_romaji": "asonde", "rule": "Nhóm 1: び (bi) / ぶ (bu) → んで (nde)", "global_id": 34 }, { "lesson": 13, "id": 2, "group": 1, "masu_kanji": "泳ぎます", "masu_kana": "およぎます", "masu_romaji": "oyogimasu", "vru_kanji": "泳ぐ", "vru_kana": "およぐ", "vru_romaji": "oyogu", "vte_kanji": "泳いで", "vte_kana": "およいで", "vte_romaji": "oyoide", "rule": "Nhóm 1: ぎ (gi) / ぐ (gu) → いで (ide)", "global_id": 35 }, { "lesson": 13, "id": 3, "group": 2, "masu_kanji": "迎えます", "masu_kana": "むかえます", "masu_romaji": "mukaemasu", "vru_kanji": "迎える", "vru_kana": "むかえる", "vru_romaji": "mukaeru", "vte_kanji": "迎えて", "vte_kana": "むかえて", "vte_romaji": "mukaete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 36 }, { "lesson": 13, "id": 4, "group": 2, "masu_kanji": "疲れます", "masu_kana": "つかれます", "masu_romaji": "tsukaremasu", "vru_kanji": "疲れる", "vru_kana": "つかれる", "vru_romaji": "tsukareru", "vte_kanji": "疲れて", "vte_kana": "つかれて", "vte_romaji": "tsukarete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 37 }, { "lesson": 13, "id": 5, "group": 1, "masu_kanji": "出します", "masu_kana": "だします", "masu_romaji": "dashimasu", "vru_kanji": "出す", "vru_kana": "だす", "vru_romaji": "dasu", "vte_kanji": "出して", "vte_kana": "だして", "vte_romaji": "dashite", "rule": "Nhóm 1: し (shi) / す (su) → して (shite)", "global_id": 38 }, { "lesson": 13, "id": 6, "group": 1, "masu_kanji": "入ります", "masu_kana": "はいります", "masu_romaji": "hairimasu", "vru_kanji": "入る", "vru_kana": "はいる", "vru_romaji": "hairu", "vte_kanji": "入って", "vte_kana": "はいって", "vte_romaji": "haitte", "rule": "Nhóm 1 (ngoại lệ âm i): り (ri) / る (ru) → って (tte)", "global_id": 39 }, { "lesson": 13, "id": 7, "group": 2, "masu_kanji": "出ます", "masu_kana": "でます", "masu_romaji": "demasu", "vru_kanji": "出る", "vru_kana": "でる", "vru_romaji": "deru", "vte_kanji": "出て", "vte_kana": "でて", "vte_romaji": "dete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 40 }, { "lesson": 13, "id": 8, "group": 3, "masu_kanji": "結婚します", "masu_kana": "けっこんします", "masu_romaji": "kekkonshimasu", "vru_kanji": "結婚する", "vru_kana": "けっこんする", "vru_romaji": "kekkonsuru", "vte_kanji": "結婚して", "vte_kana": "けっこんして", "vte_romaji": "kekkonshite", "rule": "Nhóm 3: します / する → して", "global_id": 41 }, { "lesson": 13, "id": 9, "group": 3, "masu_kanji": "買い物します", "masu_kana": "かいものします", "masu_romaji": "kaimonoshimasu", "vru_kanji": "買い物する", "vru_kana": "かいものする", "vru_romaji": "kaimonosuru", "vte_kanji": "買い物して", "vte_kana": "かいものして", "vte_romaji": "kaimonoshite", "rule": "Nhóm 3: します / する → して", "global_id": 42 }, { "lesson": 13, "id": 10, "group": 3, "masu_kanji": "食事します", "masu_kana": "しょくじします", "masu_romaji": "shokujishimasu", "vru_kanji": "食事する", "vru_kana": "しょくじする", "vru_romaji": "shokujisuru", "vte_kanji": "食事して", "vte_kana": "しょくじして", "vte_romaji": "shokujishite", "rule": "Nhóm 3: します / する → して", "global_id": 43 }, { "lesson": 13, "id": 11, "group": 3, "masu_kanji": "散歩します", "masu_kana": "さんぽします", "masu_romaji": "sanposhimasu", "vru_kanji": "散歩する", "vru_kana": "さんぽする", "vru_romaji": "sanposuru", "vte_kanji": "散歩して", "vte_kana": "さんぽして", "vte_romaji": "sanposhite", "rule": "Nhóm 3: します / する → して", "global_id": 44 }, { "lesson": 14, "id": 1, "group": 2, "masu_kanji": "つけます", "masu_kana": "つけます", "masu_romaji": "tsukemasu", "vru_kanji": "つける", "vru_kana": "つける", "vru_romaji": "tsukeru", "vte_kanji": "つけて", "vte_kana": "つけて", "vte_romaji": "tsukete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 45 }, { "lesson": 14, "id": 2, "group": 1, "masu_kanji": "消します", "masu_kana": "けします", "masu_romaji": "keshimasu", "vru_kanji": "消す", "vru_kana": "けす", "vru_romaji": "kesu", "vte_kanji": "消して", "vte_kana": "けして", "vte_romaji": "keshite", "rule": "Nhóm 1: し (shi) / す (su) → して (shite)", "global_id": 46 }, { "lesson": 14, "id": 3, "group": 2, "masu_kanji": "開けます", "masu_kana": "あけます", "masu_romaji": "akemasu", "vru_kanji": "開ける", "vru_kana": "あける", "vru_romaji": "akeru", "vte_kanji": "開けて", "vte_kana": "あけて", "vte_romaji": "akete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 47 }, { "lesson": 14, "id": 4, "group": 2, "masu_kanji": "閉めます", "masu_kana": "しめます", "masu_romaji": "shimemasu", "vru_kanji": "閉める", "vru_kana": "しめる", "vru_romaji": "shimeru", "vte_kanji": "閉めて", "vte_kana": "しめて", "vte_romaji": "shimete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 48 }, { "lesson": 14, "id": 5, "group": 1, "masu_kanji": "急ぎます", "masu_kana": "いそぎます", "masu_romaji": "isogimasu", "vru_kanji": "急ぐ", "vru_kana": "いそぐ", "vru_romaji": "isogu", "vte_kanji": "急いで", "vte_kana": "いそいで", "vte_romaji": "isoide", "rule": "Nhóm 1: ぎ (gi) / ぐ (gu) → いで (ide)", "global_id": 49 }, { "lesson": 14, "id": 6, "group": 1, "masu_kanji": "待ちます", "masu_kana": "まちます", "masu_romaji": "machimasu", "vru_kanji": "待つ", "vru_kana": "まつ", "vru_romaji": "matsu", "vte_kanji": "待って", "vte_kana": "まって", "vte_romaji": "matte", "rule": "Nhóm 1: ち (chi) / つ (tsu) → って (tte)", "global_id": 50 }, { "lesson": 14, "id": 7, "group": 2, "masu_kanji": "止めます", "masu_kana": "とめます", "masu_romaji": "tomemasu", "vru_kanji": "止める", "vru_kana": "とめる", "vru_romaji": "tomeru", "vte_kanji": "止めて", "vte_kana": "とめて", "vte_romaji": "tomete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 51 }, { "lesson": 14, "id": 8, "group": 1, "masu_kanji": "曲がります", "masu_kana": "まがります", "masu_romaji": "magarimasu", "vru_kanji": "曲がる", "vru_kana": "まがる", "vru_romaji": "magaru", "vte_kanji": "曲がって", "vte_kana": "まがって", "vte_romaji": "magatte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 52 }, { "lesson": 14, "id": 9, "group": 1, "masu_kanji": "持ちます", "masu_kana": "もちます", "masu_romaji": "mochimasu", "vru_kanji": "持つ", "vru_kana": "もつ", "vru_romaji": "motsu", "vte_kanji": "持って", "vte_kana": "もって", "vte_romaji": "motte", "rule": "Nhóm 1: ち (chi) / つ (tsu) → って (tte)", "global_id": 53 }, { "lesson": 14, "id": 10, "group": 1, "masu_kanji": "取ります", "masu_kana": "とります", "masu_romaji": "torimasu", "vru_kanji": "取る", "vru_kana": "とる", "vru_romaji": "toru", "vte_kanji": "取って", "vte_kana": "とって", "vte_romaji": "totte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 54 }, { "lesson": 14, "id": 11, "group": 1, "masu_kanji": "手伝います", "masu_kana": "てつだいます", "masu_romaji": "tetsudaimasu", "vru_kanji": "手伝う", "vru_kana": "てつだう", "vru_romaji": "tetsudau", "vte_kanji": "手伝って", "vte_kana": "てつだって", "vte_romaji": "tetsudatte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 55 }, { "lesson": 14, "id": 12, "group": 1, "masu_kanji": "呼びます", "masu_kana": "よびます", "masu_romaji": "yobimasu", "vru_kanji": "呼ぶ", "vru_kana": "よぶ", "vru_romaji": "yobu", "vte_kanji": "呼んで", "vte_kana": "よんで", "vte_romaji": "yonde", "rule": "Nhóm 1: び (bi) / ぶ (bu) → んで (nde)", "global_id": 56 }, { "lesson": 14, "id": 13, "group": 1, "masu_kanji": "話します", "masu_kana": "はなします", "masu_romaji": "hanashimasu", "vru_kanji": "話す", "vru_kana": "はなす", "vru_romaji": "hanasu", "vte_kanji": "話して", "vte_kana": "はなして", "vte_romaji": "hanashite", "rule": "Nhóm 1: し (shi) / す (su) → して (shite)", "global_id": 57 }, { "lesson": 14, "id": 14, "group": 2, "masu_kanji": "見せます", "masu_kana": "みせます", "masu_romaji": "misemasu", "vru_kanji": "見せる", "vru_kana": "みせる", "vru_romaji": "miseru", "vte_kanji": "見せて", "vte_kana": "みせて", "vte_romaji": "misete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 58 }, { "lesson": 14, "id": 16, "group": 2, "masu_kanji": "始めます", "masu_kana": "はじめます", "masu_romaji": "hajimemasu", "vru_kanji": "始める", "vru_kana": "はじめる", "vru_romaji": "hajimeru", "vte_kanji": "始めて", "vte_kana": "はじめて", "vte_romaji": "hajimete", "rule": "Nhóm 2: Bỏ ます / bỏ る thêm て", "global_id": 59 }, { "lesson": 14, "id": 17, "group": 1, "masu_kanji": "降ります", "masu_kana": "ふります", "masu_romaji": "furimasu", "vru_kanji": "降る", "vru_kana": "ふる", "vru_romaji": "furu", "vte_kanji": "降って", "vte_kana": "ふって", "vte_romaji": "futte", "rule": "Nhóm 1 (ngoại lệ âm i): り (ri) / る (ru) → って (tte)", "global_id": 60 }, { "lesson": 14, "id": 18, "group": 3, "masu_kanji": "コピーします", "masu_kana": "こぴーします", "masu_romaji": "kopiishimasu", "vru_kanji": "コピーする", "vru_kana": "こぴーする", "vru_romaji": "kopiisuru", "vte_kanji": "コピーして", "vte_kana": "こぴーして", "vte_romaji": "kopiishite", "rule": "Nhóm 3: します / する → して", "global_id": 61 }, { "lesson": 15, "id": 1, "group": 1, "masu_kanji": "立ちます", "masu_kana": "たちます", "masu_romaji": "tachimasu", "vru_kanji": "立つ", "vru_kana": "たつ", "vru_romaji": "tatsu", "vte_kanji": "立って", "vte_kana": "たって", "vte_romaji": "tatte", "rule": "Nhóm 1: ち (chi) / つ (tsu) → って (tte)", "global_id": 62 }, { "lesson": 15, "id": 2, "group": 1, "masu_kanji": "座ります", "masu_kana": "すわります", "masu_romaji": "suwarimasu", "vru_kanji": "座る", "vru_kana": "すわる", "vru_romaji": "suwaru", "vte_kanji": "座って", "vte_kana": "すわって", "vte_romaji": "suwatte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 63 }, { "lesson": 15, "id": 3, "group": 1, "masu_kanji": "使います", "masu_kana": "つかいます", "masu_romaji": "tsukaimasu", "vru_kanji": "使う", "vru_kana": "つかう", "vru_romaji": "tsukau", "vte_kanji": "使って", "vte_kana": "つかって", "vte_romaji": "tsukatte", "rule": "Nhóm 1: い (i) / う (u) → って (tte)", "global_id": 64 }, { "lesson": 15, "id": 4, "group": 1, "masu_kanji": "置きます", "masu_kana": "おきます", "masu_romaji": "okimasu", "vru_kanji": "置く", "vru_kana": "おく", "vru_romaji": "oku", "vte_kanji": "置いて", "vte_kana": "おいて", "vte_romaji": "oite", "rule": "Nhóm 1: き (ki) / く (ku) → いて (ite)", "global_id": 65 }, { "lesson": 15, "id": 5, "group": 1, "masu_kanji": "作ります", "masu_kana": "つくります", "masu_romaji": "tsukurimasu", "vru_kanji": "作る", "vru_kana": "つくる", "vru_romaji": "tsukuru", "vte_kanji": "作って", "vte_kana": "つくって", "vte_romaji": "tsukutte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 66 }, { "lesson": 15, "id": 6, "group": 1, "masu_kanji": "売ります", "masu_kana": "うります", "masu_romaji": "urimasu", "vru_kanji": "売る", "vru_kana": "うる", "vru_romaji": "uru", "vte_kanji": "売って", "vte_kana": "うって", "vte_romaji": "utte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 67 }, { "lesson": 15, "id": 7, "group": 1, "masu_kanji": "知ります", "masu_kana": "しります", "masu_romaji": "shirimasu", "vru_kanji": "知る", "vru_kana": "しる", "vru_romaji": "shiru", "vte_kanji": "知って", "vte_kana": "しって", "vte_romaji": "shitte", "rule": "Nhóm 1: り (ri) / る (ru) → って (tte)", "global_id": 68 }, { "lesson": 15, "id": 8, "group": 1, "masu_kanji": "住みます", "masu_kana": "すみます", "masu_romaji": "sumimasu", "vru_kanji": "住む", "vru_kana": "すむ", "vru_romaji": "sumu", "vte_kanji": "住んで", "vte_kana": "すんで", "vte_romaji": "sunde", "rule": "Nhóm 1: み (mi) / む (mu) → んで (nde)", "global_id": 69 }, { "lesson": 15, "id": 9, "group": 3, "masu_kanji": "研究します", "masu_kana": "けんきゅうします", "masu_romaji": "kenkyuushimasu", "vru_kanji": "研究する", "vru_kana": "けんきゅうする", "vru_romaji": "kenkyuusuru", "vte_kanji": "研究して", "vte_kana": "けんきゅうして", "vte_romaji": "kenkyuushite", "rule": "Nhóm 3: します / する → して", "global_id": 70 }, { "lesson": 15, "id": 10, "group": 1, "masu_kanji": "知っています", "masu_kana": "しっています", "masu_romaji": "shitte imasu", "vru_kanji": "知っている", "vru_kana": "しっている", "vru_romaji": "shitte iru", "vte_kanji": "知っていて", "vte_kana": "しっていて", "vte_romaji": "shitte ite", "rule": "Nhóm 1 (dạng trạng thái ています/ている)", "global_id": 71 }, { "lesson": 15, "id": 11, "group": 1, "masu_kanji": "住んでいます", "masu_kana": "すんでいます", "masu_romaji": "sunde imasu", "vru_kanji": "住んでいる", "vru_kana": "すんでいる", "vru_romaji": "sunde iru", "vte_kanji": "住んでいて", "vte_kana": "すんでいて", "vte_romaji": "sunde ite", "rule": "Nhóm 1 (dạng trạng thái ています/ている)", "global_id": 72 }, { "lesson": 15, "id": 12, "group": 1, "masu_kanji": "思い出します", "masu_kana": "おもいだします", "masu_romaji": "omoidashimasu", "vru_kanji": "思い出す", "vru_kana": "おもいだす", "vru_romaji": "omoidasu", "vte_kanji": "思い出して", "vte_kana": "おもいだして", "vte_romaji": "omoidashite", "rule": "Nhóm 1: し (shi) / す (su) → して (shite)", "global_id": 73 }, { "lesson": 15, "id": 13, "group": 1, "masu_kanji": "いらっしゃいます", "masu_kana": "いらっしゃいます", "masu_romaji": "irasshaimasu", "vru_kanji": "いらっしゃる", "vru_kana": "いらっしゃる", "vru_romaji": "irassharu", "vte_kanji": "いらっしゃって", "vte_kana": "いらっしゃって", "vte_romaji": "irasshatte", "rule": "Nhóm 1 (kính ngữ đặc biệt): り → って", "global_id": 74 }];

function getCardForms(card) {
  if (!card) return null;
  if (card.forms && card.forms.masu && card.forms.vru && card.forms.vte) {
    return card.forms;
  }
  const cleanTerm = (card.term || '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, '').trim();
  const cleanReading = (card.reading || '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, '').trim();
  const found = VERBS_MASTER_DICT.find(v =>
    v.masu_kanji === cleanTerm || v.vru_kanji === cleanTerm || v.vte_kanji === cleanTerm ||
    v.masu_kana === cleanReading || v.vru_kana === cleanReading || v.vte_kana === cleanReading ||
    (card.lesson && v.lesson === card.lesson && v.id === card.id)
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

function isMatchForm(userVal, formObj) {
  if (!formObj) return false;
  const raw = (userVal || '').trim();
  if (!raw) return false;
  const u = normalizeJp(raw);
  const uHira = normalizeJp(toHiragana(raw));
  const candidates = [
    normalizeJp(formObj.kana),
    normalizeJp(formObj.kanji),
    normalizeJp(toHiragana(formObj.romaji))
  ].filter(Boolean);

  if (candidates.includes(u) || candidates.includes(uHira)) return true;

  const cleanRomaji = raw.toLowerCase().replace(/[^a-z]/g, '');
  const targetRomaji = (formObj.romaji || '').toLowerCase().replace(/[^a-z]/g, '');
  if (cleanRomaji && cleanRomaji === targetRomaji) return true;

  return false;
}


const ALLOWED_TYPES = new Set([
  "Danh từ",
  "Động từ",
  "Tính từ -i",
  "Tính từ -na",
  "Phó từ",
  "Lượng từ",
  "Trợ từ",
  "Liên từ",
  "Cụm từ",
  "Danh từ riêng",
  "Đại từ",
  "Từ để hỏi"
]);

function isBypassPattern(val) {
  return /^~~\s*$/.test(val || '');
}

function validateCardsData(data, filename = 'tệp JSON') {
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
        error: `[${filename}] ${itemLabel}: Loại từ "${item.type}" không hợp lệ!\n\nChỉ chấp nhận các loại từ trong danh mục chuẩn:\n- Danh từ, Động từ, Tính từ -i, Tính từ -na, Phó từ\n- Lượng từ, Trợ từ, Liên từ, Cụm từ, Danh từ riêng, Đại từ, Từ để hỏi.`
      };
    }
  }
  return { valid: true };
}

function normalizeCardsData(data) {
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

createApp({
  setup() {
    const allCards = ref([]);
    const currentIndex = ref(0);
    const practiceMode = ref('jp-to-vn');
    const scopeFilter = ref('all');
    const showFurigana = ref(true);
    const showVietnamese = ref(localStorage.getItem('minna_show_vn') !== 'false');

    function toggleVietnamese() {
      showVietnamese.value = !showVietnamese.value;
      localStorage.setItem('minna_show_vn', showVietnamese.value);
    }

    const isShuffle = ref(false);
    const speechRate = ref(1.0);
    const showLookupModal = ref(false);
    const vocabFilter = ref('enabled'); // 'enabled' | 'disabled' | 'all'
    const searchQuery = ref('');
    const loadError = ref(false);
    const cacheVersion = ref(Date.now());
    let cacheVerifyPromise = null;

    // Lesson & Edge-TTS state
    const currentLesson = ref('bai_4');
    const currentLessonDisplay = computed(() => {
      const l = currentLesson.value || 'bai_4';
      if (l.includes('+')) {
        return l.split('+').map(p => p.replace(/_/g, ' ')).join(', ');
      }
      return l.replace(/_/g, ' ');
    });
    const currentLessonBadge = computed(() => {
      const l = currentLesson.value || '';
      if (l.includes('+')) {
        const parts = l.split('+');
        return parts.length > 2 ? `${parts.length}B` : parts.map(p => {
          const m = p.match(/\d+/);
          return m ? ('B' + m[0]) : p.slice(0, 2).toUpperCase();
        }).join('+');
      }
      const m = l.match(/\d+/);
      return m ? ('B' + m[0]) : (l ? l.slice(0, 2).toUpperCase() : 'N5');
    });
    const currentLessonTitle = computed(() => {
      const l = currentLesson.value || '';
      if (l.includes('+')) {
        const parts = l.split('+');
        return `Đa bài học (${parts.length} bài)`;
      }
      const m = l.match(/\d+/);
      return m ? `Bài ${m[0]}` : currentLessonDisplay.value;
    });

    // Word Type Filter & Blind Listening Mode state
    const selectedTypeFilter = ref('all');
    const isBlindMode = ref(false);
    const isBlindRevealed = ref(false);

    function toggleBlindMode() {
      isBlindMode.value = !isBlindMode.value;
      if (isBlindMode.value && currentCard.value) {
        speak(currentCard.value.reading || currentCard.value.term);
      }
    }

    function setTypeFilter(type) {
      selectedTypeFilter.value = type;
      currentIndex.value = 0;
      resetCardState();
    }

    // Voice Selection: 'voicevox' | 'edge' | 'webspeech'
    const storedVoice = localStorage.getItem('preferred_voice') || 'voicevox';
    const selectedVoice = ref((storedVoice === 'zundamon' || storedVoice === 'shikoku_metan_normal') ? 'voicevox' : storedVoice);

    // Thông tin model & style VOICEVOX đang chọn
    let initSpeakerId = 3;
    let initSpeakerName = 'ずんだもん';
    let initSpeakerStyle = 'ノーマル';
    if (storedVoice === 'shikoku_metan_normal') {
      initSpeakerId = 2;
      initSpeakerName = '四国めたん';
      initSpeakerStyle = 'ノーマル';
    } else {
      const savedId = localStorage.getItem('preferred_speaker_id');
      if (savedId) initSpeakerId = parseInt(savedId);
      const savedName = localStorage.getItem('preferred_speaker_name');
      if (savedName) initSpeakerName = savedName;
      const savedStyle = localStorage.getItem('preferred_speaker_style');
      if (savedStyle) initSpeakerStyle = savedStyle;
    }

    const selectedSpeakerId = ref(initSpeakerId);
    const selectedSpeakerName = ref(initSpeakerName);
    const selectedSpeakerStyle = ref(initSpeakerStyle);

    // Toàn bộ Model & Phong cách VOICEVOX (40+ nhân vật, 120+ styles)
    const allSpeakers = ref([]);
    const speakerSearch = ref('');
    const speakerCategory = ref('all'); // 'all' | 'female' | 'male' | 'mascot'
    const showSpeakerModal = ref(false);
    const isPreviewLoading = ref(false);

    // Live Text-to-Speech Playground
    const customTtsText = ref('');
    const showTtsBar = ref(false);

    function toggleTtsBar() {
      showTtsBar.value = !showTtsBar.value;
    }

    function getSpeakerIcon(name) {
      if (!name) return '✨';
      if (name.includes('ずんだもん')) return '💚';
      if (name.includes('めたん')) return '🌸';
      if (name.includes('つむぎ')) return '🎀';
      if (name.includes('きりたん')) return '🎧';
      if (name.includes('リツ')) return '👑';
      if (name.includes('龍星') || name.includes('武宏') || name.includes('虎太郎') || name.includes('宗麟')) return '🎙️';
      if (name.includes('うさぎ') || name.includes('あんこもん')) return '🐰';
      if (name.includes('ミコ') || name.includes('ナナ') || name.includes('はう')) return '🍭';
      return '✨';
    }

    function getSpeakerCategory(name) {
      const maleNames = ['青山龍星', '玄野武宏', '白上虎太郎', '剣崎雌雄', '後鬼', 'ちび式じい', '雀松朱司', '麒ヶ島宗麟', '栗田まろん', '黒沢冴白'];
      const mascotNames = ['ずんだもん', '中国うさぎ', 'あんこもん', 'もち子さん'];
      if (maleNames.includes(name)) return 'male';
      if (mascotNames.includes(name)) return 'mascot';
      return 'female';
    }

    const filteredSpeakers = computed(() => {
      let list = allSpeakers.value;
      if (speakerCategory.value !== 'all') {
        list = list.filter(spk => getSpeakerCategory(spk.name) === speakerCategory.value);
      }
      const q = speakerSearch.value.trim().toLowerCase();
      if (!q) return list;

      return list.filter(spk => {
        const nameMatch = spk.name.toLowerCase().includes(q);
        const styleMatch = (spk.styles || []).some(st => (st.name || '').toLowerCase().includes(q));
        return nameMatch || styleMatch;
      });
    });

    async function fetchSpeakers() {
      try {
        const res = await fetch(`${API_BASE}/api/speakers`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            allSpeakers.value = list;
          }
        }
      } catch (e) {
        console.warn('Không thể tải danh sách speakers:', e);
      }
    }

    function selectVoicevoxSpeaker(speaker, style) {
      selectedSpeakerId.value = style.id;
      selectedSpeakerName.value = speaker.name;
      selectedSpeakerStyle.value = style.name;
      selectedVoice.value = 'voicevox';
      localStorage.setItem('preferred_voice', 'voicevox');
      localStorage.setItem('preferred_speaker_id', String(style.id));
      localStorage.setItem('preferred_speaker_name', speaker.name);
      localStorage.setItem('preferred_speaker_style', style.name);
      updateAudioPaths();
      // Chào ngắn kiểm tra giọng
      previewVoicevoxSpeaker(style.id, `こんにちは！${speaker.name}です。`);
    }

    function previewVoicevoxSpeaker(speakerId, customText = null) {
      const text = customText || `こんにちは！${selectedSpeakerName.value}です。`;
      const url = `${API_BASE}/api/voicevox?text=${encodeURIComponent(text)}&speaker=${speakerId}&is_word=0`;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }
      const audio = new Audio(url);
      audio.playbackRate = speechRate.value;
      activeAudio = audio;
      isPreviewLoading.value = true;
      audio.onended = () => { isPreviewLoading.value = false; };
      audio.onerror = () => { isPreviewLoading.value = false; };
      audio.play().then(() => {
        isPreviewLoading.value = false;
      }).catch(err => {
        isPreviewLoading.value = false;
        console.warn('Preview play error:', err);
      });
    }

    function speakCustomText() {
      const text = (customTtsText.value || '').trim();
      if (!text) return;
      if (selectedVoice.value === 'webspeech') {
        fallbackWebSpeech(text, true);
        return;
      }
      const speakerId = selectedVoice.value === 'voicevox' ? selectedSpeakerId.value : 3;
      const liveUrl = `${API_BASE}/api/voicevox?text=${encodeURIComponent(text)}&speaker=${speakerId}&is_word=0`;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }
      const audio = new Audio(liveUrl);
      audio.playbackRate = speechRate.value;
      activeAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => fallbackWebSpeech(text, true));
      }
    }

    function setVoice(voice, speakerId = null, speakerName = null, speakerStyle = null) {
      if (voice === 'voicevox') {
        selectedVoice.value = 'voicevox';
        if (speakerId !== null) {
          selectedSpeakerId.value = speakerId;
          selectedSpeakerName.value = speakerName || 'VOICEVOX';
          selectedSpeakerStyle.value = speakerStyle || 'ノーマル';
          localStorage.setItem('preferred_speaker_id', String(speakerId));
          localStorage.setItem('preferred_speaker_name', selectedSpeakerName.value);
          localStorage.setItem('preferred_speaker_style', selectedSpeakerStyle.value);
        }
      } else {
        selectedVoice.value = voice;
      }
      localStorage.setItem('preferred_voice', selectedVoice.value);
      updateAudioPaths();
    }

    const edgeStatus = ref('synced'); // 'connecting' | 'synced' | 'syncing' | 'fallback'
    const edgeSyncMsg = ref('Kiến trúc Stream GPU 100% (Phát chuẩn theo từ, không bao giờ lệch file)');
    const edgeUpdatedCount = ref(0);

    const edgeIcon = computed(() => {
      if (selectedVoice.value === 'voicevox') return getSpeakerIcon(selectedSpeakerName.value);
      if (selectedVoice.value === 'edge') return '⚡';
      if (selectedVoice.value === 'webspeech') return '🌐';
      return '⚡';
    });

    const edgeStatusText = computed(() => {
      if (selectedVoice.value === 'voicevox') {
        return `${selectedSpeakerName.value} (${selectedSpeakerStyle.value}) - GPU Stream trực tiếp (RTX 3060)`;
      }
      if (selectedVoice.value === 'edge') return `Edge-TTS (Stream trực tiếp)`;
      if (selectedVoice.value === 'webspeech') return 'Web Speech (Trình duyệt)';
      return 'GPU Stream trực tiếp';
    });

    const edgeBadgeClass = computed(() => {
      if (edgeStatus.value === 'syncing') return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      if (selectedVoice.value === 'voicevox') {
        if (selectedSpeakerName.value.includes('ずんだもん')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (selectedSpeakerName.value.includes('めたん')) return 'bg-pink-50 text-pink-700 border-pink-200';
        if (selectedSpeakerName.value.includes('つむぎ')) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-purple-50 text-purple-700 border-purple-200';
      }
      if (selectedVoice.value === 'edge') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      if (selectedVoice.value === 'webspeech') return 'bg-slate-100 text-slate-600 border-slate-200';
      return 'bg-slate-100 text-slate-500 border-slate-200';
    });

    const isFocusMode = ref(false);
    const isHeaderHidden = ref(false);
    const isToolbarHidden = ref(false);

    function toggleFocusMode() {
      isFocusMode.value = !isFocusMode.value;
    }

    function toggleHeader() {
      isHeaderHidden.value = !isHeaderHidden.value;
    }

    function toggleToolbar() {
      isToolbarHidden.value = !isToolbarHidden.value;
    }

    // Study Mode: 'vocab' (Học từ mới - Mặc định) | 'qa' (Luyện phản xạ Q&A)
    const studyMode = ref(localStorage.getItem('minna_study_mode') || 'vocab');

    function toggleStudyMode() {
      if (studyMode.value === 'vocab') studyMode.value = 'qa';
      else if (studyMode.value === 'qa') studyMode.value = 'verbs3';
      else studyMode.value = 'vocab';
      localStorage.setItem('minna_study_mode', studyMode.value);
      resetCardState();
    }

    function setStudyMode(mode) {
      studyMode.value = mode;
      localStorage.setItem('minna_study_mode', mode);
      resetCardState();
    }

    const inputMode = ref(localStorage.getItem('minna_input_mode') || 'single');

    function toggleInputMode() {
      inputMode.value = inputMode.value === 'single' ? 'dual' : 'single';
      localStorage.setItem('minna_input_mode', inputMode.value);
      resetCardState();
    }

    const isAnswerRevealed = ref(false);
    const inputQuestion = ref('');
    const inputAnswer = ref('');
    const inputMeaning = ref('');
    const inputReading = inputQuestion;
    const isLastCheckPassed = ref(false);
    const validationFeedback = ref(null);
    const questionInputRef = ref(null);
    const answerInputRef = ref(null);
    const readingInputRef = questionInputRef;

    // 3 Forms State (Masu -> Vru -> Vte)
    const inputMasu = ref('');
    const inputVru = ref('');
    const inputVte = ref('');
    const statusMasu = ref('idle'); // 'idle' | 'correct' | 'wrong'
    const statusVru = ref('idle');
    const statusVte = ref('idle');
    const masuInputRef = ref(null);
    const vruInputRef = ref(null);
    const vteInputRef = ref(null);
    const isPlayingChain = ref(false);
    const currentForms = computed(() => getCardForms(currentCard.value));

    const masteredTerms = ref([]);
    const disabledTerms = ref([]);

    function getStorageKey(suffix) {
      const safe = (currentLesson.value || 'bai_4').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      return `minna_${safe}_${suffix}`;
    }

    function loadMasteredState() {
      try {
        const key = getStorageKey('mastered');
        let raw = localStorage.getItem(key);
        if (!raw && (currentLesson.value === 'bai_4' || currentLesson.value === 'bai4')) {
          raw = localStorage.getItem('minna_b4_mastered') || localStorage.getItem('minna_bai4_mastered');
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            masteredTerms.value = parsed.filter(t => t && t !== 'undefined' && t !== 'null');
            return;
          }
        }
        masteredTerms.value = [];
      } catch (e) {
        console.warn('Cannot read localStorage', e);
        masteredTerms.value = [];
      }
    }

    function saveMasteredState() {
      try {
        localStorage.setItem(getStorageKey('mastered'), JSON.stringify(masteredTerms.value));
      } catch (e) {
        console.warn('Cannot save localStorage', e);
      }
    }

    function loadDisabledState() {
      try {
        const key = getStorageKey('disabled_terms');
        let raw = localStorage.getItem(key);
        if (!raw && (currentLesson.value === 'bai_4' || currentLesson.value === 'bai4')) {
          raw = localStorage.getItem('minna_b4_disabled_terms') || localStorage.getItem('minna_bai4_disabled_terms');
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            disabledTerms.value = parsed.filter(t => t && t !== 'undefined' && t !== 'null');
            return;
          }
        }
        disabledTerms.value = [];
      } catch (e) {
        console.warn('Cannot read localStorage disabled words', e);
        disabledTerms.value = [];
      }
    }

    function saveDisabledState() {
      try {
        localStorage.setItem(getStorageKey('disabled_terms'), JSON.stringify(disabledTerms.value));
      } catch (e) {
        console.warn('Cannot save localStorage disabled words', e);
      }
    }

    function isCardMastered(term) {
      return masteredTerms.value.includes(term);
    }

    function toggleCardMastery(term) {
      const idx = masteredTerms.value.indexOf(term);
      if (idx >= 0) {
        masteredTerms.value.splice(idx, 1);
      } else {
        masteredTerms.value.push(term);
      }
      saveMasteredState();
    }

    // TÍNH NĂNG BẬT / TẮT TỪNG TỪ 1 (ĐỊNH DANH THEO TERM - AN TOÀN TUYỆT ĐỐI)
    function isWordEnabled(term) {
      if (!term) return false;
      return !disabledTerms.value.includes(term);
    }

    function toggleWordEnabled(term) {
      if (!term) return;
      const idx = disabledTerms.value.indexOf(term);
      if (idx >= 0) {
        disabledTerms.value.splice(idx, 1);
      } else {
        disabledTerms.value.push(term);
      }
      saveDisabledState();
      resetCardState();
    }

    // Nút Bật tất cả
    function enableAllWords() {
      disabledTerms.value = [];
      saveDisabledState();
      resetCardState();
    }

    // Nút Tắt tất cả
    function disableAllWords() {
      disabledTerms.value = allCards.value.map(c => c.term).filter(Boolean);
      saveDisabledState();
      resetCardState();
    }

    // Danh sách từ đang BẬT (khi tắt từ sẽ biến mất khỏi danh sách này)
    const enabledCards = computed(() => {
      return allCards.value.filter(c => !disabledTerms.value.includes(c.term));
    });

    // Danh sách từ đã TẮT
    const disabledCards = computed(() => {
      return allCards.value.filter(c => disabledTerms.value.includes(c.term));
    });

    // Flashcard active list (chỉ học các từ đang Bật và theo loại từ đã chọn)
    const activeList = computed(() => {
      let list = [...enabledCards.value];
      if (scopeFilter.value === 'learned') {
        list = list.filter(c => isCardMastered(c.term));
      } else if (scopeFilter.value === 'unlearned') {
        list = list.filter(c => !isCardMastered(c.term));
      }

      if (selectedTypeFilter.value !== 'all') {
        if (selectedTypeFilter.value === 'Tính từ') {
          list = list.filter(c => (c.type || '').startsWith('Tính từ'));
        } else if (selectedTypeFilter.value === 'Khác') {
          list = list.filter(c => !['Danh từ', 'Động từ', 'Phó từ', 'Từ để hỏi', 'Cụm từ'].includes(c.type) && !(c.type || '').startsWith('Tính từ'));
        } else {
          list = list.filter(c => c.type === selectedTypeFilter.value);
        }
      }
      return list;
    });

    const typeFiltersList = computed(() => {
      const cards = enabledCards.value;
      const countAll = cards.length;
      const countDongTu = cards.filter(c => c.type === 'Động từ').length;
      const countTinhTu = cards.filter(c => (c.type || '').startsWith('Tính từ')).length;
      const countDanhTu = cards.filter(c => c.type === 'Danh từ').length;
      const countPhoTu = cards.filter(c => c.type === 'Phó từ').length;
      const countTuDeHoi = cards.filter(c => c.type === 'Từ để hỏi').length;
      const countCumTu = cards.filter(c => c.type === 'Cụm từ').length;
      const countKhac = cards.filter(c => !['Động từ', 'Danh từ', 'Phó từ', 'Từ để hỏi', 'Cụm từ'].includes(c.type) && !(c.type || '').startsWith('Tính từ')).length;

      const filters = [
        { key: 'all', label: 'Tất cả', count: countAll },
        { key: 'Động từ', label: 'Động từ', count: countDongTu },
        { key: 'Tính từ', label: 'Tính từ', count: countTinhTu },
        { key: 'Danh từ', label: 'Danh từ', count: countDanhTu },
        { key: 'Phó từ', label: 'Phó từ', count: countPhoTu },
        { key: 'Từ để hỏi', label: 'Từ để hỏi', count: countTuDeHoi }
      ];
      if (countCumTu > 0) {
        filters.push({ key: 'Cụm từ', label: 'Cụm từ', count: countCumTu });
      }
      if (countKhac > 0) {
        filters.push({ key: 'Khác', label: 'Khác', count: countKhac });
      }
      return filters;
    });

    const currentCard = computed(() => {
      if (activeList.value.length === 0) return null;
      if (currentIndex.value >= activeList.value.length) {
        currentIndex.value = 0;
      }
      return activeList.value[currentIndex.value];
    });

    const stats = computed(() => {
      const total = enabledCards.value.length;
      const learned = enabledCards.value.filter(c => isCardMastered(c.term)).length;
      const unlearned = total - learned;
      const progressPercent = total > 0 ? Math.round((learned / total) * 100) : 0;
      return { total, learned, unlearned, progressPercent };
    });

    // Danh sách hiển thị trong Kho từ (dựa theo bộ lọc Đang bật / Đã tắt / Tất cả)
    const filteredLookupList = computed(() => {
      let baseList = [];
      if (vocabFilter.value === 'enabled') {
        baseList = enabledCards.value;
      } else if (vocabFilter.value === 'disabled') {
        baseList = disabledCards.value;
      } else {
        baseList = allCards.value;
      }

      const q = searchQuery.value.trim().toLowerCase();
      if (!q) return baseList;
      const qVn = normalizeVn(q);
      const qJp = normalizeJp(q);

      return baseList.filter(c => {
        return (
          (c.id && String(c.id).includes(q)) ||
          normalizeJp(c.term).includes(qJp) ||
          normalizeJp(c.reading).includes(qJp) ||
          normalizeJp(c.romaji).includes(qJp) ||
          normalizeVn(c.meaning).includes(qVn) ||
          (c.example && (normalizeJp(c.example.japanese).includes(qJp) || normalizeVn(c.example.vietnamese).includes(qVn)))
        );
      });
    });

    // Nút Chọn tất cả trạng thái đã nhớ / cần ôn
    const isAllMastered = computed(() => {
      if (filteredLookupList.value.length === 0) return false;
      return filteredLookupList.value.every(c => isCardMastered(c.term));
    });

    function markAllMastered() {
      filteredLookupList.value.forEach(c => {
        if (!masteredTerms.value.includes(c.term)) {
          masteredTerms.value.push(c.term);
        }
      });
      saveMasteredState();
    }

    function unmarkAllMastered() {
      const currentTerms = filteredLookupList.value.map(c => c.term);
      masteredTerms.value = masteredTerms.value.filter(t => !currentTerms.includes(t));
      saveMasteredState();
    }

    function toggleAllMastery() {
      if (isAllMastered.value) {
        unmarkAllMastered();
      } else {
        markAllMastered();
      }
    }

    function onRowClick(item) {
      if (!isWordEnabled(item.term)) {
        toggleWordEnabled(item.term);
        return;
      }
      selectCardFromTable(item);
    }

    const inputQuestionStatusClass = computed(() => {
      if (!validationFeedback.value) return 'border-slate-200 bg-white text-slate-800';
      if (validationFeedback.value.passed) {
        return 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800';
      }
      return 'bg-rose-50 border-2 border-rose-500 text-rose-800 shake-effect';
    });

    const inputAnswerStatusClass = computed(() => {
      if (!validationFeedback.value) return 'border-slate-200 bg-white text-slate-800';
      if (validationFeedback.value.passed) {
        return 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800';
      }
      return 'bg-rose-50 border-2 border-rose-500 text-rose-800 shake-effect';
    });

    const inputStatusClass = inputQuestionStatusClass;

    function speakQuestion() {
      const card = currentCard.value;
      if (!card) return;
      if (card.question) {
        speak(card.question.reading || card.question.short || card.question.polite, true);
      } else {
        speak(card.reading || card.term);
      }
    }

    function speakAnswer() {
      const card = currentCard.value;
      if (!card) return;
      if (card.answer) {
        speak(card.answer.reading || card.answer.short, true);
      } else {
        speak(card.reading || card.term);
      }
    }

    function resetCardState() {
      isAnswerRevealed.value = false;
      isBlindRevealed.value = false;
      inputQuestion.value = '';
      inputAnswer.value = '';
      inputMeaning.value = '';
      inputMasu.value = '';
      inputVru.value = '';
      inputVte.value = '';
      statusMasu.value = 'idle';
      statusVru.value = 'idle';
      statusVte.value = 'idle';
      isLastCheckPassed.value = false;
      validationFeedback.value = null;
      prefetchNextCard();
      if (isBlindMode.value && currentCard.value) {
        speakQuestion();
      }
      nextTick(() => {
        if (studyMode.value === 'verbs3') {
          if (masuInputRef.value) masuInputRef.value.focus();
        } else if (studyMode.value === 'qa' && inputMode.value === 'single' && currentCard.value && currentCard.value.question) {
          if (answerInputRef.value) answerInputRef.value.focus();
          else if (questionInputRef.value) questionInputRef.value.focus();
        } else {
          if (questionInputRef.value) questionInputRef.value.focus();
          else if (readingInputRef.value) readingInputRef.value.focus();
        }
      });
    }

    function nextCard() {
      if (currentIndex.value < activeList.value.length - 1) {
        currentIndex.value++;
        resetCardState();
      }
    }

    function prevCard() {
      if (currentIndex.value > 0) {
        currentIndex.value--;
        resetCardState();
      }
    }

    function setScope(scope) {
      scopeFilter.value = scope;
      currentIndex.value = 0;
      resetCardState();
    }

    function setMode(mode) {
      practiceMode.value = mode;
      resetCardState();
    }

    function toggleFurigana() {
      showFurigana.value = !showFurigana.value;
    }

    function toggleShuffle() {
      isShuffle.value = !isShuffle.value;
      if (isShuffle.value) {
        allCards.value.sort(() => Math.random() - 0.5);
      } else {
        allCards.value.sort((a, b) => (a.id || 0) - (b.id || 0));
      }
      currentIndex.value = 0;
      resetCardState();
    }

    function cycleSpeechRate() {
      const rates = [0.8, 1.0, 1.2];
      const nextIdx = (rates.indexOf(speechRate.value) + 1) % rates.length;
      speechRate.value = rates[nextIdx];
    }

    let activeAudio = null;

    function playAudioSequence(urlList, text, isSentence) {
      return new Promise((resolve) => {
        if (!urlList || !urlList.length) {
          fallbackWebSpeech(text, isSentence).then(resolve);
          return;
        }
        if (activeAudio) {
          activeAudio.pause();
          activeAudio.currentTime = 0;
        }

        let idx = 0;
        let settled = false;
        const done = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        function tryNext() {
          if (idx >= urlList.length) {
            fallbackWebSpeech(text, isSentence).then(done);
            return;
          }
          const currentUrl = urlList[idx++];
          const audio = new Audio(currentUrl);
          audio.playbackRate = speechRate.value;
          activeAudio = audio;
          audio.onended = done;
          audio.onerror = () => tryNext();
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => tryNext());
          }
        }
        tryNext();
      });
    }

    function prefetchNextCard() {
      if (!activeList.value || activeList.value.length === 0) return;
      const nextIdx = currentIndex.value + 1;
      if (nextIdx < activeList.value.length) {
        const nextCardObj = activeList.value[nextIdx];
        if (nextCardObj && selectedVoice.value === 'voicevox') {
          const raw = nextCardObj.reading || nextCardObj.term || '';
          const word = stripBrackets(raw).replace(/<[^>]*>/g, '').trim();
          if (word) {
            const prefetchUrl = `${API_BASE}/api/voicevox?text=${encodeURIComponent(word)}&speaker=${selectedSpeakerId.value || 3}&is_word=1`;
            fetch(prefetchUrl, { cache: 'force-cache' }).catch(() => { });
          }
        }
      }
    }

    async function speak(text, isSentence = false, customCard = null) {
      if (!text) return;

      // 1. Web Speech API (trình duyệt)
      if (selectedVoice.value === 'webspeech') {
        await fallbackWebSpeech(text, isSentence);
        return;
      }

      // Làm sạch thẻ HTML và ngoặc vuông/tròn phụ chú [な], （な）
      const cleanText = isSentence ? text.replace(/<[^>]*>/g, '').trim() : stripBrackets(text).replace(/<[^>]*>/g, '').trim();
      if (!cleanText) return;

      let urls = [];
      if (selectedVoice.value === 'voicevox') {
        const speakerId = selectedSpeakerId.value || 3;
        // STREAM TRỰC TIẾP TỪ GPU (RTX 3060) - Phát chuẩn 100% theo chữ trên màn hình
        const liveVoicevoxUrl = `${API_BASE}/api/voicevox?text=${encodeURIComponent(cleanText)}&speaker=${speakerId}&is_word=${isSentence ? 0 : 1}`;
        urls = [liveVoicevoxUrl];
      } else {
        // Edge: Stream trực tiếp từ server
        const liveEdgeUrl = `${API_BASE}/api/edge?text=${encodeURIComponent(cleanText)}`;
        urls = [liveEdgeUrl];
      }

      // Tự động Prefetch (nạp trước vào RAM cache GPU) cho thẻ kế tiếp
      prefetchNextCard();

      await playAudioSequence(urls, cleanText, isSentence);
    }

    function fallbackWebSpeech(text, isSentence = false) {
      return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        // Bỏ phần trong ngoặc [な], [na], （な） và thẻ html
        let cleanText = (isSentence ? text : stripBrackets(text)).replace(/<[^>]*>/g, '').trim();
        // Nếu là từ vựng đơn lẻ, chuyển sang Katakana để TTS đọc chuẩn âm 100%
        if (!isSentence && !/[。、！？!?]/.test(cleanText) && /^[\u3040-\u309F\s・~ー]+$/.test(cleanText)) {
          cleanText = hiraToKata(cleanText);
        }
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = 'ja-JP';
        utter.rate = speechRate.value;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      });
    }

    async function speakExample(text, customCard = null, exIndex = 0) {
      if (!text) return;

      if (selectedVoice.value === 'webspeech') {
        fallbackWebSpeech(text, true);
        return;
      }

      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      if (!cleanText) return;

      let urls = [];
      if (selectedVoice.value === 'voicevox') {
        const speakerId = selectedSpeakerId.value || 3;
        const liveVoicevoxUrl = `${API_BASE}/api/voicevox?text=${encodeURIComponent(cleanText)}&speaker=${speakerId}&is_word=0`;
        urls = [liveVoicevoxUrl];
      } else {
        const liveEdgeUrl = `${API_BASE}/api/edge?text=${encodeURIComponent(cleanText)}`;
        urls = [liveEdgeUrl];
      }

      playAudioSequence(urls, cleanText, true);
    }

    function getPromptRubyHtml(card) {
      if (!card) return '';
      if (!showFurigana.value && !isAnswerRevealed.value) {
        return card.term;
      }
      if (card.reading && card.reading !== card.term) {
        return `<ruby>${card.term}<rt>${card.reading}</rt></ruby>`;
      }
      return card.term;
    }

    function getVocabFontSizeClass(card) {
      if (!card) return 'text-3xl sm:text-5xl';
      const termLen = (card.term || '').length;
      const readingLen = (card.reading || '').length;
      const maxLen = Math.max(termLen, readingLen);

      if (maxLen <= 4) {
        return 'text-3xl sm:text-5xl';
      } else if (maxLen <= 7) {
        return 'text-2xl sm:text-4xl';
      } else if (maxLen <= 11) {
        return 'text-xl sm:text-3xl';
      } else if (maxLen <= 16) {
        return 'text-lg sm:text-2xl';
      } else {
        return 'text-base sm:text-xl';
      }
    }


    function handleInputMasu(e) {
      const val = e.target.value;
      const converted = toHiragana(val);
      if (converted !== val) {
        inputMasu.value = converted;
      }
      if (statusMasu.value === 'wrong') statusMasu.value = 'idle';
    }

    function handleInputVru(e) {
      const val = e.target.value;
      const converted = toHiragana(val);
      if (converted !== val) {
        inputVru.value = converted;
      }
      if (statusVru.value === 'wrong') statusVru.value = 'idle';
    }

    function handleInputVte(e) {
      const val = e.target.value;
      const converted = toHiragana(val);
      if (converted !== val) {
        inputVte.value = converted;
      }
      if (statusVte.value === 'wrong') statusVte.value = 'idle';
    }

    function handleEnterMasu() {
      if (isAnswerRevealed.value && isLastCheckPassed.value) {
        handleCheckOrNext();
        return;
      }
      if (isBypassPattern(inputMasu.value)) {
        bypass3Forms();
        return;
      }
      const forms = currentForms.value;
      if (forms && inputMasu.value.trim()) {
        statusMasu.value = isMatchForm(inputMasu.value, forms.masu) ? 'correct' : 'wrong';
      }
      if (vruInputRef.value) vruInputRef.value.focus();
    }

    function handleEnterVru() {
      if (isAnswerRevealed.value && isLastCheckPassed.value) {
        handleCheckOrNext();
        return;
      }
      if (isBypassPattern(inputVru.value)) {
        bypass3Forms();
        return;
      }
      const forms = currentForms.value;
      if (forms && inputVru.value.trim()) {
        statusVru.value = isMatchForm(inputVru.value, forms.vru) ? 'correct' : 'wrong';
      }
      if (vteInputRef.value) vteInputRef.value.focus();
    }

    function handleEnterVte() {
      if (isAnswerRevealed.value && isLastCheckPassed.value) {
        handleCheckOrNext();
        return;
      }
      if (isBypassPattern(inputVte.value)) {
        bypass3Forms();
        return;
      }
      check3FormsAnswers();
    }

    function check3FormsAnswers() {
      const card = currentCard.value;
      if (!card) return;
      const forms = currentForms.value;
      if (!forms) return;

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
          desc: `① ます: <b>${forms.masu.kanji}</b> (${forms.masu.kana})<br>` +
            `② 辞書: <b>${forms.vru.kanji}</b> (${forms.vru.kana})<br>` +
            `③ て形: <b>${forms.vte.kanji}</b> (${forms.vte.kana})<br>` +
            `Bấm <b>Enter</b> hoặc <b>Space</b> để sang động từ tiếp theo!`
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
          desc: `Kiểm tra lại: <b>${errors.join(', ')}</b>. Gõ <b>~~</b> nếu muốn xem đáp án ngay!`
        };

        nextTick(() => {
          if (!mPass && masuInputRef.value) masuInputRef.value.focus();
          else if (!rPass && vruInputRef.value) vruInputRef.value.focus();
          else if (!tPass && vteInputRef.value) vteInputRef.value.focus();
        });
      }
    }

    function bypass3Forms() {
      const card = currentCard.value;
      if (!card) return;
      const forms = currentForms.value;
      if (!forms) return;

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
        desc: `① ます: <b>${forms.masu.kanji}</b> (${forms.masu.kana})<br>` +
          `② 辞書: <b>${forms.vru.kanji}</b> (${forms.vru.kana})<br>` +
          `③ て形: <b>${forms.vte.kanji}</b> (${forms.vte.kana})<br>` +
          `Bấm <b>Enter</b> hoặc <b>Space</b> để sang động từ tiếp theo!`
      };
      play3FormsChain();
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

    function handleCheckOrNext() {
      const card = currentCard.value;
      if (!card) return;

      if (studyMode.value === 'verbs3') {
        if (isAnswerRevealed.value && isLastCheckPassed.value) {
          if (currentIndex.value < activeList.value.length - 1) {
            nextCard();
          } else {
            play3FormsChain();
          }
          return;
        }
        if (isBypassPattern(inputMasu.value) || isBypassPattern(inputVru.value) || isBypassPattern(inputVte.value)) {
          bypass3Forms();
          return;
        }
        check3FormsAnswers();
        return;
      }

      if (isAnswerRevealed.value && isLastCheckPassed.value) {
        if (currentIndex.value < activeList.value.length - 1) {
          nextCard();
        } else {
          if (studyMode.value === 'qa' && card.answer) speakAnswer();
          else speak(card.reading || card.term);
        }
        return;
      }

      const meaningDesc = (card.meanings && card.meanings.length > 1)
        ? card.meanings.map((m, i) => `${i + 1}. ${m}`).join(' | ')
        : card.meaning;

      // 1. Phím tắt bypass ~~: bỏ qua câu mà không kiểm tra nội dung
      if (isBypassPattern(inputQuestion.value) || isBypassPattern(inputAnswer.value) || isBypassPattern(inputMeaning.value) || isBypassPattern(inputReading.value)) {
        isAnswerRevealed.value = true;
        isLastCheckPassed.value = true;
        if (studyMode.value === 'qa' && card.answer) speakAnswer();
        else speak(card.reading || card.term);
        validationFeedback.value = {
          passed: true,
          title: 'ĐÃ BỎ QUA THẺ (LỆNH TẮT ~~)',
          desc: card.question
            ? `Hỏi: <b>${card.question.short || card.question.polite}</b><br>Đáp: <b>${card.answer.short}</b>. Nghĩa: <b>${card.meaning}</b>. Bấm <b>Enter</b> hoặc <b>Space</b> để tiếp!`
            : `Từ: <b>${card.term}</b> (${card.reading} / ${card.romaji})<br>Nghĩa: <b>${meaningDesc}</b>. Bấm <b>Enter</b> hoặc <b>Space</b> để sang thẻ tiếp!`
        };
        return;
      }

      isAnswerRevealed.value = true;
      if (studyMode.value === 'qa' && card.answer) {
        speakAnswer();
      } else {
        speak(card.reading || card.term);
      }

      const valQ = (inputQuestion.value || inputReading.value || '').trim();
      const valA = (inputAnswer.value || '').trim();

      if (practiceMode.value === 'jp-to-vn') {
        if (studyMode.value === 'qa' && card.question && card.answer) {
          // Kiểm tra Ô 1: Câu hỏi (Linh hoạt: bỏ qua dấu câu, khoảng trắng, chữ hoa/thường)
          const qMatched = matchesAnyCandidate(valQ, [
            card.question.romaji,
            card.question.reading,
            card.question.short,
            card.question.polite,
            ...(card.question.variants || [])
          ]);

          // Kiểm tra Ô 2: Câu trả lời (Linh hoạt: bỏ qua dấu câu, khoảng trắng, chữ hoa/thường)
          const aMatched = matchesAnyCandidate(valA, [
            card.answer.romaji,
            card.answer.reading,
            card.answer.short,
            ...(card.answer.variants || [])
          ]);

          // Ô 3: Nghĩa tiếng Việt (ko check - theo yêu cầu của user)

          if (inputMode.value === 'single') {
            // Chế độ 1 Ô (Mặc định - Direction A): Chỉ kiểm tra Câu trả lời phản xạ
            if (aMatched) {
              isLastCheckPassed.value = true;
              validationFeedback.value = {
                passed: true,
                title: 'XUẤT SẮC! CÂU TRẢ LỜI CHÍNH XÁC.',
                desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> ➔ Đáp: <b>${card.answer.short}</b>.<br>Nghĩa: <b>${card.meaning}</b>.`
              };
            } else {
              isLastCheckPassed.value = false;
              validationFeedback.value = {
                passed: false,
                title: 'CÂU TRẢ LỜI CHƯA CHÍNH XÁC!',
                desc: `Bạn gõ: "<b>${valA || '(trống)'}</b>". Đáp án chuẩn: <b>${card.answer.short}</b> (${card.answer.romaji}).`
              };
              nextTick(() => { if (answerInputRef.value) answerInputRef.value.select(); });
            }
          } else {
            // Chế độ 2 Ô (Thử thách - Direction B): Kiểm tra cả Câu hỏi & Câu trả lời
            if (qMatched && aMatched) {
              isLastCheckPassed.value = true;
              validationFeedback.value = {
                passed: true,
                title: 'XUẤT SẮC! CẢ CÂU HỎI VÀ ĐÁP ÁN ĐỀU ĐÚNG.',
                desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> - Đáp: <b>${card.answer.short}</b>.<br>Nghĩa: <b>${card.meaning}</b>.`
              };
            } else if (qMatched && !aMatched) {
              isLastCheckPassed.value = false;
              validationFeedback.value = {
                passed: false,
                title: 'ĐÚNG CÂU HỎI! CÂU TRẢ LỜI CHƯA CHÍNH XÁC',
                desc: `Đáp án chuẩn cho câu trả lời: <b>${card.answer.short}</b> (${card.answer.romaji}).`
              };
              nextTick(() => { if (answerInputRef.value) answerInputRef.value.select(); });
            } else if (!qMatched && aMatched) {
              isLastCheckPassed.value = false;
              validationFeedback.value = {
                passed: false,
                title: 'ĐÚNG CÂU TRẢ LỜI! CÂU HỎI CHƯA CHÍNH XÁC',
                desc: `Đáp án chuẩn cho câu hỏi: <b>${card.question.short || card.question.polite}</b> (${card.question.romaji}).`
              };
              nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
            } else {
              isLastCheckPassed.value = false;
              validationFeedback.value = {
                passed: false,
                title: 'CHƯA ĐÚNG CÂU HỎI VÀ CÂU TRẢ LỜI!',
                desc: `Hỏi: <b>${card.question.short || card.question.polite}</b> (${card.question.romaji})<br>Đáp: <b>${card.answer.short}</b> (${card.answer.romaji}).`
              };
              nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
            }
          }
        } else {
          // Thẻ cũ (chưa có trường question)
          const matched = matchesAnyCandidate(valQ, [
            card.romaji,
            stripBrackets(card.romaji),
            card.reading,
            stripBrackets(card.reading),
            card.term,
            stripBrackets(card.term)
          ]);

          if (matched) {
            isLastCheckPassed.value = true;
            validationFeedback.value = {
              passed: true,
              title: 'CHÍNH XÁC PHIÊN ÂM!',
              desc: `Từ: <b>${card.term}</b> (${card.reading}). Nghĩa: <b>${meaningDesc}</b>.`
            };
          } else {
            isLastCheckPassed.value = false;
            validationFeedback.value = {
              passed: false,
              title: 'CHƯA ĐÚNG PHIÊN ÂM!',
              desc: `Bạn vừa nhập: "<b>${valQ || '(trống)'}</b>". Đáp án chuẩn: <b>${card.romaji}</b> (${card.reading}) - Nghĩa: <b>${meaningDesc}</b>.`
            };
            nextTick(() => { if (questionInputRef.value) questionInputRef.value.select(); });
          }
        }
      } else {
        const userNorm = normalizeJp(valQ);
        const candidates = [
          normalizeJp(card.term),
          normalizeJp(stripBrackets(card.term)),
          normalizeJp((card.term || '').replace(/[\[\]\(\)（）]/g, '')),
          normalizeJp(card.reading),
          normalizeJp(stripBrackets(card.reading)),
          normalizeJp((card.reading || '').replace(/[\[\]\(\)（）]/g, '')),
          normalizeJp(card.romaji),
          normalizeJp(stripBrackets(card.romaji)),
          normalizeJp((card.romaji || '').replace(/[\[\]\(\)（）]/g, ''))
        ].filter(Boolean);

        const matched = Boolean(userNorm && candidates.includes(userNorm));

        if (matched) {
          isLastCheckPassed.value = true;
          validationFeedback.value = {
            passed: true,
            title: 'XUẤT SẮC! TIẾNG NHẬT CHÍNH XÁC.',
            desc: `Từ đúng: <b>${card.term}</b> (${card.reading}). Nghĩa: <b>${meaningDesc}</b>. Bấm <b>Phím 2</b> để đánh dấu thuộc!`
          };
        } else {
          isLastCheckPassed.value = false;
          validationFeedback.value = {
            passed: false,
            title: 'CHƯA ĐÚNG TIẾNG NHẬT!',
            desc: `Bạn vừa nhập: "<b>${valQ || '(trống)'}</b>". Đáp án chuẩn: <b>${card.term}</b> (${card.reading} / ${card.romaji}).`
          };
          nextTick(() => {
            if (readingInputRef.value) readingInputRef.value.select();
          });
        }
      }
    }

    function selectCardFromTable(item) {
      const idx = activeList.value.findIndex(c => c.term === item.term);
      if (idx >= 0) {
        currentIndex.value = idx;
      } else {
        scopeFilter.value = 'all';
        nextTick(() => {
          const newIdx = activeList.value.findIndex(c => c.term === item.term);
          if (newIdx >= 0) currentIndex.value = newIdx;
        });
      }
      showLookupModal.value = false;
      resetCardState();
    }

    const API_BASE = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:8000';

    function sanitizeLessonName(name) {
      if (!name) return 'bai_4';
      const clean = normalizeVn(name)
        .replace(/^bai(\d+)/i, 'bai_$1')
        .replace(/[\s\-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '');
      return clean || 'bai_4';
    }

    function cardExamples(card) {
      if (!card) return [];
      if (Array.isArray(card.examples) && card.examples.length) return card.examples;
      if (card.example && card.example.japanese) return [card.example];
      return [];
    }

    function getBaseLesson(name) {
      if (!name) return 'bai_4';
      return sanitizeLessonName(name)
        .replace(/_shikoku_metan_normal$/i, '')
        .replace(/_zundamon_normal$/i, '')
        .replace(/_zundamon$/i, '');
    }

    function updateAudioPaths() {
      const speakerId = selectedSpeakerId.value || 3;
      allCards.value.forEach((card) => {
        const rawWord = card.reading || card.term || '';
        const cleanWord = stripBrackets(rawWord).replace(/<[^>]*>/g, '').trim();
        card.audioWord = `${API_BASE}/api/voicevox?text=${encodeURIComponent(cleanWord)}&speaker=${speakerId}&is_word=1`;
        const exs = cardExamples(card);
        card.audioExamples = exs.map((ex) => {
          const exText = (ex && ex.japanese ? ex.japanese : '').replace(/<[^>]*>/g, '').trim();
          return `${API_BASE}/api/voicevox?text=${encodeURIComponent(exText)}&speaker=${speakerId}&is_word=0`;
        });
        card.audioExample = card.audioExamples[0] || '';
      });
    }

    function attachAudioPaths(lesson, cards) {
      currentLesson.value = sanitizeLessonName(lesson);
      updateAudioPaths();
    }

    async function verifySessionCache(lesson, cards, force = false) {
      if (!cards || !cards.length) return null;
      edgeStatus.value = 'synced';
      edgeSyncMsg.value = 'VOICEVOX GPU Streaming (RAM Cache)';
      return null;
    }

    async function syncEdgeAudio(lesson, cards) {
      return verifySessionCache(lesson, cards, true);
    }

    async function retrySyncAudio() {
      if (allCards.value.length === 0) return;
      await verifySessionCache(currentLesson.value, allCards.value, true);
    }

    const ACTIVE_SESSION_KEY = 'minna_active_session_v1';
    let isRestoringSession = false;

    function loadActiveSession() {
      try {
        const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function saveActiveSession(includeCards = false) {
      if (isRestoringSession) return;
      try {
        const prev = loadActiveSession();
        const payload = {
          lesson: currentLesson.value,
          studyMode: studyMode.value,
          currentIndex: currentIndex.value,
          scopeFilter: scopeFilter.value,
          selectedTypeFilter: selectedTypeFilter.value,
          updatedAt: Date.now()
        };
        if (includeCards) {
          payload.isUploaded = true;
          payload.cards = allCards.value;
        } else if (prev && prev.lesson === currentLesson.value && prev.isUploaded && Array.isArray(prev.cards)) {
          payload.isUploaded = true;
          payload.cards = prev.cards;
        }
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('Could not save active session to localStorage:', e);
      }
    }

    watch([studyMode, currentIndex, scopeFilter, selectedTypeFilter], () => {
      if (allCards.value.length > 0 && currentLesson.value) {
        saveActiveSession(false);
      }
    });

    function applyRestoredViewState(cached, lessonName) {
      if (!cached || cached.lesson !== lessonName) return;
      isRestoringSession = true;
      try {
        if (cached.studyMode) studyMode.value = cached.studyMode;
        if (cached.scopeFilter) scopeFilter.value = cached.scopeFilter;
        if (cached.selectedTypeFilter) selectedTypeFilter.value = cached.selectedTypeFilter;
        nextTick(() => {
          const maxIdx = Math.max(0, activeList.value.length - 1);
          const idx = typeof cached.currentIndex === 'number' ? cached.currentIndex : 0;
          currentIndex.value = Math.min(Math.max(0, idx), maxIdx);
          isRestoringSession = false;
        });
      } catch (e) {
        isRestoringSession = false;
      }
    }

    async function loadData() {
      const params = new URLSearchParams(window.location.search);
      const urlLessonParam = params.get('lesson') || params.get('file');
      const cached = loadActiveSession();

      // Nếu không có ?lesson= trên URL nhưng có cache bài đã nạp từ trước -> khôi phục ngay lập tức
      if (!urlLessonParam && cached && cached.lesson && cached.isUploaded && Array.isArray(cached.cards) && cached.cards.length > 0) {
        isRestoringSession = true;
        currentLesson.value = cached.lesson;
        loadMasteredState();
        loadDisabledState();
        allCards.value = normalizeCardsData(cached.cards);
        loadError.value = false;
        const firstLesson = cached.lesson.split('+')[0];
        attachAudioPaths(firstLesson, allCards.value);
        edgeStatus.value = 'synced';
        edgeSyncMsg.value = `Kho audio: ${cached.lesson} (Khôi phục phiên học)`;
        applyRestoredViewState(cached, cached.lesson);
        return;
      }

      let rawLesson = urlLessonParam || (cached && cached.lesson) || 'bai_4';
      rawLesson = rawLesson.replace(/\.json$/i, '');
      const lessonName = sanitizeLessonName(rawLesson);
      const fileToLoad = `${lessonName}.json`;

      try {
        const res = await fetch(`/data/vocab/${encodeURIComponent(fileToLoad)}?t=` + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Fetch failed HTTP ' + res.status);
        const data = await res.json();
        currentLesson.value = lessonName;
        loadMasteredState();
        loadDisabledState();
        allCards.value = normalizeCardsData(data);
        if (lessonName.includes('dong_tu_3_the') || allCards.value.some(c => c.forms)) {
          studyMode.value = 'verbs3';
        }
        loadError.value = false;
        // Gắn ngay đường dẫn audio offline sẵn có (không cần chờ server)
        attachAudioPaths(lessonName, allCards.value);
        edgeStatus.value = 'synced';
        edgeSyncMsg.value = `Kho audio: ${lessonName} (Ưu tiên phát offline)`;
        applyRestoredViewState(cached, lessonName);
        saveActiveSession(false);
        // Quét so cache 1 lần duy nhất trong phiên
        verifySessionCache(lessonName, allCards.value);
      } catch (e) {
        console.warn(`Could not auto-fetch ${fileToLoad}:`, e);
        if (fileToLoad !== 'bai_4.json') {
          try {
            const resB4 = await fetch('/data/vocab/bai_4.json?t=' + Date.now(), { cache: 'no-store' });
            if (resB4.ok) {
              const dataB4 = await resB4.json();
              currentLesson.value = 'bai_4';
              loadMasteredState();
              loadDisabledState();
              allCards.value = normalizeCardsData(dataB4);
              loadError.value = false;
              attachAudioPaths('bai_4', allCards.value);
              edgeStatus.value = 'synced';
              edgeSyncMsg.value = 'Kho audio: bai_4 (Ưu tiên phát offline)';
              verifySessionCache('bai_4', allCards.value);
              return;
            }
          } catch (_) { }
        }
        loadError.value = true;
        edgeStatus.value = 'fallback';
        edgeSyncMsg.value = 'Chưa chọn file bài học';
      }
    }

    async function handleFileUpload(event) {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;

      // 1. Kiểm tra quy ước đặt tên file (chữ thường, không dấu, ngăn cách bằng dấu _)
      for (const file of files) {
        if (!/^[a-z0-9_]+\.json$/i.test(file.name)) {
          alert(`❌ Tên file không đúng chuẩn quy ước: "${file.name}"\n\nHệ thống từ chối nạp file!\nVui lòng đổi tên file theo định dạng chuẩn (chữ thường, không dấu, nối bằng dấu gạch dưới _):\nVí dụ: bai_4.json, bai_8.json, bai_12.json...`);
          event.target.value = '';
          return;
        }
      }

      // 2. Đọc và kiểm tra cấu trúc từng file một cách nghiêm ngặt (Strict Schema Validation)
      try {
        const loadedCards = [];
        const lessonNames = [];

        for (const file of files) {
          let rawJson;
          try {
            const text = await file.text();
            rawJson = JSON.parse(text);
          } catch (e) {
            alert(`❌ Lỗi định dạng JSON trong file "${file.name}":\n${e.message}`);
            event.target.value = '';
            return;
          }

          const valResult = validateCardsData(rawJson, file.name);
          if (!valResult.valid) {
            alert(`❌ FILE BỊ TỪ CHỐI DO SAI CẤU TRÚC JSON:\n\n${valResult.error}`);
            event.target.value = '';
            return;
          }

          const lessonName = sanitizeLessonName(file.name.replace(/\.json$/i, ''));
          lessonNames.push(lessonName);
          const normalized = normalizeCardsData(rawJson).map(c => ({
            ...c,
            lessonSource: lessonName
          }));
          loadedCards.push(...normalized);
        }

        // Nạp thành công toàn bộ danh sách thẻ
        allCards.value = loadedCards;
        if (lessonNames.some(l => l.includes('dong_tu_3_the')) || loadedCards.some(c => c.forms)) {
          studyMode.value = 'verbs3';
        }
        currentLesson.value = lessonNames.length === 1 ? lessonNames[0] : lessonNames.join('+');
        loadMasteredState();
        loadDisabledState();
        loadError.value = false;
        currentIndex.value = 0;
        resetCardState();
        attachAudioPaths(lessonNames[0], loadedCards);
        saveActiveSession(true);
        edgeStatus.value = 'synced';
        edgeSyncMsg.value = `Kho audio: Đã nạp ${loadedCards.length} từ (${lessonNames.length} bài)`;

        // Quét cache phiên
        lessonNames.forEach(l => {
          verifySessionCache(l, loadedCards.filter(c => c.lessonSource === l));
        });
      } catch (err) {
        alert('Lỗi nạp file: ' + err.message);
      } finally {
        event.target.value = '';
      }
    }

    function handleKeydown(e) {
      if (showSpeakerModal.value) {
        if (e.key === 'Escape') showSpeakerModal.value = false;
        return;
      }
      if (showLookupModal.value) {
        if (e.key === 'Escape') showLookupModal.value = false;
        return;
      }

      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInputFocused = tag === 'input' || tag === 'textarea';

      if (isInputFocused) return;

      if (studyMode.value === 'verbs3') {
        if (e.key === '1') {
          e.preventDefault();
          speakForm('masu');
          return;
        } else if (e.key === '2') {
          e.preventDefault();
          speakForm('vru');
          return;
        } else if (e.key === '3') {
          e.preventDefault();
          speakForm('vte');
          return;
        } else if (e.key === '4' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          play3FormsChain();
          return;
        }
      }

      if (e.code === 'KeyA' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevCard();
      } else if (e.code === 'KeyD' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextCard();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleCheckOrNext();
      } else if (e.key === '1' && currentCard.value) {
        e.preventDefault();
        const idx = masteredTerms.value.indexOf(currentCard.value.term);
        if (idx >= 0) {
          masteredTerms.value.splice(idx, 1);
          saveMasteredState();
        }
      } else if (e.key === '2' && currentCard.value) {
        e.preventDefault();
        if (!isCardMastered(currentCard.value.term)) {
          masteredTerms.value.push(currentCard.value.term);
          saveMasteredState();
        }
      }
    }

    onMounted(() => {
      loadMasteredState();
      loadDisabledState();
      loadData();
      fetchSpeakers();
      window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
    });

    return {
      allCards,
      currentIndex,
      practiceMode,
      scopeFilter,
      showFurigana,
      isShuffle,
      speechRate,
      showLookupModal,
      vocabFilter,
      searchQuery,
      loadError,
      isAnswerRevealed,
      inputReading,
      inputMeaning,
      isLastCheckPassed,
      validationFeedback,
      readingInputRef,
      enabledCards,
      disabledCards,
      disabledTerms,
      disabledCardIds: disabledTerms,
      activeList,
      currentCard,
      stats,
      filteredLookupList,
      isAllMastered,
      inputStatusClass,
      isCardMastered,
      toggleCardMastery,
      isWordEnabled,
      toggleWordEnabled,
      enableAllWords,
      disableAllWords,
      markAllMastered,
      unmarkAllMastered,
      toggleAllMastery,
      onRowClick,
      setScope,
      setMode,
      toggleFurigana,
      toggleShuffle,
      cycleSpeechRate,
      speak,
      getPromptRubyHtml,
      getVocabFontSizeClass,
      handleCheckOrNext,
      nextCard,
      prevCard,
      selectCardFromTable,
      handleFileUpload,
      isFocusMode,
      isHeaderHidden,
      isToolbarHidden,
      toggleFocusMode,
      toggleHeader,
      toggleToolbar,
      currentLesson,
      currentLessonDisplay,
      currentLessonBadge,
      currentLessonTitle,
      edgeStatus,
      edgeSyncMsg,
      edgeUpdatedCount,
      edgeIcon,
      edgeStatusText,
      edgeBadgeClass,
      selectedVoice,
      selectedSpeakerId,
      selectedSpeakerName,
      selectedSpeakerStyle,
      allSpeakers,
      speakerSearch,
      speakerCategory,
      showSpeakerModal,
      filteredSpeakers,
      selectVoicevoxSpeaker,
      previewVoicevoxSpeaker,
      getSpeakerIcon,
      getSpeakerCategory,
      isPreviewLoading,
      setVoice,
      updateAudioPaths,
      cardExamples,
      speakExample,
      customTtsText,
      showTtsBar,
      toggleTtsBar,
      speakCustomText,
      retrySyncAudio,
      verifySessionCache,
      selectedTypeFilter,
      typeFiltersList,
      setTypeFilter,
      isBlindMode,
      isBlindRevealed,
      toggleBlindMode,
      inputQuestion,
      inputAnswer,
      inputMeaning,
      inputReading,
      questionInputRef,
      answerInputRef,
      readingInputRef,
      speakQuestion,
      speakAnswer,
      inputQuestionStatusClass,
      inputAnswerStatusClass,
      inputStatusClass,
      inputMode,
      toggleInputMode,
      studyMode,
      toggleStudyMode,
      showVietnamese,
      toggleVietnamese,
      inputMasu,
      inputVru,
      inputVte,
      statusMasu,
      statusVru,
      statusVte,
      masuInputRef,
      vruInputRef,
      vteInputRef,
      currentForms,
      isPlayingChain,
      handleInputMasu,
      handleInputVru,
      handleInputVte,
      handleEnterMasu,
      handleEnterVru,
      handleEnterVte,
      check3FormsAnswers,
      bypass3Forms,
      speakForm,
      play3FormsChain,
      setStudyMode
    };
  }
}).mount('#app');
