#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gpu;
mod routes;
#[cfg(windows)]
mod tray;
#[cfg(windows)]
mod tray_win32;
mod utils;
mod voicevox;

use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
use tiny_http::Server;
use utils::{log_line, resolve_base_dir};
use voicevox::VoicevoxManager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PORT: u16 = 8000;

fn open_browser_silent(url: &str) {
    #[cfg(windows)]
    {
        let local_app = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let candidates = [
            r"C:\Program Files\CocCoc\Browser\Application\browser.exe".to_string(),
            r"C:\Program Files (x86)\CocCoc\Browser\Application\browser.exe".to_string(),
            format!(r"{}\CocCoc\Browser\Application\browser.exe", local_app),
        ];
        if let Some(coccoc) = candidates.iter().find(|p| std::path::Path::new(p).exists()) {
            let mut cmd = Command::new(coccoc);
            cmd.arg(url).stdout(Stdio::null()).stderr(Stdio::null()).creation_flags(CREATE_NO_WINDOW);
            if cmd.spawn().is_ok() {
                return;
            }
        }
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", url])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW);
        let _ = cmd.spawn();
    }
}

fn main() {
    let base_dir = resolve_base_dir();

    log_line(&base_dir, "==========================================");
    log_line(&base_dir, &format!("[SERVER] Starting Minna Rust Server at {:?}", base_dir));

    let vv = Arc::new(VoicevoxManager::new(base_dir.clone()));

    let vv_init = vv.clone();
    std::thread::spawn(move || {
        vv_init.start_engine();
    });

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(800));
        open_browser_silent(&format!("http://localhost:{}/", PORT));
    });

    let addr = format!("0.0.0.0:{}", PORT);
    let server = match Server::http(&addr) {
        Ok(s) => s,
        Err(e) => {
            log_line(&base_dir, &format!("[ERROR] Port {} bind failed: {}", PORT, e));
            return;
        }
    };

    log_line(&base_dir, &format!("[SERVER] Listening on http://{}", addr));

    let vv_srv = vv.clone();
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            let vv_req = vv_srv.clone();
            std::thread::spawn(move || {
                routes::handle_request(request, vv_req);
            });
        }
    });

    #[cfg(windows)]
    tray::run_tray_loop(|| {
        open_browser_silent(&format!("http://localhost:{}/", PORT));
    });

    if let Ok(mut guard) = vv.process.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    log_line(&base_dir, "[SERVER] Exited cleanly.");
}
