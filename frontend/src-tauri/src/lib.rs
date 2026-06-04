// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Launch the bundled FastAPI backend (PyInstaller binary declared as a Tauri
/// `externalBin` sidecar named `odysseus-server`). Output is forwarded to the
/// host stderr for debugging. Tauri terminates sidecar processes automatically
/// when the app exits.
///
/// Only invoked in release builds: in development the backend is run manually
/// and reached through the Nuxt dev proxy, so we don't spawn a sidecar there.
#[cfg_attr(debug_assertions, allow(dead_code))]
fn spawn_backend(handle: &tauri::AppHandle) -> Result<(), tauri_plugin_shell::Error> {
    let sidecar = handle
        .shell()
        .sidecar("odysseus-server")?
        .env("HOST", "127.0.0.1")
        .env("PORT", "7000");

    let (mut rx, _child) = sidecar.spawn()?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    eprintln!("[backend] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => eprintln!("[backend] error: {err}"),
                CommandEvent::Terminated(payload) => {
                    eprintln!("[backend] terminated: {:?}", payload.code);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Bundled backend only in release; dev uses the Nuxt proxy. Opt out
            // at runtime with ODYSSEUS_NO_SIDECAR=1 (e.g. to target a remote API).
            #[cfg(not(debug_assertions))]
            if std::env::var_os("ODYSSEUS_NO_SIDECAR").is_none() {
                if let Err(e) = spawn_backend(app.handle()) {
                    eprintln!("failed to start backend sidecar: {e}");
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
