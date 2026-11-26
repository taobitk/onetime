use crate::voicevox_ffi::VoicevoxApi;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::ffi::c_void;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_LOADED_MODELS: usize = 2;

pub struct ModelRegistry {
    pub speakers_json: Vec<u8>,
    pub style_to_file: HashMap<u32, PathBuf>,
    loaded: VecDeque<(PathBuf, [u8; 16])>,
}

impl ModelRegistry {
    /// Scans `*.vvm` files (skipping singing `s*.vvm`) to build `/api/speakers` metadata
    /// and a `style_id -> .vvm path` lookup table without loading weights into memory.
    pub fn scan(api: &VoicevoxApi, model_dir: &Path) -> Result<Self, String> {
        let mut paths: Vec<PathBuf> = fs::read_dir(model_dir)
            .map_err(|e| format!("Failed to read {:?}: {}", model_dir, e))?
            .filter_map(|e| e.ok().map(|x| x.path()))
            .filter(|p| {
                p.extension().and_then(|e| e.to_str()) == Some("vvm")
                    && !p.file_name().and_then(|n| n.to_str()).unwrap_or("").starts_with('s')
            })
            .collect();
        paths.sort_by_key(|p| {
            p.file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(u32::MAX)
        });

        let mut merged: Vec<Value> = Vec::new();
        let mut style_to_file: HashMap<u32, PathBuf> = HashMap::new();

        for path in paths {
            let handle = match api.model_open(&path) {
                Ok(h) => h,
                Err(_) => continue,
            };
            let metas_str = api.model_metas_json(handle);
            api.model_delete(handle);
            let Ok(json_str) = metas_str else { continue };
            let Ok(items) = serde_json::from_str::<Vec<Value>>(&json_str) else { continue };

            for item in items {
                if let Some(styles) = item.get("styles").and_then(|s| s.as_array()) {
                    for st in styles {
                        if let Some(id) = st.get("id").and_then(|v| v.as_u64()) {
                            style_to_file.entry(id as u32).or_insert_with(|| path.clone());
                        }
                    }
                }
                merge_speaker(&mut merged, item);
            }
        }

        let speakers_json = serde_json::to_vec(&merged).unwrap_or_else(|_| b"[]".to_vec());
        Ok(Self {
            speakers_json,
            style_to_file,
            loaded: VecDeque::new(),
        })
    }

    /// Ensures the `.vvm` containing `style_id` is loaded in `synthesizer`,
    /// evicting the least-recently-used `.vvm` when `MAX_LOADED_MODELS` is reached.
    pub fn ensure_loaded(
        &mut self,
        api: &VoicevoxApi,
        synth: *const c_void,
        style_id: u32,
    ) -> Result<(), String> {
        let target_path = self
            .style_to_file
            .get(&style_id)
            .ok_or_else(|| format!("Unknown speaker style_id {}", style_id))?
            .clone();

        if let Some(pos) = self.loaded.iter().position(|(p, _)| p == &target_path) {
            if let Some(entry) = self.loaded.remove(pos) {
                self.loaded.push_back(entry);
            }
            return Ok(());
        }

        while self.loaded.len() >= MAX_LOADED_MODELS {
            if let Some((_, old_id)) = self.loaded.pop_front() {
                let _ = api.unload_model(synth, &old_id);
            }
        }

        let handle = api.model_open(&target_path)?;
        let model_id = api.model_id(handle)?;
        let load_res = api.load_model(synth, handle);
        api.model_delete(handle);
        load_res?;

        self.loaded.push_back((target_path, model_id));
        Ok(())
    }
}

fn merge_speaker(merged: &mut Vec<Value>, item: Value) {
    let uuid = item.get("speaker_uuid").and_then(|v| v.as_str()).unwrap_or("");
    if let Some(existing) = merged
        .iter_mut()
        .find(|m| m.get("speaker_uuid").and_then(|v| v.as_str()) == Some(uuid))
    {
        if let (Some(dst), Some(src)) = (
            existing.get_mut("styles").and_then(|v| v.as_array_mut()),
            item.get("styles").and_then(|v| v.as_array()),
        ) {
            for st in src {
                let st_id = st.get("id").and_then(|v| v.as_u64());
                if !dst.iter().any(|x| x.get("id").and_then(|v| v.as_u64()) == st_id) {
                    dst.push(st.clone());
                }
            }
        }
    } else {
        merged.push(item);
    }
}
