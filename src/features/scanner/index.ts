export { ScannerProvider, useEscaner, useManejadorEscaneo } from "./model/ScannerProvider";
export type { AbrirHojaOpciones, ContextoHoja, ManejadorEscaneo } from "./model/ScannerProvider";
export type { Lectura } from "./model/detector";
export { sonar } from "./model/sonido";
export { useEnriquecimientoIa } from "./model/useEnriquecimientoIa";
export { haceCuanto, useFiltroEscaneado, useVozAlFiltrar, type ProductoFiltrado } from "./model/useFiltroEscaneado";
export { ChipProductoEscaneado } from "./ui/ChipProductoEscaneado";
export { textoCompras, textoVentas } from "./model/resumenes";
export { useTiendaActiva } from "./model/useTiendaActiva";
export { agregarAVenta, frasesAlAgregar, frasesDeFicha, tiendaParaVender, type ResultadoAgregar } from "./model/venta";
export {
  FRASES_FIJAS,
  fraseNombre,
  frasesArmado,
  frasesCaja,
  frasesClientes,
  frasesCompras,
  frasesFicha,
  frasesInventario,
  frasesNoEstabaEnLaCompra,
  frasesNoRegistrado,
  frasesNuevaCompra,
  frasesPedidos,
  frasesRecepcion,
  frasesReporte,
  frasesVentas,
  fraseVan,
} from "./model/frases";
export { AjustesVoz } from "./ui/AjustesVoz";
export { HojaEscaneo } from "./ui/HojaEscaneo";
export { LaserEscaneo } from "./ui/LaserEscaneo";
export { ModoEscaner } from "./ui/ModoEscaner";
export { VentaFlotante } from "./ui/VentaFlotante";
