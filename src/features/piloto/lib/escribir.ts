const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Escribe un texto letra por letra en un campo controlado: se ve cómo el
 * piloto lo llena, igual que el alta por voz. Los textos largos van de a
 * varias letras para no tardar más de ~1,5 s.
 */
export async function escribirLetraPorLetra(poner: (parcial: string) => void, texto: string, msPorLetra = 32): Promise<void> {
  const paso = Math.max(1, Math.ceil(texto.length / 45));
  for (let i = paso; i < texto.length; i += paso) {
    poner(texto.slice(0, i));
    await dormir(msPorLetra);
  }
  poner(texto);
}
