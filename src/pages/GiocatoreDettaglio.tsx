import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
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
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { coloreRuolo, OPZIONI_RUOLI, RUOLO_BY_CODE } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { isDirigente, isGiocatore, OPZIONI_CATEGORIA } from '../lib/categoria'
import { statisticheGiocatore } from '../lib/statistiche'
import { formatData } from '../lib/format'
import type { Allenamento, Giocatore, Partita } from '../types'

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
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()

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
  const percPresenze = presenze.totali ? Math.round((presenze.fatte / presenze.totali) * 100) : 0

  function apriModifica() {
    form.setFieldsValue({ ...g, categoria: g!.categoria ?? 'giocatore' })
    setModale(true)
  }
  function salvaModifica(valori: Partial<Giocatore>) {
    update(g!.id, valori)
    setModale(false)
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
                <Tag color="purple">{g.categoria === 'entrambi' ? 'Giocatore e dirigente' : 'Dirigente'}</Tag>
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
        <Col xs={24} md={16}>
          <Card
            title="Statistiche"
            extra={<Text type="secondary" style={{ fontSize: 12 }}>calcolate dalle partite</Text>}
          >
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
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" style={{ marginTop: 20 }} title="Anagrafica e tesseramento">
              <Descriptions.Item label="Bravura">
                {g.bravura ? <Rate disabled value={g.bravura} style={{ fontSize: 14 }} /> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Data di nascita">{g.nascita || '—'}</Descriptions.Item>
              <Descriptions.Item label="N. tessera">
                {g.tessera || <Tag color="orange">Mancante</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Rilascio tessera">{g.dataRilascio || '—'}</Descriptions.Item>
              <Descriptions.Item label="Certificato medico">
                <Tag color={cert.color}>{cert.label}</Tag>
                {g.scadenzaCertificato && (
                  <Text type="secondary"> scad. {formatData(g.scadenzaCertificato, true)}</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Quota associativa">
                <Tag color={g.quotaPagata ? 'green' : 'red'}>
                  {g.quotaPagata ? 'Pagata' : 'Da pagare'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

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
          <Form.Item label="Ruolo preferito" name="ruoloPreferito">
            <Select options={OPZIONI_RUOLI} allowClear showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="Ruoli adattati" name="ruoliAdattati">
            <Select mode="multiple" options={OPZIONI_RUOLI} allowClear showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="Bravura" name="bravura" tooltip="Da 1 a 5: pesa nel generatore di formazione">
            <Rate />
          </Form.Item>
          <Form.Item label="Data di nascita" name="nascita">
            <Input placeholder="es. 12/03/2001" />
          </Form.Item>
          <Form.Item label="N. tessera" name="tessera">
            <Input />
          </Form.Item>
          <Form.Item label="Data rilascio tessera" name="dataRilascio">
            <Input placeholder="es. 01/09/2026" />
          </Form.Item>
          <Form.Item label="Certificato medico consegnato" name="certificatoMedico" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Scadenza certificato" name="scadenzaCertificato" {...propsCampoData}>
            <DataPicker />
          </Form.Item>
          <Form.Item label="Quota associativa pagata" name="quotaPagata" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
