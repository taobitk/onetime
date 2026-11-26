use std::ffi::{c_char, c_void, CStr, CString};
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr;

#[repr(C)]
pub struct LoadOnnxOptions { pub filename: *const c_char }
#[repr(C)]
pub struct InitOptions { pub acceleration_mode: i32, pub cpu_num_threads: u16 }
#[repr(C)]
pub struct SynthOptions { pub enable_interrogative_upspeak: bool }

#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryW(lp_lib_file_name: *const u16) -> *mut c_void;
    fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const c_char) -> *mut c_void;
    fn FreeLibrary(h_lib_module: *mut c_void) -> i32;
    fn SetDllDirectoryW(lp_path_name: *const u16) -> i32;
}

pub fn set_dll_dir(dir: &Path) {
    let wide: Vec<u16> = dir.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    unsafe { SetDllDirectoryW(wide.as_ptr()); }
}

pub struct VoicevoxApi {
    hmod: *mut c_void,
}

unsafe impl Send for VoicevoxApi {}
unsafe impl Sync for VoicevoxApi {}

impl Drop for VoicevoxApi {
    fn drop(&mut self) {
        if !self.hmod.is_null() { unsafe { FreeLibrary(self.hmod); } }
    }
}

impl VoicevoxApi {
    /// Dynamically loads `voicevox_core.dll` via Win32 `LoadLibraryW`.
    pub fn load(dll_path: &Path) -> Result<Self, String> {
        let wide: Vec<u16> = dll_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        let hmod = unsafe { LoadLibraryW(wide.as_ptr()) };
        if hmod.is_null() {
            return Err(format!("LoadLibraryW failed for {:?}", dll_path));
        }
        Ok(Self { hmod })
    }

    unsafe fn sym<T: Copy>(&self, name: &str) -> Result<T, String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let ptr = GetProcAddress(self.hmod, c_name.as_ptr());
        if ptr.is_null() {
            return Err(format!("Missing symbol: {}", name));
        }
        Ok(std::mem::transmute_copy(&ptr))
    }

    pub fn err_msg(&self, code: i32) -> String {
        unsafe {
            let Ok(f) = self.sym::<unsafe extern "C" fn(i32) -> *const c_char>("voicevox_error_result_to_message") else {
                return format!("VOICEVOX error code {}", code);
            };
            let ptr = f(code);
            if ptr.is_null() { format!("VOICEVOX error code {}", code) } else { CStr::from_ptr(ptr).to_string_lossy().into_owned() }
        }
    }

    fn check(&self, code: i32, ctx: &str) -> Result<(), String> {
        if code == 0 { Ok(()) } else { Err(format!("{}: {}", ctx, self.err_msg(code))) }
    }

    fn take_c_string(&self, ptr: *mut c_char, free_sym: &str) -> Result<String, String> {
        if ptr.is_null() { return Err("Null C string returned".to_string()); }
        unsafe {
            let s = CStr::from_ptr(ptr).to_string_lossy().into_owned();
            if let Ok(free) = self.sym::<unsafe extern "C" fn(*mut c_char)>(free_sym) { free(ptr); }
            Ok(s)
        }
    }

    pub fn load_onnxruntime(&self, ort_path: &Path) -> Result<*const c_void, String> {
        let c_path = CString::new(ort_path.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(LoadOnnxOptions, *mut *const c_void) -> i32>("voicevox_onnxruntime_load_once")?;
            let mut ort: *const c_void = ptr::null();
            self.check(f(LoadOnnxOptions { filename: c_path.as_ptr() }, &mut ort), "onnxruntime_load_once")?;
            Ok(ort)
        }
    }

    pub fn open_jtalk_new(&self, dic_dir: &Path) -> Result<*mut c_void, String> {
        let c_dir = CString::new(dic_dir.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_char, *mut *mut c_void) -> i32>("voicevox_open_jtalk_rc_new")?;
            let mut oj: *mut c_void = ptr::null_mut();
            self.check(f(c_dir.as_ptr(), &mut oj), "open_jtalk_rc_new")?;
            Ok(oj)
        }
    }

    pub fn open_jtalk_delete(&self, oj: *mut c_void) {
        if !oj.is_null() { unsafe { if let Ok(f) = self.sym::<unsafe extern "C" fn(*mut c_void)>("voicevox_open_jtalk_rc_delete") { f(oj); } } }
    }

    pub fn synthesizer_new(&self, ort: *const c_void, oj: *const c_void, accel: i32) -> Result<*mut c_void, String> {
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void, *const c_void, InitOptions, *mut *mut c_void) -> i32>("voicevox_synthesizer_new")?;
            let mut synth: *mut c_void = ptr::null_mut();
            self.check(f(ort, oj, InitOptions { acceleration_mode: accel, cpu_num_threads: 0 }, &mut synth), "synthesizer_new")?;
            Ok(synth)
        }
    }

    pub fn synthesizer_delete(&self, synth: *mut c_void) {
        if !synth.is_null() { unsafe { if let Ok(f) = self.sym::<unsafe extern "C" fn(*mut c_void)>("voicevox_synthesizer_delete") { f(synth); } } }
    }

    pub fn is_gpu_mode(&self, synth: *const c_void) -> bool {
        unsafe { self.sym::<unsafe extern "C" fn(*const c_void) -> bool>("voicevox_synthesizer_is_gpu_mode").map(|f| f(synth)).unwrap_or(false) }
    }

    pub fn model_open(&self, path: &Path) -> Result<*mut c_void, String> {
        let c_path = CString::new(path.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_char, *mut *mut c_void) -> i32>("voicevox_voice_model_file_open")?;
            let mut model: *mut c_void = ptr::null_mut();
            self.check(f(c_path.as_ptr(), &mut model), "voice_model_file_open")?;
            Ok(model)
        }
    }

    pub fn model_id(&self, model: *const c_void) -> Result<[u8; 16], String> {
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void, *mut [u8; 16])>("voicevox_voice_model_file_id")?;
            let mut id = [0u8; 16];
            f(model, &mut id);
            Ok(id)
        }
    }

    pub fn model_metas_json(&self, model: *const c_void) -> Result<String, String> {
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void) -> *mut c_char>("voicevox_voice_model_file_create_metas_json")?;
            self.take_c_string(f(model), "voicevox_json_free")
        }
    }

    pub fn model_delete(&self, model: *mut c_void) {
        if !model.is_null() { unsafe { if let Ok(f) = self.sym::<unsafe extern "C" fn(*mut c_void)>("voicevox_voice_model_file_delete") { f(model); } } }
    }

    pub fn load_model(&self, synth: *const c_void, model: *const c_void) -> Result<(), String> {
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void, *const c_void) -> i32>("voicevox_synthesizer_load_voice_model")?;
            self.check(f(synth, model), "load_voice_model")
        }
    }

    pub fn unload_model(&self, synth: *const c_void, id: &[u8; 16]) -> Result<(), String> {
        unsafe { self.check(self.sym::<unsafe extern "C" fn(*const c_void, *const [u8; 16]) -> i32>("voicevox_synthesizer_unload_voice_model")?(synth, id as *const [u8; 16]), "unload_voice_model") }
    }

    pub fn create_audio_query(&self, synth: *const c_void, text: &str, style_id: u32) -> Result<String, String> {
        let c_text = CString::new(text).map_err(|e| e.to_string())?;
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void, *const c_char, u32, *mut *mut c_char) -> i32>("voicevox_synthesizer_create_audio_query")?;
            let mut ptr: *mut c_char = ptr::null_mut();
            self.check(f(synth, c_text.as_ptr(), style_id, &mut ptr), "create_audio_query")?;
            self.take_c_string(ptr, "voicevox_json_free")
        }
    }

    pub fn synthesis(&self, synth: *const c_void, query_json: &str, style_id: u32) -> Result<Vec<u8>, String> {
        let c_json = CString::new(query_json).map_err(|e| e.to_string())?;
        unsafe {
            let f = self.sym::<unsafe extern "C" fn(*const c_void, *const c_char, u32, SynthOptions, *mut usize, *mut *mut u8) -> i32>("voicevox_synthesizer_synthesis")?;
            let free = self.sym::<unsafe extern "C" fn(*mut u8)>("voicevox_wav_free")?;
            let mut len: usize = 0;
            let mut ptr: *mut u8 = ptr::null_mut();
            self.check(f(synth, c_json.as_ptr(), style_id, SynthOptions { enable_interrogative_upspeak: true }, &mut len, &mut ptr), "synthesis")?;
            let bytes = std::slice::from_raw_parts(ptr, len).to_vec();
            free(ptr);
            Ok(bytes)
        }
    }
}
