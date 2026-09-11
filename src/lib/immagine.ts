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

export async function preparaCaricamento(file: File, latoMax = 2000): Promise<DaCaricare> {
  if (!file.type.startsWith('image/')) return comSuoi(file)
  try {
    // 'from-image': tiene conto dell'orientamento EXIF, altrimenti le foto
    // scattate in verticale arrivano coricate
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scala = Math.min(1, latoMax / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scala)
    canvas.height = Math.round(bitmap.height * scala)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return comSuoi(file)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return { dataBase64: dataUrl.split(',')[1] ?? '', tipo: 'image/jpeg', estensione: '.jpg' }
  } catch {
    return comSuoi(file)
  }
}
