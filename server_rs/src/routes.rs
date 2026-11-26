use crate::gpu::query_gpu_status;
use crate::voicevox::{VoicevoxManager, DEFAULT_SPEAKER_ID, VOICEVOX_HOST};
use serde_json::json;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tiny_http::{Header, Method, Request, Response};

fn hdr(name: &str, val: &str) -> Header {
    Header::from_bytes(name.as_bytes(), val.as_bytes()).unwrap()
}

fn send_json<T: serde::Serialize>(req: Request, status: u16, val: &T, cache: Option<&str>) {
    let body = serde_json::to_vec(val).unwrap_or_default();
    let mut resp = Response::from_data(body).with_status_code(status)
        .with_header(hdr("Content-Type", "application/json; charset=utf-8"))
        .with_header(hdr("Access-Control-Allow-Origin", "*"));
    if let Some(c) = cache { resp.add_header(hdr("Cache-Control", c)); }
    let _ = req.respond(resp);
}

fn send_redirect(req: Request, target: &str, query: Option<&str>) {
    let loc = match query { Some(q) if !q.is_empty() => format!("{}?{}", target, q), _ => target.to_string() };
    let resp = Response::empty(302).with_header(hdr("Location", &loc)).with_header(hdr("Access-Control-Allow-Origin", "*"));
    let _ = req.respond(resp);
}

fn parse_query_params(qs: &str) -> Vec<(String, String)> {
    qs.split('&').filter(|p| !p.is_empty()).map(|p| {
        let mut it = p.splitn(2, '=');
        let k = urlencoding::decode(it.next().unwrap_or("")).unwrap_or_default().into_owned();
        let v = urlencoding::decode(it.next().unwrap_or("")).unwrap_or_default().into_owned();
        (k, v)
    }).collect()
}

fn content_type_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase().as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "mp3" => "audio/mpeg", "wav" => "audio/wav",
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml", "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

pub fn handle_request(req: Request, vv: Arc<VoicevoxManager>) {
    let raw_url = req.url().to_string();
    let (raw_path, raw_query) = match raw_url.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (raw_url.as_str(), None),
    };

    if req.method() == &Method::Options {
        let resp = Response::empty(200)
            .with_header(hdr("Access-Control-Allow-Origin", "*"))
            .with_header(hdr("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
            .with_header(hdr("Access-Control-Allow-Headers", "Content-Type"));
        let _ = req.respond(resp);
        return;
    }

    match raw_path {
        "/api/health" => {
            let gpu = query_gpu_status(vv.is_running());
            send_json(req, 200, &json!({
                "status": "ok", "engine": "VOICEVOX Core 0.16.2 In-Process GPU [Rust]",
                "acceleration": if vv.is_gpu_mode() { "DirectML GPU" } else { "CPU" },
                "is_gpu_mode": vv.is_gpu_mode(),
                "default_speaker": DEFAULT_SPEAKER_ID,
                "voicevox_host": VOICEVOX_HOST, "gpu": gpu
            }), None);
        }
        "/api/ping" => {
            vv.touch_activity();
            send_json(req, 200, &json!({ "status": "ok" }), Some("no-store"));
        }
        "/api/gpu_status" => send_json(req, 200, &query_gpu_status(vv.is_running()), Some("no-cache")),
        "/api/speakers" => match vv.get_speakers() {
            Ok(bytes) => {
                let resp = Response::from_data(bytes).with_status_code(200)
                    .with_header(hdr("Content-Type", "application/json; charset=utf-8"))
                    .with_header(hdr("Cache-Control", "public, max-age=3600"))
                    .with_header(hdr("Access-Control-Allow-Origin", "*"));
                let _ = req.respond(resp);
            }
            Err(e) => send_json(req, 500, &json!({ "status": "error", "message": e }), None),
        },
        "/api/voicevox" | "/api/edge" | "/api/tts" => {
            let params = parse_query_params(raw_query.unwrap_or(""));
            let text = params.iter().find(|(k, _)| k == "text").map(|(_, v)| v.as_str()).unwrap_or("");
            let speaker = params.iter().find(|(k, _)| k == "speaker").and_then(|(_, v)| v.parse().ok()).unwrap_or(DEFAULT_SPEAKER_ID);
            let is_word = params.iter().find(|(k, _)| k == "is_word").map(|(_, v)| matches!(v.as_str(), "1" | "true" | "True")).unwrap_or(false);
            match vv.synth_stream(text, speaker, is_word) {
                Ok(wav) => {
                    let resp = Response::from_data(wav).with_status_code(200)
                        .with_header(hdr("Content-Type", "audio/wav"))
                        .with_header(hdr("Cache-Control", "public, max-age=86400"))
                        .with_header(hdr("Access-Control-Allow-Origin", "*"));
                    let _ = req.respond(resp);
                }
                Err(e) => send_json(req, 500, &json!({ "status": "error", "message": e }), None),
            }
        }
        "/" | "/index.html" => {
            vv.ensure_started_async();
            serve_static(req, "/index.html", &vv.base_dir);
        }
        "/tu_vung" | "/tu-vung" | "/tuvung" | "/tu_vung.html" | "/t%E1%BB%AB%20v%E1%BB%B1ng.html" => send_redirect(req, "/", raw_query),
        "/the_te" | "/the-te" | "/thete" | "/luyen_the_te.html" => send_redirect(req, "/pages/luyen_the_te.html", raw_query),
        "/chia_the" | "/chia-the" => send_redirect(req, "/pages/chia_the.html", raw_query),
        "/bai_tap_bai_12.html" => send_redirect(req, "/pages/bai_tap_bai_12.html", raw_query),
        _ => serve_static(req, raw_path, &vv.base_dir),
    }
}

fn serve_static(req: Request, raw_path: &str, base_dir: &Path) {
    let decoded = urlencoding::decode(raw_path).unwrap_or_default();
    let rel = decoded.trim_start_matches('/');
    if rel.contains("..") { let _ = req.respond(Response::empty(403)); return; }
    let file_path = if rel.starts_with("data/") || rel.starts_with("audio/") {
        base_dir.join(rel)
    } else if rel.ends_with(".json") && !rel.contains('/') {
        base_dir.join("data/vocab").join(rel)
    } else {
        base_dir.join("web").join(rel)
    };
    if !file_path.is_file() { let _ = req.respond(Response::empty(404)); return; }
    if let Ok(file) = fs::File::open(&file_path) {
        let mut resp = Response::from_file(file)
            .with_header(hdr("Content-Type", content_type_for(&file_path)))
            .with_header(hdr("Access-Control-Allow-Origin", "*"));
        if matches!(file_path.extension().and_then(|e| e.to_str()), Some("json" | "js" | "html")) {
            resp.add_header(hdr("Cache-Control", "no-cache, must-revalidate"));
        }
        let _ = req.respond(resp);
    } else {
        let _ = req.respond(Response::empty(500));
    }
}
