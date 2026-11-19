export { contextoAudio, prepararAudio } from "./audio";
export {
  callarVoz,
  decirFrases,
  decirTexto,
  esperarQueCalle,
  idDeFrase,
  nivelVoz,
  precalentarVoz,
  probarVoz,
  terminoDeHablar,
  useHablando,
  type AvisoVoz,
  type FraseVoz,
} from "./motor";
export {
  preferenciasVoz,
  setPreferenciasVoz,
  usePreferenciasVoz,
  VELOCIDADES,
  VOZ_POR_DEFECTO,
  type PreferenciasVoz,
} from "./preferencias";
export { sonarActivacion, sonarCierre, sonarTurno } from "./sonidos";
export { useVoces, type EstadoVoces, type VozDisponible } from "./voces";
