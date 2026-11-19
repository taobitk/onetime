use regex::Regex;
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
    let t = no_h.trim().to_string();
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
