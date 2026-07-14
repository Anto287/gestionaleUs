import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { coloreRuolo, ordineRuolo, OPZIONI_RUOLI } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { isDirigente, isGiocatore, OPZIONI_CATEGORIA } from '../lib/categoria'
import type { Allenamento, Giocatore } from '../types'

type Bozza = Pick<
  Giocatore,
  | 'nome'
  | 'cognome'
  | 'categoria'
  | 'ruoloPreferito'
  | 'ruoliAdattati'
  | 'nascita'
  | 'tessera'
  | 'dataRilascio'
  | 'certificatoMedico'
  | 'scadenzaCertificato'
>

export function Rosa() {
  const { items, add, remove } = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const navigate = useNavigate()
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  const [q, setQ] = useState('')
  const [ruoloF, setRuoloF] = useState<string | undefined>()
  const [categoriaF, setCategoriaF] = useState<string | undefined>()

  const presenze = useMemo(() => {
    const conteggio: Record<string, number> = {}
    for (const a of allenamenti.items) {
      for (const [id, presente] of Object.entries(a.presenze)) {
        if (presente) conteggio[id] = (conteggio[id] ?? 0) + 1
      }
    }
    return conteggio
  }, [allenamenti.items])

  const ordinati = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          ordineRuolo(a.ruoloPreferito) - ordineRuolo(b.ruoloPreferito) ||
          a.cognome.localeCompare(b.cognome),
      ),
    [items],
  )

  const filtrati = useMemo(
    () =>
      ordinati.filter((g) => {
        const nome = `${g.cognome} ${g.nome}`.toLowerCase()
        if (q && !nome.includes(q.toLowerCase())) return false
        if (ruoloF && g.ruoloPreferito !== ruoloF && !(g.ruoliAdattati ?? []).includes(ruoloF))
          return false
        if (categoriaF === 'giocatore' && !isGiocatore(g)) return false
        if (categoriaF === 'dirigente' && !isDirigente(g)) return false
        return true
      }),
    [ordinati, q, ruoloF, categoriaF],
  )

  function apriNuovo() {
    form.resetFields()
    form.setFieldsValue({ certificatoMedico: false, ruoliAdattati: [], categoria: 'giocatore' })
    setModale(true)
  }

  function salva(valori: Bozza) {
    add(valori)
    setModale(false)
  }

  // il click su Elimina (e sul suo Popconfirm) non deve aprire la scheda del giocatore
  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  const columns = [
    {
      title: 'Giocatore',
      key: 'nome',
      render: (_: unknown, g: Giocatore) => (
        <span style={{ fontWeight: 600 }}>
          {g.cognome} {g.nome}
          {isDirigente(g) && (
            <Tag color="purple" style={{ marginLeft: 8 }}>
              {g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Ruolo',
      key: 'ruolo',
      render: (_: unknown, g: Giocatore) =>
        g.ruoloPreferito ? <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag> : '—',
    },
    {
      title: 'Adattato',
      key: 'adattati',
      render: (_: unknown, g: Giocatore) =>
        g.ruoliAdattati?.length ? (
          <Space size={[4, 4]} wrap>
            {g.ruoliAdattati.map((r) => (
              <Tag key={r} color={coloreRuolo(r)} style={{ opacity: 0.75 }}>
                {r}
              </Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Pres.',
      key: 'pres',
      align: 'right' as const,
      render: (_: unknown, g: Giocatore) => presenze[g.id] ?? 0,
    },
    {
      title: 'Certificato',
      key: 'cert',
      render: (_: unknown, g: Giocatore) => {
        const s = statoCertificato(g)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '',
      key: 'azioni',
      width: 60,
      ...stopCell,
      render: (_: unknown, g: Giocatore) => (
        <Popconfirm
          title={`Eliminare ${g.nome} ${g.cognome}?`}
          okText="Elimina"
          cancelText="Annulla"
          okButtonProps={{ danger: true }}
          onConfirm={() => remove(g.id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        titolo="Rosa"
        sottotitolo={`${items.length} tesserati · tocca un nome per la scheda`}
        azioni={
          items.length > 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
              Aggiungi giocatore
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Empty description="Nessun giocatore in rosa">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            Aggiungi il primo
          </Button>
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca giocatore"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Ruolo"
              value={ruoloF}
              onChange={setRuoloF}
              options={OPZIONI_RUOLI}
              style={{ width: 200 }}
            />
            <Select
              allowClear
              placeholder="Categoria"
              value={categoriaF}
              onChange={setCategoriaF}
              options={[
                { value: 'giocatore', label: 'Giocatori' },
                { value: 'dirigente', label: 'Dirigenti' },
              ]}
              style={{ width: 150 }}
            />
          </Space>
          <Table
            rowKey="id"
            dataSource={filtrati}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            onRow={(g) => ({ onClick: () => navigate(`/rosa/${g.id}`), style: { cursor: 'pointer' } })}
          />
        </>
      )}

      <Modal
        title="Nuovo giocatore"
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText="Aggiungi"
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, message: 'Inserisci il nome' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Cognome"
            name="cognome"
            rules={[{ required: true, message: 'Inserisci il cognome' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Categoria" name="categoria">
            <Select options={OPZIONI_CATEGORIA} />
          </Form.Item>
          <Form.Item label="Ruolo preferito" name="ruoloPreferito">
            <Select options={OPZIONI_RUOLI} placeholder="es. DC — Difensore centrale" allowClear showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="Ruoli adattati" name="ruoliAdattati">
            <Select
              mode="multiple"
              options={OPZIONI_RUOLI}
              placeholder="uno o più ruoli"
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item label="Data di nascita (gg/mm/aaaa)" name="nascita">
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
          <Form.Item label="Scadenza certificato" name="scadenzaCertificato">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
