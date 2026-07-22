import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Row, Select, Space, Statistic, Tabs, Tag, Typography } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FilePdfOutlined, TrophyOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useSeason } from '../season/SeasonContext'
import { PageHeader } from '../components/PageHeader'
import { COLORI } from '../lib/chart'
import { esitoPartita } from '../lib/social'
import { partiteConPresenze, statisticheGiocatore } from '../lib/statistiche'
import { isGiocatore } from '../lib/categoria'
import { ClassificaPresenze, type RigaClassifica } from './allenamenti/classifica'
import { AlboDoro } from './statistiche/AlboDoro'
import { esportaReportStagione } from './statistiche/report'
import type { Allenamento, Giocatore, Movimento, Partita, Torneo } from '../types'

const { Text } = Typography

const COLORE_ESITO: Record<string, string> = { V: COLORI.verde, P: COLORI.oro, S: COLORI.rosso }

function labelBreve(iso: string) {
  const [, m, d] = iso.split('-')
  return d && m ? `${d}/${m}` : iso
}

export function Statistiche() {
  const { items: partite } = useCollection<Partita>('partite')
  const { items: giocatori } = useCollection<Giocatore>('giocatori')
  const { items: allenamenti } = useCollection<Allenamento>('allenamenti')
  const { items: conti } = useCollection<Movimento>('conti')
  const { items: tornei } = useCollection<Torneo>('tornei')
  const { attiva } = useSeason()
  const [esportando, setEsportando] = useState(false)
  // 'tutte' oppure l'id di un torneo: tutte le statistiche si restringono
  const [competizione, setCompetizione] = useState<string>('tutte')
  const [tab, setTab] = useState<'stagione' | 'albo'>('stagione')

  const giocate = useMemo(
    () =>
      partite
        .filter((p) => p.giocata !== false)
        .filter((p) => competizione === 'tutte' || p.torneoId === competizione)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [partite, competizione],
  )

  // il filtro compare solo se qualche partita ha una competizione assegnata
  const torneiUsati = useMemo(
    () => tornei.filter((t) => partite.some((p) => p.torneoId === t.id)),
    [tornei, partite],
  )
  const nomeCompetizione =
    competizione === 'tutte' ? undefined : tornei.find((t) => t.id === competizione)?.nome

  const record = useMemo(() => {
    const r = { v: 0, p: 0, s: 0, gf: 0, gs: 0 }
    for (const p of giocate) {
      const e = esitoPartita(p).code
      if (e === 'V') r.v++
      else if (e === 'P') r.p++
      else r.s++
      r.gf += p.golFatti
      r.gs += p.golSubiti
    }
    return r
  }, [giocate])

  const casaTrasferta = useMemo(() => {
    const base = () => ({ v: 0, p: 0, s: 0, gf: 0, gs: 0, giocate: 0 })
    const casa = base()
    const fuori = base()
    for (const p of giocate) {
      const box = p.inCasa ? casa : fuori
      const e = esitoPartita(p).code
      if (e === 'V') box.v++
      else if (e === 'P') box.p++
      else box.s++
      box.gf += p.golFatti
      box.gs += p.golSubiti
      box.giocate++
    }
    return { casa, fuori }
  }, [giocate])

  const datiChart = useMemo(
    () =>
      giocate.map((p) => ({
        label: labelBreve(p.data),
        avversario: p.avversario,
        fatti: p.golFatti,
        subiti: p.golSubiti,
      })),
    [giocate],
  )

  // classifiche individuali (solo giocatori, dai tabellini delle partite)
  const { marcatori, assist, disciplina } = useMemo(() => {
    const soloGiocatori = giocatori.filter(isGiocatore)
    const stats = soloGiocatori.map((g) => ({
      g,
      nome: `${g.cognome} ${g.nome}`,
      s: statisticheGiocatore(g.id, giocate),
    }))
    const totGol = Math.max(1, record.gf)
    const totAssist = Math.max(
      1,
      stats.reduce((t, x) => t + x.s.assist, 0),
    )
    const marcatori: RigaClassifica[] = stats
      .filter((x) => x.s.gol > 0)
      .sort((a, b) => b.s.gol - a.s.gol || a.nome.localeCompare(b.nome))
      .map((x) => ({ id: x.g.id, nome: x.nome, presenze: x.s.gol, perc: Math.round((x.s.gol / totGol) * 100) }))
    const assist: RigaClassifica[] = stats
      .filter((x) => x.s.assist > 0)
      .sort((a, b) => b.s.assist - a.s.assist || a.nome.localeCompare(b.nome))
      .map((x) => ({
        id: x.g.id,
        nome: x.nome,
        presenze: x.s.assist,
        perc: Math.round((x.s.assist / totAssist) * 100),
      }))
    const disciplina = stats
      .filter((x) => x.s.ammonizioni > 0 || x.s.espulsioni > 0)
      .sort((a, b) => b.s.espulsioni - a.s.espulsioni || b.s.ammonizioni - a.s.ammonizioni)
    return { marcatori, assist, disciplina }
  }, [giocatori, giocate, record.gf])

  // presenze in partita (se segnate nel dettaglio della partita)
  const nConPresenze = useMemo(() => partiteConPresenze(giocate), [giocate])
  const presenzePartita: RigaClassifica[] = useMemo(() => {
    if (!nConPresenze) return []
    return giocatori
      .filter(isGiocatore)
      .map((g) => {
        const s = statisticheGiocatore(g.id, giocate)
        return {
          id: g.id,
          nome: `${g.cognome} ${g.nome}`,
          presenze: s.presenzePartita,
          perc: Math.round((s.presenzePartita / nConPresenze) * 100),
        }
      })
      .filter((r) => r.presenze > 0)
      .sort((a, b) => b.presenze - a.presenze || a.nome.localeCompare(b.nome))
  }, [giocatori, giocate, nConPresenze])

  const presenzeAllenamenti: RigaClassifica[] = useMemo(() => {
    const conteggio: Record<string, number> = {}
    for (const a of allenamenti) {
      for (const [id, presente] of Object.entries(a.presenze)) {
        if (presente) conteggio[id] = (conteggio[id] ?? 0) + 1
      }
    }
    return giocatori
      .filter(isGiocatore)
      .map((g) => ({
        id: g.id,
        nome: `${g.cognome} ${g.nome}`,
        presenze: conteggio[g.id] ?? 0,
        perc: allenamenti.length ? Math.round(((conteggio[g.id] ?? 0) / allenamenti.length) * 100) : 0,
      }))
      .sort((a, b) => b.presenze - a.presenze || a.nome.localeCompare(b.nome))
  }, [giocatori, allenamenti])

  const forma = giocate.slice(-5).map((p) => ({ id: p.id, esito: esitoPartita(p) }))

  async function esporta() {
    setEsportando(true)
    try {
      const entrate = conti.filter((m) => m.saldato && m.tipo === 'entrata').reduce((s, m) => s + m.importo, 0)
      const uscite = conti.filter((m) => m.saldato && m.tipo === 'uscita').reduce((s, m) => s + m.importo, 0)
      await esportaReportStagione({
        stagione: attiva,
        competizione: nomeCompetizione,
        giocate,
        record,
        marcatori: marcatori.map((r) => ({ nome: r.nome, n: r.presenze })),
        assist: assist.map((r) => ({ nome: r.nome, n: r.presenze })),
        presenze: presenzeAllenamenti.map((r) => ({ nome: r.nome, n: r.presenze })),
        presenzePartita: presenzePartita.map((r) => ({ nome: r.nome, n: r.presenze })),
        totaleSedute: allenamenti.length,
        bilancio: { entrate, uscite, saldo: entrate - uscite },
      })
    } finally {
      setEsportando(false)
    }
  }

  const diff = record.gf - record.gs

  const contenutoStagione = giocate.length === 0 ? (
    <Empty
      description={
        competizione === 'tutte'
          ? 'Le statistiche arrivano dalle partite: registra i primi risultati nella pagina Partite.'
          : 'Nessuna partita giocata in questa competizione.'
      }
    />
  ) : (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <TrophyOutlined className="stat-icon" aria-hidden />
            <Statistic title="Vittorie" value={record.v} valueStyle={{ color: COLORI.verde }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="Pareggi" value={record.p} valueStyle={{ color: '#9a6b1e' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic title="Sconfitte" value={record.s} valueStyle={{ color: COLORI.rosso }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="Differenza reti"
              value={`${diff >= 0 ? '+' : ''}${diff}`}
              valueStyle={{ color: diff >= 0 ? COLORI.verde : COLORI.rosso }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="Forma recente">
            {forma.length === 0 ? (
              <Text type="secondary">—</Text>
            ) : (
              <Space size={6}>
                {forma.map((f) => (
                  <Tag key={f.id} color={COLORE_ESITO[f.esito.code]} style={{ marginInlineEnd: 0, fontWeight: 700 }}>
                    {f.esito.code}
                  </Tag>
                ))}
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  ultime {forma.length} partite
                </Text>
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Casa e trasferta">
            <Space size={[20, 6]} wrap>
              <Text>
                🏠 In casa: <b>{casaTrasferta.casa.v}V {casaTrasferta.casa.p}P {casaTrasferta.casa.s}S</b>{' '}
                <Text type="secondary">({casaTrasferta.casa.gf}-{casaTrasferta.casa.gs})</Text>
              </Text>
              <Text>
                🚌 In trasferta: <b>{casaTrasferta.fuori.v}V {casaTrasferta.fuori.p}P {casaTrasferta.fuori.s}S</b>{' '}
                <Text type="secondary">({casaTrasferta.fuori.gf}-{casaTrasferta.fuori.gs})</Text>
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Gol fatti e subiti per partita" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: Math.max(320, datiChart.length * 56), height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datiChart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={COLORI.griglia} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: COLORI.griglia }}
                  tick={{ fontSize: 11, fill: COLORI.testo }}
                />
                <YAxis
                  allowDecimals={false}
                  width={28}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: COLORI.testo }}
                />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { label: string; avversario: string } | undefined
                    return p ? `${p.label} · vs ${p.avversario}` : ''
                  }}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${COLORI.griglia}`, fontSize: 13 }}
                  cursor={{ fill: 'rgba(194,32,38,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Bar dataKey="fatti" name="Gol fatti" fill={COLORI.verde} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="subiti" name="Gol subiti" fill={COLORI.rosso} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Classifica marcatori">
            {marcatori.length === 0 ? (
              <Text type="secondary">Ancora nessun gol registrato.</Text>
            ) : (
              <ClassificaPresenze righe={marcatori} />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Classifica assist">
            {assist.length === 0 ? (
              <Text type="secondary">Ancora nessun assist registrato.</Text>
            ) : (
              <ClassificaPresenze righe={assist} />
            )}
          </Card>
        </Col>
      </Row>

      {presenzePartita.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card
              title="Presenze in partita"
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  su {nConPresenze} partite con presenze segnate
                </Text>
              }
            >
              <ClassificaPresenze righe={presenzePartita} totale={nConPresenze} />
            </Card>
          </Col>
        </Row>
      )}

      {disciplina.length > 0 && (
        <Card title="Disciplina" size="small">
          <Space size={[14, 8]} wrap>
            {disciplina.map((x) => (
              <Text key={x.g.id}>
                {x.nome}{' '}
                {x.s.ammonizioni > 0 && <Tag color="gold">🟨 {x.s.ammonizioni}</Tag>}
                {x.s.espulsioni > 0 && <Tag color="red">🟥 {x.s.espulsioni}</Tag>}
              </Text>
            ))}
          </Space>
        </Card>
      )}
    </>
  )

  return (
    <>
      <PageHeader
        titolo="Statistiche"
        sottotitolo={
          tab === 'albo'
            ? "Record e campioni di tutte le stagioni"
            : giocate.length
              ? `${giocate.length} partite giocate nella stagione ${attiva}${nomeCompetizione ? ` · ${nomeCompetizione}` : ''}`
              : undefined
        }
        azioni={
          tab === 'stagione' && (
            <Space wrap>
              {torneiUsati.length > 0 && (
                <Select
                  value={competizione}
                  onChange={setCompetizione}
                  style={{ minWidth: 170 }}
                  options={[
                    { value: 'tutte', label: 'Tutte le competizioni' },
                    ...torneiUsati.map((t) => ({ value: t.id, label: t.nome })),
                  ]}
                />
              )}
              {giocate.length > 0 && (
                <Button icon={<FilePdfOutlined />} onClick={esporta} loading={esportando}>
                  Report stagione (PDF)
                </Button>
              )}
            </Space>
          )
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'stagione' | 'albo')}
        items={[
          { key: 'stagione', label: `Stagione ${attiva}`, children: contenutoStagione },
          { key: 'albo', label: "🏆 Albo d'oro", children: <AlboDoro /> },
        ]}
      />
    </>
  )
}
