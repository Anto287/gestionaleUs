import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Empty, Skeleton, Table, Space, Switch } from 'antd'
import { useCollection } from '../hooks/useCollection'
import { logoSquadra } from '../lib/loghi'
import type { LogoSquadra } from '../types'
import { PageHeader } from '../components/PageHeader'
import { useSeason } from '../season/SeasonContext'
import { ReloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import { EsportaClassifica } from './classifica/EsportaClassifica'
import { nostraSquadra } from './classifica/esporta'
import type { RisultatoUisp } from '../lib/uisp'
import { callDrive, getSecret } from '../services/driveStore'
import { leggiClassificaCache, salvaClassificaCache, stessoComunicato, richiestaClassifica, type RigaClassifica as Riga, type DatiClassifica as Risposta } from '../lib/classificaCache'
export function Classifica() {
  const { attiva } = useSeason()
  return <ClassificaStagione key={attiva} stagione={attiva} />
}
function ClassificaStagione({ stagione }: { stagione: string }) {
  const { items: loghi } = useCollection<LogoSquadra>('loghi')
  const [data, setData] = useState<Risposta | undefined>(() => leggiClassificaCache(stagione))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [dettagli, setDettagli] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [esporta, setEsporta] = useState(false)
  const copia = useRef(data)
  const forza = useRef(false)
  useEffect(() => {
    let active = true, loading = false
    async function carica() {
      if (loading) return
      loading = true
      setBusy(true)
      try {
        const force = forza.current
        forza.current = false
        const secret = getSecret()
        const r = await richiestaClassifica(`${stagione}|${secret}|${force}`, async () => {
          const r = await callDrive({ action: 'standings', season: stagione, secret })
          if (!r.ok) throw new Error(r.error || 'Classifica non disponibile')
          if (r.tipo === 'uisp') {
            const cached = copia.current
            if (!force && stessoComunicato(cached, r)) return { ...r, righe: cached!.righe, risultati: cached!.risultati, avvisoRisultati: cached!.avvisoRisultati }
            const [file, reader] = await Promise.all([
              callDrive({ action: 'standingsPdf', season: stagione, secret }),
              import('../lib/uispPdf'),
            ])
            if (!file.ok) throw new Error(file.error || 'Comunicato UISP non disponibile')
            if (file.pdfUrl !== r.pdfUrl) throw new Error('È disponibile un nuovo comunicato. Premi Aggiorna per rileggerlo.')
            Object.assign(r, await reader.leggiPdfUisp(file.dataBase64, r.categoria, r.girone))
          }
          salvaClassificaCache(stagione, r)
          return r
        })
        if (active) { copia.current = r; setData(r); setError('') }
      } catch (e) { if (active) setError((e as Error).message) }
      finally { loading = false; if (active) setBusy(false) }
    }
    void carica()
    const torna = () => { if (document.visibilityState === 'visible') void carica() }
    window.addEventListener('online', torna)
    document.addEventListener('visibilitychange', torna)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void carica() }, 300000)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('online', torna); document.removeEventListener('visibilitychange', torna) }
  }, [stagione, refresh])
  return <div className="classifica-page">
    <PageHeader titolo="Classifica" sottotitolo={`Campionato · ${stagione}`} azioni={<Space><Button icon={<ReloadOutlined />} loading={busy} onClick={() => setRefresh((n) => n + 1)}>Aggiorna</Button><Button icon={<ShareAltOutlined />} type="primary" disabled={!data?.righe?.length} onClick={() => setEsporta((v) => !v)} aria-expanded={esporta}>Esporta classifica</Button></Space>} />
    {error && data && <Alert type="warning" showIcon message="Mostriamo l’ultima copia salvata" description={error} style={{ marginBottom: 16 }} />}
    {busy && !data ? <Skeleton active /> : error && !data ? <Alert type="error" message="Impossibile caricare la classifica" description={error} /> : data?.tipo === 'widget' ? <Alert type="warning" showIcon message="La fonte di questa stagione usa ancora un widget" description="Per visualizzare la classifica interna con i loghi, configura UISP Modena oppure una fonte API JSON in Management → Classifica. Un collegamento al widget non fornisce i dati della tabella." />
    : (data?.tipo === 'api' || data?.tipo === 'uisp') ? <>
      <div className="classifica-fonte">
        <div><span className="classifica-eyebrow">{data.tipo === 'uisp' ? `UISP Modena · Categoria ${data.categoria}, Girone ${data.girone}` : 'Campionato'}</span><p>{data.tipo === 'uisp' ? `Comunicato del ${data.comunicato?.split('-').reverse().join('/')}` : `Ultima lettura: ${new Date(data.aggiornato!).toLocaleString('it-IT')}`}</p></div>
        <span className="classifica-stato" role="status">{busy ? 'Verifica aggiornamenti…' : error ? 'Copia salvata' : 'Disponibile sul dispositivo'}</span>
        {data.tipo === 'uisp' && <div className="classifica-source-note"><span>Aggiornamento settimanale, non in tempo reale.</span> <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer">Comunicato ufficiale ↗</a><Button type="link" size="small" disabled={busy} onClick={() => { forza.current = true; setRefresh((n) => n + 1) }}>Rileggi PDF</Button></div>}
      </div>
      {esporta && <EsportaClassifica key={`${data.pdfUrl}|${data.comunicato}|${data.categoria}|${data.girone}|${data.aggiornato}`} dati={data} stagione={stagione} loghi={loghi} />}
      <div className="classifica-toolbar"><h2>Classifica del campionato</h2><label><Switch size="small" checked={dettagli} onChange={setDettagli} /> Tutte le statistiche</label></div>
      <Table<Riga> className={dettagli ? "classifica-table classifica-table-full" : "classifica-table"} rowClassName={(r) => nostraSquadra(r.squadra) ? "classifica-own" : ""} size="small" rowKey="squadra" dataSource={data.righe} pagination={false} scroll={dettagli ? { x: 720 } : undefined} columns={[
        { title: '#', width: 36, render: (_, _r, i) => i + 1 }, { title: 'Squadra', className: 'classifica-team-cell', dataIndex: 'squadra', render: (nome: string) => { const logo = logoSquadra(loghi, nome); return <span className="classifica-team">{logo && <img src={logo.dataUrl} alt={`Logo ${nome}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />}<span>{nome}</span></span> } },
        ...[['punti', 'Pt'], ['giocate', 'G'], ...(dettagli ? [['vinte', 'V'], ['pareggiate', 'N'], ['perse', 'P'], ['golFatti', 'GF'], ['golSubiti', 'GS']] : [])].map(([dataIndex, title]) => ({ title, dataIndex, width: 46, className: dataIndex === 'punti' ? 'classifica-punti' : 'classifica-numero', render: (v: number | undefined) => v ?? '—' })),
      ]} />
      {data.tipo === 'uisp' && <>
        <div className="classifica-toolbar classifica-results-title"><h2>Risultati del girone</h2><span>Dal comunicato del {data.comunicato?.split('-').reverse().join('/')}</span></div>
        {data.avvisoRisultati && <Alert type="warning" showIcon message={data.avvisoRisultati} style={{ marginBottom: 12 }} />}
        <div className="classifica-mobile-results">{data.risultati?.length ? data.risultati.map((r) => <article key={r.id}><small>{r.data.split('-').reverse().join('/')} · {r.giornata}</small><div><span>{r.casa}</span><strong>{r.golCasa} – {r.golOspite}</strong><span>{r.ospite}</span></div></article>) : <p>Nessun risultato pubblicato in questo comunicato.</p>}</div>
        <Table<RisultatoUisp> className="classifica-desktop-results" size="small" rowKey="id" pagination={false} scroll={{ x: 600 }} dataSource={data.risultati} locale={{ emptyText: 'Nessun risultato del girone pubblicato in questo comunicato.' }} columns={[
          { title: 'Data', dataIndex: 'data', render: (s: string) => s.split('-').reverse().join('/') },
          { title: 'Giornata', dataIndex: 'giornata' }, { title: 'Casa', dataIndex: 'casa' },
          { title: 'Risultato', render: (_, r) => <strong>{r.golCasa} – {r.golOspite}</strong> }, { title: 'Trasferta', dataIndex: 'ospite' },
        ]} />
      </>}
    </> : <Empty description="Fonte non configurata per questa stagione. Un amministratore può aggiungerla in Management → Classifica." />}
  </div>
}
