import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { leggiUisp, type PaginaUisp } from './uisp'
GlobalWorkerOptions.workerSrc = worker
export async function leggiPdfUisp(base64: string, categoria: string, girone: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const task = getDocument({ data: bytes, isEvalSupported: false })
  try {
    const pdf = await task.promise
    if (pdf.numPages > 150) throw new Error('Comunicato UISP troppo lungo')
    const pagine: PaginaUisp[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n), text = await page.getTextContent()
      const lines: Array<{ y: number; items: Array<{ x: number; str: string }> }> = []
      for (const item of text.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = item.transform[5], x = item.transform[4]
        let line = lines.find((l) => Math.abs(l.y - y) < 2)
        if (!line) { line = { y, items: [] }; lines.push(line) }
        line.items.push({ x, str: item.str })
      }
      pagine.push({ righe: lines.sort((a, b) => b.y - a.y).map((l) => l.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()) })
      page.cleanup()
    }
    return leggiUisp(pagine, categoria, girone)
  } finally { await task.destroy() }
}
