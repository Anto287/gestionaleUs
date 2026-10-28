/**
 * Preparazione dei file prima di mandarli sul Drive.
 *
 * Le foto del telefono pesano anche 5 MB l'una: si rimpiccioliscono qui,
 * nel browser, prima di partire. Un lato da 2000 px basta e avanza per
 * leggere un documento d'identità e rende il caricamento immediato anche
 * con la rete del campo. Se qualcosa non va (formato che il browser non sa
 * disegnare, es. HEIC su PC) si manda il file originale così com'è.
 */
import { estensioneDa } from './archivio'

export interface DaCaricare {
  dataBase64: string
  tipo: string
  estensione: string
}

function base64Di(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(String(reader.result).split(',')[1] ?? '')
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

async function comSuoi(file: File): Promise<DaCaricare> {
  return {
    dataBase64: await base64Di(file),
    tipo: file.type || 'application/octet-stream',
    estensione: estensioneDa(file.name, file.type),
  }
}

/**
 * L'estensione che avrà il file una volta caricato: le immagini diventano
 * sempre JPEG, così il nome si può mostrare prima di partire.
 */
export function estensionePrevista(file: File): string {
  return file.type.startsWith('image/') ? '.jpg' : estensioneDa(file.name, file.type)
}

export interface LogoPronto {
  /** dataURL PNG: la trasparenza di uno stemma ritagliato va tenuta */
  src: string
  /** altezza diviso larghezza, per non schiacciare lo stemma nella grafica */
  rapporto: number
}

/**
 * Prepara il logo di una squadra per le grafiche: lo rimpicciolisce e lo
 * riesporta in PNG (in JPEG il fondo trasparente diventerebbe bianco), e
 * dice quanto è alto rispetto a quanto è largo.
 */
export async function preparaLogo(file: File, latoMax = 512): Promise<LogoPronto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scala = Math.min(1, latoMax / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scala))
    canvas.height = Math.max(1, Math.round(bitmap.height * scala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas non disponibile')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return { src: canvas.toDataURL('image/png'), rapporto: canvas.height / canvas.width }
  } finally {
    bitmap.close()
  }
}

/** JPEG molto leggero per le ricevute dei Conti. Non invia originali pesanti
 * se la decodifica fallisce: il chiamante mostra l'errore e conserva il file. */
export async function preparaScontrino(file: File): Promise<DaCaricare> {
  if (!file.type.startsWith('image/')) return comSuoi(file)
  try {
    return await comprimiImmagine(file, 1200, 0.15)
  } catch {
    throw new Error('Impossibile comprimere la foto dello scontrino. Prova con una foto JPEG o PNG.')
  }
}

async function comprimiImmagine(file: File, latoMax: number, qualita: number): Promise<DaCaricare> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scala = Math.min(1, latoMax / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scala))
    canvas.height = Math.max(1, Math.round(bitmap.height * scala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas non disponibile')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', qualita)
    if (!dataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('Compressione JPEG non disponibile')
    return { dataBase64: dataUrl.split(',')[1] ?? '', tipo: 'image/jpeg', estensione: '.jpg' }
  } finally {
    bitmap.close()
  }
}

export async function preparaCaricamento(file: File, latoMax = 2000): Promise<DaCaricare> {
  if (!file.type.startsWith('image/')) return comSuoi(file)
  try {
    return await comprimiImmagine(file, latoMax, 0.85)
  } catch {
    return comSuoi(file)
  }
}
