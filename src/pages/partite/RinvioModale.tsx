import { Form, Input, Modal } from 'antd'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { inAttesaDiRecupero, REGEX_ORA } from '../../lib/partita'
import type { Partita } from '../../types'

interface Valori {
  dataRecupero?: string
  oraRecupero?: string
  motivo?: string
}

export function RinvioModale({ partita, onSave, onClose }: {
  partita: Partita
  onSave: (patch: Partial<Partita>) => void
  onClose: () => void
}) {
  const [form] = Form.useForm<Valori>()
  const riprogramma = inAttesaDiRecupero(partita)
  const dataScelta = Form.useWatch('dataRecupero', form)

  function salva(v: Valori) {
    if (partita.giocata !== false) return

    const rinvii = [...(partita.rinvii ?? [])]
    const recupero = {
      dataRecupero: v.dataRecupero,
      oraRecupero: v.dataRecupero ? v.oraRecupero?.trim() || undefined : undefined,
    }
    if (riprogramma) {
      if (!recupero.dataRecupero) return
      const ultimo = rinvii.pop()!
      rinvii.push({ ...ultimo, ...recupero })
    } else {
      rinvii.push({
        dataPrecedente: partita.data,
        oraPrecedente: partita.ora,
        motivo: v.motivo?.trim() || undefined,
        ...recupero,
      })
    }

    onSave({ data: recupero.dataRecupero ?? partita.data, ora: recupero.oraRecupero, rinvii })
    onClose()
  }

  return (
    <Modal
      open
      title={`${riprogramma ? 'Fissa il recupero' : 'Rinvia partita'} · ${partita.avversario}`}
      okText={riprogramma ? 'Salva recupero' : 'Rinvia'}
      cancelText="Annulla"
      onCancel={onClose}
      onOk={() => form.submit()}
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={salva}>
        <Form.Item
          name="dataRecupero"
          label="Data di recupero"
          extra={riprogramma ? undefined : 'Puoi lasciare la data vuota e sceglierla in seguito.'}
          rules={[{ required: riprogramma, message: 'Scegli la data di recupero' }]}
          {...propsCampoData}
        >
          <DataPicker />
        </Form.Item>
        {dataScelta && (
          <Form.Item
            name="oraRecupero"
            label="Ora di recupero (facoltativa)"
            rules={[{ pattern: REGEX_ORA, message: 'Usa il formato HH:mm' }]}
          >
            <Input placeholder="15:30" />
          </Form.Item>
        )}
        {!riprogramma && (
          <Form.Item name="motivo" label="Motivo (facoltativo)">
            <Input.TextArea rows={2} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
