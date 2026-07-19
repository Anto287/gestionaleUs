import { createElement, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Checkbox, Col, Form, Input, Modal, Popconfirm, Row, Switch, Tag, Typography } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EuroOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useSeason } from '../season/SeasonContext'
import { useCollection } from '../hooks/useCollection'
import { formatData, formatEuro } from '../lib/format'
import { statoScadenza } from '../lib/scadenza'
import { statoCertificato } from '../lib/certificato'
import { statoQuota } from '../lib/quota'
import { isGiocatore } from '../lib/categoria'
import { StatCard } from '../components/StatCard'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { DettaglioMovimenti, type VistaDettaglio } from '../components/DettaglioMovimenti'
import type { Allenamento, Articolo, Distinta, Giocatore, Movimento, Promemoria, VoceMagazzino } from '../types'

const { Title, Text } = Typography

export function Dashboard() {
  const { attiva } = useSeason()
  const navigate = useNavigate()
  const giocatori = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const distinte = useCollection<Distinta>('distinte')
  const magazzino = useCollection<Articolo>('magazzino')
  const borsaMedica = useCollection<VoceMagazzino>('borsaMedica')
  const conti = useCollection<Movimento>('conti')
  const promemoria = useCollection<Promemoria>('promemoria')
  const [dettaglio, setDettaglio] = useState<VistaDettaglio | null>(null)
  const [modalePromemoria, setModalePromemoria] = useState(false)
  const [formP] = Form.useForm()

  const oggiIso = new Date().toISOString().slice(0, 10)

  // promemoria a mano: prima gli urgenti e chi scade prima, i fatti in coda
  const promemoriaOrdinati = useMemo(
    () =>
      [...promemoria.items].sort(
        (a, b) =>
          Number(!!a.fatto) - Number(!!b.fatto) ||
          Number(!!b.urgente) - Number(!!a.urgente) ||
          (a.entro ?? '9999').localeCompare(b.entro ?? '9999') ||
          (a.creato ?? '').localeCompare(b.creato ?? ''),
      ),
    [promemoria.items],
  )

  function salvaPromemoria(v: { testo: string; entro?: string; urgente?: boolean; assegnatoA?: string }) {
    promemoria.add({
      testo: v.testo.trim(),
      entro: v.entro || undefined,
      urgente: !!v.urgente || undefined,
      assegnatoA: v.assegnatoA?.trim() || undefined,
      creato: oggiIso,
    })
    setModalePromemoria(false)
  }

  // il "da fare" di inizio (e metà) stagione, riunito da rosa e magazzino
  const daFare = useMemo(() => {
    const soloGiocatori = giocatori.items.filter(isGiocatore)
    const nomi = (gg: Giocatore[]) => gg.map((g) => g.cognome).join(', ')

    const certCritici = soloGiocatori.filter((g) => statoCertificato(g).stato === 'critico')
    const certInScadenza = soloGiocatori.filter((g) => statoCertificato(g).stato === 'scadenza')
    const quoteAperte = soloGiocatori.filter((g) => !statoQuota(g).completa)
    const senzaTessera = giocatori.items.filter((g) => !g.tessera)
    const infortunati = soloGiocatori.filter((g) => g.infortunato)
    const borsaScaduta = borsaMedica.items.filter((v) => statoScadenza(v.scadenza).critico)

    const voci = [
      {
        key: 'cert',
        icona: <SafetyCertificateOutlined />,
        colore: '#b1352f',
        testo: 'Certificati medici da regolarizzare',
        dettaglio: nomi(certCritici),
        n: certCritici.length,
        to: '/rosa',
      },
      {
        key: 'cert2',
        icona: <SafetyCertificateOutlined />,
        colore: '#9a6b1e',
        testo: 'Certificati in scadenza entro un mese',
        dettaglio: nomi(certInScadenza),
        n: certInScadenza.length,
        to: '/rosa',
      },
      {
        key: 'quote',
        icona: <EuroOutlined />,
        colore: '#9a6b1e',
        testo: 'Quote associative da incassare',
        dettaglio: nomi(quoteAperte),
        n: quoteAperte.length,
        to: '/rosa',
      },
      {
        key: 'tessere',
        icona: <IdcardOutlined />,
        colore: '#b1352f',
        testo: 'Tesserati senza numero di tessera',
        dettaglio: nomi(senzaTessera),
        n: senzaTessera.length,
        to: '/rosa',
      },
      {
        key: 'borsa',
        icona: <MedicineBoxOutlined />,
        colore: '#b1352f',
        testo: 'Borsa medica: articoli scaduti o in scadenza',
        dettaglio: borsaScaduta.map((v) => v.nome).join(', '),
        n: borsaScaduta.length,
        to: '/magazzino',
      },
      {
        key: 'infortuni',
        icona: <MedicineBoxOutlined />,
        colore: '#9a6b1e',
        testo: 'Giocatori infortunati',
        dettaglio: nomi(infortunati),
        n: infortunati.length,
        to: '/rosa',
      },
    ]
    return voci.filter((v) => v.n > 0)
  }, [giocatori.items, borsaMedica.items])

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

      <Card
        title="Da fare"
        style={{ marginBottom: 20, marginTop: 8 }}
        styles={{ body: { padding: daFare.length || promemoriaOrdinati.length ? '4px 0' : 20 } }}
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              formP.resetFields()
              setModalePromemoria(true)
            }}
          >
            Aggiungi
          </Button>
        }
      >
        {daFare.length === 0 && promemoriaOrdinati.length === 0 ? (
          <Text type="secondary">
            <CheckCircleOutlined style={{ color: '#3f7a52', marginRight: 8 }} />
            Tutto in ordine: certificati, quote, tessere e borsa medica sono a posto.
          </Text>
        ) : (
          <>
            {promemoriaOrdinati.map((p) => {
              const scaduto = !p.fatto && p.entro && p.entro < oggiIso
              return (
                <div key={p.id} className="dafare-riga">
                  <Checkbox
                    checked={!!p.fatto}
                    onChange={(e) => promemoria.update(p.id, { fatto: e.target.checked || undefined })}
                  />
                  <span
                    className="dafare-testo"
                    style={p.fatto ? { textDecoration: 'line-through', color: 'var(--testo-2, #75695a)' } : undefined}
                  >
                    {p.testo}
                    {p.urgente && !p.fatto && (
                      <Tag color="red" style={{ marginLeft: 8 }}>
                        Urgente
                      </Tag>
                    )}
                    {(p.entro || p.assegnatoA) && (
                      <span className="dafare-dettaglio">
                        {p.entro && (
                          <span style={scaduto ? { color: '#b1352f', fontWeight: 600 } : undefined}>
                            entro {formatData(p.entro, true)}
                          </span>
                        )}
                        {p.entro && p.assegnatoA && ' · '}
                        {p.assegnatoA && `se ne occupa ${p.assegnatoA}`}
                      </span>
                    )}
                  </span>
                  <Popconfirm
                    title="Eliminare il promemoria?"
                    okText="Elimina"
                    cancelText="Annulla"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => promemoria.remove(p.id)}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              )
            })}
            {daFare.map((v) => (
              <Link key={v.key} to={v.to} className="dafare-riga">
                <span className="dafare-icona" style={{ color: v.colore }}>
                  {v.icona}
                </span>
                <span className="dafare-testo">
                  {v.testo}
                  {v.dettaglio && <span className="dafare-dettaglio">{v.dettaglio}</span>}
                </span>
                <Tag color={v.colore === '#b1352f' ? 'red' : 'orange'} style={{ marginInlineEnd: 0 }}>
                  {v.n}
                </Tag>
                <RightOutlined style={{ color: '#c9bfad', fontSize: 12 }} />
              </Link>
            ))}
          </>
        )}
      </Card>

      <Modal
        title="Nuova cosa da fare"
        open={modalePromemoria}
        onCancel={() => setModalePromemoria(false)}
        onOk={() => formP.submit()}
        okText="Aggiungi"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={formP} layout="vertical" onFinish={salvaPromemoria} requiredMark={false}>
          <Form.Item
            label="Cosa c'è da fare"
            name="testo"
            rules={[{ required: true, message: 'Scrivi cosa c’è da fare' }]}
          >
            <Input placeholder="es. chiudere le buche delle talpe" autoComplete="off" />
          </Form.Item>
          <Form.Item label="Entro il (facoltativo)" name="entro" {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item label="Urgente" name="urgente" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Chi se ne sta occupando (facoltativo)" name="assegnatoA">
            <Input placeholder="es. Mario" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>

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
