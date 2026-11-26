use crate::katakana_en::apply_katakana_english;
use regex::Regex;
use serde_json::Value;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub fn resolve_base_dir() -> PathBuf {
    let is_root = |p: &Path| p.join("TTS").exists() || p.join("web").exists() || p.join("data").exists();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if is_root(dir) {
                return dir.to_path_buf();
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        if is_root(&cwd) {
            return cwd;
        }
        if let Some(parent) = cwd.parent() {
            if is_root(parent) {
                return parent.to_path_buf();
            }
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn log_line(base_dir: &Path, msg: &str) {
    let logs_dir = base_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    let log_path = logs_dir.join("minna_server.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "{}", msg);
    }
}

pub fn clean_tts_text(text: &str, is_word: bool) -> String {
    static RE_BRACKETS: OnceLock<Regex> = OnceLock::new();
    static RE_HTML: OnceLock<Regex> = OnceLock::new();
    let re_b = RE_BRACKETS.get_or_init(|| Regex::new(r"\[.*?\]|\(.*?\)|（.*?）").unwrap());
    let re_h = RE_HTML.get_or_init(|| Regex::new(r"<[^>]*>").unwrap());

    let no_b = re_b.replace_all(text, "");
    let no_h = re_h.replace_all(&no_b, "");
    let t = apply_katakana_english(no_h.trim());
    if t.is_empty() || is_word {
        return t;
    }
    insert_topic_pause(&t)
}

fn insert_topic_pause(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len() + 4);
    for i in 0..chars.len() {
        out.push(chars[i]);
        if chars[i] == 'は' && i > 0 && i + 1 < chars.len() {
            let prev = chars[i - 1];
            let next = chars[i + 1];
            let prev_ok = !matches!(prev, 'で' | 'じ' | 'ゃ');
            let next_ok = !matches!(next, '、' | '。' | '！' | '？') && !next.is_whitespace();
            if prev_ok && next_ok {
                out.push('、');
            }
        }
    }
    out
}

pub fn tune_audio_query(raw_json: &str, is_word: bool) -> Result<String, String> {
    let mut query: Value = serde_json::from_str(raw_json).map_err(|e| e.to_string())?;
    if is_word {
        if let Some(phrases) = query.get("accent_phrases").and_then(|v| v.as_array()) {
            if phrases.len() > 1 {
                let mut all_moras = Vec::new();
                for p in phrases {
                    if let Some(moras) = p.get("moras").and_then(|m| m.as_array()) {
                        all_moras.extend(moras.iter().cloned());
                    }
                }
                query["accent_phrases"] = serde_json::json!([{
                    "moras": all_moras, "accent": 1, "pause_mora": null, "is_interrogative": false
                }]);
            }
        }
    }
    query["speedScale"] = serde_json::json!(0.95);
    query["prePhonemeLength"] = serde_json::json!(0.10);
    query["postPhonemeLength"] = serde_json::json!(0.20);
    query["intonationScale"] = serde_json::json!(1.10);
    serde_json::to_string(&query).map_err(|e| e.to_string())
}
