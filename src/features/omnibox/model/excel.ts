/**
 * El generador de .xlsx se movió a `@/shared/lib/excel` porque ahora también
 * lo usan los listados y Reportes. Se re-exporta acá para no romper imports.
 */
export * from "@/shared/lib/excel";
