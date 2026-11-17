fn main() {
    // Los comandos que el panel puede pedirle a la app (con su permiso en capabilities/).
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["traer_al_frente", "info_escritorio"])),
    )
    .expect("no se pudo preparar la app de escritorio");
}
