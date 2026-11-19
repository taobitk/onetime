use crate::utils::{clean_tts_text, log_line};
use lru::LruCache;
use serde_json::Value;
use std::io::Read;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const VOICEVOX_HOST: &str = "http://127.0.0.1:50021";
pub const DEFAULT_SPEAKER_ID: i64 = 2;

#[derive(Clone)]
pub struct VoicevoxManager {
    pub base_dir: PathBuf,
    pub agent: ureq::Agent,
    pub cache: Arc<Mutex<LruCache<String, Vec<u8>>>>,
    pub process: Arc<Mutex<Option<Child>>>,
}

impl VoicevoxManager {
    pub fn new(base_dir: PathBuf) -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_read(Duration::from_secs(20))
            .timeout_connect(Duration::from_secs(5))
            .build();
        Self {
            base_dir,
            agent,
            cache: Arc::new(Mutex::new(LruCache::new(NonZeroUsize::new(800).unwrap()))),
            process: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_running(&self) -> bool {
        let url = format!("{}/version", VOICEVOX_HOST);
        self.agent.get(&url).timeout(Duration::from_secs(1)).call().is_ok()
    }

    pub fn start_engine(&self) -> bool {
        if self.is_running() {
            log_line(&self.base_dir, "[VOICEVOX GPU] Engine đã hoạt động sẵn sàng.");
            self.warmup();
            return true;
        }
        let engine_path = self.base_dir.join("TTS").join("VOICEVOX").join("vv-engine").join("run.exe");
        if !engine_path.exists() {
            log_line(&self.base_dir, &format!("[VOICEVOX GPU] Không tìm thấy run.exe tại {:?}", engine_path));
            return false;
        }
        let engine_dir = engine_path.parent().unwrap_or(&self.base_dir);
        let mut cmd = Command::new(&engine_path);
        cmd.args(["--use_gpu", "--host", "127.0.0.1", "--port", "50021"])
            .current_dir(engine_dir).env("PYTHONUTF8", "1").env("PYTHONIOENCODING", "utf-8")
            .stdout(Stdio::null()).stderr(Stdio::null());
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        match cmd.spawn() {
            Ok(child) => {
                *self.process.lock().unwrap() = Some(child);
                for _ in 0..25 {
                    std::thread::sleep(Duration::from_millis(400));
                    if self.is_running() {
                        log_line(&self.base_dir, "[VOICEVOX GPU] Đã kết nối GPU Engine thành công!");
                        self.warmup();
                        return true;
                    }
                }
                true
            }
            Err(e) => { log_line(&self.base_dir, &format!("[VOICEVOX GPU] Lỗi: {}", e)); false }
        }
    }

    pub fn warmup(&self) {
        if let Err(e) = self.synth_stream("あ", DEFAULT_SPEAKER_ID, true) {
            log_line(&self.base_dir, &format!("[VOICEVOX GPU] Warm-up warning: {}", e));
        } else {
            log_line(&self.base_dir, "[VOICEVOX GPU] Warm-up thành công trên GPU!");
        }
    }

    pub fn get_speakers(&self) -> Result<Vec<u8>, String> {
        let url = format!("{}/speakers", VOICEVOX_HOST);
        let resp = self.agent.get(&url).timeout(Duration::from_secs(5)).call().map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        resp.into_reader().read_to_end(&mut bytes).map_err(|e| e.to_string())?;
        Ok(bytes)
    }

    pub fn synth_stream(&self, text: &str, speaker_id: i64, is_word: bool) -> Result<Vec<u8>, String> {
        let cleaned = clean_tts_text(text, is_word);
        if cleaned.is_empty() {
            return Ok(Vec::new());
        }
        let cache_key = format!("{}_{}_{}", cleaned, speaker_id, if is_word { 1 } else { 0 });
        if let Some(cached) = self.cache.lock().unwrap().get(&cache_key) {
            return Ok(cached.clone());
        }
        if !self.is_running() {
            self.start_engine();
        }

        let encoded = urlencoding::encode(&cleaned);
        let q_url = format!("{}/audio_query?text={}&speaker={}", VOICEVOX_HOST, encoded, speaker_id);
        let mut query: Value = self.agent.post(&q_url).call().map_err(|e| e.to_string())?
            .into_json().map_err(|e| e.to_string())?;

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
                        "moras": all_moras,
                        "accent": 1,
                        "pause_mora": null,
                        "is_interrogative": false
                    }]);
                }
            }
        }
        query["speedScale"] = serde_json::json!(0.95);
        query["prePhonemeLength"] = serde_json::json!(0.10);
        query["postPhonemeLength"] = serde_json::json!(0.20);
        query["intonationScale"] = serde_json::json!(1.10);

        let s_url = format!("{}/synthesis?speaker={}", VOICEVOX_HOST, speaker_id);
        let resp = self.agent.post(&s_url).send_json(&query).map_err(|e| e.to_string())?;
        let mut wav_bytes = Vec::new();
        resp.into_reader().read_to_end(&mut wav_bytes).map_err(|e| e.to_string())?;

        self.cache.lock().unwrap().put(cache_key, wav_bytes.clone());
        Ok(wav_bytes)
    }
}
