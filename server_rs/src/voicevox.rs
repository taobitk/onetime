use crate::utils::{clean_tts_text, log_line, tune_audio_query};
use crate::voicevox_ffi::{set_dll_dir, VoicevoxApi};
use crate::voicevox_models::ModelRegistry;
use lru::LruCache;
use std::ffi::c_void;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const VOICEVOX_HOST: &str = "in-process (voicevox_core 0.16.2)";
pub const DEFAULT_SPEAKER_ID: i64 = 2;
const IDLE_TIMEOUT: Duration = Duration::from_secs(120);

pub struct VoicevoxRuntime {
    api: VoicevoxApi,
    open_jtalk: *mut c_void,
    synth: *mut c_void,
    registry: ModelRegistry,
    pub gpu_mode: bool,
}

unsafe impl Send for VoicevoxRuntime {}

impl Drop for VoicevoxRuntime {
    fn drop(&mut self) {
        self.api.synthesizer_delete(self.synth);
        self.api.open_jtalk_delete(self.open_jtalk);
    }
}

#[derive(Clone)]
pub struct VoicevoxManager {
    pub base_dir: PathBuf,
    pub cache: Arc<Mutex<LruCache<String, Vec<u8>>>>,
    runtime: Arc<Mutex<Option<VoicevoxRuntime>>>,
    init_lock: Arc<Mutex<()>>,
    last_activity: Arc<Mutex<Instant>>,
}

impl VoicevoxManager {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            base_dir,
            cache: Arc::new(Mutex::new(LruCache::new(NonZeroUsize::new(800).unwrap()))),
            runtime: Arc::new(Mutex::new(None)),
            init_lock: Arc::new(Mutex::new(())),
            last_activity: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn touch_activity(&self) {
        if let Ok(mut t) = self.last_activity.lock() {
            *t = Instant::now();
        }
    }

    pub fn is_running(&self) -> bool {
        self.runtime.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn is_gpu_mode(&self) -> bool {
        self.runtime.lock().ok().and_then(|g| g.as_ref().map(|r| r.gpu_mode)).unwrap_or(false)
    }

    pub fn ensure_started_async(&self) {
        self.touch_activity();
        if self.is_running() {
            return;
        }
        let vv = self.clone();
        std::thread::spawn(move || {
            vv.start_engine();
        });
    }

    pub fn start_idle_watchdog(&self) {
        let vv = self.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(15));
            let idle = vv.last_activity.lock().map(|t| t.elapsed() >= IDLE_TIMEOUT).unwrap_or(false);
            if idle && vv.is_running() {
                let _guard = vv.init_lock.lock().unwrap();
                let still_idle = vv.last_activity.lock().map(|t| t.elapsed() >= IDLE_TIMEOUT).unwrap_or(false);
                if still_idle && vv.is_running() {
                    vv.shutdown();
                    log_line(&vv.base_dir, "[VOICEVOX Core] Idle > 120s -> Đã giải phóng RAM & VRAM.");
                }
            }
        });
    }

    pub fn start_engine(&self) -> bool {
        let _init_guard = self.init_lock.lock().unwrap();
        self.touch_activity();
        if self.is_running() {
            return true;
        }
        let vv_dir = self.base_dir.join("TTS").join("VOICEVOX").join("vv-engine");
        let dll_path = vv_dir.join("voicevox_core.dll");
        let ort_path = vv_dir.join("voicevox_onnxruntime.dll");
        let dic_dir = vv_dir.join("engine_internal").join("pyopenjtalk").join("open_jtalk_dic_utf_8-1.11");
        let model_dir = vv_dir.join("model");

        let init = || -> Result<VoicevoxRuntime, String> {
            set_dll_dir(&vv_dir);
            let api = VoicevoxApi::load(&dll_path)?;
            let ort = api.load_onnxruntime(&ort_path)?;
            let open_jtalk = api.open_jtalk_new(&dic_dir)?;
            let synth = match api.synthesizer_new(ort, open_jtalk, 2).or_else(|_| api.synthesizer_new(ort, open_jtalk, 0)) {
                Ok(s) => s,
                Err(e) => { api.open_jtalk_delete(open_jtalk); return Err(e); }
            };
            let gpu_mode = api.is_gpu_mode(synth);
            let mut registry = ModelRegistry::scan(&api, &model_dir)?;
            registry.ensure_loaded(&api, synth, DEFAULT_SPEAKER_ID as u32)?;
            Ok(VoicevoxRuntime { api, open_jtalk, synth, registry, gpu_mode })
        };

        match init() {
            Ok(rt) => {
                let gpu = rt.gpu_mode;
                *self.runtime.lock().unwrap() = Some(rt);
                log_line(&self.base_dir, &format!("[VOICEVOX Core] Khởi tạo thành công (GPU={})", gpu));
                self.warmup();
                true
            }
            Err(e) => {
                log_line(&self.base_dir, &format!("[VOICEVOX Core] Lỗi khởi tạo: {}", e));
                false
            }
        }
    }

    pub fn warmup(&self) {
        if let Err(e) = self.synth_stream("あ", DEFAULT_SPEAKER_ID, true) {
            log_line(&self.base_dir, &format!("[VOICEVOX Core] Warm-up warning: {}", e));
        } else {
            log_line(&self.base_dir, "[VOICEVOX Core] Warm-up thành công!");
        }
    }

    pub fn get_speakers(&self) -> Result<Vec<u8>, String> {
        self.touch_activity();
        if !self.is_running() && !self.start_engine() {
            return Err("VOICEVOX Core chưa sẵn sàng".to_string());
        }
        let guard = self.runtime.lock().unwrap();
        let rt = guard.as_ref().ok_or_else(|| "VOICEVOX Core unavailable".to_string())?;
        Ok(rt.registry.speakers_json.clone())
    }

    pub fn synth_stream(&self, text: &str, speaker_id: i64, is_word: bool) -> Result<Vec<u8>, String> {
        self.touch_activity();
        let cleaned = clean_tts_text(text, is_word);
        if cleaned.is_empty() { return Ok(Vec::new()); }

        let cache_key = format!("{}_{}_{}", cleaned, speaker_id, if is_word { 1 } else { 0 });
        if let Some(cached) = self.cache.lock().unwrap().get(&cache_key) {
            return Ok(cached.clone());
        }
        if !self.is_running() && !self.start_engine() {
            return Err("VOICEVOX Core chưa sẵn sàng".to_string());
        }

        let sid = u32::try_from(speaker_id).unwrap_or(DEFAULT_SPEAKER_ID as u32);
        let wav_bytes = {
            let mut guard = self.runtime.lock().unwrap();
            let rt = guard.as_mut().ok_or_else(|| "VOICEVOX Core unavailable".to_string())?;
            rt.registry.ensure_loaded(&rt.api, rt.synth, sid)?;
            let raw_q = rt.api.create_audio_query(rt.synth, &cleaned, sid)?;
            let tuned_q = tune_audio_query(&raw_q, is_word)?;
            rt.api.synthesis(rt.synth, &tuned_q, sid)?
        };

        self.cache.lock().unwrap().put(cache_key, wav_bytes.clone());
        Ok(wav_bytes)
    }

    pub fn shutdown(&self) {
        if let Ok(mut guard) = self.runtime.lock() {
            *guard = None;
        }
        if let Ok(mut cache) = self.cache.lock() {
            cache.clear();
        }
    }
}
