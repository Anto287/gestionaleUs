import { useState } from 'react'
import { Button, Empty, Flex, Form, Grid, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import type { Divisa } from '../../types'

const { Text } = Typography

type Bozza = Pick<Divisa, 'nome' | 'coloreMaglia' | 'colorePantaloncini' | 'coloreCalzettoni'>

/** Un pallino colorato + testo, o un trattino se il colore non è indicato. */
function Colore({ valore }: { valore?: string }) {
  if (!valore) return <span style={{ color: '#bbb' }}>—</span>
  return <Tag>{valore}</Tag>
}

/**
 * Gestione delle tute da gara: nome + colori di maglia, pantaloncini e
 * calzettoni. Vengono poi scelte nella testata della distinta.
 */
export function DivisaManager() {
  const { items, add, update, remove } = useCollection<Divisa>('divise')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Divisa | null>(null)
  const [form] = Form.useForm()

  function apriNuova() {
    setInModifica(null)
    form.resetFields()
    setModale(true)
  }
  function apriModifica(d: Divisa) {
    setInModifica(d)
    form.setFieldsValue(d)
    setModale(true)
  }
  function salva(valori: Bozza) {
    if (inModifica) update(inModifica.id, valori)
    else add(valori)
    setModale(false)
  }

  const stopCell = { onCell: () => ({ onClick: (e: React.MouseEvent) => e.stopPropagation() }) }

  const nomeCol = {
    title: 'Divisa',
    dataIndex: 'nome',
    sorter: (a: Divisa, b: Divisa) => (a.nome ?? '').localeCompare(b.nome ?? ''),
    render: (nome: string) => (
      <span className="tronca" style={{ maxWidth: 220, fontWeight: 600 }} title={nome}>
        {nome}
      </span>
    ),
  }
  const azioniCol = {
    title: '',
    key: 'azioni',
    width: 50,
    ...stopCell,
    render: (_: unknown, d: Divisa) => (
      <Popconfirm
        title={`Eliminare la divisa ${d.nome}?`}
        okText="Elimina"
        cancelText="Annulla"
        okButtonProps={{ danger: true }}
        onConfirm={() => remove(d.id)}
      >
        <Button type="text" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    ),
  }
  // su mobile i tre colori stanno in un'unica colonna (niente scroll orizzontale)
  const colonneColore = isMobile
    ? [
        {
          title: 'Colori',
          key: 'colori',
          render: (_: unknown, d: Divisa) =>
            d.coloreMaglia || d.colorePantaloncini || d.coloreCalzettoni ? (
              <Space size={[4, 4]} wrap>
                {d.coloreMaglia && <Tag>Maglia: {d.coloreMaglia}</Tag>}
                {d.colorePantaloncini && <Tag>Pant.: {d.colorePantaloncini}</Tag>}
                {d.coloreCalzettoni && <Tag>Calz.: {d.coloreCalzettoni}</Tag>}
              </Space>
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
      ]
    : [
        { title: 'Maglia', key: 'maglia', render: (_: unknown, d: Divisa) => <Colore valore={d.coloreMaglia} /> },
        { title: 'Pantaloncini', key: 'pant', render: (_: unknown, d: Divisa) => <Colore valore={d.colorePantaloncini} /> },
        { title: 'Calzettoni', key: 'calz', render: (_: unknown, d: Divisa) => <Colore valore={d.coloreCalzettoni} /> },
      ]

  const columns = [nomeCol, ...colonneColore, azioniCol]

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Text>
          <b>{items.length}</b> divise
        </Text>
        {items.length > 0 && (
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
            Nuova divisa
          </Button>
        )}
      </Flex>

      {items.length === 0 ? (
        <Empty description="Nessuna divisa: definiscine una (colori di maglia, pantaloncini e calzettoni) da usare nella distinta.">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuova}>
            Nuova divisa
          </Button>
        </Empty>
      ) : (
        <Table
          rowKey="id"
          dataSource={items}
          columns={columns}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          onRow={(d) => ({ onClick: () => apriModifica(d), style: { cursor: 'pointer' } })}
        />
      )}

      <Modal
        title={inModifica ? 'Modifica divisa' : 'Nuova divisa'}
        open={modale}
        onCancel={() => setModale(false)}
        onOk={() => form.submit()}
        okText={inModifica ? 'Salva' : 'Aggiungi'}
        cancelText="Annulla"
        maskClosable={false}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
          <Form.Item
            label="Nome divisa"
            name="nome"
            rules={[{ required: true, message: 'Inserisci un nome (es. Prima divisa)' }]}
          >
            <Input placeholder="es. Prima divisa" />
          </Form.Item>
          <Form.Item label="Colore maglia" name="coloreMaglia">
            <Input placeholder="es. Giallorossa" />
          </Form.Item>
          <Form.Item label="Colore pantaloncini" name="colorePantaloncini">
            <Input placeholder="es. Rossi" />
          </Form.Item>
          <Form.Item label="Colore calzettoni" name="coloreCalzettoni">
            <Input placeholder="es. Gialli" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
