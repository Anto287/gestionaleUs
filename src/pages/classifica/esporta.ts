import type { DatiClassifica } from '../../lib/classificaCache'
import { chiaveSquadra, logoSquadra } from '../../lib/loghi'
import type { LogoSquadra } from '../../types'
import { config } from '../../config'
export type FormatoClassifica = 'post' | 'storia' | 'pdf'
const rosso = '#c22026', oro = '#e5a800', carta = '#f5f2eb', inchiostro = '#241d16'
const dataFonte = (d: DatiClassifica) => d.comunicato ? `Comunicato UISP del ${d.comunicato.split('-').reverse().join('/')}` : `Dati del ${new Date(d.aggiornato || Date.now()).toLocaleDateString('it-IT')}`
export const nostraSquadra = (nome: string) => chiaveSquadra(nome).includes('riolunato')
function immagine(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(undefined); img.src = src })
}
function nomeSquadra(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number) {
  for (let size = 28; size >= 12; size--) {
    ctx.font = `600 ${size}px Inter, sans-serif`
    const lines: string[] = []
    let line = ''
    for (const char of text) {
      if (ctx.measureText(line + char).width > width) { lines.push(line.trim()); line = '' }
      line += char
    }
    if (line) lines.push(line.trim())
    if (lines.length * size * 1.2 > height - 10) continue
    lines.forEach((l, i) => ctx.fillText(l, x, y + (height - lines.length * size * 1.2) / 2 + size + i * size * 1.2))
    return
  }
}
function salva(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export async function preparaGrafiche(dati: DatiClassifica, stagione: string, loghi: LogoSquadra[], formato: FormatoClassifica) {
  await document.fonts.ready
  const righe = dati.righe || [], perPagina = formato === 'storia' ? 18 : 12
  const pages: HTMLCanvasElement[] = []
  const immagini = new Map<string, HTMLImageElement>()
  await Promise.all(loghi.map(async (l) => { const img = await immagine(l.dataUrl); if (img) immagini.set(l.id, img) }))
  const club = logoSquadra(loghi, config.clubName)
  const crest = (club && immagini.get(club.id)) || await immagine(`${import.meta.env.BASE_URL}logo.png`)
  for (let offset = 0; offset < righe.length; offset += perPagina) {
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = formato === 'storia' ? 1920 : 1350
    const ctx = canvas.getContext('2d')!
    const top = formato === 'storia' ? 170 : 64, bottom = formato === 'storia' ? 180 : 60
    ctx.fillStyle = carta; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = rosso; ctx.fillRect(0, 0, 1080, 18); ctx.fillStyle = oro; ctx.fillRect(780, 0, 300, 18)
    if (crest) { const ratio = Math.min(92 / crest.width, 110 / crest.height); ctx.drawImage(crest, 62, top, crest.width * ratio, crest.height * ratio) }
    ctx.fillStyle = rosso; ctx.font = '700 24px Inter, sans-serif'; ctx.fillText(config.clubName.toUpperCase(), 180, top + 34)
    ctx.fillStyle = inchiostro; ctx.font = '700 70px Inter, sans-serif'; ctx.fillText('CLASSIFICA', 60, top + 185)
    ctx.font = '500 26px Inter, sans-serif'
    ctx.fillText(`${stagione}${dati.tipo === 'uisp' ? ` · Categoria ${dati.categoria} · Girone ${dati.girone}` : ' · Campionato'}`, 64, top + 232)
    const start = top + 300, rows = righe.slice(offset, offset + perPagina), rowH = Math.min(83, (canvas.height - bottom - start - 100) / rows.length)
    ctx.fillStyle = '#75695a'; ctx.font = '600 22px Inter, sans-serif'
    ctx.fillText('#', 76, start); ctx.fillText('SQUADRA', 164, start); ctx.fillText('G', 860, start); ctx.fillText('PT', 955, start)
    rows.forEach((r, i) => {
      const y = start + 22 + i * rowH, own = nostraSquadra(r.squadra)
      if (own) { ctx.fillStyle = rosso; ctx.fillRect(58, y, 964, rowH - 4) }
      ctx.fillStyle = own ? carta : inchiostro; ctx.font = '600 27px Inter, sans-serif'; ctx.fillText(String(offset + i + 1).padStart(2, '0'), 76, y + rowH * .61)
      const logo = logoSquadra(loghi, r.squadra), img = logo && immagini.get(logo.id)
      if (img) { const scale = Math.min(44 / img.width, 48 / img.height); ctx.drawImage(img, 146 + (44 - img.width * scale) / 2, y + (rowH - img.height * scale) / 2 - 2, img.width * scale, img.height * scale) }
      nomeSquadra(ctx, r.squadra, 210, y - 2, 610, rowH)
      ctx.font = '500 26px Inter, sans-serif'; ctx.fillText(String(r.giocate ?? '—'), 860, y + rowH * .61)
      ctx.font = '800 32px Inter, sans-serif'; ctx.fillText(String(r.punti), 955, y + rowH * .61)
      if (!own) { ctx.strokeStyle = '#dcd2c2'; ctx.beginPath(); ctx.moveTo(64, y + rowH - 3); ctx.lineTo(1016, y + rowH - 3); ctx.stroke() }
    })
    ctx.fillStyle = '#75695a'; ctx.font = '500 21px Inter, sans-serif'; ctx.fillText(dataFonte(dati), 64, canvas.height - bottom)
    if (righe.length > perPagina) { ctx.textAlign = 'right'; ctx.fillText(`${offset / perPagina + 1} / ${Math.ceil(righe.length / perPagina)}`, 1016, canvas.height - bottom); ctx.textAlign = 'left' }
    pages.push(canvas)
  }
  return pages
}
export async function scaricaGrafica(canvas: HTMLCanvasElement, nome: string) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(Error('Impossibile creare la grafica')), 'image/png'))
  salva(blob, nome)
}
export async function scaricaClassificaPdf(dati: DatiClassifica, stagione: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF(), rows = dati.righe || []
  const columns: [string, number, keyof (typeof rows)[number] | 'pos'][] = [['#', 14, 'pos'], ['Squadra', 25, 'squadra'], ['Pt', 126, 'punti'], ['G', 138, 'giocate'], ['V', 150, 'vinte'], ['N', 162, 'pareggiate'], ['P', 174, 'perse'], ['GF', 186, 'golFatti'], ['GS', 198, 'golSubiti']]
  let y = 0
  const header = () => {
    pdf.setFillColor(194, 32, 38); pdf.rect(14, 14, 184, 2, 'F'); pdf.setTextColor(36, 29, 22); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.text('CLASSIFICA', 14, 30)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(`${config.clubName} | ${stagione}${dati.tipo === 'uisp' ? ` | Categoria ${dati.categoria}, Girone ${dati.girone}` : ''}`, 14, 38); pdf.text(dataFonte(dati), 14, 45)
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); columns.forEach(([label, x]) => pdf.text(label, x, 58, { align: x > 100 ? 'right' : 'left' })); y = 65
  }
  header()
  rows.forEach((r, i) => {
    pdf.setFontSize(9); const lines = pdf.splitTextToSize(r.squadra, 91) as string[], h = Math.max(10, lines.length * 4 + 5)
    if (y + h > 276) { pdf.addPage(); header() }
    if (nostraSquadra(r.squadra)) { pdf.setFillColor(249, 235, 230); pdf.rect(14, y - 5, 184, h, 'F') }
    pdf.setFont('helvetica', nostraSquadra(r.squadra) ? 'bold' : 'normal')
    columns.forEach(([, x, k]) => { pdf.text(k === 'squadra' ? lines : String(k === 'pos' ? i + 1 : r[k] ?? '-'), x, y, { align: x > 100 ? 'right' : 'left' }) })
    y += h
  })
  pdf.save(`classifica-${stagione.replace('/', '-')}.pdf`)
}
