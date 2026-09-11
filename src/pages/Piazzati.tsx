import { useMemo, useState } from 'react'
import {
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowUpOutlined,
  ClearOutlined,
  FlagOutlined,
  PrinterOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import type { ComponentType } from 'react'
import { useCollection } from '../hooks/useCollection'
import { useSeason } from '../season/SeasonContext'
import { PageHeader } from '../components/PageHeader'
import { isGiocatore } from '../lib/categoria'
import { oggiIso, formatData, plurale } from '../lib/format'
import {
  CASELLE_TOTALI,
  REPARTI,
  caselleAssegnate,
  etichettaCasella,
  type Incarico,
} from '../lib/piazzati'
import { esportaFoglioPiazzati } from './piazzati/foglio'
import type { CalciPiazzati, Giocatore } from '../types'

const { Text } = Typography

const ICONA: Record<string, ComponentType> = {
  battitori: FlagOutlined,
  favore: ArrowUpOutlined,
  contro: SafetyOutlined,
}

/**
 * Calci piazzati: chi batte gli angoli, le punizioni e le rimesse, e chi va
 * dove quando la palla è ferma — in area nostra e in area loro. Si compila
 * una volta e si stampa: in versione piena per lo spogliatoio, o vuota da
 * riempire a penna (anche in coda alla distinta).
 */
export function Piazzati() {
  const { attiva } = useSeason()
  const { items: rosa } = useCollection<Giocatore>('giocatori')
  const schede = useCollection<CalciPiazzati>('calciPiazzati')
  const { message } = AntApp.useApp()
  const [stampaVuoto, setStampaVuoto] = useState(false)
  const [stampando, setStampando] = useState(false)

  const scheda = schede.items[0]
  const incarichi = useMemo(() => scheda?.incarichi ?? {}, [scheda])

  const giocatori = useMemo(
    () =>
      rosa
        .filter(isGiocatore)
        .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`)),
    [rosa],
  )
  const opzioni = useMemo(
    () =>
      giocatori.map((g) => ({
        value: g.id,
        label: `${g.numeroMaglia != null ? `${g.numeroMaglia} · ` : ''}${g.cognome} ${g.nome}${
          g.infortunato ? ' (infortunato)' : ''
        }`,
      })),
    [giocatori],
  )
  const nomeDi = useMemo(() => {
    const m = new Map(giocatori.map((g) => [g.id, `${g.cognome} ${g.nome}`]))
    return (id: string) => m.get(id) ?? ''
  }, [giocatori])

  const assegnate = caselleAssegnate(incarichi)
  const percento = Math.round((assegnate / CASELLE_TOTALI) * 100)

  /** Salva una modifica: la scheda è una sola, si crea alla prima scelta. */
  function salva(prossimi: Record<string, string[]>, note?: string) {
    const dati = {
      incarichi: prossimi,
      note: note ?? scheda?.note,
      aggiornato: oggiIso(),
    }
    if (scheda) schede.update(scheda.id, dati)
    else schede.add(dati)
  }

  function scegli(inc: Incarico, posto: number, id?: string) {
    const attuali = [...(incarichi[inc.key] ?? [])]
    // una casella vuota in mezzo resta vuota: l'ordine è un'informazione
    while (attuali.length < inc.slot) attuali.push('')
    attuali[posto] = id ?? ''
    const puliti = attuali.slice(0, inc.slot)
    const prossimi = { ...incarichi, [inc.key]: puliti }
    if (puliti.every((x) => !x)) delete prossimi[inc.key]
    salva(prossimi)
  }

  function svuota() {
    salva({})
    message.success('Scheda svuotata.')
  }

  async function stampa() {
    setStampando(true)
    try {
      await esportaFoglioPiazzati({
        stagione: attiva,
        vuoto: stampaVuoto,
        incarichi,
        nomeDi,
        note: scheda?.note,
      })
    } catch (e) {
      message.error(`Stampa non riuscita: ${String((e as Error)?.message || e)}`)
    } finally {
      setStampando(false)
    }
  }

  if (giocatori.length === 0) {
    return (
      <>
        <PageHeader titolo="Calci piazzati" sottotitolo="Chi batte e chi va dove sulle palle ferme." />
        <Empty description="Prima serve qualcuno in rosa: aggiungi i giocatori e torna qui." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        titolo="Calci piazzati"
        sottotitolo="Chi batte e chi va dove sulle palle ferme."
        azioni={
          <Space wrap>
            {assegnate > 0 && (
              <Popconfirm
                title="Svuotare tutta la scheda?"
                description="Si perdono tutte le scelte fatte."
                okText="Svuota"
                cancelText="Annulla"
                okButtonProps={{ danger: true }}
                onConfirm={svuota}
              >
                <Button icon={<ClearOutlined />}>Svuota</Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<PrinterOutlined />} loading={stampando} onClick={stampa}>
              Stampa (PDF)
            </Button>
          </Space>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <div className="piazzati-stato">
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <Text strong>
              {plurale(assegnate, 'casella assegnata', 'caselle assegnate')} su {CASELLE_TOTALI}
            </Text>
            <Progress
              percent={percento}
              showInfo={false}
              strokeColor="#c22026"
              trailColor="var(--linea)"
              size={['100%', 6]}
              style={{ display: 'block', margin: '6px 0 0' }}
            />
            {scheda?.aggiornato && (
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                Ultima modifica: {formatData(scheda.aggiornato, true)}
              </Text>
            )}
          </div>
          <Tooltip title="Stampa il foglio senza i nomi, con le caselle da riempire a penna">
            <Checkbox checked={stampaVuoto} onChange={(e) => setStampaVuoto(e.target.checked)}>
              Stampa il foglio vuoto
            </Checkbox>
          </Tooltip>
        </div>
      </Card>

      {REPARTI.map((reparto) => {
        const Icona = ICONA[reparto.key]
        return (
          <Card
            key={reparto.key}
            style={{ marginBottom: 16 }}
            title={
              <Space>
                {Icona && <Icona />}
                {reparto.titolo}
              </Space>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 14, fontSize: 13.5 }}>
              {reparto.nota}
            </Text>
            <div className="piazzati-righe">
              {reparto.incarichi.map((inc) => (
                <div key={inc.key} className="piazzati-riga">
                  <div className="piazzati-nome">
                    <b>{inc.label}</b>
                    {inc.nota && <span className="piazzati-nota">{inc.nota}</span>}
                  </div>
                  <div
                    className="piazzati-caselle"
                    // le caselle stanno su una griglia (al massimo tre per riga):
                    // così anche la barriera da cinque resta incolonnata
                    style={{ gridTemplateColumns: `repeat(${Math.min(inc.slot, 3)}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: inc.slot }, (_, i) => (
                      <Select
                        key={i}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        className="piazzati-select"
                        placeholder={etichettaCasella(inc, i) || 'Chi lo fa'}
                        value={(incarichi[inc.key] ?? [])[i] || undefined}
                        onChange={(v) => scegli(inc, i, v)}
                        options={opzioni}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      <Card title="Note">
        <Input.TextArea
          rows={3}
          placeholder="Schemi particolari, chi chiama il segnale, cosa fare sul 1-0…"
          defaultValue={scheda?.note}
          onBlur={(e) => {
            const testo = e.target.value.trim()
            if (testo !== (scheda?.note ?? '')) salva(incarichi, testo || undefined)
          }}
        />
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          Le note finiscono in fondo al foglio stampato.
        </Text>
      </Card>
    </>
  )
}
