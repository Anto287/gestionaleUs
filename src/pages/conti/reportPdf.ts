import { jsPDF } from 'jspdf'
import { config } from '../../config'
import { formatData, formatEuro } from '../../lib/format'
import { totaliReport, type FiltriConti } from '../../lib/contiReport'
import type { Movimento } from '../../types'

const pulito = (s: string) =>
  s
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
const euro = (n: number) => pulito(formatEuro(n))
export function descriviFiltri(f: FiltriConti): string {
  return (
    [
      f.da && `Dal ${formatData(f.da, true)}`,
      f.a && `al ${formatData(f.a, true)}`,
      f.anno && `Anno: ${f.anno}`,
      f.mese && `Mese: ${f.mese}`,
      f.q?.trim() && `Ricerca: ${f.q.trim()}`,
      f.tipo && `Tipo: ${f.tipo}`,
      f.stato && `Stato: ${f.stato === 'saldato' ? 'Saldati' : 'Da saldare'}`,
      f.categoria && `Categoria: ${f.categoria}`,
      f.controparte && `Controparte: ${f.controparte}`,
      f.importo != null &&
        `Importo ${f.importoOp === 'minore' ? 'massimo' : 'minimo'}: ${euro(f.importo)}`,
      f.allegati && 'Solo con ricevute',
    ]
      .filter(Boolean)
      .join(' · ') || 'Tutti i movimenti'
  )
}
/** Testo selezionabile, righe paginate e intestazioni ripetute anche su report lunghi. */
export function creaReportPdf(items: Movimento[], filtri: FiltriConti): jsPDF {
  const pdf = new jsPDF()
  let y = 0
  function intestazione() {
    pdf.setFillColor(194, 32, 38).rect(14, 12, 182, 2, 'F')
    pdf.setTextColor(36, 29, 22).setFont('helvetica', 'bold').setFontSize(17)
    pdf.text(`${config.clubName} | Conti`, 14, 24)
    pdf.setFont('helvetica', 'normal').setFontSize(9)
    pdf.text(
      `Generato il ${new Date().toLocaleString('it-IT')} | ${items.length} movimenti`,
      14,
      31,
    )
    y = 41
  }
  function spazio(h: number) {
    if (y + h > 278) {
      pdf.addPage()
      intestazione()
    }
  }
  function testo(s: string, size = 9) {
    pdf.setFontSize(size)
    const righe = pdf.splitTextToSize(pulito(s), 182) as string[]
    for (const riga of righe) {
      spazio(5)
      pdf.text(riga, 14, y)
      y += 5
    }
  }
  function testataTabella() {
    pdf.setFillColor(245, 242, 235).rect(14, y - 4, 182, 8, 'F')
    pdf.setFont('helvetica', 'bold').setFontSize(9)
    pdf.text('Data', 15, y + 1)
    pdf.text('Descrizione / categoria / controparte', 39, y + 1)
    pdf.text('Tipo', 117, y + 1)
    pdf.text('Importo', 158, y + 1, { align: 'right' })
    pdf.text('Stato', 166, y + 1)
    pdf.setFont('helvetica', 'normal')
    y += 10
  }
  intestazione()
  testo(descriviFiltri(filtri))
  y += 4
  const t = totaliReport(items)
  pdf.setFont('helvetica', 'bold')
  testo(
    `Entrate saldate: ${euro(t.entrate)} | Uscite saldate: ${euro(t.uscite)} | Netto selezione: ${euro(t.netto)}`,
    10,
  )
  pdf.setFont('helvetica', 'normal')
  testo(`Da incassare: ${euro(t.daIncassare)} | Da pagare: ${euro(t.daPagare)}`)
  testo(
    'Il netto riguarda solo i movimenti saldati selezionati; non rappresenta il saldo totale della cassa.',
  )
  y += 5
  spazio(20)
  testataTabella()
  for (const m of [...items].sort((a, b) => a.data.localeCompare(b.data))) {
    const dettagli = [
      m.descrizione,
      m.categoria,
      m.controparte,
      m.allegati?.length ? `Ricevute: ${m.allegati.length}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
    pdf.setFontSize(9)
    const righe = pdf.splitTextToSize(pulito(dettagli), 74) as string[]
    let indice = 0
    while (indice < righe.length) {
      if (y + 12 > 278) {
        pdf.addPage()
        intestazione()
        testataTabella()
      }
      const n = Math.max(1, Math.floor((278 - y - 6) / 4.5))
      const parte = righe.slice(indice, indice + n)
      if (indice === 0) {
        pdf.text(formatData(m.data, true), 15, y)
        pdf.text(m.tipo === 'entrata' ? 'Entrata' : 'Uscita', 117, y)
        pdf.text(euro(m.importo), 158, y, { align: 'right' })
        pdf.text(
          m.saldato
            ? 'Saldato'
            : m.tipo === 'entrata'
              ? 'Da incassare'
              : 'Da pagare',
          166,
          y,
        )
      }
      pdf.text(parte, 39, y, { lineHeightFactor: 1.42 })
      y += parte.length * 4.5 + 5
      indice += parte.length
    }
    pdf.setDrawColor(233, 225, 210).line(14, y - 3, 196, y - 3)
  }
  const pagine = pdf.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    pdf.setPage(i).setFontSize(8).setTextColor(100)
    pdf.text('Prospetto interno dell’associazione', 14, 288)
    pdf.text(`${i} / ${pagine}`, 196, 288, { align: 'right' })
  }
  return pdf
}
