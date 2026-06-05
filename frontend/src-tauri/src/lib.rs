// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_updater::UpdaterExt;

/// Launch the bundled FastAPI backend (PyInstaller binary declared as a Tauri
/// `externalBin` sidecar named `odysseus-server`). Output is forwarded to the
/// host stderr for debugging. Tauri terminates sidecar processes automatically
/// when the app exits.
///
/// Only invoked in release builds: in development the backend is run manually
/// and reached through the Nuxt dev proxy, so we don't spawn a sidecar there.
#[cfg_attr(debug_assertions, allow(dead_code))]
fn spawn_backend(handle: &AppHandle) -> Result<(), tauri_plugin_shell::Error> {
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

/// Bring the main window to the foreground (used by the tray).
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Check the configured update endpoint and, if a newer signed release exists,
/// download + install it then restart. No-ops (logs) when the updater isn't
/// configured (empty pubkey/endpoint) — see plugins.updater in tauri.conf.json.
fn trigger_update(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match app.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    eprintln!("[updater] {} available — downloading…", update.version);
                    match update.download_and_install(|_, _| {}, || {}).await {
                        Ok(_) => app.restart(),
                        Err(e) => eprintln!("[updater] install failed: {e}"),
                    }
                }
                Ok(None) => eprintln!("[updater] already up to date"),
                Err(e) => eprintln!("[updater] check failed: {e}"),
            },
            Err(e) => eprintln!("[updater] not configured: {e}"),
        }
    });
}

/// Native application menu (app / Edit / View).
fn build_menu(app: &AppHandle) -> tauri::Result<()> {
    let check = MenuItemBuilder::with_id("check_update", "Check for Updates…").build(app)?;

    let app_menu = SubmenuBuilder::new(app, "Odysseus")
        .item(&check)
        .separator()
        .hide()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View").fullscreen().build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &edit_menu, &view_menu])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

/// System tray with show / update / quit, and left-click to reveal the window.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let tray_menu = MenuBuilder::new(app)
        .text("show", "Show Odysseus")
        .text("check_update", "Check for Updates…")
        .separator()
        .quit()
        .build()?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("a default window icon is configured in tauri.conf.json");

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Odysseus")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "check_update" => trigger_update(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            build_menu(app.handle())?;
            build_tray(app.handle())?;

            // Bundled backend only in release; dev uses the Nuxt proxy. Opt out
            // at runtime with ODYSSEUS_NO_SIDECAR=1 (e.g. to target a remote API).
            #[cfg(not(debug_assertions))]
            if std::env::var_os("ODYSSEUS_NO_SIDECAR").is_none() {
                if let Err(e) = spawn_backend(app.handle()) {
                    eprintln!("failed to start backend sidecar: {e}");
                }
            }
            Ok(())
        })
        // Window-menu events (the tray has its own handler).
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check_update" {
                trigger_update(app);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
