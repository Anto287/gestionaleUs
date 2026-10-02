/**
 * Lettura del testo da una foto, tutta nel telefono (Tesseract.js): la
 * foto del documento non lascia mai il dispositivo.
 *
 * Al primo uso il browser scarica il motore e il dizionario italiano (pochi
 * MB, da cdn.jsdelivr.net); il dizionario resta poi nel browser e il
 * motore nella cache dell'app, quindi le volte dopo è più veloce.
 *
 * La libreria si carica con import() solo quando serve: chi non scansiona
 * documenti non la scarica mai.
 */

import type { PSM, Worker } from 'tesseract.js'

export interface Lettura {
  testo: string
  /** fiducia media del riconoscimento, 0–100 */
  fiducia: number
}

export type Avanzamento = (fase: string, percento: number) => void

let workerInCorso: Promise<Worker> | null = null
let avvisa: Avanzamento = () => {}

function worker(): Promise<Worker> {
  if (!workerInCorso) {
    workerInCorso = import('tesseract.js').then(({ createWorker }) =>
      createWorker('ita', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') avvisa('Lettura del testo', Math.round(m.progress * 100))
          else if (/load|initializ/i.test(m.status)) avvisa('Preparo il lettore (solo la prima volta è lento)', Math.round(m.progress * 100))
        },
      }),
    )
    // se il caricamento fallisce (es. senza rete) si riprova alla volta dopo
    workerInCorso.catch(() => (workerInCorso = null))
  }
  return workerInCorso
}

/** Chiude il lettore e libera la memoria (va chiamato quando si chiude la scansione). */
export async function chiudiLettore(): Promise<void> {
  const w = workerInCorso
  workerInCorso = null
  if (w) await (await w).terminate().catch(() => {})
}

/**
 * Prepara la foto: lato lungo a 2000 px (le foto del telefono sono enormi e
 * rallentano senza leggere meglio), toni di grigio e contrasto tirato, e
 * ruotata di `gradi` se serve.
 */
async function prepara(file: Blob, gradi: number): Promise<HTMLCanvasElement> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scala = Math.min(1, 2000 / Math.max(img.width, img.height))
  const w = Math.round(img.width * scala)
  const h = Math.round(img.height * scala)
  const ruotata = gradi % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = ruotata ? h : w
  canvas.height = ruotata ? w : h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((gradi * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  img.close()

  const dati = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = dati.data
  // grigio + allungamento dei toni fra il 2° e il 98° percentile
  const grigi = new Uint8ClampedArray(px.length / 4)
  const istogramma = new Uint32Array(256)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    grigi[j] = g
    istogramma[g]++
  }
  const soglia = grigi.length * 0.02
  let basso = 0
  let alto = 255
  let somma = istogramma[0]
  while (basso < 254 && somma < soglia) somma += istogramma[++basso]
  somma = istogramma[255]
  while (alto > basso + 1 && somma < soglia) somma += istogramma[--alto]
  const ampiezza = Math.max(1, alto - basso)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = ((grigi[j] - basso) * 255) / ampiezza
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(dati, 0, 0)
  return canvas
}

async function riconosci(canvas: HTMLCanvasElement): Promise<Lettura> {
  const w = await worker()
  const { data } = await w.recognize(canvas)
  return { testo: data.text ?? '', fiducia: data.confidence ?? 0 }
}

/**
 * Seconda passata per il codice MRZ (le righe coi «<<<» sul retro della
 * CIE): col dizionario italiano i «<» diventano «K», ««» o spariscono, e le
 * righe si fondono. Ammettendo solo maiuscole, cifre e «<», e leggendo la
 * foto come un blocco unico di righe, il codice esce quasi sempre pulito.
 */
async function riconosciMrz(canvas: HTMLCanvasElement): Promise<string> {
  const w = await worker()
  await w.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    tessedit_pageseg_mode: '6' as PSM,
  })
  try {
    const { data } = await w.recognize(canvas)
    return data.text ?? ''
  } finally {
    await w.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3' as PSM })
  }
}

/** Ritaglia la parte bassa della foto, dove sta l'MRZ. */
function parteBassa(canvas: HTMLCanvasElement, quota = 0.45): HTMLCanvasElement {
  const out = document.createElement('canvas')
  const y = Math.round(canvas.height * (1 - quota))
  out.width = canvas.width
  out.height = canvas.height - y
  out.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, out.height, 0, 0, canvas.width, out.height)
  return out
}

/**
 * Legge il testo di una foto. Se la lettura viene male (foto girata di
 * lato: capita spesso con le tessere fotografate in verticale) prova anche
 * ruotandola di 90° e 270°, e tiene la lettura migliore. Con `mrz` (carta
 * d'identità) aggiunge in coda la lettura dedicata al codice MRZ, se la
 * foto sembra averne uno.
 */
export async function leggiFoto(
  file: Blob,
  onAvanzamento: Avanzamento = () => {},
  opzioni: { mrz?: boolean } = {},
): Promise<Lettura> {
  avvisa = onAvanzamento
  try {
    onAvanzamento('Preparo la foto', 0)
    let tela = await prepara(file, 0)
    let migliore = await riconosci(tela)
    if (migliore.fiducia < 60) {
      for (const gradi of [90, 270]) {
        onAvanzamento(`Provo a girare la foto (${gradi}°)`, 0)
        const prova = await prepara(file, gradi)
        const lettura = await riconosci(prova)
        if (lettura.fiducia > migliore.fiducia) {
          migliore = lettura
          tela = prova
        }
        if (migliore.fiducia >= 60) break
      }
    }
    // l'MRZ si riconosce già dalla prima lettura: righe lunghe piene di «<» (o di K/« che li sostituiscono)
    if (opzioni.mrz && /<{2,}|[<K«]{4,}|ITA[<K«]/.test(migliore.testo)) {
      onAvanzamento('Leggo il codice in basso', 0)
      const codice = await riconosciMrz(parteBassa(tela))
      migliore = { ...migliore, testo: `${migliore.testo}\n${codice}` }
    }
    return migliore
  } finally {
    avvisa = () => {}
  }
}
