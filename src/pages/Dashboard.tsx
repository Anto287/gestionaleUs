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
  InboxOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useSeason } from '../season/SeasonContext'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { formatData, formatEuro, oggiIso } from '../lib/format'
import { statoScadenza } from '../lib/scadenza'
import { sottoScorta } from '../lib/scorta'
import { statoCertificato } from '../lib/certificato'
import { statoQuota } from '../lib/quota'
import { isGiocatore } from '../lib/categoria'
import { StatCard } from '../components/StatCard'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { DettaglioMovimenti, type VistaDettaglio } from '../components/DettaglioMovimenti'
import type {
  Allenamento,
  Appuntamento,
  Articolo,
  Distinta,
  Giocatore,
  Movimento,
  Partita,
  Promemoria,
  SpesaCondivisa,
  VoceMagazzino,
} from '../types'
import { seduteSvolte } from '../lib/allenamenti'

const { Title, Text } = Typography

/** Arrotonda ai centesimi (niente "-0,00 €" in rosso). */
const cent = (n: number) => Math.round(n * 100) / 100 || 0

/** Tono delle voci "da fare": decide colore dell'icona e del contatore. */
const TONI = {
  rosso: { colore: 'var(--rosso-testo)', tag: 'red' },
  ocra: { colore: 'var(--ocra)', tag: 'orange' },
} as const

export function Dashboard() {
  const { attiva } = useSeason()
  const navigate = useNavigate()
  const giocatori = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const distinte = useCollection<Distinta>('distinte')
  const magazzino = useCollection<Articolo>('magazzino')
  const materiale = useCollection<VoceMagazzino>('materiale')
  const manutenzione = useCollection<VoceMagazzino>('manutenzione')
  const borsaMedica = useCollection<VoceMagazzino>('borsaMedica')
  const conti = useCollection<Movimento>('conti')
  const spese = useCollection<SpesaCondivisa>('speseCondivise')
  const partite = useCollection<Partita>('partite')
  const appuntamenti = useCollection<Appuntamento>('appuntamenti')
  const promemoria = useCollection<Promemoria>('promemoria')
  const eliminaConUndo = useEliminaUndo()
  const [dettaglio, setDettaglio] = useState<VistaDettaglio | null>(null)
  const [modalePromemoria, setModalePromemoria] = useState(false)
  const [formP] = Form.useForm()


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
      creato: oggiIso(),
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
    // documento d'identità: scaduto (rosso) o in scadenza entro un mese (ocra)
    const docScaduti = giocatori.items.filter((g) => (statoScadenza(g.scadenzaDocumento).giorni ?? 0) < 0)
    const docInScadenza = giocatori.items.filter((g) => {
      const d = statoScadenza(g.scadenzaDocumento)
      return d.critico && (d.giorni ?? 0) >= 0
    })
    const infortunati = soloGiocatori.filter((g) => g.infortunato)
    const speseAperte = spese.items.filter((s) => !s.saldata)
    const borsaScaduta = borsaMedica.items.filter((v) => statoScadenza(v.scadenza).critico)
    const daRiordinare = [
      ...magazzino.items,
      ...materiale.items,
      ...manutenzione.items,
      ...borsaMedica.items,
    ].filter(sottoScorta)

    const voci = [
      {
        key: 'cert',
        icona: <SafetyCertificateOutlined />,
        tono: 'rosso' as const,
        testo: 'Certificati medici da regolarizzare',
        dettaglio: nomi(certCritici),
        n: certCritici.length,
        to: '/rosa',
      },
      {
        key: 'cert2',
        icona: <SafetyCertificateOutlined />,
        tono: 'ocra' as const,
        testo: 'Certificati in scadenza entro un mese',
        dettaglio: nomi(certInScadenza),
        n: certInScadenza.length,
        to: '/rosa',
      },
      {
        key: 'quote',
        icona: <EuroOutlined />,
        tono: 'ocra' as const,
        testo: 'Quote associative da incassare',
        dettaglio: nomi(quoteAperte),
        n: quoteAperte.length,
        to: '/rosa',
      },
      {
        key: 'tessere',
        icona: <IdcardOutlined />,
        tono: 'rosso' as const,
        testo: 'Tesserati senza numero di tessera',
        dettaglio: nomi(senzaTessera),
        n: senzaTessera.length,
        to: '/rosa',
      },
      {
        key: 'doc',
        icona: <IdcardOutlined />,
        tono: 'rosso' as const,
        testo: "Documenti d'identità scaduti",
        dettaglio: nomi(docScaduti),
        n: docScaduti.length,
        to: '/rosa',
      },
      {
        key: 'doc2',
        icona: <IdcardOutlined />,
        tono: 'ocra' as const,
        testo: "Documenti d'identità in scadenza entro un mese",
        dettaglio: nomi(docInScadenza),
        n: docInScadenza.length,
        to: '/rosa',
      },
      {
        key: 'borsa',
        icona: <MedicineBoxOutlined />,
        tono: 'rosso' as const,
        testo: 'Borsa medica: articoli scaduti o in scadenza',
        dettaglio: borsaScaduta.map((v) => v.nome).join(', '),
        n: borsaScaduta.length,
        to: '/magazzino',
      },
      {
        key: 'scorte',
        icona: <InboxOutlined />,
        tono: 'ocra' as const,
        testo: 'Articoli sotto scorta da riordinare',
        dettaglio: daRiordinare.map((v) => v.nome).join(', '),
        n: daRiordinare.length,
        to: '/magazzino',
      },
      {
        key: 'spese',
        icona: <SwapOutlined />,
        tono: 'ocra' as const,
        testo: 'Spese condivise ancora da saldare',
        dettaglio: [...new Set(speseAperte.map((s) => s.societa))].join(', '),
        n: speseAperte.length,
        to: '/spese',
      },
      {
        key: 'infortuni',
        icona: <MedicineBoxOutlined />,
        tono: 'ocra' as const,
        testo: 'Giocatori infortunati',
        dettaglio: nomi(infortunati),
        n: infortunati.length,
        to: '/rosa',
      },
    ]
    return voci.filter((v) => v.n > 0)
  }, [
    giocatori.items,
    borsaMedica.items,
    magazzino.items,
    materiale.items,
    manutenzione.items,
    spese.items,
  ])

  const saldo = cent(
    conti.items.filter((m) => m.saldato).reduce((s, m) => s + (m.tipo === 'entrata' ? m.importo : -m.importo), 0),
  )
  const daIncassare = cent(
    conti.items.filter((m) => !m.saldato && m.tipo === 'entrata').reduce((s, m) => s + m.importo, 0),
  )
  const daPagare = cent(
    conti.items.filter((m) => !m.saldato && m.tipo === 'uscita').reduce((s, m) => s + m.importo, 0),
  )
  const inScadenza = magazzino.items.filter((a) => statoScadenza(a.scadenza).critico).length

  const oggi = oggiIso()

  /**
   * Il prossimo impegno guarda tutto quello che è in programma: le partite
   * senza risultato, gli appuntamenti del calendario e le distinte già
   * preparate (prima leggeva solo queste ultime, così finché non si preparava
   * la distinta la dashboard non sapeva della partita di domenica).
   */
  const prossimo = useMemo(() => {
    const impegni: { data: string; ora?: string; chi: string }[] = []
    for (const p of partite.items)
      if (p.giocata === false && p.data >= oggi)
        impegni.push({ data: p.data, ora: p.ora, chi: p.avversario })
    for (const a of appuntamenti.items)
      if (a.data >= oggi) impegni.push({ data: a.data, ora: a.ora, chi: a.avversario })
    for (const d of distinte.items)
      if (d.data && d.data >= oggi) impegni.push({ data: d.data, chi: d.avversario ?? 'prossima gara' })
    return impegni.sort((a, b) =>
      (a.data + (a.ora ?? '')).localeCompare(b.data + (b.ora ?? '')),
    )[0]
  }, [partite.items, appuntamenti.items, distinte.items, oggi])

  const ultimoAllenamento = seduteSvolte(allenamenti.items).map((a) => a.data).sort((a, b) => b.localeCompare(a))[0]

  const sottotitolo = prossimo
    ? `Prossimo impegno: ${prossimo.chi} · ${formatData(prossimo.data, true)}${prossimo.ora ? ` alle ${prossimo.ora}` : ''}`
    : ultimoAllenamento
      ? `Ultimo allenamento: ${formatData(ultimoAllenamento, true)}`
      : ''

  return (
    <>
      <div className="page-header">
        <div>
          <Text className="hero-eyebrow">Stagione {attiva}</Text>
          <Title level={2} className="page-title page-title-hero">
            {config.clubName}
          </Title>
          <span className="page-band" aria-hidden />
          {sottotitolo && (
            <Text type="secondary" className="page-sub">
              {sottotitolo}
            </Text>
          )}
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
        <Col xs={24} sm={8}>
          <StatCard
            icona={<WalletOutlined />}
            titolo="Saldo di cassa"
            valore={formatEuro(saldo)}
            colore={saldo < 0 ? 'var(--rosso-testo)' : undefined}
            onApri={() => setDettaglio('cassa')}
            apriLabel="vedi gli ultimi movimenti"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<RiseOutlined />}
            titolo="Da incassare"
            valore={formatEuro(daIncassare)}
            colore="var(--verde)"
            onApri={() => setDettaglio('daIncassare')}
            apriLabel="vedi da chi dobbiamo ricevere soldi"
          />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard
            icona={<CreditCardOutlined />}
            titolo="Da pagare"
            valore={formatEuro(daPagare)}
            colore={daPagare > 0 ? 'var(--ocra)' : undefined}
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
            colore={inScadenza > 0 ? 'var(--ocra)' : undefined}
            onApri={() => navigate('/magazzino')}
            apriLabel="apri il Magazzino"
          />
        </Col>
      </Row>

      <Card
        title="Da fare"
        style={{ marginBottom: 20, marginTop: 16 }}
        styles={{ body: { padding: daFare.length || promemoriaOrdinati.length ? '4px 0' : 20 } }}
        extra={
          <Button
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
            <CheckCircleOutlined style={{ color: 'var(--verde)', marginRight: 8 }} />
            Tutto in ordine: certificati, documenti, quote, tessere e borsa medica sono a posto.
          </Text>
        ) : (
          <>
            {promemoriaOrdinati.map((p) => {
              const scaduto = !p.fatto && p.entro && p.entro < oggi
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
                          <span style={scaduto ? { color: 'var(--rosso-testo)', fontWeight: 600 } : undefined}>
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
                    onConfirm={() => eliminaConUndo(promemoria, p, 'Promemoria eliminato.')}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              )
            })}
            {daFare.map((v) => (
              <Link key={v.key} to={v.to} className="dafare-riga">
                <span className="dafare-icona" style={{ color: TONI[v.tono].colore }}>
                  {v.icona}
                </span>
                <span className="dafare-testo">
                  {v.testo}
                  {v.dettaglio && <span className="dafare-dettaglio">{v.dettaglio}</span>}
                </span>
                <Tag color={TONI[v.tono].tag} style={{ marginInlineEnd: 0 }}>
                  {v.n}
                </Tag>
                <RightOutlined style={{ color: 'var(--testo-2)', fontSize: 12 }} />
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
