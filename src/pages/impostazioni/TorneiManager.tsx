import { useState } from 'react'
import { Button, Card, Empty, Form, Input, List, Modal, Popconfirm, Tag, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, TrophyOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { useEliminaUndo } from '../../hooks/useEliminaUndo'
import type { Partita, Torneo } from '../../types'
import { plurale, ripulisciTesti } from '../../lib/format'

const { Text } = Typography

type Bozza = Pick<Torneo, 'nome' | 'girone'>

/**
 * Gestione dei tornei/competizioni della stagione (Campionato, Coppa, …)
 * con il rispettivo girone. Nella distinta si scelgono da un elenco a tendina.
 */
export function TorneiManager() {
  const tornei = useCollection<Torneo>('tornei')
  const { items, add, update } = tornei
  const partite = useCollection<Partita>('partite')
  const eliminaConUndo = useEliminaUndo()
  const [modale, setModale] = useState(false)
  const [inModifica, setInModifica] = useState<Torneo | null>(null)
  const [form] = Form.useForm()

  function apriNuovo() {
    setInModifica(null)
    form.resetFields()
    setModale(true)
  }
  function apriModifica(t: Torneo) {
    setInModifica(t)
    form.setFieldsValue(t)
    setModale(true)
  }
  function salva(valori: Bozza) {
    valori = ripulisciTesti(valori)
    if (inModifica) update(inModifica.id, valori)
    else add(valori)
    setModale(false)
  }

  // quante partite fanno riferimento al torneo: restano, ma senza competizione
  function usatoDa(id: string) {
    const n = partite.items.filter((p) => p.torneoId === id).length
    return n
      ? `È usato da ${plurale(n, 'partita', 'partite')}: ${n === 1 ? 'resterà' : 'resteranno'} senza competizione.`
      : 'Nessuna partita lo usa.'
  }

  return (
    <Card
      title={
        <>
          <TrophyOutlined style={{ marginRight: 8 }} />
          Tornei e gironi
        </>
      }
      style={{ marginBottom: 16 }}
      extra={
        items.length > 0 && (
          <Button icon={<PlusOutlined />} onClick={apriNuovo}>
            Nuovo torneo
          </Button>
        )
      }
    >
      <Text type="secondary">
        Campionato, coppa e altre competizioni della stagione: si potranno scegliere nella testata
        della distinta.
      </Text>

      {items.length === 0 ? (
        <Empty style={{ marginTop: 16 }} description="Nessun torneo impostato">
          <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
            Aggiungi il primo
          </Button>
        </Empty>
      ) : (
        <List
          style={{ marginTop: 12 }}
          dataSource={items}
          renderItem={(t) => (
            <List.Item
              actions={[
                <Button key="e" type="text" icon={<EditOutlined />} onClick={() => apriModifica(t)} />,
                <Popconfirm
                  key="d"
                  title={`Eliminare il torneo ${t.nome}?`}
                  description={usatoDa(t.id)}
                  okText="Elimina"
                  cancelText="Annulla"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => eliminaConUndo(tornei, t, `Torneo ${t.nome} eliminato`)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: 600 }}>{t.nome}</span>}
                description={t.girone ? <Tag>{t.girone}</Tag> : <Text type="secondary">senza girone</Text>}
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title={inModifica ? 'Modifica torneo' : 'Nuovo torneo'}
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
            label="Nome torneo"
            name="nome"
            rules={[{ required: true, message: 'Inserisci un nome (es. Campionato)' }]}
          >
            <Input placeholder="es. Campionato, Coppa" />
          </Form.Item>
          <Form.Item label="Girone" name="girone">
            <Input placeholder="es. Girone B" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
