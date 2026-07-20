import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import { isGiocatore } from '../lib/categoria'
import { EventoEditor } from './partite/EventoEditor'
import type { EventoGol, Giocatore, Partita, Torneo } from '../types'

const { Title, Text } = Typography

export function PartitaDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const partiteColl = useCollection<Partita>('partite')
  const { items, update } = partiteColl
  const giocatori = useCollection<Giocatore>('giocatori')
  const tornei = useCollection<Torneo>('tornei')
  const eliminaConUndo = useEliminaUndo()
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  const giocataForm = Form.useWatch('giocata', form)

  const p = items.find((x) => x.id === id)

  const rosa = useMemo(
    () =>
      [...giocatori.items].sort((a, b) =>
        `${a.cognome}${a.nome}`.localeCompare(`${b.cognome}${b.nome}`),
      ),
    [giocatori.items],
  )
  // i dirigenti puri non giocano: si propongono solo i giocatori, ma chi è già
  // segnato (es. riclassificato dirigente in seguito) resta visibile col suo nome
  const opzioniGiocatori = (selezionati: string[]) =>
    rosa
      .filter((g) => isGiocatore(g) || selezionati.includes(g.id))
      .map((g) => ({ value: g.id, label: `${g.cognome} ${g.nome}` }))

  if (!p) {
    return (
      <Result
        status="404"
        title="Partita non trovata"
        extra={
          <Button type="primary" onClick={() => navigate('/partite')}>
            Torna alle partite
          </Button>
        }
      />
    )
  }

  function apriModifica() {
    form.setFieldsValue({ ...p!, giocata: p!.giocata !== false })
    setModale(true)
  }
  function salvaModifica(v: Partial<Partita>) {
    const giocata = v.giocata !== false
    update(p!.id, {
      ...v,
      giocata,
      ora: v.ora?.trim() || undefined,
      avversario: (v.avversario ?? p!.avversario).trim(),
      torneoId: v.torneoId || undefined,
      golFatti: giocata ? (v.golFatti ?? 0) : 0,
      golSubiti: giocata ? (v.golSubiti ?? 0) : 0,
    })
    setModale(false)
  }

  const nomeTorneo = tornei.items.find((t) => t.id === p.torneoId)?.nome

  const programma = p.giocata === false
  const esitoColore =
    p.golFatti > p.golSubiti ? '#3f7a52' : p.golFatti < p.golSubiti ? '#b1352f' : '#6f695f'

  return (
    <>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/partite')}
        style={{ marginBottom: 12, paddingLeft: 0 }}
      >
        Partite
      </Button>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Text type="secondary">
              {formatData(p.data)}
              {p.ora ? ` · ore ${p.ora}` : ''} · {p.inCasa ? 'In casa' : 'In trasferta'}
              {nomeTorneo ? ` · ${nomeTorneo}` : ''}
            </Text>
            <Title level={3} style={{ margin: '4px 0 0' }}>
              U.S. Riolunato{' '}
              {programma ? (
                <Tag color="gold" style={{ verticalAlign: 'middle' }}>
                  In programma
                </Tag>
              ) : (
                <span style={{ color: esitoColore, fontVariantNumeric: 'tabular-nums' }}>
                  {p.golFatti} – {p.golSubiti}
                </span>
              )}{' '}
              {p.avversario}
            </Title>
            {p.note && <Text type="secondary">{p.note}</Text>}
          </div>
          <Space>
            <Button icon={<EditOutlined />} onClick={apriModifica}>
              Modifica
            </Button>
            <Popconfirm
              title="Eliminare questa partita?"
              okText="Elimina"
              cancelText="Annulla"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                eliminaConUndo(partiteColl, p, `Partita con ${p.avversario} eliminata.`)
                navigate('/partite')
              }}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        {!programma && (
          <>
            <Col xs={24} md={12}>
              <Card
                title={`Titolari${p.titolari?.length ? ` (${p.titolari.length})` : ''}`}
                size="small"
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    chi è sceso in campo dal 1'
                  </Text>
                }
              >
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="Giocatori titolari"
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  value={p.titolari ?? []}
                  options={opzioniGiocatori(p.titolari ?? [])}
                  onChange={(titolari) => update(p.id, { titolari })}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={`Subentrati${p.subentrati?.length ? ` (${p.subentrati.length})` : ''}`}
                size="small"
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    entrati dalla panchina
                  </Text>
                }
              >
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="Giocatori subentrati"
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  value={p.subentrati ?? []}
                  options={opzioniGiocatori(p.subentrati ?? [])}
                  onChange={(subentrati) => update(p.id, { subentrati })}
                />
              </Card>
            </Col>
          </>
        )}
        <Col xs={24} md={12}>
          <Card title="Marcatori" size="small">
            <EventoEditor
              rosa={rosa}
              value={p.marcatori ?? []}
              onChange={(marcatori: EventoGol[]) => update(p.id, { marcatori })}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Assist" size="small">
            <EventoEditor
              rosa={rosa}
              value={p.assist ?? []}
              onChange={(assist: EventoGol[]) => update(p.id, { assist })}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Ammoniti (gialli)" size="small">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Giocatori ammoniti"
              showSearch
              optionFilterProp="label"
              value={p.ammoniti ?? []}
              options={opzioniGiocatori(p.ammoniti ?? [])}
              onChange={(ammoniti) => update(p.id, { ammoniti })}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Espulsi (rossi)" size="small">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Giocatori espulsi"
              showSearch
              optionFilterProp="label"
              value={p.espulsi ?? []}
              options={opzioniGiocatori(p.espulsi ?? [])}
              onChange={(espulsi) => update(p.id, { espulsi })}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Modifica partita"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Salva"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salvaModifica} requiredMark={false}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Data" name="data" rules={[{ required: true }]} {...propsCampoData}>
                <DataPicker />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Ora" name="ora">
                <Input placeholder="es. 15:30" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Avversario" name="avversario" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Dove" name="inCasa">
            <Select
              options={[
                { value: true, label: 'In casa' },
                { value: false, label: 'In trasferta' },
              ]}
            />
          </Form.Item>
          {tornei.items.length > 0 && (
            <Form.Item label="Competizione (facoltativa)" name="torneoId">
              <Select
                allowClear
                placeholder="es. Campionato, Coppa…"
                options={tornei.items.map((t) => ({ value: t.id, label: t.nome }))}
              />
            </Form.Item>
          )}
          <Form.Item
            label="Partita già giocata"
            name="giocata"
            valuePropName="checked"
            extra="Spegni per una partita in programma (senza risultato)"
          >
            <Switch />
          </Form.Item>
          {giocataForm !== false && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Gol fatti" name="golFatti">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Gol subiti" name="golSubiti">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
