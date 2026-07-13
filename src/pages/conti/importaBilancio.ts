/**
 * Import dei conti da un file Excel o CSV nel formato "Bilancio digitale":
 * colonne Data · Nome transazione · Uscita · Entrata · Da dare · Totale in
 * cassa. È lo stesso formato che lo script del Drive genera nel foglio
 * Bilancio, quindi si può reimportare anche quello. Le colonne di servizio
 * (Mese, Anno, riepiloghi) e la riga TOTALI vengono ignorate.
 */
import type { Movimento } from '../../types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Numero o valuta in qualunque formato ("2.730,00 €", "2730.00 €", 2730) → numero, o null. */
function aNumero(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v !== 'string') return null
  let s = v.replace(/[€\s]/g, '')
  if (!s) return null
  const virgola = s.lastIndexOf(',')
  const punto = s.lastIndexOf('.')
  if (virgola > punto) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return isFinite(n) ? n : null
}

/** Data excel (seriale, Date o testo gg/mm/aaaa · aaaa-mm-gg) → 'aaaa-mm-gg', o null. */
function aDataIso(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime()))
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
    // seriale excel: giorni dal 30/12/1899; la parte oraria si scarta
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  if (typeof v === 'string') {
    const s = v.trim()
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s)
    if (m) {
      const anno = m[3].length === 2 ? `20${m[3]}` : m[3]
      return `${anno}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
    }
  }
  return null
}

export async function leggiBilancio(file: File): Promise<Omit<Movimento, 'id'>[]> {
  // la libreria excel si carica solo quando serve (non pesa sull'avvio)
  const XLSX = await import('xlsx')
  let wb: ReturnType<typeof XLSX.read>
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    throw new Error('il file non si legge come Excel/CSV')
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const righe: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

  // trova la riga di intestazione e le colonne che ci interessano
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
  let col: Record<'data' | 'nome' | 'uscita' | 'entrata' | 'daDare' | 'cassa', number> | null = null
  let inizio = 0
  for (let i = 0; i < Math.min(righe.length, 10); i++) {
    const r = righe[i].map(norm)
    const c = {
      data: r.findIndex((x) => x === 'data'),
      nome: r.findIndex((x) => x.includes('transazione') || x.includes('descrizione')),
      uscita: r.findIndex((x) => x.startsWith('uscit')),
      entrata: r.findIndex((x) => x.startsWith('entrat')),
      daDare: r.findIndex((x) => x.includes('da dare')),
      cassa: r.findIndex((x) => x.includes('cassa')),
    }
    if (c.data >= 0 && c.nome >= 0 && (c.uscita >= 0 || c.entrata >= 0)) {
      col = c
      inizio = i + 1
      break
    }
  }
  if (!col) throw new Error('intestazioni non riconosciute (servono Data, Nome transazione, Uscita/Entrata)')

  const movimenti: Omit<Movimento, 'id'>[] = []
  let cassaPrec = 0 // per le righe scritte solo nel "Totale in cassa"
  let ultimaData = ''
  for (let i = inizio; i < righe.length; i++) {
    const r = righe[i]
    const testo = String(r[col.nome] ?? '').trim()
    if (!testo || testo.toUpperCase() === 'TOTALI') continue
    const uscita = col.uscita >= 0 ? aNumero(r[col.uscita]) : null
    const entrata = col.entrata >= 0 ? aNumero(r[col.entrata]) : null
    const daDare = col.daDare >= 0 ? aNumero(r[col.daDare]) : null
    const cassa = col.cassa >= 0 ? aNumero(r[col.cassa]) : null
    if (uscita != null && entrata != null) continue // riga di totali senza etichetta

    let tipo: Movimento['tipo']
    let importo: number
    let descrizioneForzata: string | undefined
    if (uscita != null) {
      tipo = 'uscita'
      importo = uscita
    } else if (entrata != null) {
      tipo = 'entrata'
      importo = entrata
    } else if (daDare != null && daDare !== 0) {
      tipo = 'uscita' // "da dare" puro: debito ancora aperto
      importo = daDare
    } else if (cassa != null) {
      // importo indicato solo nel totale progressivo: si ricava per differenza
      const delta = Math.round((cassa - cassaPrec) * 100) / 100
      if (!delta) continue
      tipo = delta > 0 ? 'entrata' : 'uscita'
      importo = Math.abs(delta)
      // riga tipo "Totale in cassa | 2480": è il saldo di partenza
      if (norm(testo).includes('totale in cassa')) descrizioneForzata = 'Saldo iniziale'
    } else {
      continue
    }

    const saldato = !(daDare != null && daDare !== 0)
    if (cassa != null) cassaPrec = cassa
    else if (saldato) cassaPrec += tipo === 'entrata' ? importo : -importo

    // il foglio del Drive salva "descrizione · controparte" in una cella sola
    let descrizione = descrizioneForzata ?? testo
    let controparte: string | undefined
    const sep = testo.lastIndexOf(' · ')
    if (!descrizioneForzata && sep > 0) {
      controparte = testo.slice(sep + 3).trim() || undefined
      descrizione = testo.slice(0, sep).trim()
    }

    const data = aDataIso(r[col.data]) ?? ultimaData ?? ''
    if (data) ultimaData = data

    movimenti.push({ data, descrizione, tipo, importo, saldato, controparte })
  }
  return movimenti
}
