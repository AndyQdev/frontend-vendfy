//! Vendfy para Windows: el mismo panel de app.vendfy.shop en una ventana propia,
//! más lo que el navegador no puede hacer:
//!
//! - arrancar con Windows (minimizado en la bandeja del reloj);
//! - F9 desde cualquier programa: trae Vendfy y abre el micrófono;
//! - cerrar la ventana la esconde en la bandeja (sigue escuchando «Oye Vendfy»);
//! - una sola instancia: abrirla de nuevo trae la que ya estaba;
//! - el panel le pide traer la ventana al frente cuando oye la palabra.
//!
//! `VENDFY_URL` cambia la dirección (para probar contra el panel local).

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

// El panel publicado en la cuenta de Vercel que funciona (app.vendfy.shop
// sigue en la cuenta pausada hasta que se verifique el dominio). Las dos
// direcciones sirven el mismo panel.
const URL_POR_DEFECTO: &str = "https://vendfy-panel.vercel.app";
const ARRANQUE_MINIMIZADO: &str = "--minimizado";

fn ventana(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn al_frente(w: &WebviewWindow) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_focus();
}

/// El panel oyó «Oye Vendfy» (o alguien tocó el aviso): la ventana al frente.
#[tauri::command]
fn traer_al_frente(window: WebviewWindow) {
    al_frente(&window);
}

/// Para que el panel sepa que corre dentro de la app (y qué versión).
#[tauri::command]
fn info_escritorio() -> serde_json::Value {
    serde_json::json!({ "plataforma": "windows", "version": env!("CARGO_PKG_VERSION") })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = ventana(app) {
                al_frente(&w);
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![ARRANQUE_MINIMIZADO])))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, atajo, evento| {
                    if evento.state() == ShortcutState::Pressed && atajo.key == Code::F9 {
                        if let Some(w) = ventana(app) {
                            al_frente(&w);
                            let _ = w.emit("vendfy://atajo", ());
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![traer_al_frente, info_escritorio])
        .setup(|app| {
            let url = std::env::var("VENDFY_URL").unwrap_or_else(|_| URL_POR_DEFECTO.to_string());
            let minimizado = std::env::args().any(|a| a == ARRANQUE_MINIMIZADO);
            let w = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title("Vendfy")
                .inner_size(1366.0, 860.0)
                .min_inner_size(380.0, 600.0)
                .center()
                .visible(!minimizado)
                .build()?;

            // Cerrar la esconde: Vendfy sigue en la bandeja, escuchando.
            let w_cierre = w.clone();
            w.on_window_event(move |e| {
                if let WindowEvent::CloseRequested { api, .. } = e {
                    api.prevent_close();
                    let _ = w_cierre.hide();
                }
            });

            // F9 desde cualquier programa (si otro programa ya lo usa, queda el F9 de la ventana).
            let _ = app.global_shortcut().register(Shortcut::new(None, Code::F9));

            // Arranca con Windows la primera vez; se apaga desde la bandeja.
            let autolanzar = app.autolaunch();
            if std::env::var("VENDFY_SIN_AUTOARRANQUE").is_err() && !autolanzar.is_enabled().unwrap_or(false) {
                let _ = autolanzar.enable();
            }

            let abrir = MenuItem::with_id(app, "abrir", "Abrir Vendfy", true, None::<&str>)?;
            let hablar = MenuItem::with_id(app, "hablar", "Hablarle a Vendfy (F9)", true, None::<&str>)?;
            let arranque = MenuItem::with_id(app, "arranque", "No abrir al iniciar Windows", true, None::<&str>)?;
            let salir = MenuItem::with_id(app, "salir", "Salir de Vendfy", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &hablar, &arranque, &salir])?;
            TrayIconBuilder::with_id("vendfy")
                .icon(app.default_window_icon().cloned().expect("falta el ícono"))
                .tooltip("Vendfy — di «Oye Vendfy» o pulsa F9")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, evento| match evento.id.as_ref() {
                    "abrir" => {
                        if let Some(w) = ventana(app) {
                            al_frente(&w);
                        }
                    }
                    "hablar" => {
                        if let Some(w) = ventana(app) {
                            al_frente(&w);
                            let _ = w.emit("vendfy://atajo", ());
                        }
                    }
                    "arranque" => {
                        let _ = app.autolaunch().disable();
                    }
                    "salir" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|icono, evento| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                        if let Some(w) = ventana(icono.app_handle()) {
                            al_frente(&w);
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("no se pudo abrir Vendfy");
}
