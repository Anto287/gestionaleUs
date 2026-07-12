import { Button, App } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Convocato } from './SelectorList'

/**
 * Genera la distinta di gara ufficiale in PDF (dal repo generatore-distinte).
 */
export function PdfExporter({ list = [] }: { list?: Convocato[] }) {
  const { message } = App.useApp()

  async function handlePrint() {
    if (!list.length) return message.warning('La lista è vuota: aggiungi i convocati prima di stampare')

    function getMansNum(item: Convocato) {
      if (item.Allen) return 'Allen.'
      if (item.VAllen) return 'V.Allen.'
      if (item.DirAcc) return 'Dir. Acc'
      let result = item.amount ? item.amount.toString() : ''
      if (item.C) result += ' C.'
      if (item.VC) result += ' V.C.'
      return result
    }

    function generateEmptyRows(count: number) {
      if (count <= 0) return ''
      let rows = ''
      for (let i = 0; i < count; i++) {
        rows += `<tr style="height: 28px;">
          <td style="border: 1px solid #000; padding: 5px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center;">&nbsp;</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center;">&nbsp;</td>
        </tr>`
      }
      return rows
    }

    const tableHtml = document.createElement('div')
    tableHtml.style.padding = '40px'
    tableHtml.style.background = '#fff'
    tableHtml.style.position = 'absolute'
    tableHtml.style.left = '-9999px'
    tableHtml.style.top = '0'
    tableHtml.style.width = '210mm'
    tableHtml.style.fontFamily = 'Arial, sans-serif'

    tableHtml.innerHTML = `
      <div style="position: relative; text-align: center; margin-bottom: 25px;">
        <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="position: absolute; top: 0; right: 0; height: 70px; width: auto;" />
        <h2 style="font-size: 22px; font-weight: bold; margin: 0 0 20px 0;">DISTINTA GARA</h2>
        <div style="font-weight: bold; margin-bottom: 15px; font-size: 13px;">SQUADRA: U.S. RIOLUNATO</div>
        <div style="margin-bottom: 12px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span>COLORI: MAGLIE_______________________</span>
          <span>PANT. _______________________</span>
          <span>CALZ. _______________________</span>
        </div>
        <div style="margin-bottom: 12px; font-size: 12px;">
          <span style="font-size: 10px;">GIRONE/TORNEO:</span> ________________________ Tesserati partecipanti alla gara del ____________
        </div>
        <div style="margin-bottom: 20px; font-size: 12px;">
          ore_______ orario pres.note________ Contro_____________________________
          Campo____________________________
        </div>
      </div>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width:100%; font-size:12px;">
        <thead>
          <tr style="background: #d9d9d9; border: 1px solid #000;">
            <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Mans/Num.</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Cognome e Nome</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Data nascita</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Tessera</th>
            <th style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">Data rilascio</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map((item) => {
              const mansNum = getMansNum(item)
              const raw = item.raw as Record<string, string>
              const cognomeNome = `${raw?.Cognome ? raw.Cognome.replace(/\s+(JR|SR)$/i, '').trim() : ''} ${
                raw?.Nome ? raw.Nome.replace(/\s+(JR|SR)$/i, '').trim() : ''
              }`.trim()
              return `<tr style="height: 28px;">
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${mansNum}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${cognomeNome}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${raw?.DataNascita || ''}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${raw?.Tessera || ''}</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center;">${raw?.DataRilascio || ''}</td>
            </tr>`
            })
            .join('')}
          ${generateEmptyRows(23 - list.length)}
        </tbody>
      </table>
      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 20px; font-size: 13px; font-weight: bold;">
        <div style="text-align: center;"><div style="margin-bottom: 40px;">L'ARBITRO</div><div style="border-top: 1px solid #000; width: 180px; margin: 0 auto;"></div></div>
        <div style="text-align: center;"><div style="margin-bottom: 40px;">IL CAPITANO</div><div style="border-top: 1px solid #000; width: 180px; margin: 0 auto;"></div></div>
        <div style="text-align: center;"><div style="margin-bottom: 40px;">IL DIRIGENTE ACCOMPAGNATORE</div><div style="border-top: 1px solid #000; width: 180px; margin: 0 auto;"></div></div>
      </div>
    `

    document.body.appendChild(tableHtml)

    try {
      // aspetta che il logo sia caricato prima di catturare
      const img = tableHtml.querySelector('img')
      if (img && !img.complete) {
        await new Promise((res) => {
          img.onload = res
          img.onerror = res
        })
      }

      const canvas = await html2canvas(tableHtml, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

      let heightLeft = pdfHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
      heightLeft -= pdf.internal.pageSize.getHeight()
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight)
        heightLeft -= pdf.internal.pageSize.getHeight()
      }

      const now = new Date()
      const data = now.toLocaleDateString('it-IT').replace(/\//g, '-')
      const ora = now
        .toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        .replace(/:/g, '-')
      pdf.save(`distinta-riolunato-${data}_${ora}.pdf`)
      message.success('PDF generato con successo')
    } catch (err) {
      console.error('Errore generazione PDF:', err)
      message.error('Errore durante la generazione del PDF')
    } finally {
      tableHtml.remove()
    }
  }

  return (
    <Button
      icon={<DownloadOutlined />}
      type="primary"
      onClick={handlePrint}
      disabled={!list.length}
      size="large"
      block
    >
      Stampa Distinta (PDF)
    </Button>
  )
}
