import { callDrive, driveAttivo, getSecret } from '../services/driveStore'
export interface LogoSquadra { id: string; nome: string; rapporto: number; fileId?: string; src?: string }
const immagini = new Map<string, Promise<string>>()
export function leggiLogo(logo: LogoSquadra): Promise<string> {
  if (logo.src) return Promise.resolve(logo.src)
  if (!logo.fileId) return Promise.reject(new Error('Immagine del logo mancante'))
  let promise = immagini.get(logo.fileId)
  if (!promise) {
    promise = callDrive({ action: 'logoFile', id: logo.fileId, secret: getSecret() }).then(r => {
      if (!r.ok) throw new Error(r.error || 'Logo non disponibile')
      return `data:image/png;base64,${r.dataBase64}`
    }).catch(e => { immagini.delete(logo.fileId!); throw e })
    immagini.set(logo.fileId, promise)
  }
  return promise
}
export async function caricaLogo(src: string): Promise<Pick<LogoSquadra, 'src' | 'fileId'>> {
  if (!driveAttivo()) return { src }
  const r = await callDrive({ action: 'logoUpload', dataBase64: src.split(',')[1], secret: getSecret(), requestId: crypto.randomUUID() })
  if (!r.ok) throw new Error(r.error || 'Aggiorna Google Apps Script per caricare i loghi')
  return { fileId: r.fileId }
}
