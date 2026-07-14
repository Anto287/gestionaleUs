import { createElement } from 'react'
import { Link } from 'react-router-dom'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import { ClockCircleOutlined, CreditCardOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useSeason } from '../season/SeasonContext'
import { useCollection } from '../hooks/useCollection'
import { formatData, formatEuro } from '../lib/format'
import { statoScadenza } from '../lib/scadenza'
import { isGiocatore } from '../lib/categoria'
import type { Allenamento, Articolo, Distinta, Giocatore, Movimento } from '../types'

const { Title, Text } = Typography

export function Dashboard() {
  const { attiva } = useSeason()
  const giocatori = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const distinte = useCollection<Distinta>('distinte')
  const magazzino = useCollection<Articolo>('magazzino')
  const conti = useCollection<Movimento>('conti')

  const saldo = conti.items
    .filter((m) => m.saldato)
    .reduce((s, m) => s + (m.tipo === 'entrata' ? m.importo : -m.importo), 0)
  const daPagare = conti.items
    .filter((m) => !m.saldato && m.tipo === 'uscita')
    .reduce((s, m) => s + m.importo, 0)
  const inScadenza = magazzino.items.filter((a) => statoScadenza(a.scadenza).critico).length

  const oggi = new Date().toISOString().slice(0, 10)
  const prossima = distinte.items
    .filter((d) => d.data >= oggi)
    .sort((a, b) => a.data.localeCompare(b.data))[0]
  const ultimoAllenamento = allenamenti.items.map((a) => a.data).sort((a, b) => b.localeCompare(a))[0]

  const sottotitolo = prossima
    ? `Prossimo impegno: ${prossima.avversario} · ${formatData(prossima.data, true)}`
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
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <TeamOutlined className="stat-icon" aria-hidden />
            <Statistic title="Giocatori in rosa" value={giocatori.items.filter(isGiocatore).length} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <WalletOutlined className="stat-icon" aria-hidden />
            <Statistic
              title="Saldo di cassa"
              value={formatEuro(saldo)}
              valueStyle={{ color: saldo < 0 ? '#b1352f' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <CreditCardOutlined className="stat-icon" aria-hidden />
            <Statistic
              title="Da pagare"
              value={formatEuro(daPagare)}
              valueStyle={{ color: daPagare > 0 ? '#9a6b1e' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <ClockCircleOutlined className="stat-icon" aria-hidden />
            <Statistic
              title="Articoli in scadenza"
              value={inScadenza}
              valueStyle={{ color: inScadenza > 0 ? '#9a6b1e' : undefined }}
            />
          </Card>
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
    </>
  )
}
