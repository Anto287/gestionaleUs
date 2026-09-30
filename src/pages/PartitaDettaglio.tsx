import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  App as AntApp,
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
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, AimOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { formatData } from '../lib/format'
import { isGiocatore } from '../lib/categoria'
import { REGEX_ORA, problemiPartita, sommaEventi } from '../lib/partita'
import { COLORI } from '../lib/chart'
import { EventoEditor } from './partite/EventoEditor'
import { FormazioneCampo } from './partite/FormazioneCampo'
import { schedaDi } from '../lib/avversari'
import type { Avversario, EventoGol, Giocatore, Partita, Torneo } from '../types'

const { Text } = Typography

export function PartitaDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const partiteColl = useCollection<Partita>('partite')
  const { items, update } = partiteColl
  const giocatori = useCollection<Giocatore>('giocatori')
  const tornei = useCollection<Torneo>('tornei')
  const avversari = useCollection<Avversario>('avversari')
  const eliminaConUndo = useEliminaUndo()
  const { message } = AntApp.useApp()
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
  // si parte dal modulo dell'ultima partita di cui è stata segnata la formazione
  const moduloSuggerito = useMemo(
    () =>
      [...items]
        .filter((x) => x.formazione && x.id !== id)
        .sort((a, b) => b.data.localeCompare(a.data))[0]?.formazione?.modulo,
    [items, id],
  )
  const nomeDi = (gid: string) => {
    const g = rosa.find((x) => x.id === gid)
    return g ? `${g.cognome} ${g.nome}` : 'Ex tesserato'
  }
  // i dirigenti puri non giocano: si propongono solo i giocatori, ma chi è già
  // segnato (es. riclassificato dirigente in seguito) resta visibile col suo nome.
  // `esclusi` toglie chi è già nell'altro ruolo (titolare <-> subentrato).
  // Gli id di tesserati eliminati restano come "Ex tesserato" (non come UUID),
  // così si possono ancora togliere.
  const opzioniGiocatori = (selezionati: string[], esclusi: string[] = []) => [
    ...rosa
      .filter(
        (g) =>
          (isGiocatore(g) || selezionati.includes(g.id)) &&
          (!esclusi.includes(g.id) || selezionati.includes(g.id)),
      )
      .map((g) => ({ value: g.id, label: `${g.cognome} ${g.nome}` })),
    ...selezionati
      .filter((sid) => !rosa.some((g) => g.id === sid))
      .map((sid) => ({ value: sid, label: 'Ex tesserato' })),
  ]

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

  const programma = p.giocata === false
  const titolari = p.titolari ?? []
  const subentrati = p.subentrati ?? []
  const golMarcatori = sommaEventi(p.marcatori)
  const golAssist = sommaEventi(p.assist)
  const haEventi =
    (p.marcatori?.length ?? 0) +
      (p.assist?.length ?? 0) +
      (p.ammoniti?.length ?? 0) +
      (p.espulsi?.length ?? 0) >
    0
  const haFormazione = titolari.length + subentrati.length > 0 || !!p.formazione
  const problemi = problemiPartita(p, nomeDi)

  /** Apre la scheda della squadra avversaria (e la crea se non c'è ancora). */
  function apriScheda() {
    const scheda = schedaDi(avversari.items, p!.avversario)
    const sid = scheda?.id ?? avversari.add({ nome: p!.avversario.trim(), giocatori: [] })
    navigate(`/avversari/${sid}`)
  }

  function apriModifica() {
    // via i valori (e gli errori) di un'apertura precedente
    form.resetFields()
    form.setFieldsValue({ ...p!, amichevole: !!p!.amichevole, giocata: p!.giocata !== false })
    setModale(true)
  }
  function salvaModifica(v: Partial<Partita>) {
    const giocata = v.giocata !== false
    if (!giocata && (haEventi || haFormazione)) {
      message.error(
        'Per rimettere la partita in programma togli prima formazione, marcatori e cartellini.',
      )
      return
    }
    update(p!.id, {
      ...v,
      giocata,
      ora: v.ora?.trim() || undefined,
      avversario: (v.avversario ?? p!.avversario).trim(),
      torneoId: v.torneoId || undefined,
      amichevole: v.amichevole || undefined,
      golFatti: giocata ? (v.golFatti ?? 0) : 0,
      golSubiti: giocata ? (v.golSubiti ?? 0) : 0,
    })
    setModale(false)
  }

  const nomeTorneo = tornei.items.find((t) => t.id === p.torneoId)?.nome

  // tabellone: in trasferta il punteggio si legge coi padroni di casa a sinistra
  const noi = 'U.S. Riolunato'
  const nomeSinistra = p.inCasa ? noi : p.avversario
  const nomeDestra = p.inCasa ? p.avversario : noi
  const golSinistra = p.inCasa ? p.golFatti : p.golSubiti
  const golDestra = p.inCasa ? p.golSubiti : p.golFatti
  const esitoColore =
    p.golFatti > p.golSubiti ? COLORI.verde : p.golFatti < p.golSubiti ? COLORI.rosso : 'var(--testo-2)'
  const esitoTag = programma
    ? { color: 'gold', label: 'In programma' }
    : p.golFatti > p.golSubiti
      ? { color: 'success', label: 'Vittoria' }
      : p.golFatti < p.golSubiti
        ? { color: 'error', label: 'Sconfitta' }
        : { color: 'default', label: 'Pareggio' }
  const riepilogoMarcatori = (p.marcatori ?? [])
    .map((m) => `${nomeDi(m.giocatoreId)}${m.quantita > 1 ? ` ×${m.quantita}` : ''}`)
    .join(' · ')

  // per una partita in programma gli eventi non esistono ancora: le card si
  // mostrano solo se restano dati vecchi da ripulire
  const mostraEventi = !programma || haEventi

  const minGolFatti = Math.max(golMarcatori, golAssist)

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Text type="secondary">
            {formatData(p.data)}
            {p.ora ? ` · ore ${p.ora}` : ''} · {p.inCasa ? 'In casa' : 'In trasferta'}
            {nomeTorneo ? ` · ${nomeTorneo}` : ''}
            {p.amichevole ? ' · Amichevole' : ''}
          </Text>
          <Space>
            <Button icon={<AimOutlined />} onClick={apriScheda}>
              Scheda avversario
            </Button>
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

        <div className="tabellone">
          <span className="tabellone-squadra" style={{ textAlign: 'right' }} title={nomeSinistra}>
            {nomeSinistra}
          </span>
          <span
            className="tabellone-punteggio"
            style={{ color: programma ? 'var(--testo-2)' : esitoColore }}
          >
            {programma ? 'VS' : `${golSinistra} – ${golDestra}`}
          </span>
          <span className="tabellone-squadra" title={nomeDestra}>
            {nomeDestra}
          </span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Tag color={esitoTag.color} style={{ marginInlineEnd: 0 }}>
            {esitoTag.label}
          </Tag>
        </div>
        {!programma && riepilogoMarcatori && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary">⚽ {riepilogoMarcatori}</Text>
          </div>
        )}
        {p.note && (
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <Text type="secondary">{p.note}</Text>
          </div>
        )}
      </Card>

      {problemi.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Qualcosa non torna in questa partita"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problemi.map((testo) => (
                <li key={testo}>{testo}</li>
              ))}
            </ul>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        {!programma && (
          <Col span={24}>
            <FormazioneCampo
              p={p}
              rosa={rosa}
              moduloSuggerito={moduloSuggerito}
              onChange={(patch) => update(p.id, patch)}
            />
          </Col>
        )}
        {mostraEventi ? (
          <>
            <Col xs={24} md={12}>
              <Card title={`Marcatori${golMarcatori ? ` (${golMarcatori})` : ''}`} size="small">
                <EventoEditor
                  rosa={rosa}
                  value={p.marcatori ?? []}
                  max={p.golFatti}
                  onChange={(marcatori: EventoGol[]) => update(p.id, { marcatori })}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={`Assist${golAssist ? ` (${golAssist})` : ''}`} size="small">
                <EventoEditor
                  rosa={rosa}
                  value={p.assist ?? []}
                  max={p.golFatti}
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
          </>
        ) : (
          <Col span={24}>
            <Card size="small">
              <Text type="secondary">
                Partita in programma: dopo che è stata giocata, imposta il risultato da «Modifica»
                e qui segnerai formazione, marcatori e cartellini.
              </Text>
            </Card>
          </Col>
        )}
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
              <Form.Item
                label="Ora"
                name="ora"
                rules={[{ pattern: REGEX_ORA, message: 'Usa il formato 15:30' }]}
              >
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
          {(tornei.items.length > 0 || !!p.torneoId) && (
            <Form.Item label="Competizione (facoltativa)" name="torneoId">
              <Select
                allowClear
                placeholder="es. Campionato, Coppa…"
                options={[
                  ...tornei.items.map((t) => ({ value: t.id, label: t.nome })),
                  // competizione cancellata: niente UUID nel campo
                  ...(p.torneoId && !tornei.items.some((t) => t.id === p.torneoId)
                    ? [{ value: p.torneoId, label: 'Torneo eliminato' }]
                    : []),
                ]}
              />
            </Form.Item>
          )}
          <Form.Item label="Amichevole" name="amichevole" valuePropName="checked">
            <Switch />
          </Form.Item>
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
                <Form.Item
                  label="Gol fatti"
                  name="golFatti"
                  rules={[
                    {
                      validator: (_, v) =>
                        (v ?? 0) >= minGolFatti
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                `Fra marcatori e assist ne risultano già ${minGolFatti}: correggi prima quelli`,
                              ),
                            ),
                    },
                  ]}
                >
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
