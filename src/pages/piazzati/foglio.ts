/**
 * Il foglio dei calci piazzati da stampare (A4).
 *
 * Stesso metodo della distinta e della classifica presenze: si compone un
 * blocco HTML fuori schermo, lo si fotografa con html2canvas e lo si mette
 * dentro un PDF. Il foglio esce in due versioni: compilato (i nomi scelti)
 * oppure vuoto, con le caselle da riempire a penna negli spogliatoi.
 */
import type jsPDF from 'jspdf'
import { REPARTI, etichettaCasella, type Incarico } from '../../lib/piazzati'
import { formatData } from '../../lib/format'

export interface OpzioniFoglio {
  stagione: string
  /** true = solo le caselle, da compilare a mano */
  vuoto?: boolean
  incarichi?: Record<string, string[]>
  /** come si stampa un giocatore (numero e cognome) */
  nomeDi?: (id: string) => string
  note?: string
  /** testata della gara, quando il foglio esce in coda alla distinta */
  avversario?: string
  dataGara?: string
}

/** Il testo dell'utente finisce dentro innerHTML: va schermato. */
function esc(s?: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function mcm(a: number, b: number): number {
  const mcd = (x: number, y: number): number => (y === 0 ? x : mcd(y, x % y))
  return (a * b) / mcd(a, b)
}

const BORDO = '1px solid #000'

function cella(inc: Incarico, i: number, colspan: number, testo: string, vuoto: boolean): string {
  const etichetta = etichettaCasella(inc, i)
  // dove le caselle sono tante (il centro area ne ha sei) la colonna è stretta:
  // il nome rimpicciolisce, altrimenti un cognome lungo va a capo
  const corpo = inc.slot >= 4 ? 10.5 : 12
  return `<td colspan="${colspan}" style="border:${BORDO};padding:4px 6px;vertical-align:top;height:${vuoto ? 30 : 26}px;">
    ${etichetta ? `<div style="font-size:8.5px;color:#666;line-height:1.2;">${etichetta}</div>` : ''}
    <div style="font-size:${corpo}px;font-weight:bold;line-height:1.3;">${testo || '&nbsp;'}</div>
  </td>`
}

function tabellaReparto(
  titolo: string,
  nota: string,
  incarichi: Incarico[],
  opt: OpzioniFoglio,
): string {
  const colonne = incarichi.reduce((n, i) => mcm(n, i.slot), 1)
  const nomeDi = opt.nomeDi ?? ((id: string) => id)
  const righe = incarichi
    .map((inc) => {
      const scelti = opt.incarichi?.[inc.key] ?? []
      const celle = Array.from({ length: inc.slot }, (_, i) => {
        const id = scelti[i]
        const testo = opt.vuoto || !id ? '' : esc(nomeDi(id))
        return cella(inc, i, colonne / inc.slot, testo, !!opt.vuoto)
      }).join('')
      return `<tr>
        <td style="border:${BORDO};padding:4px 8px;width:34%;vertical-align:top;">
          <div style="font-size:12px;font-weight:bold;line-height:1.3;">${esc(inc.label)}</div>
          ${inc.nota ? `<div style="font-size:9px;color:#555;line-height:1.2;">${esc(inc.nota)}</div>` : ''}
        </td>
        ${celle}
      </tr>`
    })
    .join('')

  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:14px;">
    <thead>
      <tr>
        <th colspan="${colonne + 1}" style="border:${BORDO};background:#d9d9d9;padding:5px 8px;text-align:left;">
          <span style="font-size:13px;font-weight:bold;letter-spacing:.04em;">${esc(titolo.toUpperCase())}</span>
          <span style="font-size:9.5px;font-weight:normal;color:#333;"> — ${esc(nota)}</span>
        </th>
      </tr>
    </thead>
    <tbody>${righe}</tbody>
  </table>`
}

/** Il foglio completo, pronto da fotografare. */
export function htmlFoglioPiazzati(opt: OpzioniFoglio): string {
  const gara = [opt.avversario ? `vs ${esc(opt.avversario)}` : '', opt.dataGara ? formatData(opt.dataGara, true) : '']
    .filter(Boolean)
    .join(' · ')
  const note = opt.vuoto
    ? '<div style="height:16px;border-bottom:1px solid #999;margin-bottom:10px;"></div>'.repeat(3)
    : opt.note
      ? `<div style="font-size:12px;white-space:pre-wrap;">${esc(opt.note)}</div>`
      : '<div style="font-size:11px;color:#666;">—</div>'

  return `
    <div style="position:relative;margin-bottom:18px;">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="position:absolute;top:0;right:0;height:58px;" />
      <h2 style="font-size:21px;font-weight:bold;margin:0 0 4px;letter-spacing:.02em;">CALCI PIAZZATI</h2>
      <div style="font-size:12px;">U.S. RIOLUNATO · Stagione ${esc(opt.stagione)}${gara ? ` · ${gara}` : ''}</div>
      <div style="font-size:10px;color:#555;margin-top:2px;">
        ${opt.vuoto ? 'Foglio da compilare' : 'Schema della squadra'}
      </div>
    </div>
    ${REPARTI.map((r) => tabellaReparto(r.titolo, r.nota, r.incarichi, opt)).join('')}
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th style="border:${BORDO};background:#d9d9d9;padding:5px 8px;text-align:left;font-size:13px;letter-spacing:.04em;">
            NOTE
          </th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:${BORDO};padding:8px;">${note}</td></tr>
      </tbody>
    </table>
  `
}

/** Fotografa un blocco HTML in formato A4 (fuori schermo, su carta bianca). */
export async function canvasFoglio(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')
  const box = document.createElement('div')
  // colori espliciti: senza, il foglio eredita l'inchiostro del tema scuro
  box.style.cssText =
    'padding:34px 40px;background:#fff;position:absolute;left:-9999px;top:0;width:210mm;font-family:Arial,sans-serif;color:#000;'
  box.innerHTML = html
  document.body.appendChild(box)
  try {
    const img = box.querySelector('img')
    if (img && !img.complete) await new Promise((res) => ((img.onload = res), (img.onerror = res)))
    return await html2canvas(box, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
  } finally {
    box.remove()
  }
}

/**
 * Mette il canvas nel PDF, spezzandolo in più pagine se non ci sta.
 * L'immagine va in JPEG di qualità alta: in PNG lo stesso foglio pesava
 * quasi 9 MB, scomodo da mandare su WhatsApp, e su carta non si vede
 * differenza.
 */
export function aggiungiAlPdf(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  const dati = canvas.toDataURL('image/jpeg', 0.95)
  const larghezza = pdf.internal.pageSize.getWidth()
  const altezza = (canvas.height * larghezza) / canvas.width
  let restante = altezza
  let pos = 0
  pdf.addImage(dati, 'JPEG', 0, pos, larghezza, altezza)
  restante -= pdf.internal.pageSize.getHeight()
  while (restante > 0) {
    pos = restante - altezza
    pdf.addPage()
    pdf.addImage(dati, 'JPEG', 0, pos, larghezza, altezza)
    restante -= pdf.internal.pageSize.getHeight()
  }
}

/** Scarica il foglio come PDF a sé (bottone «Stampa» della pagina). */
export async function esportaFoglioPiazzati(opt: OpzioniFoglio): Promise<void> {
  const [{ default: JsPDF }, canvas] = await Promise.all([
    import('jspdf'),
    canvasFoglio(htmlFoglioPiazzati(opt)),
  ])
  const pdf = new JsPDF('p', 'mm', 'a4')
  aggiungiAlPdf(pdf, canvas)
  const oggi = new Date().toLocaleDateString('it-IT').replace(/\//g, '-')
  pdf.save(`calci-piazzati${opt.vuoto ? '-vuoto' : ''}-${oggi}.pdf`)
}
