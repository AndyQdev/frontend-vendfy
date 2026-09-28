/**
 * Barrel local a propósito: no se reexporta desde `shared/ui` ni desde el barrel
 * del feature. Cualquier pantalla que tocara ese barrel arrastraría el chunk 3D
 * a su grafo de dependencias aunque no dibuje el mapa.
 */
export { BoliviaSalesMap } from "./DailyTower";
export type { BoliviaSalesMapProps } from "./DailyTower";
