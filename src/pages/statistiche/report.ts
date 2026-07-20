/**
 * Report di fine stagione in PDF: risultati, marcatori, assist, presenze e
 * bilancio, pronto per assemblea o sponsor. Stesso approccio della classifica
 * presenze: HTML fuori schermo → html2canvas → jspdf (caricati al momento).
 */
import { esitoPartita } from '../../lib/social'
import { formatData, formatEuro } from '../../lib/format'
import type { Partita } from '../../types'

export interface RigaConteggio {
  nome: string
  n: number
}

export interface DatiReport {
  stagione: string
  /** nome della competizione, se il report è filtrato (es. "Campionato") */
  competizione?: string
  giocate: Partita[]
  record: { v: number; p: number; s: number; gf: number; gs: number }
  marcatori: RigaConteggio[]
  assist: RigaConteggio[]
  presenze: RigaConteggio[]
  /** presenze in partita (titolari + subentrati), se segnate */
  presenzePartita?: RigaConteggio[]
  totaleSedute: number
  bilancio: { entrate: number; uscite: number; saldo: number }
}

function tabella(titolo: string, intestazioni: string[], righe: string[][]): string {
  if (!righe.length) return ''
  return `
    <h3 style="font-size:15px;margin:24px 0 8px;">${titolo}</h3>
    <table cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
      <thead>
        <tr style="background:#d9d9d9;">
          ${intestazioni.map((h) => `<th style="border:1px solid #000;padding:5px;text-align:left;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${righe
          .map(
            (r) =>
              `<tr>${r.map((c) => `<td style="border:1px solid #000;padding:5px;">${c}</td>`).join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `
}

export async function esportaReportStagione(d: DatiReport): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const conteggi = (righe: RigaConteggio[]): string[][] =>
    righe.slice(0, 15).map((r, i) => [String(i + 1), r.nome, String(r.n)])

  const box = document.createElement('div')
  box.style.cssText =
    'padding:40px;background:#fff;position:absolute;left:-9999px;top:0;width:210mm;font-family:Arial,sans-serif;color:#000;'
  box.innerHTML = `
    <div style="position:relative;text-align:center;margin-bottom:20px;">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="position:absolute;top:0;right:0;height:64px;" />
      <h2 style="font-size:22px;font-weight:bold;margin:0 0 6px;">REPORT STAGIONE ${d.stagione}${d.competizione ? ` — ${d.competizione.toUpperCase()}` : ''}</h2>
      <div style="font-size:13px;">U.S. RIOLUNATO</div>
    </div>

    <h3 style="font-size:15px;margin:0 0 8px;">Riepilogo</h3>
    <div style="font-size:13px;line-height:1.7;">
      Partite giocate: <b>${d.giocate.length}</b> —
      Vittorie <b>${d.record.v}</b> · Pareggi <b>${d.record.p}</b> · Sconfitte <b>${d.record.s}</b><br/>
      Gol fatti <b>${d.record.gf}</b> · Gol subiti <b>${d.record.gs}</b> · Differenza reti <b>${d.record.gf - d.record.gs >= 0 ? '+' : ''}${d.record.gf - d.record.gs}</b><br/>
      Allenamenti svolti: <b>${d.totaleSedute}</b><br/>
      Bilancio: entrate <b>${formatEuro(d.bilancio.entrate)}</b> · uscite <b>${formatEuro(d.bilancio.uscite)}</b> · saldo <b>${formatEuro(d.bilancio.saldo)}</b>
    </div>

    ${tabella(
      'Risultati',
      ['Data', 'Avversario', 'Dove', 'Risultato', 'Esito'],
      d.giocate.map((p) => [
        formatData(p.data, true),
        p.avversario,
        p.inCasa ? 'Casa' : 'Trasferta',
        `${p.golFatti} - ${p.golSubiti}`,
        esitoPartita(p).label,
      ]),
    )}

    ${tabella('Classifica marcatori', ['#', 'Giocatore', 'Gol'], conteggi(d.marcatori))}
    ${tabella('Classifica assist', ['#', 'Giocatore', 'Assist'], conteggi(d.assist))}
    ${tabella('Presenze in partita', ['#', 'Giocatore', 'Presenze'], conteggi(d.presenzePartita ?? []))}
    ${tabella(
      `Presenze agli allenamenti (${d.totaleSedute} sedute)`,
      ['#', 'Giocatore', 'Presenze'],
      conteggi(d.presenze),
    )}
  `
  document.body.appendChild(box)
  try {
    const img = box.querySelector('img')
    if (img && !img.complete) await new Promise((res) => ((img.onload = res), (img.onerror = res)))
    const canvas = await html2canvas(box, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const w = pdf.internal.pageSize.getWidth()
    const hgt = (canvas.height * w) / canvas.width
    let left = hgt
    let pos = 0
    pdf.addImage(imgData, 'PNG', 0, pos, w, hgt)
    left -= pdf.internal.pageSize.getHeight()
    while (left > 0) {
      pos = left - hgt
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, pos, w, hgt)
      left -= pdf.internal.pageSize.getHeight()
    }
    const suffisso = d.competizione ? `-${d.competizione.toLowerCase().replace(/\s+/g, '-')}` : ''
    pdf.save(`report-stagione-${d.stagione.replace('/', '-')}${suffisso}.pdf`)
  } finally {
    box.remove()
  }
}
