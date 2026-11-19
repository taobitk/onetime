#![cfg(windows)]

use crate::tray_win32::*;
use std::mem::{size_of, zeroed};
use std::ptr::null_mut;
use std::sync::OnceLock;

const ID_OPEN: usize = 1001;
const ID_EXIT: usize = 1002;

static OPEN_CB: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();

unsafe extern "system" fn wnd_proc(hwnd: isize, msg: u32, wp: usize, lp: isize) -> isize {
    match msg {
        WM_TRAY => {
            if lp as u32 == WM_RBUTTONUP {
                let menu = CreatePopupMenu();
                let open_txt = wide("Mở Minna (Cốc Cốc)");
                let exit_txt = wide("Thoát Server");
                AppendMenuW(menu, MF_STRING, ID_OPEN, open_txt.as_ptr());
                AppendMenuW(menu, MF_SEPARATOR, 0, std::ptr::null());
                AppendMenuW(menu, MF_STRING, ID_EXIT, exit_txt.as_ptr());
                let mut pt = Point { x: 0, y: 0 };
                GetCursorPos(&mut pt);
                SetForegroundWindow(hwnd);
                TrackPopupMenu(menu, TPM_RIGHTALIGN | TPM_BOTTOMALIGN, pt.x, pt.y, 0, hwnd, std::ptr::null());
                PostMessageW(hwnd, 0, 0, 0);
                DestroyMenu(menu);
            } else if lp as u32 == WM_LBUTTONDBLCLK {
                if let Some(cb) = OPEN_CB.get() { cb(); }
            }
            0
        }
        WM_COMMAND => {
            match wp & 0xFFFF {
                ID_OPEN => if let Some(cb) = OPEN_CB.get() { cb(); },
                ID_EXIT => PostQuitMessage(0),
                _ => {}
            }
            0
        }
        WM_DESTROY => { PostQuitMessage(0); 0 }
        _ => DefWindowProcW(hwnd, msg, wp, lp),
    }
}

pub fn run_tray_loop(on_open: impl Fn() + Send + Sync + 'static) {
    let _ = OPEN_CB.set(Box::new(on_open));
    unsafe {
        let hinst = GetModuleHandleW(std::ptr::null());
        let cls = wide("MinnaTrayClass");
        let wc = WndClassW {
            style: 0, lpfn_wnd_proc: Some(wnd_proc), cb_cls_extra: 0, cb_wnd_extra: 0,
            h_instance: hinst, h_icon: 0, h_cursor: 0, hbr_background: 0,
            lpsz_menu_name: std::ptr::null(), lpsz_class_name: cls.as_ptr(),
        };
        RegisterClassW(&wc);
        let hwnd = CreateWindowExW(0, cls.as_ptr(), cls.as_ptr(), 0, 0, 0, 0, 0, 0, 0, hinst, null_mut());
        let icon = create_app_icon();
        let mut nid: NotifyIconDataW = zeroed();
        nid.cb_size = size_of::<NotifyIconDataW>() as u32;
        nid.h_wnd = hwnd;
        nid.u_id = 1;
        nid.u_flags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
        nid.u_callback_message = WM_TRAY;
        nid.h_icon = icon;
        let tip = wide("Minna no Nihongo Server (Port 8000)");
        let copy_len = tip.len().min(128);
        nid.sz_tip[..copy_len].copy_from_slice(&tip[..copy_len]);
        Shell_NotifyIconW(NIM_ADD, &nid);

        let mut msg: Msg = zeroed();
        while GetMessageW(&mut msg, 0, 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        Shell_NotifyIconW(NIM_DELETE, &nid);
        DestroyIcon(icon);
    }
}
