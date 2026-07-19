import { useMemo, useState } from 'react'
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
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  EuroOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { coloreRuolo, OPZIONI_RUOLI, RUOLO_BY_CODE } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { isDirigente, isGiocatore, OPZIONI_CATEGORIA, OPZIONI_RUOLI_DIRIGENZA } from '../lib/categoria'
import { statisticheGiocatore } from '../lib/statistiche'
import { statoQuota } from '../lib/quota'
import { formatData, formatEuro } from '../lib/format'
import type { Allenamento, Giocatore, Movimento, Partita, VersamentoQuota } from '../types'

const { Title, Text } = Typography

function iniziali(g: Giocatore) {
  return `${g.nome[0] ?? ''}${g.cognome[0] ?? ''}`.toUpperCase()
}

export function GiocatoreDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, update, remove } = useCollection<Giocatore>('giocatori')
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

  const g = items.find((x) => x.id === id)

  const presenze = useMemo(() => {
    if (!g) return { fatte: 0, totali: 0 }
    return {
      totali: allenamenti.items.length,
      fatte: allenamenti.items.filter((a) => a.presenze[g.id]).length,
    }
  }, [allenamenti.items, g])

  const stat = useMemo(
    () => (g ? statisticheGiocatore(g.id, partite.items) : { gol: 0, assist: 0, ammonizioni: 0, espulsioni: 0 }),
    [g, partite.items],
  )

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
  const soloDirigente = !isGiocatore(g)
  const percPresenze = presenze.totali ? Math.round((presenze.fatte / presenze.totali) * 100) : 0

  function apriModifica() {
    form.setFieldsValue({ ...g, categoria: g!.categoria ?? 'giocatore' })
    setModale(true)
  }
  function salvaModifica(valori: Partial<Giocatore>) {
    // scarta i valori dei campi nascosti rimasti da un cambio di categoria
    if (valori.categoria === 'dirigente') {
      valori = {
        ...valori,
        ruoloPreferito: undefined,
        ruoliAdattati: undefined,
        bravura: undefined,
        certificatoMedico: undefined,
        scadenzaCertificato: undefined,
        quotaPagata: undefined,
        quotaImporto: undefined,
        infortunato: undefined,
        rientroInfortunio: undefined,
      }
    }
    if (valori.categoria === 'giocatore') valori = { ...valori, ruoloDirigenza: undefined }
    if (!valori.infortunato) valori = { ...valori, rientroInfortunio: undefined }
    update(g!.id, valori)
    setModale(false)
  }

  function apriVersamento() {
    formVersamento.resetFields()
    formVersamento.setFieldsValue({ data: new Date().toISOString().slice(0, 10) })
    setModaleVersamento(true)
  }

  /** Registra un versamento della quota e il movimento gemello nei Conti. */
  function aggiungiVersamento(v: { data: string; importo: number; note?: string }) {
    const movimentoId = conti.add({
      data: v.data,
      descrizione: `Quota ${g!.cognome} ${g!.nome}${v.note?.trim() ? ' — ' + v.note.trim() : ''}`,
      tipo: 'entrata',
      importo: v.importo,
      saldato: true,
      controparte: `${g!.cognome} ${g!.nome}`,
    })
    const nuovo: VersamentoQuota = {
      id: crypto.randomUUID(),
      data: v.data,
      importo: v.importo,
      note: v.note?.trim() || undefined,
      movimentoId,
    }
    update(g!.id, { versamentiQuota: [...(g!.versamentiQuota ?? []), nuovo] })
    setModaleVersamento(false)
    message.success('Versamento registrato, movimento creato nei Conti')
  }

  function rimuoviVersamento(v: VersamentoQuota) {
    if (v.movimentoId && conti.items.some((m) => m.id === v.movimentoId)) conti.remove(v.movimentoId)
    update(g!.id, { versamentiQuota: (g!.versamentiQuota ?? []).filter((x) => x.id !== v.id) })
  }
  function elimina() {
    remove(g!.id)
    navigate('/rosa')
  }

  return (
    <>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/rosa')}
        style={{ marginBottom: 12, paddingLeft: 0 }}
      >
        Rosa
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar size={64} style={{ background: '#c22026', fontSize: 24, flex: 'none' }}>
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

      <Row gutter={[16, 16]}>
        {!soloDirigente && (
          <Col xs={24} md={8}>
            <Card style={{ textAlign: 'center' }}>
              <Text type="secondary">Presenze agli allenamenti</Text>
              <div style={{ margin: '12px 0' }}>
                <Progress type="dashboard" percent={percPresenze} strokeColor="#c22026" size={140} />
              </div>
              <Text strong>
                {presenze.fatte} su {presenze.totali} sedute
              </Text>
            </Card>
          </Col>
        )}
        <Col xs={24} md={soloDirigente ? 24 : 16}>
          <Card
            title={soloDirigente ? 'Anagrafica e tesseramento' : 'Statistiche'}
            extra={
              !soloDirigente && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  calcolate dalle partite
                </Text>
              )
            }
          >
            {!soloDirigente && (
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic title="Gol" value={stat.gol} />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic title="Assist" value={stat.assist} />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Ammonizioni"
                    value={stat.ammonizioni}
                    valueStyle={{ color: stat.ammonizioni > 0 ? '#9a6b1e' : undefined }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Espulsioni"
                    value={stat.espulsioni}
                    valueStyle={{ color: stat.espulsioni > 0 ? '#b1352f' : undefined }}
                  />
                </Col>
              </Row>
            )}
            <Descriptions
              column={{ xs: 1, sm: 2 }}
              size="small"
              style={soloDirigente ? undefined : { marginTop: 20 }}
              title={soloDirigente ? undefined : 'Anagrafica e tesseramento'}
            >
              {isDirigente(g) && (
                <Descriptions.Item label="Ruolo in dirigenza">{g.ruoloDirigenza || '—'}</Descriptions.Item>
              )}
              {!soloDirigente && (
                <Descriptions.Item label="Bravura">
                  {g.bravura ? <Rate disabled value={g.bravura} style={{ fontSize: 14 }} /> : '—'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Data di nascita">{g.nascita || '—'}</Descriptions.Item>
              <Descriptions.Item label="N. tessera">
                {g.tessera || <Tag color="orange">Mancante</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Rilascio tessera">{g.dataRilascio || '—'}</Descriptions.Item>
              {!soloDirigente && (
                <Descriptions.Item label="Certificato medico">
                  <Tag color={cert.color}>{cert.label}</Tag>
                  {g.scadenzaCertificato && (
                    <Text type="secondary"> scad. {formatData(g.scadenzaCertificato, true)}</Text>
                  )}
                </Descriptions.Item>
              )}
              {!soloDirigente && (
                <Descriptions.Item label="Quota associativa">
                  {(() => {
                    const q = statoQuota(g)
                    return (
                      <Tag color={q.completa ? 'green' : q.parziale ? 'orange' : 'red'}>{q.label}</Tag>
                    )
                  })()}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Note" span={2}>
                {g.note?.trim() ? <span style={{ whiteSpace: 'pre-wrap' }}>{g.note}</span> : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

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
                {q.totale ? (
                  <>
                    <Progress
                      percent={Math.min(100, Math.round((q.versato / q.totale) * 100))}
                      strokeColor={q.completa ? '#3f7a52' : '#e5a800'}
                      trailColor="#eee4d3"
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
                          title="Eliminare il versamento (e il movimento nei Conti)?"
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
                        <EuroOutlined style={{ color: '#3f7a52' }} />
                        <Text strong>{formatEuro(v.importo)}</Text>
                        <Text type="secondary">{formatData(v.data, true)}</Text>
                        {v.note && <Text type="secondary">· {v.note}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )
          })()}
        </Card>
      )}

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
            <InputNumber min={1} style={{ width: '100%' }} placeholder="es. 50" autoFocus />
          </Form.Item>
          <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]} {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item label="Note (facoltative)" name="note">
            <Input placeholder="es. acconto, saldo…" autoComplete="off" />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          Il versamento crea in automatico un'entrata saldata nei Conti intestata a {g.cognome} {g.nome}.
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
          <Form.Item label="Nome" name="nome" rules={[{ required: true, message: 'Inserisci il nome' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Cognome" name="cognome" rules={[{ required: true, message: 'Inserisci il cognome' }]}>
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
            </>
          )}
          <Form.Item label="Data di nascita" name="nascita">
            <Input placeholder="es. 12/03/2001" />
          </Form.Item>
          <Form.Item label="N. tessera" name="tessera">
            <Input />
          </Form.Item>
          <Form.Item label="Data rilascio tessera" name="dataRilascio">
            <Input placeholder="es. 01/09/2026" />
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
                label="Importo quota (€)"
                name="quotaImporto"
                tooltip="Se impostato, lo stato della quota deriva dai versamenti registrati qui sotto"
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="es. 150" />
              </Form.Item>
              <Form.Item label="Quota associativa pagata" name="quotaPagata" valuePropName="checked">
                <Switch />
              </Form.Item>
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
