#![cfg(windows)]

pub const WM_DESTROY: u32 = 0x0002;
pub const WM_COMMAND: u32 = 0x0111;
pub const WM_LBUTTONDBLCLK: u32 = 0x0203;
pub const WM_RBUTTONUP: u32 = 0x0205;
pub const WM_TRAY: u32 = 0x8001;

pub const NIM_ADD: u32 = 0x0000_0000;
pub const NIM_DELETE: u32 = 0x0000_0002;
pub const NIF_MESSAGE: u32 = 0x0000_0001;
pub const NIF_ICON: u32 = 0x0000_0002;
pub const NIF_TIP: u32 = 0x0000_0004;
pub const MF_STRING: u32 = 0x0000_0000;
pub const MF_SEPARATOR: u32 = 0x0000_0800;
pub const TPM_RIGHTALIGN: u32 = 0x0008;
pub const TPM_BOTTOMALIGN: u32 = 0x0020;

#[repr(C)]
pub struct Point { pub x: i32, pub y: i32 }
#[repr(C)]
pub struct Msg { pub hwnd: isize, pub message: u32, pub w_param: usize, pub l_param: isize, pub time: u32, pub pt: Point }
#[repr(C)]
pub struct IconInfo { pub f_icon: i32, pub x_hotspot: u32, pub y_hotspot: u32, pub hbm_mask: isize, pub hbm_color: isize }

#[repr(C)]
pub struct WndClassW {
    pub style: u32,
    pub lpfn_wnd_proc: Option<unsafe extern "system" fn(isize, u32, usize, isize) -> isize>,
    pub cb_cls_extra: i32, pub cb_wnd_extra: i32, pub h_instance: isize,
    pub h_icon: isize, pub h_cursor: isize, pub hbr_background: isize,
    pub lpsz_menu_name: *const u16, pub lpsz_class_name: *const u16,
}

#[repr(C)]
pub struct NotifyIconDataW {
    pub cb_size: u32, pub h_wnd: isize, pub u_id: u32, pub u_flags: u32, pub u_callback_message: u32, pub h_icon: isize,
    pub sz_tip: [u16; 128], pub dw_state: u32, pub dw_state_mask: u32, pub sz_info: [u16; 256],
    pub u_ver: u32, pub sz_info_title: [u16; 64], pub dw_info_flags: u32, pub guid: [u8; 16], pub h_balloon: isize,
}

#[link(name = "kernel32")]
extern "system" { pub fn GetModuleHandleW(name: *const u16) -> isize; }
#[link(name = "gdi32")]
extern "system" {
    pub fn CreateBitmap(w: i32, h: i32, planes: u32, bpp: u32, bits: *const u8) -> isize;
    pub fn DeleteObject(obj: isize) -> i32;
}
#[link(name = "shell32")]
extern "system" { pub fn Shell_NotifyIconW(msg: u32, data: *const NotifyIconDataW) -> i32; }
#[link(name = "user32")]
extern "system" {
    pub fn RegisterClassW(wc: *const WndClassW) -> u16;
    pub fn CreateWindowExW(ex: u32, cls: *const u16, title: *const u16, style: u32, x: i32, y: i32, w: i32, h: i32, p: isize, m: isize, i: isize, lp: *mut u8) -> isize;
    pub fn DefWindowProcW(hwnd: isize, msg: u32, wp: usize, lp: isize) -> isize;
    pub fn GetMessageW(msg: *mut Msg, hwnd: isize, min: u32, max: u32) -> i32;
    pub fn TranslateMessage(msg: *const Msg) -> i32;
    pub fn DispatchMessageW(msg: *const Msg) -> isize;
    pub fn PostMessageW(hwnd: isize, msg: u32, wp: usize, lp: isize) -> i32;
    pub fn PostQuitMessage(code: i32);
    pub fn CreatePopupMenu() -> isize;
    pub fn AppendMenuW(menu: isize, flags: u32, id: usize, item: *const u16) -> i32;
    pub fn TrackPopupMenu(menu: isize, flags: u32, x: i32, y: i32, res: i32, hwnd: isize, rect: *const u8) -> i32;
    pub fn DestroyMenu(menu: isize) -> i32;
    pub fn GetCursorPos(pt: *mut Point) -> i32;
    pub fn SetForegroundWindow(hwnd: isize) -> i32;
    pub fn CreateIconIndirect(info: *const IconInfo) -> isize;
    pub fn DestroyIcon(icon: isize) -> i32;
}

pub fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() }

pub fn create_app_icon() -> isize {
    let mut bgra = vec![0u8; 32 * 32 * 4];
    for y in 0..32i32 {
        for x in 0..32i32 {
            let idx = ((y * 32 + x) * 4) as usize;
            let dx = x - 16;
            let dy = y - 16;
            let r2 = dx * dx + dy * dy;
            let in_box = x >= 2 && x < 30 && y >= 2 && y < 30
                && !((x < 6 || x >= 26) && (y < 6 || y >= 26) && (dx.abs() + dy.abs() > 24));
            let (b, g, r, a) = if r2 <= 36 {
                (68, 68, 239, 255)
            } else if r2 <= 100 {
                (255, 255, 255, 255)
            } else if in_box {
                (235, 99, 37, 255)
            } else {
                (0, 0, 0, 0)
            };
            bgra[idx] = b; bgra[idx + 1] = g; bgra[idx + 2] = r; bgra[idx + 3] = a;
        }
    }
    unsafe {
        let color_bmp = CreateBitmap(32, 32, 1, 32, bgra.as_ptr());
        let mask_bytes = vec![0u8; 32 * 4];
        let mask_bmp = CreateBitmap(32, 32, 1, 1, mask_bytes.as_ptr());
        let info = IconInfo { f_icon: 1, x_hotspot: 0, y_hotspot: 0, hbm_mask: mask_bmp, hbm_color: color_bmp };
        let icon = CreateIconIndirect(&info);
        DeleteObject(color_bmp);
        DeleteObject(mask_bmp);
        icon
    }
}
