import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  App,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Rate,
  Result,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  AimOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
  EuroOutlined,
  LeftOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  RightOutlined,
  StopOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { CampoEuro } from '../components/CampoEuro'
import { StatCard } from '../components/StatCard'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { coloreRuolo, ordineRuolo, OPZIONI_RUOLI, RUOLO_BY_CODE } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { statoScadenza } from '../lib/scadenza'
import { isDirigente, isExtra, isGiocatore, OPZIONI_CATEGORIA, OPZIONI_RUOLI_DIRIGENZA, ripulisciTesserato } from '../lib/categoria'
import { statisticheGiocatore } from '../lib/statistiche'
import { useArchivio } from '../data/ArchivioProvider'
import { ArchivioTesserato } from '../components/archivio/ArchivioTesserato'
import { statoQuota } from '../lib/quota'
import { formatData, formatEuro, iniziali, oggiIso } from '../lib/format'
import type { Allenamento, Giocatore, Movimento, Partita, VersamentoQuota } from '../types'
import { seduteSvolte } from '../lib/allenamenti'

const { Title, Text } = Typography

export function GiocatoreDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const giocatori = useCollection<Giocatore>('giocatori')
  const { items, update } = giocatori
  const eliminaConUndo = useEliminaUndo()
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const partite = useCollection<Partita>('partite')
  const conti = useCollection<Movimento>('conti')
  const { message } = App.useApp()
  const [modale, setModale] = useState(false)
  const [modaleVersamento, setModaleVersamento] = useState(false)
  const [form] = Form.useForm()
  const [formVersamento] = Form.useForm()
  // chi è SOLO dirigente non ha campi da giocatore (ruoli, certificato, quota)
  const categoriaForm = Form.useWatch('categoria', form)
  const campiGiocatore = categoriaForm !== 'dirigente'
  const campiDirigente = categoriaForm === 'dirigente' || categoriaForm === 'entrambi'
  const infortunatoForm = Form.useWatch('infortunato', form)
  const esenteForm = Form.useWatch('quotaEsente', form)

  const g = items.find((x) => x.id === id)

  // frecce avanti/indietro: si scorre nello stesso ordine della Rosa
  // (reparto del ruolo, poi cognome)
  const ordinati = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          ordineRuolo(a.ruoloPreferito) - ordineRuolo(b.ruoloPreferito) ||
          a.cognome.localeCompare(b.cognome),
      ),
    [items],
  )
  const posizione = ordinati.findIndex((x) => x.id === id)
  const precedente = posizione > 0 ? ordinati[posizione - 1] : undefined
  const successivo =
    posizione >= 0 && posizione < ordinati.length - 1 ? ordinati[posizione + 1] : undefined

  // frecce della tastiera (fuori da campi di testo e con i modali chiusi)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modale || modaleVersamento) return
      // anche con aperti i modali dell'archivio (anteprima, carica file)
      if (document.querySelector('.ant-modal-wrap:not([style*="display: none"])')) return
      const t = e.target as HTMLElement | null
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return
      if (e.key === 'ArrowLeft' && precedente) navigate(`/rosa/${precedente.id}`)
      if (e.key === 'ArrowRight' && successivo) navigate(`/rosa/${successivo.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modale, modaleVersamento, precedente, successivo, navigate])

  const presenze = useMemo(() => {
    if (!g) return { fatte: 0, totali: 0 }
    // le sedute future (create in anticipo dal calendario) non contano ancora
    const svolte = seduteSvolte(allenamenti.items)
    return {
      totali: svolte.length,
      fatte: svolte.filter((a) => a.presenze[g.id]).length,
    }
  }, [allenamenti.items, g])

  // la foto dell'archivio fa da avatar, quando c'è
  const archivio = useArchivio()
  const foto = archivio.miniatura(archivio.scheda(g?.id ?? '').foto?.id)

  // solo le partite giocate: quelle in programma non hanno ancora statistiche
  const giocate = useMemo(() => partite.items.filter((p) => p.giocata !== false), [partite.items])
  const stat = useMemo(
    () =>
      g
        ? statisticheGiocatore(g.id, giocate)
        : { gol: 0, assist: 0, ammonizioni: 0, espulsioni: 0, presenzePartita: 0, daTitolare: 0 },
    [g, giocate],
  )
  // quanti dei gol sono arrivati in amichevole
  const golAmichevole = useMemo(
    () => (g ? statisticheGiocatore(g.id, giocate.filter((p) => p.amichevole)).gol : 0),
    [g, giocate],
  )
  // con statistiche, eliminarlo lo toglie da classifiche e albo d'oro
  const haStatistiche = stat.gol + stat.assist + stat.presenzePartita > 0

  if (!g) {
    return (
      <Result
        status="404"
        title="Giocatore non trovato"
        extra={
          <Button type="primary" onClick={() => navigate('/rosa')}>
            Torna alla rosa
          </Button>
        }
      />
    )
  }

  const cert = statoCertificato(g)
  const doc = statoScadenza(g.scadenzaDocumento)
  const soloDirigente = !isGiocatore(g)
  const percPresenze = presenze.totali ? Math.round((presenze.fatte / presenze.totali) * 100) : 0

  function apriModifica() {
    // svuota prima: i campi facoltativi del giocatore precedente non devono restare
    form.resetFields()
    form.setFieldsValue({ ...g, categoria: g!.categoria ?? 'giocatore' })
    setModale(true)
  }
  function salvaModifica(valori: Partial<Giocatore>) {
    valori = ripulisciTesserato(valori)
    update(g!.id, valori)
    setModale(false)
  }

  function apriVersamento() {
    formVersamento.resetFields()
    formVersamento.setFieldsValue({ data: oggiIso() })
    setModaleVersamento(true)
  }

  /**
   * Registra un versamento della quota. Non tocca i Conti: le quote restano
   * qui e a fine anno chi le raccoglie ne registra il totale come unica entrata.
   */
  function aggiungiVersamento(v: { data: string; importo: number; note?: string }) {
    const nuovo: VersamentoQuota = {
      id: crypto.randomUUID(),
      data: v.data,
      importo: v.importo,
      note: v.note?.trim() || undefined,
    }
    update(g!.id, { versamentiQuota: [...(g!.versamentiQuota ?? []), nuovo] })
    setModaleVersamento(false)
    message.success('Versamento registrato')
  }

  function rimuoviVersamento(v: VersamentoQuota) {
    // i versamenti vecchi avevano il movimento gemello nei Conti: va via con loro
    if (v.movimentoId && conti.items.some((m) => m.id === v.movimentoId)) conti.remove(v.movimentoId)
    update(g!.id, { versamentiQuota: (g!.versamentiQuota ?? []).filter((x) => x.id !== v.id) })
  }
  function elimina() {
    eliminaConUndo(giocatori, g!, `${g!.cognome} ${g!.nome} eliminato.`)
    navigate('/rosa')
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/rosa')}
          style={{ paddingLeft: 0 }}
        >
          Rosa
        </Button>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
            {posizione + 1} di {ordinati.length}
          </Text>
          <Tooltip title={precedente ? `${precedente.cognome} ${precedente.nome}` : ''}>
            <Button
              icon={<LeftOutlined />}
              disabled={!precedente}
              aria-label="Giocatore precedente"
              onClick={() => precedente && navigate(`/rosa/${precedente.id}`)}
            />
          </Tooltip>
          <Tooltip title={successivo ? `${successivo.cognome} ${successivo.nome}` : ''}>
            <Button
              icon={<RightOutlined />}
              disabled={!successivo}
              aria-label="Giocatore successivo"
              onClick={() => successivo && navigate(`/rosa/${successivo.id}`)}
            />
          </Tooltip>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar src={foto} size={64} style={{ background: 'var(--rosso)', fontSize: 24, flex: 'none' }}>
            {iniziali(g)}
          </Avatar>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Title level={3} style={{ margin: 0 }}>
              {g.cognome} {g.nome}
            </Title>
            <Space size={[6, 6]} wrap style={{ marginTop: 6 }}>
              {isDirigente(g) && (
                <Tag color="purple">
                  {g.categoria === 'entrambi' ? 'Giocatore e dirigente' : 'Dirigente'}
                  {g.ruoloDirigenza ? ` · ${g.ruoloDirigenza}` : ''}
                </Tag>
              )}
              {isExtra(g) && <Tag color="cyan">Giocatore Extra</Tag>}
              {isGiocatore(g) && g.infortunato && (
                <Tag color="red" icon={<MedicineBoxOutlined />}>
                  Infortunato{g.rientroInfortunio ? ` · rientro ${formatData(g.rientroInfortunio, true)}` : ''}
                </Tag>
              )}
              {g.ruoloPreferito ? (
                <Tag color={coloreRuolo(g.ruoloPreferito)}>
                  {g.ruoloPreferito} · {RUOLO_BY_CODE[g.ruoloPreferito]?.label}
                </Tag>
              ) : (
                isGiocatore(g) && <Text type="secondary">Ruolo non impostato</Text>
              )}
              {g.ruoliAdattati?.map((r) => (
                <Tag key={r} color={coloreRuolo(r)} style={{ opacity: 0.7 }}>
                  {r}
                </Tag>
              ))}
            </Space>
          </div>
          <Space>
            <Button icon={<EditOutlined />} onClick={apriModifica}>
              Modifica
            </Button>
            <Popconfirm
              title={`Eliminare ${g.nome} ${g.cognome}?`}
              description={
                haStatistiche
                  ? "Ha gol, assist o presenze in partita: sparirà da classifiche e albo d'oro. Meglio cambiarlo in categoria «Giocatore Extra»."
                  : undefined
              }
              okText="Elimina"
              cancelText="Annulla"
              okButtonProps={{ danger: true }}
              onConfirm={elimina}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      </Card>

      {!soloDirigente && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} lg={4}>
            <StatCard
              icona={<CalendarOutlined />}
              titolo="Allenamenti"
              valore={`${percPresenze}%`}
              sotto={
                <>
                  <Progress
                    percent={percPresenze}
                    showInfo={false}
                    strokeColor="var(--rosso)"
                    size={['100%', 5]}
                    style={{ display: 'block', margin: '2px 0' }}
                  />
                  {presenze.fatte} su {presenze.totali} sedute
                </>
              }
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatCard
              icona={<TrophyOutlined />}
              titolo="Presenze partita"
              valore={stat.presenzePartita}
              sotto={stat.presenzePartita > 0 ? `di cui ${stat.daTitolare} dal 1'` : undefined}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatCard
              icona={<AimOutlined />}
              titolo="Gol"
              valore={stat.gol}
              sotto={golAmichevole > 0 ? `di cui ${golAmichevole} in amichevole` : undefined}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatCard icona={<ThunderboltOutlined />} titolo="Assist" valore={stat.assist} />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatCard
              icona={<WarningOutlined />}
              titolo="Ammonizioni"
              valore={stat.ammonizioni}
              colore={stat.ammonizioni > 0 ? 'var(--ocra)' : undefined}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <StatCard
              icona={<StopOutlined />}
              titolo="Espulsioni"
              valore={stat.espulsioni}
              colore={stat.espulsioni > 0 ? 'var(--rosso-testo)' : undefined}
            />
          </Col>
        </Row>
      )}

      <Card title="Anagrafica e tesseramento">
        <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 3 }} size="small">
              {isDirigente(g) && (
                <Descriptions.Item label="Ruolo in dirigenza">{g.ruoloDirigenza || '—'}</Descriptions.Item>
              )}
              {!soloDirigente && (
                <Descriptions.Item label="Bravura">
                  {g.bravura ? <Rate disabled value={g.bravura} style={{ fontSize: 14 }} /> : '—'}
                </Descriptions.Item>
              )}
              {!soloDirigente && (
                <Descriptions.Item label="N. maglia">{g.numeroMaglia ?? '—'}</Descriptions.Item>
              )}
              <Descriptions.Item label="Data di nascita">
                {g.nascita ? formatData(g.nascita, true) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="N. tessera">
                {g.tessera || <Tag color="orange">Mancante</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Rilascio tessera">
                {g.dataRilascio ? formatData(g.dataRilascio, true) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Scadenza documento">
                {g.scadenzaDocumento ? (
                  <Space size={4}>
                    <span style={{ color: doc.critico ? 'var(--rosso-testo)' : undefined, fontWeight: doc.critico ? 600 : undefined }}>
                      {formatData(g.scadenzaDocumento, true)}
                    </span>
                    {doc.label && <Tag color={doc.color}>{doc.label}</Tag>}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              {!soloDirigente && (
                <Descriptions.Item label="Certificato medico">
                  {/* va a capo sul telefono: tag e data insieme sbordavano */}
                  <Space size={[4, 2]} wrap>
                    <Tag color={cert.color} style={{ marginInlineEnd: 0 }}>
                      {cert.label}
                    </Tag>
                    {g.scadenzaCertificato && (
                      <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                        scad. {formatData(g.scadenzaCertificato, true)}
                      </Text>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              {!soloDirigente && (
                <Descriptions.Item label="Quota associativa">
                  {(() => {
                    const q = statoQuota(g)
                    return (
                      <Tag color={q.esente ? 'blue' : q.completa ? 'green' : q.parziale ? 'orange' : 'red'}>{q.label}</Tag>
                    )
                  })()}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Note" span="filled">
                {g.note?.trim() ? <span style={{ whiteSpace: 'pre-wrap' }}>{g.note}</span> : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

      {!soloDirigente && (
        <Card
          title="Quota associativa"
          style={{ marginTop: 16 }}
          extra={
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={apriVersamento}>
              Aggiungi versamento
            </Button>
          }
        >
          {(() => {
            const q = statoQuota(g)
            return (
              <>
                {q.esente ? (
                  <Text>
                    <Tag color="blue">Esente</Tag> Non deve pagare la quota: non compare fra le quote da incassare.
                    Si cambia con «Modifica» in alto.
                  </Text>
                ) : q.totale ? (
                  <>
                    <Progress
                      percent={Math.min(100, Math.round((q.versato / q.totale) * 100))}
                      strokeColor={q.completa ? 'var(--verde)' : 'var(--oro)'}
                      trailColor="var(--linea)"
                    />
                    <Text strong>
                      {formatEuro(q.versato)} versati su {formatEuro(q.totale)}
                      {q.completa ? ' — quota saldata 🎉' : ` — mancano ${formatEuro(q.totale - q.versato)}`}
                    </Text>
                  </>
                ) : (
                  <Text type="secondary">
                    Imposta l'importo della quota (bottone «Modifica» in alto) per seguire i versamenti a
                    rate: lo stato «pagata» si calcolerà da solo.
                  </Text>
                )}
                <List
                  size="small"
                  style={{ marginTop: 12 }}
                  locale={{ emptyText: 'Nessun versamento registrato' }}
                  dataSource={[...(g.versamentiQuota ?? [])].sort((a, b) => a.data.localeCompare(b.data))}
                  renderItem={(v) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          key="del"
                          title={
                            v.movimentoId
                              ? 'Eliminare il versamento (e il vecchio movimento nei Conti)?'
                              : 'Eliminare il versamento?'
                          }
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => rimuoviVersamento(v)}
                        >
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <Space>
                        <EuroOutlined style={{ color: 'var(--verde)' }} />
                        <Text strong>{formatEuro(v.importo)}</Text>
                        <Text type="secondary">{formatData(v.data, true)}</Text>
                        {v.note && <Text type="secondary">· {v.note}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
                  I versamenti non finiscono nei Conti: a fine anno chi raccoglie le quote registra il
                  totale come unica entrata (il totale della rosa è nel riepilogo in Rosa).
                </Text>
              </>
            )
          })()}
        </Card>
      )}

      <ArchivioTesserato giocatore={g} />

      <Modal
        title="Nuovo versamento quota"
        open={modaleVersamento}
        onCancel={() => setModaleVersamento(false)}
        onOk={() => formVersamento.submit()}
        okText="Registra"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={formVersamento} layout="vertical" onFinish={aggiungiVersamento} requiredMark={false}>
          <Form.Item
            label="Importo (€)"
            name="importo"
            rules={[{ required: true, message: 'Inserisci l’importo' }]}
          >
            <CampoEuro min={0.01} placeholder="es. 50" autoFocus />
          </Form.Item>
          <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]} {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item label="Note (facoltative)" name="note">
            <Input placeholder="es. acconto, saldo…" autoComplete="off" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          Resta qui, nella scheda di {g.cognome} {g.nome}: nei Conti va solo il totale delle quote, a fine
          anno e a mano.
        </Text>
      </Modal>

      <Modal
        title="Modifica giocatore"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Salva"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salvaModifica} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, whitespace: true, message: 'Inserisci il nome' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Cognome" name="cognome" rules={[{ required: true, whitespace: true, message: 'Inserisci il cognome' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Categoria" name="categoria">
            <Select options={OPZIONI_CATEGORIA} />
          </Form.Item>
          {campiDirigente && (
            <Form.Item label="Ruolo in dirigenza (facoltativo)" name="ruoloDirigenza">
              <AutoComplete
                options={OPZIONI_RUOLI_DIRIGENZA}
                placeholder="es. Presidente, Segretario…"
                allowClear
                filterOption={(input, opt) =>
                  String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}
          {campiGiocatore && (
            <>
              <Form.Item label="Ruolo preferito" name="ruoloPreferito">
                <Select options={OPZIONI_RUOLI} allowClear showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item label="Ruoli adattati" name="ruoliAdattati">
                <Select mode="multiple" options={OPZIONI_RUOLI} allowClear showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item label="Bravura" name="bravura" tooltip="Da 1 a 5: pesa nel generatore di formazione">
                <Rate />
              </Form.Item>
              <Form.Item
                label="Numero di maglia (facoltativo)"
                name="numeroMaglia"
                tooltip="Precompila la distinta e la grafica della formazione"
              >
                <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="es. 10" />
              </Form.Item>
            </>
          )}
          <Form.Item label="Data di nascita (gg/mm/aaaa)" name="nascita">
            <Input placeholder="es. 12/03/2001" />
          </Form.Item>
          <Form.Item label="N. tessera" name="tessera">
            <Input />
          </Form.Item>
          <Form.Item label="Data rilascio tessera" name="dataRilascio">
            <Input placeholder="es. 01/09/2026" />
          </Form.Item>
          <Form.Item
            label="Scadenza documento d'identità"
            name="scadenzaDocumento"
            tooltip="Fine validità della carta d'identità (o del documento usato in distinta)"
            {...propsCampoData}
          >
            <DataPicker />
          </Form.Item>
          {campiGiocatore && (
            <>
              <Form.Item label="Certificato medico consegnato" name="certificatoMedico" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Scadenza certificato" name="scadenzaCertificato" {...propsCampoData}>
                <DataPicker />
              </Form.Item>
              <Form.Item
                label="Esente dalla quota"
                name="quotaEsente"
                valuePropName="checked"
                tooltip="Non deve pagare la quota (es. allenatore che gioca, accordi): non compare fra le quote da incassare"
              >
                <Switch />
              </Form.Item>
              {!esenteForm && (
                <>
                  <Form.Item
                    label="Importo quota (€)"
                    name="quotaImporto"
                    tooltip="Se impostato, lo stato della quota deriva dai versamenti registrati qui sotto"
                  >
                    <CampoEuro placeholder="es. 150" />
                  </Form.Item>
                  <Form.Item label="Quota associativa pagata" name="quotaPagata" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              )}
              <Form.Item label="Infortunato" name="infortunato" valuePropName="checked">
                <Switch />
              </Form.Item>
              {infortunatoForm && (
                <Form.Item label="Rientro previsto" name="rientroInfortunio" {...propsCampoData}>
                  <DataPicker />
                </Form.Item>
              )}
            </>
          )}
          <Form.Item label="Note" name="note">
            <Input.TextArea rows={3} placeholder="es. taglia maglia, recapiti, incarichi…" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
