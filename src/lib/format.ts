/** Formattatori comuni, in italiano. */

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const dataLunga = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
const dataBreve = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatEuro(n: number): string {
  return euro.format(n)
}

/** Da 'YYYY-MM-DD' a data leggibile; stringa vuota se non valida. */
export function formatData(iso: string, breve = false): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return (breve ? dataBreve : dataLunga).format(d)
}

/** Una data in 'YYYY-MM-DD' secondo l'orologio locale. */
export function isoDa(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * La data di oggi in 'YYYY-MM-DD'.
 *
 * NON si usa `toISOString()`: quello dà l'ora di Greenwich, così in Italia
 * fra mezzanotte e le 1 (le 2 con l'ora legale) "oggi" risultava ancora il
 * giorno prima — e le sedute segnate a tarda sera finivano nel giorno sbagliato.
 */
export function oggiIso(): string {
  return isoDa(new Date())
}

/** Le iniziali di un tesserato, per gli avatar: "Mario Rossi" → "MR". */
export function iniziali(t: { nome: string; cognome: string }): string {
  return `${t.nome[0] ?? ''}${t.cognome[0] ?? ''}`.toUpperCase()
}

/** Concorda il nome col numero: plurale(1, 'partita', 'partite') → "1 partita". */
export function plurale(n: number, singolare: string, plurale: string): string {
  return `${n} ${n === 1 ? singolare : plurale}`
}

export function formatKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
