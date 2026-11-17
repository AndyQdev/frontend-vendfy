// Sin la consola negra detrás de la ventana en la versión final.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    vendfy_escritorio::run();
}
