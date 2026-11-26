use regex::Regex;
use std::sync::OnceLock;

/// Converts ASCII Latin words and uppercase acronyms in Japanese text into
/// approximate Katakana readings without pulling in external ONNX dependencies.
pub fn apply_katakana_english(text: &str) -> String {
    static RE_LATIN: OnceLock<Regex> = OnceLock::new();
    let re = RE_LATIN.get_or_init(|| Regex::new(r"[A-Za-z]{2,}").unwrap());
    re.replace_all(text, |caps: &regex::Captures| {
        let word = &caps[0];
        if let Some(known) = lookup_common_word(word) {
            return known.to_string();
        }
        if word.len() <= 5 && word.chars().all(|c| c.is_ascii_uppercase()) {
            return spell_acronym(word);
        }
        transliterate_english(word)
    })
    .into_owned()
}

fn spell_acronym(word: &str) -> String {
    word.chars()
        .map(|c| match c {
            'A' => "エー", 'B' => "ビー", 'C' => "シー", 'D' => "ディー", 'E' => "イー",
            'F' => "エフ", 'G' => "ジー", 'H' => "エイチ", 'I' => "アイ", 'J' => "ジェイ",
            'K' => "ケイ", 'L' => "エル", 'M' => "エム", 'N' => "エヌ", 'O' => "オー",
            'P' => "ピー", 'Q' => "キュー", 'R' => "アール", 'S' => "エス", 'T' => "ティー",
            'U' => "ユー", 'V' => "ブイ", 'W' => "ダブリュー", 'X' => "エックス",
            'Y' => "ワイ", 'Z' => "ゼット", _ => "",
        })
        .collect()
}

fn lookup_common_word(word: &str) -> Option<&'static str> {
    match word.to_ascii_lowercase().as_str() {
        "ok" => Some("オーケー"),
        "email" => Some("イーメール"),
        "internet" => Some("インターネット"),
        "wifi" => Some("ワイファイ"),
        "check" => Some("チェック"),
        "test" => Some("テスト"),
        "app" => Some("アップ"),
        "smartphone" => Some("スマートフォン"),
        "computer" => Some("コンピューター"),
        "video" => Some("ビデオ"),
        "camera" => Some("カメラ"),
        "hotel" => Some("ホテル"),
        "bus" => Some("バス"),
        "taxi" => Some("タクシー"),
        "coffee" => Some("コーヒー"),
        _ => None,
    }
}

fn transliterate_english(word: &str) -> String {
    let s = word.to_ascii_lowercase();
    let bytes = s.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i < bytes.len() {
        let rest = &s[i..];
        let (kana, step) = if rest.starts_with("tion") { ("ション", 4) }
            else if rest.starts_with("sion") { ("ジョン", 4) }
            else if rest.starts_with("ing") { ("イング", 3) }
            else if rest.starts_with("sh") { ("シュ", 2) }
            else if rest.starts_with("ch") { ("チ", 2) }
            else if rest.starts_with("th") { ("ス", 2) }
            else if rest.starts_with("ph") { ("フ", 2) }
            else if rest.starts_with("qu") { ("ク", 2) }
            else if rest.starts_with("oo") { ("ウー", 2) }
            else if rest.starts_with("ee") { ("イー", 2) }
            else if rest.starts_with("er") || rest.starts_with("ar") || rest.starts_with("or") {
                if i + 2 == bytes.len() { ("アー", 2) } else { (single_char(bytes[i]), 1) }
            } else {
                (single_char(bytes[i]), 1)
            };
        out.push_str(kana);
        i += step;
    }
    out
}

fn single_char(b: u8) -> &'static str {
    match b {
        b'a' => "ア", b'i' => "イ", b'u' => "ウ", b'e' => "エ", b'o' => "オ",
        b'b' => "ブ", b'c' => "ク", b'd' => "ド", b'f' => "フ", b'g' => "グ",
        b'h' => "ハ", b'j' => "ジ", b'k' => "ク", b'l' => "ル", b'm' => "ム",
        b'n' => "ン", b'p' => "プ", b'q' => "ク", b'r' => "ル", b's' => "ス",
        b't' => "ト", b'v' => "ブ", b'w' => "ワ", b'x' => "クス", b'y' => "イ",
        b'z' => "ズ", _ => "",
    }
}
