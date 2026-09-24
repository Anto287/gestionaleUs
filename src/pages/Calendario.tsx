import { useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  App,
  Button,
  Calendar,
  Card,
  Grid,
  Input,
  List,
  Popover,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { CalendarProps } from 'antd'
import { CopyOutlined, DownloadOutlined, LinkOutlined, PlusOutlined, PrinterOutlined, RightOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useSeason } from '../season/SeasonContext'
import { PageHeader } from '../components/PageHeader'
import { useAppuntamenti } from '../lib/appuntamenti'
import { scaricaIcs, type EventoCal } from '../lib/ics'
import { formatData } from '../lib/format'
import { config } from '../config'
import { driveAttivo, getSecret } from '../services/driveStore'
import type { Allenamento, Partita, Torneo } from '../types'
import { StampaCalendario } from './partite/StampaCalendario'
import { ImpegnoModale, type Selezione } from './calendario/ImpegnoModale'

const { Text } = Typography

const COLORE_TIPO: Record<EventoCal['tipo'], string> = {
  partita: '#c22026',
  allenamento: '#3f7a52',
  appuntamento: '#e5a800',
}
const NOME_TIPO: Record<EventoCal['tipo'], string> = {
  partita: 'Partita',
  allenamento: 'Allenamento',
  appuntamento: 'In programma',
}

export function Calendario() {
  const { items: partite } = useCollection<Partita>('partite')
  const { items: allenamenti } = useCollection<Allenamento>('allenamenti')
  const { items: tornei } = useCollection<Torneo>('tornei')
  const { list: appuntamenti } = useAppuntamenti()
  const { attiva } = useSeason()
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const grande = !!screens.md
  const [mese, setMese] = useState<Dayjs>(() => dayjs())
  const [selezione, setSelezione] = useState<Selezione | null>(null)
  const [stampa, setStampa] = useState(false)

  /** L'evento del calendario → il record vero da aprire nel modale. */
  function apri(e: EventoCal) {
    const [pref, ...resto] = e.id.split('-')
    const id = resto.join('-')
    if (pref === 'p') {
      const item = partite.find((x) => x.id === id)
      if (item) setSelezione({ kind: 'partita', item })
    } else if (pref === 'a') {
      const item = allenamenti.find((x) => x.id === id)
      if (item) setSelezione({ kind: 'allenamento', item })
    } else {
      const item = appuntamenti.find((x) => x.id === id)
      if (item) setSelezione({ kind: 'appuntamento', item })
    }
  }

  const eventi: EventoCal[] = useMemo(() => {
    const out: EventoCal[] = []
    for (const p of partite) {
      const giocata = p.giocata !== false
      out.push({
        id: `p-${p.id}`,
        data: p.data,
        ora: p.ora,
        tipo: 'partita',
        titolo: `${giocata ? `Riolunato ${p.golFatti}-${p.golSubiti}` : 'Partita vs'} ${p.avversario} (${p.inCasa ? 'casa' : 'trasferta'})`,
      })
    }
    for (const a of allenamenti) {
      out.push({
        id: `a-${a.id}`,
        data: a.data,
        tipo: 'allenamento',
        titolo: 'Allenamento',
        descrizione: a.note,
      })
    }
    // un appuntamento con stessa data e avversario di una partita è la stessa
    // gara: si mostra solo la partita
    const chiave = (data: string, avv: string) => `${data}|${avv.trim().toLowerCase().replace(/\s+/g, ' ')}`
    const gia = new Set(partite.map((p) => chiave(p.data, p.avversario)))
    for (const ap of appuntamenti) {
      if (gia.has(chiave(ap.data, ap.avversario))) continue
      out.push({
        id: `ap-${ap.id}`,
        data: ap.data,
        ora: ap.ora,
        tipo: 'appuntamento',
        titolo: `Partita vs ${ap.avversario} (${ap.inCasa ? 'casa' : 'trasferta'})`,
        luogo: ap.luogo,
      })
    }
    return out.sort((a, b) => (a.data + (a.ora ?? '')).localeCompare(b.data + (b.ora ?? '')))
  }, [partite, allenamenti, appuntamenti])

  const perData = useMemo(() => {
    const m: Record<string, EventoCal[]> = {}
    for (const e of eventi) (m[e.data] ??= []).push(e)
    return m
  }, [eventi])

  const delMese = useMemo(
    () => eventi.filter((e) => e.data.slice(0, 7) === mese.format('YYYY-MM')),
    [eventi, mese],
  )

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (curr, info) => {
    if (info.type !== 'date') return info.originNode
    const evs = perData[curr.format('YYYY-MM-DD')]
    if (!evs?.length) return null
    if (grande) {
      return (
        <ul className="cal-lista">
          {evs.map((e) => (
            <li
              key={e.id}
              className="cal-evento"
              title="Modifica"
              onClick={(ev) => {
                // non deve scattare anche il "nuovo impegno" del giorno
                ev.stopPropagation()
                apri(e)
              }}
            >
              <i className="cal-dot" style={{ background: COLORE_TIPO[e.tipo] }} />
              {e.ora ? `${e.ora} · ` : ''}
              {e.tipo === 'allenamento' ? 'Allenamento' : e.titolo.replace(/^Partita vs /, 'vs ').replace(/^Riolunato /, '')}
            </li>
          ))}
        </ul>
      )
    }
    return (
      <div className="cal-dots">
        {evs.slice(0, 3).map((e) => (
          <i key={e.id} className="cal-dot" style={{ background: COLORE_TIPO[e.tipo] }} />
        ))}
      </div>
    )
  }

  function esportaIcs() {
    if (!eventi.length) {
      message.info('Nessun impegno da esportare')
      return
    }
    scaricaIcs(eventi, `U.S. Riolunato ${attiva}`, `riolunato-calendario-${attiva.replace('/', '-')}.ics`)
    message.success('Calendario scaricato: aprilo per importarlo in Google/Apple Calendar')
  }

  // link del feed (azione "ics" dello script sul Drive): si aggiorna da solo
  const urlFeed = driveAttivo()
    ? `${config.drive.url}?action=ics&secret=${encodeURIComponent(getSecret())}&season=${encodeURIComponent(attiva)}`
    : null

  async function copiaFeed() {
    if (!urlFeed) return
    try {
      await navigator.clipboard.writeText(urlFeed)
      message.success('Link copiato')
    } catch {
      message.info('Copia il link selezionandolo dal campo')
    }
  }

  return (
    <>
      <PageHeader
        titolo="Calendario"
        sottotitolo="Partite, allenamenti e impegni: tocca un impegno per modificarlo"
        azioni={
          <Space wrap>
            {urlFeed && (
              <Popover
                trigger="click"
                title="Connetti dal telefono"
                content={
                  <div style={{ maxWidth: 340 }}>
                    <Text style={{ fontSize: 13 }}>
                      In Google Calendar: Impostazioni → Aggiungi calendario → <b>Da URL</b> e incolla
                      questo link. Il calendario si aggiornerà da solo.
                    </Text>
                    <Space.Compact style={{ width: '100%', marginTop: 10 }}>
                      <Input readOnly value={urlFeed} onFocus={(e) => e.target.select()} />
                      <Button icon={<CopyOutlined />} onClick={copiaFeed} />
                    </Space.Compact>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                      ⚠️ Il link contiene la chiave della società: condividilo solo con dirigenti e mister.
                    </Text>
                  </div>
                }
              >
                <Button icon={<LinkOutlined />}>Connetti</Button>
              </Popover>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => setStampa(true)}>
              Stampa calendario
            </Button>
            <Button icon={<DownloadOutlined />} onClick={esportaIcs}>
              Scarica .ics
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSelezione({ kind: 'nuovo', data: mese.format('YYYY-MM-DD') })}
            >
              Nuovo impegno
            </Button>
          </Space>
        }
      />

      <Space size={[10, 6]} wrap style={{ marginBottom: 12 }}>
        {(Object.keys(COLORE_TIPO) as EventoCal['tipo'][]).map((t) => (
          <span key={t} className="cal-legenda">
            <i className="cal-dot" style={{ background: COLORE_TIPO[t] }} /> {NOME_TIPO[t]}
          </span>
        ))}
      </Space>

      <Card styles={{ body: { padding: grande ? 16 : 8 } }} style={{ marginBottom: 16 }}>
        <Calendar
          fullscreen={grande}
          value={mese}
          onChange={setMese}
          onPanelChange={(d) => setMese(d)}
          onSelect={(d, info) => {
            // sul calendario grande un clic sul giorno crea un impegno lì
            // (le tendine anno/mese in testata passano 'year'/'month')
            if (grande && info.source === 'date') setSelezione({ kind: 'nuovo', data: d.format('YYYY-MM-DD') })
          }}
          cellRender={cellRender}
        />
      </Card>

      <Card title={`Impegni di ${mese.format('MMMM YYYY')}`} styles={{ body: { padding: 0 } }}>
        <List
          locale={{ emptyText: 'Nessun impegno in questo mese' }}
          dataSource={delMese}
          renderItem={(e) => (
            <List.Item
              style={{ padding: '10px 20px', cursor: 'pointer' }}
              onClick={() => apri(e)}
              extra={<RightOutlined style={{ color: 'var(--testo-2)' }} />}
            >
              <Space size={10} wrap>
                <Tag color={COLORE_TIPO[e.tipo]} style={{ marginInlineEnd: 0 }}>
                  {NOME_TIPO[e.tipo]}
                </Tag>
                <Text strong>{formatData(e.data, true)}</Text>
                {e.ora && <Text>{e.ora}</Text>}
                <Text>{e.titolo}</Text>
                {e.luogo && <Text type="secondary">· {e.luogo}</Text>}
                {e.descrizione && <Text type="secondary">· {e.descrizione}</Text>}
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <ImpegnoModale selezione={selezione} onClose={() => setSelezione(null)} onSalvato={(d) => setMese(dayjs(d))} />

      <StampaCalendario
        open={stampa}
        onClose={() => setStampa(false)}
        partite={partite}
        allenamenti={allenamenti}
        appuntamenti={appuntamenti}
        tornei={tornei}
        stagione={attiva}
      />
    </>
  )
}
