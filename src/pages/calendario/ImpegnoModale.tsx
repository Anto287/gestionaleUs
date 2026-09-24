import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import { DeleteOutlined, RightOutlined } from '@ant-design/icons'
import { useCollection } from '../../hooks/useCollection'
import { useEliminaUndo } from '../../hooks/useEliminaUndo'
import { DataPicker, propsCampoData } from '../../components/DataPicker'
import { formatData, oggiIso } from '../../lib/format'
import { REGEX_ORA, sommaEventi } from '../../lib/partita'
import type { Allenamento, Appuntamento, Partita, Torneo } from '../../types'

const { Text } = Typography

/**
 * Cosa si apre dal calendario: un impegno nuovo (partita o allenamento, che
 * finiscono nelle rispettive sezioni) oppure uno esistente da modificare.
 */
export type Selezione =
  | { kind: 'nuovo'; data: string }
  | { kind: 'partita'; item: Partita }
  | { kind: 'allenamento'; item: Allenamento }
  | { kind: 'appuntamento'; item: Appuntamento }

type Tipo = 'partita' | 'allenamento' | 'appuntamento'

interface Valori {
  data: string
  ora?: string
  avversario?: string
  inCasa?: boolean
  torneoId?: string
  amichevole?: boolean
  giocata?: boolean
  golFatti?: number
  golSubiti?: number
  luogo?: string
  note?: string
}

const pulisci = (s?: string) => s?.trim() || undefined

export function ImpegnoModale({
  selezione,
  onClose,
  onSalvato,
}: {
  selezione: Selezione | null
  onClose: () => void
  /** data dell'impegno salvato: il calendario ci si sposta */
  onSalvato: (data: string) => void
}) {
  const partiteColl = useCollection<Partita>('partite')
  const allenamentiColl = useCollection<Allenamento>('allenamenti')
  const appuntamentiColl = useCollection<Appuntamento>('appuntamenti')
  const tornei = useCollection<Torneo>('tornei')
  const eliminaConUndo = useEliminaUndo()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm<Valori>()
  const giocata = Form.useWatch('giocata', form)
  const [tipoNuovo, setTipoNuovo] = useState<'partita' | 'allenamento'>('partita')

  const nuovo = selezione?.kind === 'nuovo'
  const tipo: Tipo = !selezione || selezione.kind === 'nuovo' ? tipoNuovo : selezione.kind
  const idCorrente = selezione && selezione.kind !== 'nuovo' ? selezione.item.id : undefined
  // la partita che si modifica: marcatori e formazione restano quelli segnati nel dettaglio
  const partitaInModifica = selezione?.kind === 'partita' ? selezione.item : undefined
  const minGolFatti = partitaInModifica
    ? Math.max(sommaEventi(partitaInModifica.marcatori), sommaEventi(partitaInModifica.assist))
    : 0
  const haEventi =
    !!partitaInModifica &&
    (minGolFatti > 0 ||
      (partitaInModifica.ammoniti?.length ?? 0) > 0 ||
      (partitaInModifica.espulsi?.length ?? 0) > 0 ||
      (partitaInModifica.titolari?.length ?? 0) > 0 ||
      (partitaInModifica.subentrati?.length ?? 0) > 0)

  // una sola seduta al giorno (come nella pagina Allenamenti)
  const dateOccupate = useMemo(
    () => new Set(allenamentiColl.items.filter((s) => s.id !== idCorrente).map((s) => s.data)),
    [allenamentiColl.items, idCorrente],
  )

  useEffect(() => {
    if (!selezione) return
    form.resetFields()
    if (selezione.kind === 'nuovo') {
      form.setFieldsValue({
        data: selezione.data,
        inCasa: true,
        amichevole: false,
        // una data passata è quasi sempre una partita già giocata
        giocata: selezione.data < oggiIso(),
        golFatti: 0,
        golSubiti: 0,
      })
    } else if (selezione.kind === 'partita') {
      const p = selezione.item
      form.setFieldsValue({ ...p, giocata: p.giocata !== false, amichevole: !!p.amichevole })
    } else {
      form.setFieldsValue(selezione.item)
    }
  }, [selezione, form])

  function salva(v: Valori) {
    if (tipo === 'allenamento') {
      if (dateOccupate.has(v.data)) {
        message.warning(`Il ${formatData(v.data, true)} c'è già un allenamento.`)
        return
      }
      const dati = { data: v.data, note: pulisci(v.note) }
      if (nuovo) allenamentiColl.add({ ...dati, presenze: {} })
      else allenamentiColl.update(idCorrente!, dati)
    } else if (tipo === 'partita') {
      const g = v.giocata !== false
      // come nel dettaglio partita: una partita con eventi non torna "in programma"
      if (!g && haEventi) {
        message.error('Per rimettere la partita in programma togli prima formazione, marcatori e cartellini (dal dettaglio).')
        return
      }
      const dati = {
        data: v.data,
        ora: pulisci(v.ora),
        avversario: v.avversario!.trim(),
        inCasa: v.inCasa !== false,
        torneoId: v.torneoId || undefined,
        amichevole: v.amichevole || undefined,
        giocata: g,
        golFatti: g ? (v.golFatti ?? 0) : 0,
        golSubiti: g ? (v.golSubiti ?? 0) : 0,
        note: pulisci(v.note),
      }
      if (nuovo) partiteColl.add({ ...dati, marcatori: [], assist: [], ammoniti: [], espulsi: [] })
      else partiteColl.update(idCorrente!, dati)
    } else {
      appuntamentiColl.update(idCorrente!, {
        data: v.data,
        ora: pulisci(v.ora),
        avversario: v.avversario!.trim(),
        inCasa: v.inCasa !== false,
        luogo: pulisci(v.luogo),
      })
    }
    message.success(
      nuovo
        ? tipo === 'allenamento'
          ? 'Allenamento aggiunto: lo trovi anche nella sezione Allenamenti'
          : 'Partita aggiunta: la trovi anche nella sezione Partite'
        : tipo === 'partita'
          ? 'Partita aggiornata'
          : tipo === 'allenamento'
            ? 'Allenamento aggiornato'
            : 'Impegno aggiornato',
    )
    onSalvato(v.data)
    onClose()
  }

  function elimina() {
    if (!selezione || selezione.kind === 'nuovo') return
    if (selezione.kind === 'partita')
      eliminaConUndo(partiteColl, selezione.item, `Partita con ${selezione.item.avversario} eliminata.`)
    else if (selezione.kind === 'allenamento')
      eliminaConUndo(allenamentiColl, selezione.item, `Allenamento del ${formatData(selezione.item.data, true)} eliminato.`)
    else eliminaConUndo(appuntamentiColl, selezione.item, 'Impegno eliminato.')
    onClose()
  }

  function apriDettaglio() {
    if (!selezione || selezione.kind === 'nuovo') return
    onClose()
    if (selezione.kind === 'partita') navigate(`/partite/${selezione.item.id}`)
    else if (selezione.kind === 'allenamento') navigate(`/allenamenti?seduta=${selezione.item.id}`)
  }

  const titolo = nuovo
    ? 'Nuovo impegno'
    : tipo === 'partita'
      ? 'Modifica partita'
      : tipo === 'allenamento'
        ? 'Modifica allenamento'
        : 'Modifica impegno'

  const avvisoElimina =
    selezione?.kind === 'partita'
      ? 'Eliminare la partita? Spariscono anche marcatori, cartellini e presenze.'
      : selezione?.kind === 'allenamento'
        ? 'Eliminare la seduta? Spariscono anche le presenze segnate.'
        : 'Eliminare l’impegno?'

  return (
    <Modal
      title={titolo}
      open={!!selezione}
      onCancel={onClose}
      maskClosable={false}
      forceRender
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          <Space wrap>
            {!nuovo && (
              <Popconfirm
                title={avvisoElimina}
                okText="Elimina"
                cancelText="Annulla"
                okButtonProps={{ danger: true }}
                onConfirm={elimina}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Elimina
                </Button>
              </Popconfirm>
            )}
            {!nuovo && tipo !== 'appuntamento' && (
              <Button icon={<RightOutlined />} onClick={apriDettaglio}>
                {tipo === 'partita' ? 'Apri partita' : 'Segna presenze'}
              </Button>
            )}
          </Space>
          <Space wrap>
            <Button onClick={onClose}>Annulla</Button>
            <Button type="primary" onClick={() => form.submit()}>
              {nuovo ? 'Aggiungi' : 'Salva'}
            </Button>
          </Space>
        </div>
      }
    >
      {nuovo && (
        <Segmented
          block
          style={{ marginBottom: 16 }}
          value={tipoNuovo}
          onChange={(v) => setTipoNuovo(v as 'partita' | 'allenamento')}
          options={[
            { value: 'partita', label: 'Partita' },
            { value: 'allenamento', label: 'Allenamento' },
          ]}
        />
      )}
      <Form form={form} layout="vertical" onFinish={salva} requiredMark={false}>
        <Row gutter={12}>
          <Col span={tipo === 'allenamento' ? 24 : 14}>
            <Form.Item label="Data" name="data" rules={[{ required: true, message: 'Scegli la data' }]} {...propsCampoData}>
              <DataPicker
                disabledDate={
                  tipo === 'allenamento' ? (d) => dateOccupate.has(d.format('YYYY-MM-DD')) : undefined
                }
              />
            </Form.Item>
          </Col>
          {tipo !== 'allenamento' && (
            <Col span={10}>
              <Form.Item
                label="Ora (facoltativa)"
                name="ora"
                rules={[{ pattern: REGEX_ORA, message: 'Usa il formato 15:30' }]}
              >
                <Input placeholder="es. 15:30" autoComplete="off" />
              </Form.Item>
            </Col>
          )}
        </Row>

        {tipo !== 'allenamento' && (
          <>
            <Form.Item
              label="Avversario"
              name="avversario"
              rules={[{ required: true, whitespace: true, message: 'Inserisci l’avversario' }]}
            >
              <Input placeholder="es. Pievepelago" autoComplete="off" />
            </Form.Item>
            <Form.Item label="Dove" name="inCasa">
              <Select
                options={[
                  { value: true, label: 'In casa' },
                  { value: false, label: 'In trasferta' },
                ]}
              />
            </Form.Item>
          </>
        )}

        {tipo === 'appuntamento' && (
          <Form.Item label="Luogo (facoltativo)" name="luogo">
            <Input placeholder="es. Comunale di Riolunato" autoComplete="off" />
          </Form.Item>
        )}

        {tipo === 'partita' && (
          <>
            {tornei.items.length > 0 && (
              <Form.Item label="Competizione (facoltativa)" name="torneoId">
                <Select
                  allowClear
                  placeholder="es. Campionato, Coppa…"
                  options={[
                    ...tornei.items.map((t) => ({ value: t.id, label: t.nome })),
                    // una competizione eliminata: meglio dirlo che mostrarne il codice
                    ...(partitaInModifica?.torneoId && !tornei.items.some((t) => t.id === partitaInModifica.torneoId)
                      ? [{ value: partitaInModifica.torneoId, label: 'Competizione eliminata' }]
                      : []),
                  ]}
                />
              </Form.Item>
            )}
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item label="Amichevole" name="amichevole" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Già giocata" name="giocata" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            {giocata !== false && (
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="Gol fatti"
                    name="golFatti"
                    rules={[
                      {
                        validator: (_, v) =>
                          (v ?? 0) >= minGolFatti
                            ? Promise.resolve()
                            : Promise.reject(new Error(`Fra marcatori e assist ne risultano già ${minGolFatti}`)),
                      },
                    ]}
                  >
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Gol subiti" name="golSubiti">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </>
        )}

        {tipo !== 'appuntamento' && (
          <Form.Item label="Note (facoltative)" name="note">
            <Input
              placeholder={tipo === 'allenamento' ? 'es. seduta atletica, campo sintetico…' : undefined}
              autoComplete="off"
            />
          </Form.Item>
        )}
      </Form>
      <Text type="secondary" style={{ fontSize: 12.5 }}>
        {tipo === 'partita'
          ? 'La partita compare anche nella sezione Partite: marcatori, cartellini e formazione si segnano da lì.'
          : tipo === 'allenamento'
            ? 'La seduta compare anche nella sezione Allenamenti, dove si segnano le presenze. Una sola seduta al giorno.'
            : 'Impegno inserito a mano: compare anche nella grafica IG «Mese».'}
      </Text>
    </Modal>
  )
}
