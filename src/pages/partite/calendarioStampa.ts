/**
 * Il calendario delle partite da stampare (o da mandare nel gruppo).
 *
 * Due impaginazioni: l'elenco raggruppato per mese e la griglia mensile
 * stile calendario da muro. Stesso metodo degli altri fogli: HTML fuori
 * schermo → html2canvas → jspdf. In più qui il foglio è fatto a blocchi
 * (testata, un blocco per mese) e le pagine si tagliano solo fra un blocco
 * e l'altro, così una riga o una settimana non finisce mai a metà fra due
 * fogli.
 */
import { formatData, oggiIso } from '../../lib/format'
import type { Allenamento, Partita } from '../../types'

export const NOI = 'U.S. Riolunato'

export type Impaginazione = 'elenco' | 'griglia'
export type Colonna = 'ora' | 'competizione' | 'note' | 'ritrovo' | 'risultato'

export interface OpzioniCalendario {
  titolo: string
  /** riga sotto il titolo: periodo e filtri scelti */
  sottotitolo?: string
  partite: Partita[]
  /** allenamenti da mettere nel foglio (dal Calendario); assente = solo partite */
  allenamenti?: Allenamento[]
  /** estremi del periodo (ISO), per la griglia: si disegnano tutti i mesi */
  da?: string
  a?: string
  impaginazione: Impaginazione
  orizzontale: boolean
  colonne: Colonna[]
  /** sfondo grigio sulle partite in casa */
  evidenziaCasa: boolean
  /** griglia: un mese per foglio */
  mesePerPagina: boolean
  /** testo libero in fondo (es. "Ritrovo al campo un'ora prima") */
  nota?: string
  nomeTorneo: (id?: string) => string | undefined
}

/** Il testo dell'utente finisce dentro innerHTML: va schermato. */
function esc(s?: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const nomeMese = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const giornoSett = new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function data(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

function titoloMese(chiave: string): string {
  const t = nomeMese.format(data(chiave + '-01'))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** "Sab 12/10" */
function giornoBreve(iso: string): string {
  const g = giornoSett.format(data(iso)).replace('.', '')
  const [, m, d] = iso.split('-')
  return `${g.charAt(0).toUpperCase()}${g.slice(1)} ${d}/${m}`
}

function incontro(p: Partita): string {
  const [casa, fuori] = p.inCasa ? [NOI, p.avversario] : [p.avversario, NOI]
  const b = (n: string) => (n === NOI ? `<b>${esc(n)}</b>` : esc(n))
  return `${b(casa)} – ${b(fuori)}`
}

function risultato(p: Partita): string {
  if (p.giocata === false) return ''
  const [a, b] = p.inCasa ? [p.golFatti, p.golSubiti] : [p.golSubiti, p.golFatti]
  return `${a} - ${b}`
}

function competizione(p: Partita, o: OpzioniCalendario): string {
  return [o.nomeTorneo(p.torneoId), p.amichevole ? 'Amichevole' : ''].filter(Boolean).join(' · ')
}

/** Una riga del foglio: una partita o una seduta di allenamento. */
type Riga = { tipo: 'partita'; p: Partita } | { tipo: 'allenamento'; a: Allenamento }

const dataRiga = (r: Riga) => (r.tipo === 'partita' ? r.p.data : r.a.data)
const oraRiga = (r: Riga) => (r.tipo === 'partita' ? (r.p.ora ?? '') : '')

function perMese(o: OpzioniCalendario): Map<string, Riga[]> {
  const righe: Riga[] = [
    ...o.partite.map((p) => ({ tipo: 'partita' as const, p })),
    ...(o.allenamenti ?? []).map((a) => ({ tipo: 'allenamento' as const, a })),
  ]
  righe.sort((x, y) => (dataRiga(x) + oraRiga(x)).localeCompare(dataRiga(y) + oraRiga(y)))
  const m = new Map<string, Riga[]>()
  for (const r of righe) {
    const k = dataRiga(r).slice(0, 7)
    m.set(k, [...(m.get(k) ?? []), r])
  }
  return m
}

/** "3 partite · 2 allenamenti" (solo le partite se il foglio è di sole partite). */
function conteggio(righe: Riga[], o: OpzioniCalendario): string {
  const np = righe.filter((r) => r.tipo === 'partita').length
  const na = righe.length - np
  const partite = `${np} ${np === 1 ? 'partita' : 'partite'}`
  if (!o.allenamenti) return partite
  return [np ? partite : '', na ? `${na} ${na === 1 ? 'allenamento' : 'allenamenti'}` : '']
    .filter(Boolean)
    .join(' · ')
}

/** Tutti i mesi fra due date ISO, estremi compresi ('YYYY-MM'). */
function mesiFra(da: string, a: string): string[] {
  const out: string[] = []
  let [y, m] = da.slice(0, 7).split('-').map(Number)
  const fine = a.slice(0, 7)
  for (let i = 0; i < 24; i++) {
    const k = `${y}-${String(m).padStart(2, '0')}`
    if (k > fine) break
    out.push(k)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

const BORDO = '1px solid #000'
/** righe per pezzo di tabella: la pagina va a capo solo fra un pezzo e l'altro */
const RIGHE_PER_PEZZO = 4
const GRIGIO = '#ececec'

export interface Blocco {
  html: string
  /** true = il blocco comincia su un foglio nuovo */
  nuovaPagina?: boolean
}

function testata(o: OpzioniCalendario): string {
  return `
    <div style="position:relative;padding-bottom:14px;margin-bottom:6px;border-bottom:2px solid #000;min-height:58px;">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="position:absolute;top:0;right:0;height:58px;" />
      <div style="font-size:11px;letter-spacing:.14em;font-weight:bold;">${esc(NOI.toUpperCase())}</div>
      <h2 style="font-size:24px;font-weight:bold;margin:2px 0 4px;letter-spacing:.01em;">${esc(o.titolo || 'Calendario partite')}</h2>
      ${o.sottotitolo ? `<div style="font-size:12px;color:#333;">${esc(o.sottotitolo)}</div>` : ''}
    </div>`
}

/**
 * Un pezzo della tabella di un mese. Il primo porta titolo e intestazioni;
 * i seguenti sono solo righe, attaccati sotto (margine -1px: il bordo resta
 * singolo), così la pagina può andare a capo fra un pezzo e l'altro.
 */
function bloccoElenco(chiave: string, righeMese: Riga[], o: OpzioniCalendario, totale: string, primo: boolean): string {
  const col = new Set(o.colonne)
  const th = (t: string) =>
    `<th style="border:${BORDO};padding:5px 7px;text-align:left;font-size:11px;">${t}</th>`
  const td = (t: string, extra = '') =>
    `<td style="border:${BORDO};padding:6px 7px;font-size:12.5px;vertical-align:top;${extra}">${t}</td>`
  // stesse colonne (e larghezze) in tutti i pezzi, fissate dal <colgroup>
  const tutte: [Colonna | 'giorno' | 'partita', string, string?][] = [
    ['giorno', 'Giorno', '84px'],
    ['ora', 'Ora', '48px'],
    ['partita', o.allenamenti ? 'Impegno' : 'Partita'],
    ['competizione', 'Competizione', '17%'],
    ['risultato', 'Ris.', '52px'],
    ['ritrovo', 'Ritrovo', '14%'],
    ['note', 'Note', '19%'],
  ]
  const colonne = tutte
    .filter(([k]) => k === 'giorno' || k === 'partita' || col.has(k))
    .map(([, t, w]) => [t, w] as const)
  const colgroup = `<colgroup>${colonne.map(([, w]) => `<col${w ? ` style="width:${w};"` : ''} />`).join('')}</colgroup>`
  const righe = righeMese
    .map((r) => {
      if (r.tipo === 'allenamento') {
        const a = r.a
        return `<tr>
        ${td(`<b>${giornoBreve(a.data)}</b>`, 'white-space:nowrap;')}
        ${col.has('ora') ? td('—', 'white-space:nowrap;') : ''}
        ${td(`<b>Allenamento</b>${!col.has('note') && a.note ? `<div style="font-size:10px;color:#555;margin-top:1px;">${esc(a.note)}</div>` : ''}`)}
        ${col.has('competizione') ? td('') : ''}
        ${col.has('risultato') ? td('') : ''}
        ${col.has('ritrovo') ? td('&nbsp;') : ''}
        ${col.has('note') ? td(esc(a.note)) : ''}
      </tr>`
      }
      const p = r.p
      const sfondo = o.evidenziaCasa && p.inCasa ? `background:${GRIGIO};` : ''
      return `<tr style="${sfondo}">
        ${td(`<b>${giornoBreve(p.data)}</b>`, 'white-space:nowrap;')}
        ${col.has('ora') ? td(esc(p.ora) || '—', 'white-space:nowrap;') : ''}
        ${td(`${incontro(p)}<div style="font-size:10px;color:#555;margin-top:1px;">${p.inCasa ? 'In casa' : 'In trasferta'}</div>`)}
        ${col.has('competizione') ? td(esc(competizione(p, o))) : ''}
        ${col.has('risultato') ? td(`<b>${risultato(p)}</b>`, 'text-align:center;white-space:nowrap;') : ''}
        ${col.has('ritrovo') ? td('&nbsp;') : ''}
        ${col.has('note') ? td(esc(p.note)) : ''}
      </tr>`
    })
    .join('')
  if (!primo)
    return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:-1px;table-layout:fixed;">
      ${colgroup}
      <tbody>${righe}</tbody>
    </table>`
  return `
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:14px;table-layout:fixed;">
      ${colgroup}
      <thead>
        <tr>
          <th colspan="${colonne.length}" style="border:${BORDO};background:#d9d9d9;padding:6px 8px;text-align:left;font-size:14px;letter-spacing:.05em;">
            ${esc(titoloMese(chiave).toUpperCase())}
            <span style="font-weight:normal;font-size:11px;letter-spacing:0;"> — ${totale}</span>
          </th>
        </tr>
        <tr>${colonne.map(([t]) => th(t)).join('')}</tr>
      </thead>
      <tbody>${righe}</tbody>
    </table>`
}

function bloccoGriglia(chiave: string, righeMese: Riga[], o: OpzioniCalendario): string {
  const col = new Set(o.colonne)
  const [y, m] = chiave.split('-').map(Number)
  const giorniMese = new Date(y, m, 0).getDate()
  // lunedì = 0
  const primo = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const perGiorno = new Map<number, Riga[]>()
  for (const r of righeMese) {
    const g = Number(dataRiga(r).slice(8, 10))
    perGiorno.set(g, [...(perGiorno.get(g) ?? []), r])
  }
  const altezza = o.orizzontale ? 78 : 96
  const celle: string[] = []
  for (let i = 0; i < primo; i++) celle.push(`<td style="border:${BORDO};background:#f7f7f7;"></td>`)
  for (let g = 1; g <= giorniMese; g++) {
    const weekend = (primo + g - 1) % 7 >= 5
    const gare = (perGiorno.get(g) ?? [])
      .map((r) => {
        if (r.tipo === 'allenamento')
          return `<div style="border:1px dashed #000;border-radius:4px;padding:2px 4px;margin-top:3px;line-height:1.25;">
          <div style="font-size:9.5px;font-weight:bold;">ALLENAMENTO</div>
          ${r.a.note ? `<div style="font-size:8.5px;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.a.note)}</div>` : ''}
        </div>`
        const p = r.p
        const sfondo = o.evidenziaCasa && p.inCasa ? GRIGIO : '#fff'
        const ris = col.has('risultato') ? risultato(p) : ''
        const comp = col.has('competizione') ? competizione(p, o) : ''
        return `<div style="border:1.5px solid #000;border-radius:4px;background:${sfondo};padding:3px 4px;margin-top:3px;line-height:1.25;">
          <div style="font-size:9px;font-weight:bold;">${p.inCasa ? 'CASA' : 'TRASFERTA'}${col.has('ora') && p.ora ? ` · ${esc(p.ora)}` : ''}${ris ? ` · ${ris}` : ''}</div>
          <div style="font-size:11px;font-weight:bold;">${esc(p.avversario)}</div>
          ${comp ? `<div style="font-size:8.5px;color:#444;">${esc(comp)}</div>` : ''}
        </div>`
      })
      .join('')
    celle.push(`<td style="border:${BORDO};vertical-align:top;padding:3px 4px;height:${altezza}px;${weekend ? 'background:#fafafa;' : ''}">
      <div style="font-size:11px;font-weight:bold;color:${weekend ? '#000' : '#555'};">${g}</div>${gare}
    </td>`)
  }
  while (celle.length % 7) celle.push(`<td style="border:${BORDO};background:#f7f7f7;"></td>`)
  const settimane: string[] = []
  for (let i = 0; i < celle.length; i += 7) settimane.push(`<tr>${celle.slice(i, i + 7).join('')}</tr>`)
  return `
    <div style="margin-top:14px;">
      <div style="font-size:18px;font-weight:bold;margin-bottom:6px;letter-spacing:.03em;">
        ${esc(titoloMese(chiave).toUpperCase())}
        <span style="font-weight:normal;font-size:11px;letter-spacing:0;color:#444;"> — ${righeMese.length ? conteggio(righeMese, o) : o.allenamenti ? 'nessun impegno' : 'nessuna partita'}</span>
      </div>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;table-layout:fixed;">
        <thead><tr>${GIORNI.map((g, i) => `<th style="border:${BORDO};background:${i >= 5 ? '#bfbfbf' : '#d9d9d9'};padding:4px;font-size:11px;">${g}</th>`).join('')}</tr></thead>
        <tbody>${settimane.join('')}</tbody>
      </table>
    </div>`
}

function piede(o: OpzioniCalendario): string {
  const legenda = o.evidenziaCasa
    ? `<span style="display:inline-block;width:12px;height:12px;background:${GRIGIO};border:1px solid #000;vertical-align:-2px;"></span> partite in casa &nbsp; `
    : ''
  const oggi = formatData(oggiIso(), true)
  return `
    <div style="margin-top:16px;font-size:11px;">
      ${o.nota ? `<div style="font-size:12.5px;font-weight:bold;white-space:pre-wrap;border:${BORDO};padding:7px 9px;margin-bottom:8px;">${esc(o.nota)}</div>` : ''}
      <div style="color:#555;">${legenda}Date e orari possono cambiare: fa fede il comunicato ufficiale. · Stampato il ${oggi}</div>
    </div>`
}

/** Il foglio a blocchi: testata, un blocco per mese, piede. */
export function blocchiCalendario(o: OpzioniCalendario): Blocco[] {
  const mesi = perMese(o)
  const blocchi: Blocco[] = [{ html: testata(o) }]
  if (o.impaginazione === 'griglia') {
    const chiavi =
      o.da && o.a ? mesiFra(o.da, o.a) : [...mesi.keys()]
    chiavi.forEach((k, i) =>
      blocchi.push({ html: bloccoGriglia(k, mesi.get(k) ?? [], o), nuovaPagina: o.mesePerPagina && i > 0 }),
    )
  } else if (mesi.size === 0) {
    blocchi.push({
      html: `<div style="margin-top:24px;font-size:14px;">${o.allenamenti ? 'Nessun impegno' : 'Nessuna partita'} nel periodo scelto.</div>`,
    })
  } else {
    for (const [k, ps] of mesi)
      for (let i = 0; i < ps.length; i += RIGHE_PER_PEZZO)
        blocchi.push({ html: bloccoElenco(k, ps.slice(i, i + RIGHE_PER_PEZZO), o, conteggio(ps, o), i === 0) })
  }
  blocchi.push({ html: piede(o) })
  return blocchi
}

/** Larghezza del foglio in px CSS (96 dpi): A4 verticale 210 mm, orizzontale 297 mm. */
export function larghezzaFoglio(orizzontale: boolean): number {
  return Math.round(((orizzontale ? 297 : 210) / 25.4) * 96)
}

const PADDING_X = 36
const MARGINE_MM = 10

/** Il contenitore del foglio (usato anche dall'anteprima). */
export function htmlFoglio(blocchi: Blocco[]): string {
  return blocchi
    .map((b, i) => `<div data-blocco="${i}"${b.nuovaPagina ? ' data-nuova-pagina="1"' : ''}>${b.html}</div>`)
    .join('')
}

async function fotografa(o: OpzioniCalendario) {
  const { default: html2canvas } = await import('html2canvas')
  const box = document.createElement('div')
  // colori espliciti: senza, il foglio eredita l'inchiostro del tema scuro
  box.style.cssText = `padding:0 ${PADDING_X}px 4px;background:#fff;position:absolute;left:-9999px;top:0;width:${larghezzaFoglio(o.orizzontale)}px;box-sizing:border-box;font-family:Arial,sans-serif;color:#000;`
  box.innerHTML = htmlFoglio(blocchiCalendario(o))
  document.body.appendChild(box)
  try {
    const img = box.querySelector('img')
    if (img && !img.complete) await new Promise((res) => ((img.onload = res), (img.onerror = res)))
    // su iPhone un canvas oltre ~16 milioni di pixel esce bianco: con un
    // foglio lunghissimo (stagione intera con gli allenamenti) si scende di scala
    const scala = box.offsetWidth * box.offsetHeight * 4 > 16e6 ? 1 : 2
    const canvas = await html2canvas(box, { scale: scala, useCORS: true, backgroundColor: '#ffffff', logging: false })
    const blocchi = [...box.querySelectorAll<HTMLElement>('[data-blocco]')].map((el) => ({
      inizio: el.offsetTop * scala,
      fine: (el.offsetTop + el.offsetHeight) * scala,
      nuovaPagina: el.dataset.nuovaPagina === '1',
    }))
    return { canvas, blocchi }
  } finally {
    box.remove()
  }
}

/** Nome file: "calendario-partite-12-10-2026.pdf" (o "calendario-impegni-…" con gli allenamenti) */
function nomeFile(o: OpzioniCalendario, ext: string): string {
  const oggi = new Date().toLocaleDateString('it-IT').replace(/\//g, '-')
  return `calendario-${o.allenamenti ? 'impegni' : 'partite'}-${oggi}.${ext}`
}

export async function esportaCalendarioPdf(o: OpzioniCalendario): Promise<void> {
  const [{ default: JsPDF }, { canvas, blocchi }] = await Promise.all([import('jspdf'), fotografa(o)])
  const pdf = new JsPDF(o.orizzontale ? 'l' : 'p', 'mm', 'a4')
  const wMm = pdf.internal.pageSize.getWidth()
  const hMm = pdf.internal.pageSize.getHeight()
  const pxPerMm = canvas.width / wMm
  const utile = (hMm - 2 * MARGINE_MM - 4) * pxPerMm

  // tagli: si va a capo solo fra un blocco e l'altro; un blocco più alto di
  // un foglio intero (un mese fitto di partite) si spezza per forza
  const pagine: [number, number][] = []
  let inizio = 0
  for (const b of blocchi) {
    if (b.nuovaPagina && b.inizio > inizio) {
      pagine.push([inizio, b.inizio])
      inizio = b.inizio
    }
    if (b.fine - inizio > utile && b.inizio > inizio) {
      pagine.push([inizio, b.inizio])
      inizio = b.inizio
    }
    while (b.fine - inizio > utile) {
      pagine.push([inizio, inizio + utile])
      inizio += utile
    }
  }
  if (canvas.height > inizio) pagine.push([inizio, canvas.height])

  pagine.forEach(([da, a], i) => {
    const fetta = document.createElement('canvas')
    fetta.width = canvas.width
    fetta.height = Math.max(1, Math.round(a - da))
    fetta.getContext('2d')!.drawImage(canvas, 0, -Math.round(da))
    if (i > 0) pdf.addPage()
    pdf.addImage(fetta.toDataURL('image/jpeg', 0.95), 'JPEG', 0, MARGINE_MM, wMm, fetta.height / pxPerMm)
    if (pagine.length > 1) {
      pdf.setFontSize(8)
      pdf.setTextColor(90)
      pdf.text(`${i + 1} / ${pagine.length}`, wMm - MARGINE_MM, hMm - 5, { align: 'right' })
    }
  })
  pdf.save(nomeFile(o, 'pdf'))
}

/** Un'unica immagine lunga, comoda da mandare nel gruppo WhatsApp. */
export async function esportaCalendarioPng(o: OpzioniCalendario): Promise<void> {
  const { canvas } = await fotografa(o)
  // un po' di bianco sopra: nel foglio il margine lo mette il PDF
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height + 60
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 40)
  const a = document.createElement('a')
  a.href = out.toDataURL('image/png')
  a.download = nomeFile(o, 'png')
  a.click()
}
