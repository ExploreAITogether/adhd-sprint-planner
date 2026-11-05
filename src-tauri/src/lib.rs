use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

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
        // Restores window size (and maximized state) across launches; saves
        // automatically on close. Position is deliberately not restored so the
        // window always opens centered. No JS API is used, so no capability
        // permission is needed.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::POSITION)
                .build(),
        )
        .setup(|app| {
            // Center after the plugin has restored the saved size; the
            // config's `center` runs before that, at the default size.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.center();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
