import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Divider, Empty, List, Row, Statistic, Tag, Tooltip, Typography } from 'antd'
import {
  CalendarOutlined,
  FireOutlined,
  ReloadOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { useSeason } from '../../season/SeasonContext'
import { PalloneSpinner } from '../../components/PalloneSpinner'
import { formatData } from '../../lib/format'
import {
  calcolaAlbo,
  calcolaAmichevoli,
  caricaStorico,
  descrizionePartita,
  type Albo,
  type AlboAmichevoli,
  type AlboStagione,
  type CampioneStagione,
  type RigaAlbo,
} from '../../lib/alboDoro'

const { Text } = Typography

/** "1 presenza" / "3 presenze" (gol e assist non cambiano) */
const SINGOLARE: Record<string, string> = { presenze: 'presenza', sedute: 'seduta' }
const unitaDi = (n: number, unita: string) => (n === 1 ? (SINGOLARE[unita] ?? unita) : unita)

/** oro, argento, bronzo — come nella classifica presenze */
const MEDAGLIE = ['#e5a800', '#b6b0a3', '#c8823c']

/** Un "trono": la classifica di sempre di una categoria, con podio. */
function Podio({ titolo, emoji, righe, unita }: { titolo: string; emoji: string; righe: RigaAlbo[]; unita: string }) {
  const top = righe.slice(0, 5)
  return (
    <Card size="small" title={`${emoji} ${titolo}`} style={{ height: '100%' }}>
      {top.length === 0 ? (
        <Text type="secondary">Ancora nessuno.</Text>
      ) : (
        top.map((r, i) => {
          const medaglia = i < 3 ? MEDAGLIE[i] : null
          return (
            <div
              key={r.nome}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: 700,
                  background: medaglia ?? 'transparent',
                  color: medaglia ? '#fff' : 'var(--testo-2)',
                }}
              >
                {i + 1}
              </span>
              <Tooltip title={r.dettaglio}>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: i === 0 ? 700 : 500,
                  }}
                >
                  {r.nome}
                  {r.stagioni > 1 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {' '}
                      · {r.stagioni} stagioni
                    </Text>
                  )}
                </span>
              </Tooltip>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                <b>{r.totale}</b>{' '}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {unitaDi(r.totale, unita)}
                </Text>
              </span>
            </div>
          )
        })
      )}
    </Card>
  )
}

/** Una tessera dei "record di sempre": valore grande + spiegazione. */
function TesseraRecord({ valore, etichetta, dettaglio }: { valore: string; etichetta: string; dettaglio?: string }) {
  return (
    <Card size="small" style={{ height: '100%', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valore}
      </div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{etichetta}</div>
      {dettaglio && (
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {dettaglio}
        </Text>
      )}
    </Card>
  )
}

function Campione({ etichetta, emoji, c, unita }: { etichetta: string; emoji: string; c?: CampioneStagione; unita: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' }}>
      <Text type="secondary">
        {emoji} {etichetta}
      </Text>
      {c ? (
        <span style={{ textAlign: 'right' }}>
          <b>{c.nome}</b>{' '}
          <Text type="secondary">
            ({c.n} {unitaDi(c.n, unita)})
          </Text>
        </span>
      ) : (
        <Text type="secondary">—</Text>
      )}
    </div>
  )
}

/** Il quadro di una stagione: bilancio + i suoi campioni. */
function SchedaStagione({ a }: { a: AlboStagione }) {
  return (
    <Card
      size="small"
      title={`Stagione ${a.stagione}`}
      extra={
        a.giocate > 0 && (
          <Tag style={{ marginInlineEnd: 0 }}>
            {a.v}V {a.p}P {a.s}S · {a.gf}-{a.gs}
          </Tag>
        )
      }
      style={{ height: '100%' }}
    >
      <Campione etichetta="Capocannoniere" emoji="⚽" c={a.capocannoniere} unita="gol" />
      <Campione etichetta="Re degli assist" emoji="🎯" c={a.reAssist} unita="assist" />
      <Campione etichetta="Più presente in partita" emoji="👕" c={a.piuPresente} unita="presenze" />
      <Campione etichetta="Stakanovista" emoji="💪" c={a.stakanovista} unita="sedute" />
      <div style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {a.giocate} {a.giocate === 1 ? 'partita ufficiale' : 'partite ufficiali'} · {a.sedute}{' '}
          {a.sedute === 1 ? 'seduta' : 'sedute'} di allenamento
        </Text>
      </div>
    </Card>
  )
}

/** Le amichevoli: fuori dall'albo d'oro, con bilancio, classifiche ed elenco a parte. */
function SezioneAmichevoli({ a }: { a: AlboAmichevoli }) {
  return (
    <>
      <Divider orientation="left" style={{ marginTop: 28 }}>
        🤝 Amichevoli
      </Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
        Non entrano nell'albo d'oro: classifiche, record e strisce qui sopra contano solo le partite ufficiali.
      </Text>
      {a.giocate === 0 ? (
        <Text type="secondary">Nessuna amichevole giocata finora.</Text>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <TesseraRecord valore={`${a.giocate}`} etichetta="Amichevoli giocate" />
            </Col>
            <Col xs={12} sm={6}>
              <TesseraRecord valore={`${a.v} · ${a.p} · ${a.s}`} etichetta="Vinte · pari · perse" />
            </Col>
            <Col xs={12} sm={6}>
              <TesseraRecord valore={`${a.gf}`} etichetta="Gol fatti" />
            </Col>
            <Col xs={12} sm={6}>
              <TesseraRecord valore={`${a.gs}`} etichetta="Gol subiti" />
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Podio titolo="Gol in amichevole" emoji="⚽" righe={a.gol} unita="gol" />
            </Col>
            <Col xs={24} md={8}>
              <Podio titolo="Assist in amichevole" emoji="🎯" righe={a.assist} unita="assist" />
            </Col>
            <Col xs={24} md={8}>
              <Podio titolo="Presenze in amichevole" emoji="👕" righe={a.presenze} unita="presenze" />
            </Col>
          </Row>
          <Card size="small" title="Tutte le amichevoli" styles={{ body: { padding: 0 } }}>
            <List
              dataSource={a.partite}
              renderItem={(x) => (
                <List.Item style={{ padding: '8px 16px' }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <Text strong>{formatData(x.data, true)}</Text>
                    <span>vs {x.avversario}</span>
                    <Tag style={{ marginInlineEnd: 0 }}>{x.inCasa ? 'Casa' : 'Trasferta'}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {x.stagione}
                    </Text>
                  </span>
                  <b style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {x.gf} - {x.gs}
                  </b>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}
    </>
  )
}

/**
 * La tab "Albo d'oro" delle statistiche: legge tutte le stagioni (con una
 * cache di sessione) e mostra classifiche di sempre, record e campioni
 * stagione per stagione.
 */
export function AlboDoro() {
  const { stagioni, attiva } = useSeason()
  const [albo, setAlbo] = useState<Albo | null>(null)
  const [amichevoli, setAmichevoli] = useState<AlboAmichevoli | null>(null)
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let annullato = false
    setCaricamento(true)
    setErrore('')
    caricaStorico(stagioni, tentativo > 0, attiva)
      .then((dati) => {
        if (annullato) return
        setAlbo(calcolaAlbo(dati))
        setAmichevoli(calcolaAmichevoli(dati))
      })
      .catch((e) => {
        if (!annullato) setErrore(String((e as Error)?.message || e))
      })
      .finally(() => {
        if (!annullato) setCaricamento(false)
      })
    return () => {
      annullato = true
    }
  }, [stagioni, attiva, tentativo])

  if (caricamento) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
        <PalloneSpinner />
        <Text type="secondary">
          Sto rileggendo {stagioni.length === 1 ? 'la stagione' : `tutte le ${stagioni.length} stagioni`}…
        </Text>
      </div>
    )
  }

  if (errore) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Non riesco a leggere lo storico delle stagioni"
        description={errore}
        action={
          <Button size="small" onClick={() => setTentativo((t) => t + 1)}>
            Riprova
          </Button>
        }
      />
    )
  }

  if (!albo || (albo.partiteTotali === 0 && albo.seduteTotali === 0 && !amichevoli?.giocate)) {
    return (
      <Empty description="L'albo d'oro si costruisce da partite e allenamenti: si riempirà stagione dopo stagione." />
    )
  }

  const c = albo.curiosita

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => setTentativo((t) => t + 1)}>
          Aggiorna
        </Button>
      </div>

      {/* la storia in quattro numeri */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <TrophyOutlined className="stat-icon" aria-hidden />
            <Statistic title="Stagioni" value={albo.stagioniConDati} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <CalendarOutlined className="stat-icon" aria-hidden />
            <Statistic title="Partite ufficiali" value={albo.partiteTotali} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <RiseOutlined className="stat-icon" aria-hidden />
            <Statistic title="Gol segnati" value={albo.golTotali} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <FireOutlined className="stat-icon" aria-hidden />
            <Statistic title="Sedute" value={albo.seduteTotali} />
          </Card>
        </Col>
      </Row>

      {/* le classifiche di sempre */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} xl={6}>
          <Podio titolo="Re del gol" emoji="⚽" righe={albo.gol} unita="gol" />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Podio titolo="Re degli assist" emoji="🎯" righe={albo.assist} unita="assist" />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Podio titolo="Sempre in campo" emoji="👕" righe={albo.presenzePartita} unita="presenze" />
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Podio titolo="Stakanovisti" emoji="💪" righe={albo.presenzeAllenamenti} unita="sedute" />
        </Col>
      </Row>

      {/* i record da raccontare al bar */}
      <Card title="Record di sempre" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {c.vittoriaPiuLarga && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.vittoriaPiuLarga.gf} – ${c.vittoriaPiuLarga.gs}`}
                etichetta="Vittoria più larga"
                dettaglio={descrizionePartita(c.vittoriaPiuLarga)}
              />
            </Col>
          )}
          {c.piuGolInPartita && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.piuGolInPartita.n} ⚽`}
                etichetta={`In una partita: ${c.piuGolInPartita.nome}`}
                dettaglio={descrizionePartita(c.piuGolInPartita)}
              />
            </Col>
          )}
          {c.partitaPiuSpettacolare && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.partitaPiuSpettacolare.gf} – ${c.partitaPiuSpettacolare.gs}`}
                etichetta="Partita più spettacolare"
                dettaglio={descrizionePartita(c.partitaPiuSpettacolare)}
              />
            </Col>
          )}
          {c.strisciaVittorie && c.strisciaVittorie.n > 1 && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.strisciaVittorie.n}`}
                etichetta="Vittorie di fila"
                dettaglio={`dal ${formatData(c.strisciaVittorie.dal, true)} al ${formatData(c.strisciaVittorie.al, true)}`}
              />
            </Col>
          )}
          {c.strisciaUtile && c.strisciaUtile.n > 1 && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.strisciaUtile.n}`}
                etichetta="Risultati utili di fila"
                dettaglio={`dal ${formatData(c.strisciaUtile.dal, true)} al ${formatData(c.strisciaUtile.al, true)}`}
              />
            </Col>
          )}
          {c.porteInviolate > 0 && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.porteInviolate}`}
                etichetta="Porte inviolate"
                dettaglio={`su ${albo.partiteTotali} partite`}
              />
            </Col>
          )}
          {c.affluenzaRecord && (
            <Col xs={12} md={8} xl={6}>
              <TesseraRecord
                valore={`${c.affluenzaRecord.presenti}`}
                etichetta="Affluenza record in allenamento"
                dettaglio={`seduta del ${formatData(c.affluenzaRecord.data, true)} · ${c.affluenzaRecord.stagione}`}
              />
            </Col>
          )}
        </Row>
      </Card>

      {/* l'albo, stagione per stagione */}
      <Row gutter={[16, 16]}>
        {albo.perStagione.map((a) => (
          <Col xs={24} md={12} key={a.stagione}>
            <SchedaStagione a={a} />
          </Col>
        ))}
      </Row>

      {amichevoli && <SezioneAmichevoli a={amichevoli} />}
    </>
  )
}
