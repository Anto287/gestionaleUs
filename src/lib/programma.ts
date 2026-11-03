const esercizi: Record<string, string[]> = {
  Possesso: ['Rondò: gruppi da 4–6 con un difendente, cambio dopo recupero; limita a due tocchi.', 'Possesso a settori: punto dopo un passaggio in ogni settore; cura smarcamento e sostegno.', 'Partita a tema: punto bonus dopo cinque passaggi consecutivi.'],
  Finalizzazione: ['Passaggio, controllo orientato e tiro: due file, alterna il piede e il lato di partenza.', 'Combinazione a tre e conclusione: passaggio, sponda e attacco dello spazio; ruota i ruoli.', 'Partita a tema: conclusione entro tre passaggi dal recupero.'],
  Difesa: ['Duelli 1 contro 1: accompagna verso l’esterno, alterna attaccante e difendente.', 'Copertura e pressione: 2 contro 2 in spazio ridotto; uno esce e uno copre.', 'Partita a tema: punto bonus al recupero nella propria metà e uscita controllata.'],
}
export function generaProgramma(minuti: number, giocatori: number, obiettivo: string): string {
  if (!Number.isInteger(minuti) || minuti < 30 || minuti > 150 || !Number.isInteger(giocatori) || giocatori < 4 || giocatori > 40 || !esercizi[obiettivo]) throw new Error('Parametri allenamento non validi')
  const quote = [0.15, 0.2, 0.25, 0.3].map((q) => Math.floor(minuti * q))
  const tempi = [...quote, minuti - quote.reduce((a, b) => a + b, 0)]
  const fasi = ['Attivazione: mobilità dinamica e conduzione palla, aumentando gradualmente il ritmo.', ...esercizi[obiettivo], 'Defaticamento: corsa blanda, mobilità e breve confronto sulla seduta.']
  return `Obiettivo: ${obiettivo} · ${giocatori} giocatori · ${minuti} minuti\nMateriale: palloni, cinesini, casacche e porticine.\nDividi in gruppi equilibrati; con numeri dispari usa un jolly e ruotalo.\n\n` + fasi.map((fase, i) => `${i + 1}. ${tempi[i]} min · ${fase}`).join('\n\n')
}
