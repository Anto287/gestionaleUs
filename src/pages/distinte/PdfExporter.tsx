import { Button, App } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Convocato } from './SelectorList'
import type { TestataDistinta } from '../../types'
import { formatData } from '../../lib/format'
import { aggiungiAlPdf, canvasFoglio, htmlFoglioPiazzati } from '../piazzati/foglio'

/** Scherma i caratteri speciali: il testo dell'utente va dentro innerHTML. */
function esc(s?: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** righe per i giocatori nel modello UISP */
const RIGHE_GIOCATORI = 20
const ALTEZZA_RIGA = 27
/** stile comune delle celle del foglio */
const td = 'border:1px solid #000;padding:2px 3px;overflow:hidden;white-space:nowrap;'
/** ruoli di staff: vanno in fondo al foglio, non fra i giocatori (VAllen = distinte salvate prima) */
const RUOLI_STAFF = ['Allen', 'VAllen', 'DirAcc', 'DirUff', 'AssArb', 'Defib']

/** "COGNOME Nome", senza i JR/SR aggiunti per distinguere gli omonimi */
function cognomeNome(raw: Record<string, string>): string {
  const pulito = (v?: string) => (v ?? '').replace(/\s+(JR|SR)$/i, '').trim()
  return `${pulito(raw.Cognome)} ${pulito(raw.Nome)}`.trim()
}

/** la data di nascita può essere ISO (dal selettore) o già scritta gg/mm/aaaa */
function dataNascita(v?: string): string {
  if (!v) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatData(v, true) : v
}

/** L'HTML del foglio (misurato su 210mm di larghezza), sul modello "DISTINTA A 20 GIOCATORI UISP". */
function htmlDistinta(list: Convocato[], testata: TestataDistinta): string {
  const gironeTorneo = [testata.torneo, testata.girone].filter(Boolean).join(' — ')
  const dataGara = testata.dataGara ? formatData(testata.dataGara, true) : undefined

  // in ordine alfabetico, prima il cognome e poi il nome; il N. del ruolo segue l'ordine (1–20)
  const pulito = (v?: string) => (v ?? '').replace(/\s+(JR|SR)$/i, '').trim()
  const chiave = (it: Convocato) => {
    const raw = (it.raw ?? {}) as Record<string, string>
    return [pulito(raw.Cognome), pulito(raw.Nome)] as const
  }
  const giocatori = list
    .filter((it) => !RUOLI_STAFF.some((k) => it[k]))
    .sort((a, b) => {
      const [ca, na] = chiave(a)
      const [cb, nb] = chiave(b)
      return (
        ca.localeCompare(cb, 'it', { sensitivity: 'base' }) || na.localeCompare(nb, 'it', { sensitivity: 'base' })
      )
    })
  const staff = (k: string) => list.find((it) => it[k])

  // la distinta UISP ha 20 righe: le vuote restano da compilare a penna
  const righe = Array.from({ length: Math.max(RIGHE_GIOCATORI, giocatori.length) }, (_, i) => {
    const g = giocatori[i]
    const raw = (g?.raw ?? {}) as Record<string, string>
    const capVice = g?.C ? 'C' : g?.VC ? 'VC' : ''
    return `<tr style="height:${ALTEZZA_RIGA}px;">
      <td style="${td}text-align:center;">${i + 1}</td>
      <td style="${td}text-align:center;">${g?.amount ?? ''}</td>
      <td style="${td}text-align:center;">${esc(dataNascita(raw.DataNascita))}</td>
      <td style="${td}padding-left:6px;">${g ? esc(cognomeNome(raw)) : ''}</td>
      <td style="${td}text-align:center;font-size:11px;">${capVice}</td>
      <td style="${td}text-align:center;">${esc(raw.Tessera)}</td>
      <td style="${td}text-align:center;">${esc(raw.Documento)}</td>
    </tr>`
  }).join('')

  const assistente = staff('AssArb')
  const rawAss = (assistente?.raw ?? {}) as Record<string, string>

  /** riga di staff in fondo al foglio: nome e, se c'è, la tessera */
  function rigaStaff(etichetta: string, k: string) {
    const p = staff(k)
    const raw = (p?.raw ?? {}) as Record<string, string>
    return `<tr style="height:30px;">
      <td style="${td}padding-left:6px;">${etichetta}</td>
      <td style="${td}padding-left:6px;">${p ? `<b>${esc(cognomeNome(raw))}</b>` : ''}</td>
      <td style="${td}text-align:center;font-size:9px;">Tessera:</td>
      <td style="${td}text-align:center;">${esc(raw.Tessera)}</td>
    </tr>`
  }

  // riga libera: solo il nome (dalla testata, o dalle distinte vecchie fra i convocati), niente tessera
  function rigaDefibrillatore() {
    const vecchio = staff('Defib')?.raw as Record<string, string> | undefined
    const nome = testata.defibrillatore ?? (vecchio ? cognomeNome(vecchio) : '')
    return `<tr style="height:30px;">
      <td colspan="4" style="${td}padding-left:6px;">Addetto al defibrillatore:${nome ? ` <b>${esc(nome)}</b>` : ''}</td>
    </tr>`
  }

  const colori = [
    testata.coloreMaglia && `maglia ${esc(testata.coloreMaglia)}`,
    testata.colorePantaloncini && `pant. ${esc(testata.colorePantaloncini)}`,
    testata.coloreCalzettoni && `calz. ${esc(testata.coloreCalzettoni)}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const gara = testata.avversario ? `U.S. Riolunato — ${esc(testata.avversario)}` : ''
  const quando = [dataGara, testata.oraGara && `ore ${esc(testata.oraGara)}`].filter(Boolean).join(' · ')

  return `
    <div style="text-align:center;font-size:20px;font-weight:bold;color:#0000cc;margin-bottom:8px;">UISP MODENA SDA CALCIO</div>
    <div style="display:flex;align-items:center;gap:14px;min-height:76px;margin-bottom:8px;font-size:12px;">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="height:70px;width:auto;" />
      <div style="flex:1;line-height:1.55;">
        <div style="font-size:15px;font-weight:bold;">U.S. RIOLUNATO</div>
        ${gironeTorneo ? `<div>Girone/torneo: <b>${esc(gironeTorneo)}</b></div>` : ''}
        ${colori ? `<div>Colori: <b>${colori}</b></div>` : ''}
        ${testata.orarioRitrovo ? `<div>Ritrovo / note: <b>${esc(testata.orarioRitrovo)}</b></div>` : ''}
      </div>
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:14px;table-layout:fixed;">
      <colgroup>
        <col style="width:3.5%" /><col style="width:3.7%" /><col style="width:13.3%" /><col style="width:31.3%" />
        <col style="width:4.3%" /><col style="width:16.7%" /><col style="width:27.2%" />
      </colgroup>
      <tr style="height:44px;">
        <td colspan="5" style="${td}text-align:center;">Distinta dei giocatori partecipanti alla gara:</td>
        <td colspan="2" style="${td}text-align:center;"><b>${gara}</b></td>
      </tr>
      <tr style="height:24px;">
        <td colspan="3" style="${td}text-align:center;">Da disputare il:</td>
        <td style="${td}text-align:center;"><b>${esc(quando)}</b></td>
        <td style="${td}text-align:center;">A:</td>
        <td colspan="2" style="${td}text-align:center;"><b>${esc(testata.campo)}</b></td>
      </tr>
      <tr style="height:22px;">
        <td rowspan="2" style="${td}text-align:center;font-size:7px;line-height:1.2;white-space:normal;">N. del ruolo</td>
        <td rowspan="2" style="${td}text-align:center;font-size:7px;line-height:1.2;white-space:normal;">N. maglia</td>
        <td rowspan="2" style="${td}text-align:center;font-size:11px;">Data di nascita</td>
        <td rowspan="2" style="${td}text-align:center;">Cognome e nome</td>
        <td style="${td}text-align:center;font-size:9px;">CAP</td>
        <td colspan="2" style="${td}text-align:center;font-size:12px;">Documenti di identificazione</td>
      </tr>
      <tr style="height:22px;">
        <td style="${td}text-align:center;font-size:9px;">VICE</td>
        <td style="${td}text-align:center;font-size:12px;">N. TESSERA UISP</td>
        <td style="${td}text-align:center;font-size:12px;">N. DOCUMENTO IDENTITA'</td>
      </tr>
      ${righe}
      <tr style="height:${ALTEZZA_RIGA}px;">
        <td colspan="7" style="${td}padding-left:6px;font-size:12px;">Assistente dell'arbitro:${
          assistente
            ? ` <b style="font-size:14px;">${esc(cognomeNome(rawAss))}</b>${rawAss.Tessera ? ` &nbsp;·&nbsp; Tessera: ${esc(rawAss.Tessera)}` : ''}`
            : ''
        }</td>
      </tr>
    </table>
    <table style="border-collapse:collapse;width:100%;font-size:13px;table-layout:fixed;margin-top:10px;">
      <colgroup>
        <col style="width:56.1%" /><col style="width:16.7%" /><col style="width:11.6%" /><col style="width:15.6%" />
      </colgroup>
      ${rigaStaff('Dirigente accompagnatore ufficiale della Squadra Sig.', 'DirAcc')}
      ${rigaStaff('Dirigente addetto ufficiali di gara Sig.', 'DirUff')}
      ${rigaStaff('Allenatore Sig.', 'Allen')}
      ${rigaDefibrillatore()}
    </table>
    <div style="display:flex;margin-top:18px;font-size:11px;text-align:center;">
      <div style="flex:1;"><div style="margin-bottom:34px;">V° L'ARBITRO</div><div style="border-top:1px solid #000;width:220px;margin:0 auto;"></div></div>
      <div style="flex:1;"><div style="margin-bottom:34px;">IL DIRIGENTE ACCOMPAGNATORE UFFICIALE</div><div style="border-top:1px solid #000;width:220px;margin:0 auto;"></div></div>
    </div>
  `
}

/**
 * Genera la distinta di gara in PDF sul modello UISP a 20 giocatori
 * (tessera UISP e documento d'identità presi dalla rosa).
 */
export function PdfExporter({
  list = [],
  testata = {},
  onStampato,
  allegaPiazzati = false,
  stagione = '',
}: {
  list?: Convocato[]
  testata?: TestataDistinta
  /** chiamato dopo che il PDF è stato generato con successo (per salvare la distinta) */
  onStampato?: () => void
  /** aggiunge in coda il foglio dei calci piazzati, vuoto, da compilare a penna */
  allegaPiazzati?: boolean
  stagione?: string
}) {
  const { message } = App.useApp()

  async function handlePrint() {
    if (!list.length) return message.warning('La lista è vuota: aggiungi i convocati prima di stampare')

    const tableHtml = document.createElement('div')
    tableHtml.style.padding = '26px 30px'
    tableHtml.style.background = '#fff'
    tableHtml.style.position = 'absolute'
    tableHtml.style.left = '-9999px'
    tableHtml.style.top = '0'
    tableHtml.style.width = '210mm'
    tableHtml.style.fontFamily = "'Century Schoolbook', 'New Century Schoolbook', 'Times New Roman', serif"
    // colore esplicito: senza, il foglio eredita l'inchiostro del tema attivo
    // (in tema scuro è panna e sulla carta bianca il testo sparisce)
    tableHtml.style.color = '#000'

    tableHtml.innerHTML = htmlDistinta(list, testata)

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
      // stessa impaginazione del foglio calci piazzati (in JPEG: la distinta
      // in PNG pesava 9 MB, scomoda da mandare in chat, e su carta è uguale)
      const pdf = new jsPDF('p', 'mm', 'a4')
      aggiungiAlPdf(pdf, canvas)

      // pagina in più: lo schema dei calci piazzati da riempire a mano
      if (allegaPiazzati) {
        const foglio = await canvasFoglio(
          htmlFoglioPiazzati({
            stagione,
            vuoto: true,
            avversario: testata.avversario,
            dataGara: testata.dataGara,
          }),
        )
        pdf.addPage()
        aggiungiAlPdf(pdf, foglio)
      }

      const now = new Date()
      const data = now.toLocaleDateString('it-IT').replace(/\//g, '-')
      const ora = now
        .toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        .replace(/:/g, '-')
      pdf.save(`distinta-riolunato-${data}_${ora}.pdf`)
      message.success('PDF generato con successo')
      onStampato?.()
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
