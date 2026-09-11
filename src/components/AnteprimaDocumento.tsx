import { useEffect, useRef, useState } from 'react'
import { Typography } from 'antd'
import { AnteprimaPdf } from './AnteprimaPdf'
import { PalloneSpinner } from './PalloneSpinner'
import { exportPdf } from '../services/driveStore'
import type { Documento } from '../types'

/**
 * Che anteprima possiamo mostrare:
 * - 'stampa': documento sul Drive → chiediamo allo script il PDF di stampa
 *   e lo disegniamo noi (identico al foglio stampato anche sul telefono);
 *   se lo script non conosce ancora l'azione si ripiega sull'iframe;
 * - 'iframe': visualizzatore di Google incorporato (immagini sul Drive e
 *   ripiego dei casi sopra);
 * - 'pdf': PDF salvato nel browser, disegnato direttamente;
 * - 'immagine': immagine salvata nel browser.
 */
type Anteprima =
  | { modo: 'immagine'; src: string }
  | { modo: 'pdf'; base64: string }
  | { modo: 'iframe'; src: string }
  | { modo: 'stampa'; fileId: string; ripiego: string }

/** Se e come si può mostrare l'anteprima di un documento (null = non si può). */
export function anteprimaDi(d: Documento): Anteprima | null {
  if (d.url) {
    const m = d.url.match(/\/(file|document|spreadsheets|presentation)\/d\/([\w-]+)/)
    if (!m) return null
    const host = m[1] === 'file' ? 'https://drive.google.com' : 'https://docs.google.com'
    const iframe = `${host}/${m[1]}/d/${m[2]}/preview`
    if (d.tipo.startsWith('image/')) return { modo: 'iframe', src: iframe }
    return { modo: 'stampa', fileId: m[2], ripiego: iframe }
  }
  if (d.dataUrl) {
    if (d.tipo.startsWith('image/')) return { modo: 'immagine', src: d.dataUrl }
    if (d.tipo === 'application/pdf') return { modo: 'pdf', base64: d.dataUrl.split(',')[1] ?? '' }
  }
  return null
}

/**
 * A questa larghezza il visualizzatore di Google mostra l'impaginazione da
 * stampa; sotto, passa alla vista mobile "riflowata". Per questo l'iframe
 * viene sempre reso così largo e poi rimpicciolito in scala nel riquadro.
 */
const LARGHEZZA_STAMPA = 880

function AnteprimaIframe({ src, nome }: { src: string; nome: string }) {
  const [pronto, setPronto] = useState(false)
  const [larghezza, setLarghezza] = useState(0)
  const riquadro = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = riquadro.current
    if (!el) return
    const osserva = new ResizeObserver(() => setLarghezza(el.clientWidth))
    osserva.observe(el)
    setLarghezza(el.clientWidth)
    return () => osserva.disconnect()
  }, [])

  const scala = larghezza > 0 ? larghezza / LARGHEZZA_STAMPA : 1
  return (
    <div ref={riquadro} className="anteprima-doc anteprima-doc-iframe">
      {larghezza > 0 && (
        <iframe
          src={src}
          title={nome}
          allow="autoplay"
          onLoad={() => setPronto(true)}
          style={{
            width: LARGHEZZA_STAMPA,
            height: `${70 / scala}vh`,
            border: 0,
            transform: `scale(${scala})`,
            transformOrigin: 'top left',
            visibility: pronto ? 'visible' : 'hidden',
          }}
        />
      )}
      {!pronto && (
        <div className="anteprima-caricamento">
          <PalloneSpinner />
          <Typography.Text type="secondary">Apro l'anteprima…</Typography.Text>
        </div>
      )}
    </div>
  )
}

export function AnteprimaDocumento({ doc }: { doc: Documento }) {
  const [vista] = useState(() => anteprimaDi(doc))
  const [prontaImg, setProntaImg] = useState(false)
  // PDF di stampa chiesto allo script; se manca o fallisce si ripiega sull'iframe
  const [pdf, setPdf] = useState<string | null>(null)
  const [ripiego, setRipiego] = useState(false)

  useEffect(() => {
    if (vista?.modo !== 'stampa') return
    let vivo = true
    exportPdf(vista.fileId)
      .then((b64) => vivo && (b64 ? setPdf(b64) : setRipiego(true)))
      .catch(() => vivo && setRipiego(true))
    return () => {
      vivo = false
    }
  }, [vista])

  if (!vista) return null

  if (vista.modo === 'immagine')
    return (
      <div className="anteprima-doc">
        <img
          src={vista.src}
          alt={doc.nome}
          onLoad={() => setProntaImg(true)}
          style={{
            display: prontaImg ? 'block' : 'none',
            maxWidth: '100%',
            maxHeight: '70vh',
            margin: '0 auto',
          }}
        />
        {!prontaImg && (
          <div className="anteprima-caricamento">
            <PalloneSpinner />
            <Typography.Text type="secondary">Apro l'anteprima…</Typography.Text>
          </div>
        )}
      </div>
    )

  if (vista.modo === 'pdf')
    return ripiego ? (
      <AnteprimaIframe src={doc.dataUrl!} nome={doc.nome} />
    ) : (
      <AnteprimaPdf base64={vista.base64} onErrore={() => setRipiego(true)} />
    )

  if (vista.modo === 'stampa') {
    if (ripiego) return <AnteprimaIframe src={vista.ripiego} nome={doc.nome} />
    if (pdf) return <AnteprimaPdf base64={pdf} onErrore={() => setRipiego(true)} />
    return (
      <div className="anteprima-caricamento">
        <PalloneSpinner />
        <Typography.Text type="secondary">Preparo l'anteprima di stampa…</Typography.Text>
      </div>
    )
  }

  return <AnteprimaIframe src={vista.src} nome={doc.nome} />
}
