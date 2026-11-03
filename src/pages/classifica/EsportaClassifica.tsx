import { useState } from 'react'
import { Alert, Button, Segmented, Space } from 'antd'
import { DownloadOutlined, FilePdfOutlined, InstagramOutlined } from '@ant-design/icons'
import type { DatiClassifica } from '../../lib/classificaCache'
import type { LogoSquadra } from '../../types'
import { preparaGrafiche, scaricaClassificaPdf, scaricaGrafica, type FormatoClassifica } from './esporta'
export function EsportaClassifica({ dati, stagione, loghi }: { dati: DatiClassifica; stagione: string; loghi: LogoSquadra[] }) {
  const [formato, setFormato] = useState<FormatoClassifica>('post')
  const [canvases, setCanvases] = useState<HTMLCanvasElement[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function genera() {
    setBusy(true); setError('')
    try { setCanvases(await preparaGrafiche(dati, stagione, loghi, formato)) }
    catch { setError('Impossibile creare la grafica. Riprova.') }
    finally { setBusy(false) }
  }
  async function pdf() {
    setBusy(true); setError('')
    try { await scaricaClassificaPdf(dati, stagione) }
    catch { setError('Impossibile creare il PDF. Riprova.') }
    finally { setBusy(false) }
  }
  return <section className="classifica-export" aria-label="Esporta classifica">
    <div><h2>La classifica, pronta da condividere</h2><p>Loghi delle squadre, colori della società e data del comunicato. Il PDF A4 è pronto per la stampa.</p></div>
    <Segmented block aria-label="Formato Instagram" value={formato} onChange={(v) => { setFormato(v as FormatoClassifica); setCanvases([]) }} options={[{ label: 'Post · 4:5', value: 'post' }, { label: 'Storia · 9:16', value: 'storia' }]} />
    <Space wrap><Button icon={<InstagramOutlined />} type="primary" loading={busy} onClick={() => void genera()}>Anteprima Instagram</Button><Button icon={<FilePdfOutlined />} disabled={busy} onClick={() => void pdf()}>Scarica PDF A4</Button></Space>
    {error && <Alert type="error" message={error} />}
    {canvases.length > 0 && <div className="classifica-previews">{canvases.map((c, i) => <figure key={i}><img src={c.toDataURL('image/png')} alt={`Anteprima classifica, pagina ${i + 1}`} /><figcaption><Button icon={<DownloadOutlined />} onClick={() => void scaricaGrafica(c, `classifica-${stagione.replace('/', '-')}-${formato}-${i + 1}.png`).catch(() => setError('Download non riuscito'))}>Scarica PNG {canvases.length > 1 ? i + 1 : ''}</Button></figcaption></figure>)}</div>}
  </section>
}
