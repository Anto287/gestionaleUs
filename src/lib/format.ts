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

export function formatKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
