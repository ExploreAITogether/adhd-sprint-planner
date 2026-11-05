use serde::Deserialize;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};
use tauri_plugin_window_state::{StateFlags, DEFAULT_FILENAME};

/// Largest share of the screen's usable area a restored window may cover.
const MAX_SCREEN_FRACTION: f64 = 0.9;

/// The fields we need from tauri-plugin-window-state's saved file. Width and
/// height are the window's inner size in physical pixels.
#[derive(Deserialize)]
struct SavedWindowState {
    width: u32,
    height: u32,
    #[serde(default)]
    maximized: bool,
}

fn load_saved_state<R: Runtime>(window: &WebviewWindow<R>) -> Option<SavedWindowState> {
    let path = window.app_handle().path().app_config_dir().ok()?.join(DEFAULT_FILENAME);
    let text = std::fs::read_to_string(path).ok()?;
    let mut states: std::collections::HashMap<String, SavedWindowState> =
        serde_json::from_str(&text).ok()?;
    states.remove(window.label()).filter(|s| s.width > 0 && s.height > 0)
}

/// Place the main window before it is first shown: restore the saved size,
/// shrunk to fit the current screen, and center it in the usable area
/// (excluding the menu bar and Dock / taskbar).
///
/// This is done here instead of by the window-state plugin because on macOS
/// size changes are applied asynchronously, so centering right after the
/// plugin's restore measured the old default size and the window then grew
/// off to the right. It also stops a size saved on a bigger monitor from
/// overflowing a smaller screen. Every size here is computed, never read back.
fn place_main_window<R: Runtime>(window: &WebviewWindow<R>) {
    let saved = load_saved_state(window);

    let (Ok(Some(monitor)), Ok(outer), Ok(inner)) = (
        window.current_monitor().or_else(|_| window.primary_monitor()),
        window.outer_size(),
        window.inner_size(),
    ) else {
        let _ = window.center();
        return;
    };
    let area = monitor.work_area();

    // Window chrome (title bar) is the gap between outer and inner size. The
    // window was just created at its config size, so these reads are current.
    let chrome_w = outer.width.saturating_sub(inner.width);
    let chrome_h = outer.height.saturating_sub(inner.height);

    let (inner_w, inner_h) = saved
        .as_ref()
        .map_or((inner.width, inner.height), |s| (s.width, s.height));
    let max_w = (area.size.width as f64 * MAX_SCREEN_FRACTION) as u32;
    let max_h = (area.size.height as f64 * MAX_SCREEN_FRACTION) as u32;
    let outer_w = (inner_w + chrome_w).min(max_w);
    let outer_h = (inner_h + chrome_h).min(max_h);

    let _ = window.set_size(PhysicalSize::new(
        outer_w.saturating_sub(chrome_w),
        outer_h.saturating_sub(chrome_h),
    ));
    let x = area.position.x + (area.size.width.saturating_sub(outer_w) / 2) as i32;
    let y = area.position.y + (area.size.height.saturating_sub(outer_h) / 2) as i32;
    let _ = window.set_position(PhysicalPosition::new(x, y));

    if saved.is_some_and(|s| s.maximized) {
        let _ = window.maximize();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Opens the "get a Gemini API key" link in the system browser. The
        // capability in capabilities/default.json limits it to that one URL.
        .plugin(tauri_plugin_opener::init())
        // Saves window size and maximized state automatically on close. It
        // doesn't restore the main window itself (skip_initial_state);
        // place_main_window does that, so the window always opens centered.
        // No JS API is used, so no capability permission is needed.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::MAXIMIZED)
                .skip_initial_state("main")
                .build(),
        )
        .setup(|app| {
            // The main window starts hidden (tauri.conf.json `visible: false`)
            // so it appears only once it's sized and centered. The show call
            // is queued after the size and position changes.
            if let Some(window) = app.get_webview_window("main") {
                place_main_window(&window);
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
