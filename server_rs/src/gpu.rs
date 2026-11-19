use serde::Serialize;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize)]
pub struct GpuStatus {
    pub gpu_available: bool,
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u64,
    pub gpu_util_pct: u64,
    pub voicevox_running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub fn query_gpu_status(voicevox_running: bool) -> GpuStatus {
    let mut status = GpuStatus {
        gpu_available: false,
        name: "NVIDIA GeForce RTX 3060".to_string(),
        vram_used_mb: 0,
        vram_total_mb: 6144,
        temp_c: 0,
        gpu_util_pct: 0,
        voicevox_running,
        error: None,
    };

    let mut cmd = Command::new("nvidia-smi");
    cmd.args([
        "--query-gpu=memory.used,memory.total,temperature.gpu,utilization.gpu,name",
        "--format=csv,noheader,nounits",
    ]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.output() {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = text.trim().split(',').map(|s| s.trim()).collect();
            if parts.len() >= 4 {
                status.vram_used_mb = parts[0].parse::<f64>().unwrap_or(0.0) as u64;
                status.vram_total_mb = parts[1].parse::<f64>().unwrap_or(6144.0) as u64;
                status.temp_c = parts[2].parse::<f64>().unwrap_or(0.0) as u64;
                status.gpu_util_pct = parts[3].parse::<f64>().unwrap_or(0.0) as u64;
                if parts.len() >= 5 && !parts[4].is_empty() {
                    status.name = parts[4].to_string();
                }
                status.gpu_available = true;
            }
        }
        Ok(out) => {
            status.error = Some(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Err(e) => {
            status.error = Some(e.to_string());
        }
    }

    status
}
