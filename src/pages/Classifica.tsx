import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Skeleton, Table } from 'antd'
import { useCollection } from '../hooks/useCollection'
import { logoSquadra } from '../lib/loghi'
import type { LogoSquadra } from '../types'
import { PageHeader } from '../components/PageHeader'
import { useSeason } from '../season/SeasonContext'
import type { RisultatoUisp } from '../lib/uisp'
import { callDrive, getSecret } from '../services/driveStore'
type Riga = { squadra: string; punti: number; giocate?: number; vinte?: number; pareggiate?: number; perse?: number; golFatti?: number; golSubiti?: number }
type Risposta = { tipo: string; righe?: Riga[]; aggiornato?: string; risultati?: RisultatoUisp[]; avvisoRisultati?: string; pdfUrl?: string; comunicato?: string; categoria?: string; girone?: string }
const cacheUisp = new Map<string, { letto: number; dati: { righe: Riga[]; risultati: RisultatoUisp[]; avvisoRisultati?: string } }>()
export function Classifica() {
  const { attiva } = useSeason()
  return <ClassificaStagione key={attiva} stagione={attiva} />
}
function ClassificaStagione({ stagione }: { stagione: string }) {
  const { items: loghi } = useCollection<LogoSquadra>('loghi')
  const [data, setData] = useState<Risposta>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    async function carica() {
      setBusy(true)
      try {
        const r = await callDrive({ action: 'standings', season: stagione, secret: getSecret() })
        if (!active) return
        if (!r.ok) throw new Error(r.error || 'Classifica non disponibile')
        if (r.tipo === 'uisp') {
          const key = `${r.pdfUrl}|${r.categoria}|${r.girone}`
          const cached = cacheUisp.get(key)
          let parsed = cached && Date.now() - cached.letto < 15 * 60_000 ? cached.dati : undefined
          if (!parsed) {
            const [file, reader] = await Promise.all([
              callDrive({ action: 'standingsPdf', season: stagione, secret: getSecret() }),
              import('../lib/uispPdf'),
            ])
            if (!file.ok) throw new Error(file.error || 'Comunicato UISP non disponibile')
            if (file.pdfUrl !== r.pdfUrl) throw new Error('È disponibile un nuovo comunicato. Premi Aggiorna per rileggerlo.')
            if (!active) return
            parsed = await reader.leggiPdfUisp(file.dataBase64, r.categoria, r.girone)
            if (cacheUisp.size >= 3) cacheUisp.clear()
            cacheUisp.set(key, { letto: Date.now(), dati: parsed })
          }
          Object.assign(r, parsed)
        }
        if (active) { setData(r); setError('') }
      } catch (e) { if (active) { setData(undefined); setError((e as Error).message) } }
      finally { if (active) setBusy(false) }
    }
    void carica()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void carica() }, 300000)
    return () => { active = false; window.clearInterval(timer) }
  }, [stagione, refresh])
  return <>
    <PageHeader titolo="Classifica" sottotitolo={`Campionato · ${stagione}`} azioni={<Button loading={busy} onClick={() => { cacheUisp.clear(); setRefresh((n) => n + 1) }}>Aggiorna</Button>} />
    {busy && !data ? <Skeleton active /> : error ? <Alert type="error" message="Impossibile caricare la classifica" description={error} /> : data?.tipo === 'widget' ? <Alert type="warning" showIcon message="La fonte di questa stagione usa ancora un widget" description="Per visualizzare la classifica interna con i loghi, configura UISP Modena oppure una fonte API JSON in Management → Classifica. Un collegamento al widget non fornisce i dati della tabella." />
    : (data?.tipo === 'api' || data?.tipo === 'uisp') ? <>
      {data.tipo === 'uisp' ? <Alert type="info" showIcon message={`UISP Modena · Categoria ${data.categoria}, Girone ${data.girone}`} description={<span>Comunicato del {data.comunicato?.split('-').reverse().join('/')} · Aggiornamento settimanale, non in tempo reale. <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer">Apri il comunicato ufficiale</a></span>} style={{ marginBottom: 16 }} /> : <p>Ultima lettura: {new Date(data.aggiornato!).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} · Aggiornamento automatico ogni 5 minuti</p>}
      <Table<Riga> rowKey="squadra" dataSource={data.righe} pagination={false} scroll={{ x: 650 }} columns={[
        { title: '#', render: (_, _r, i) => i + 1 }, { title: 'Squadra', dataIndex: 'squadra', render: (nome: string) => { const logo = logoSquadra(loghi, nome); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{logo && <img src={logo.dataUrl} alt={`Logo ${nome}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />}{nome}</span> } },
        ...[['punti', 'Pt'], ['giocate', 'G'], ['vinte', 'V'], ['pareggiate', 'N'], ['perse', 'P'], ['golFatti', 'GF'], ['golSubiti', 'GS']].map(([dataIndex, title]) => ({ title, dataIndex, render: (v: number | undefined) => v ?? '—' })),
      ]} />
      {data.tipo === 'uisp' && <>
        <h2>Risultati del girone</h2>
        <p>Partite pubblicate nel comunicato del {data.comunicato?.split('-').reverse().join('/')}. Non modificano le partite e le statistiche della società.</p>
        {data.avvisoRisultati && <Alert type="warning" showIcon message={data.avvisoRisultati} style={{ marginBottom: 12 }} />}
        <Table<RisultatoUisp> rowKey="id" pagination={false} scroll={{ x: 600 }} dataSource={data.risultati} locale={{ emptyText: 'Nessun risultato del girone pubblicato in questo comunicato.' }} columns={[
          { title: 'Data', dataIndex: 'data', render: (s: string) => s.split('-').reverse().join('/') },
          { title: 'Giornata', dataIndex: 'giornata' }, { title: 'Casa', dataIndex: 'casa' },
          { title: 'Risultato', render: (_, r) => <strong>{r.golCasa} – {r.golOspite}</strong> }, { title: 'Trasferta', dataIndex: 'ospite' },
        ]} />
      </>}
    </> : <Empty description="Fonte non configurata per questa stagione. Un amministratore può aggiungerla in Management → Classifica." />}
  </>
}
