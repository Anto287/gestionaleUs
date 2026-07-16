import { createElement, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Col, Row, Typography } from 'antd'
import {
  ClockCircleOutlined,
  CreditCardOutlined,
  RiseOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useSeason } from '../season/SeasonContext'
import { useCollection } from '../hooks/useCollection'
import { formatData, formatEuro } from '../lib/format'
import { statoScadenza } from '../lib/scadenza'
import { isGiocatore } from '../lib/categoria'
import { StatCard } from '../components/StatCard'
import { DettaglioMovimenti, type VistaDettaglio } from '../components/DettaglioMovimenti'
import type { Allenamento, Articolo, Distinta, Giocatore, Movimento } from '../types'

const { Title, Text } = Typography

export function Dashboard() {
  const { attiva } = useSeason()
  const navigate = useNavigate()
  const giocatori = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const distinte = useCollection<Distinta>('distinte')
  const magazzino = useCollection<Articolo>('magazzino')
  const conti = useCollection<Movimento>('conti')
  const [dettaglio, setDettaglio] = useState<VistaDettaglio | null>(null)

  const saldo = conti.items
    .filter((m) => m.saldato)
    .reduce((s, m) => s + (m.tipo === 'entrata' ? m.importo : -m.importo), 0)
  const daIncassare = conti.items
    .filter((m) => !m.saldato && m.tipo === 'entrata')
    .reduce((s, m) => s + m.importo, 0)
  const daPagare = conti.items
    .filter((m) => !m.saldato && m.tipo === 'uscita')
    .reduce((s, m) => s + m.importo, 0)
  const inScadenza = magazzino.items.filter((a) => statoScadenza(a.scadenza).critico).length

  const oggi = new Date().toISOString().slice(0, 10)
  const prossima = distinte.items
    .filter((d) => d.data && d.data >= oggi)
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))[0]
  const ultimoAllenamento = allenamenti.items.map((a) => a.data).sort((a, b) => b.localeCompare(a))[0]

  const sottotitolo = prossima
    ? `Prossimo impegno: ${prossima.avversario ?? 'prossima gara'}${prossima.data ? ' · ' + formatData(prossima.data, true) : ''}`
    : ultimoAllenamento
      ? `Ultimo allenamento: ${formatData(ultimoAllenamento, true)}`
      : 'Inizia aggiungendo i giocatori alla rosa.'

  return (
    <>
      <div className="page-header">
        <div>
          <Text className="hero-eyebrow">Stagione {attiva}</Text>
          <Title level={2} className="page-title page-title-hero">
            {config.clubName}
          </Title>
          <span className="page-band" aria-hidden />
          <Text type="secondary" className="page-sub">
            {sottotitolo}
          </Text>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
        <Col xs={24} sm={8}>
          <StatCard
            icona={<WalletOutlined />}
            titolo="Saldo di cassa"
            valore={formatEuro(saldo)}
            colore={saldo < 0 ? '#b1352f' : undefined}
            onApri={() => setDettaglio('cassa')}
            apriLabel="vedi gli ultimi movimenti"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<RiseOutlined />}
            titolo="Da incassare"
            valore={formatEuro(daIncassare)}
            colore="#3f7a52"
            onApri={() => setDettaglio('daIncassare')}
            apriLabel="vedi da chi dobbiamo ricevere soldi"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<CreditCardOutlined />}
            titolo="Da pagare"
            valore={formatEuro(daPagare)}
            colore={daPagare > 0 ? '#9a6b1e' : undefined}
            onApri={() => setDettaglio('daPagare')}
            apriLabel="vedi a chi dobbiamo dare soldi"
          />
        </Col>
        <Col xs={12} sm={12}>
          <StatCard
            icona={<TeamOutlined />}
            titolo="Giocatori in rosa"
            valore={giocatori.items.filter(isGiocatore).length}
            onApri={() => navigate('/rosa')}
            apriLabel="apri la Rosa"
          />
        </Col>
        <Col xs={12} sm={12}>
          <StatCard
            icona={<ClockCircleOutlined />}
            titolo="Articoli in scadenza"
            valore={inScadenza}
            colore={inScadenza > 0 ? '#9a6b1e' : undefined}
            onApri={() => navigate('/magazzino')}
            apriLabel="apri il Magazzino"
          />
        </Col>
      </Row>

      <Text className="section-label">Sezioni</Text>
      <Row gutter={[16, 16]}>
        {navItems
          .filter((n) => n.to !== '/' && n.to !== '/impostazioni')
          .map((n) => (
            <Col xs={12} md={8} lg={6} key={n.to}>
              <Link to={n.to}>
                <Card hoverable className="tile-card">
                  <span className="tile-icon">{createElement(n.icon)}</span>
                  <div className="tile-label">{n.label}</div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {n.descrizione}
                  </Text>
                </Card>
              </Link>
            </Col>
          ))}
      </Row>

      <DettaglioMovimenti
        vista={dettaglio}
        movimenti={conti.items}
        onClose={() => setDettaglio(null)}
        conLinkConti
      />
    </>
  )
}
