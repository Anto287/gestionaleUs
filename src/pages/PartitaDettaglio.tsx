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
  Typography,
} from 'antd'
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import { isGiocatore } from '../lib/categoria'
import { EventoEditor } from './partite/EventoEditor'
import type { EventoGol, Giocatore, Partita } from '../types'

const { Title, Text } = Typography

export function PartitaDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, update, remove } = useCollection<Partita>('partite')
  const giocatori = useCollection<Giocatore>('giocatori')
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()

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
    form.setFieldsValue(p)
    setModale(true)
  }
  function salvaModifica(v: Partial<Partita>) {
    update(p!.id, { ...v, avversario: (v.avversario ?? p!.avversario).trim() })
    setModale(false)
  }

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
              {formatData(p.data)} · {p.inCasa ? 'In casa' : 'In trasferta'}
            </Text>
            <Title level={3} style={{ margin: '4px 0 0' }}>
              U.S. Riolunato{' '}
              <span style={{ color: esitoColore, fontVariantNumeric: 'tabular-nums' }}>
                {p.golFatti} – {p.golSubiti}
              </span>{' '}
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
                remove(p.id)
                navigate('/partite')
              }}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
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
          <Form.Item label="Data" name="data" rules={[{ required: true }]} {...propsCampoData}>
            <DataPicker />
          </Form.Item>
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
          <Form.Item label="Note" name="note">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
