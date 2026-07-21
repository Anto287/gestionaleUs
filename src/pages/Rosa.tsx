import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AutoComplete,
  Button,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Rate,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  MedicineBoxOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { useEliminaUndo } from '../hooks/useEliminaUndo'
import { useAggancioLista } from '../hooks/useAggancioLista'
import { PageHeader } from '../components/PageHeader'
import { FiltriDrawer, FiltroCampo } from '../components/FiltriDrawer'
import { DataPicker, propsCampoData } from '../components/DataPicker'
import { coloreRuolo, ordineRuolo, OPZIONI_RUOLI, RUOLO_BY_CODE, type Area } from '../ruoli'
import { statoCertificato } from '../lib/certificato'
import { statoQuota } from '../lib/quota'
import { esportaExcel } from '../lib/excel'
import { isDirigente, isExtra, isGiocatore, OPZIONI_CATEGORIA, OPZIONI_RUOLI_DIRIGENZA, LABEL_CATEGORIA } from '../lib/categoria'
import type { Allenamento, Giocatore } from '../types'

type Bozza = Pick<
  Giocatore,
  | 'nome'
  | 'cognome'
  | 'categoria'
  | 'ruoloDirigenza'
  | 'ruoloPreferito'
  | 'ruoliAdattati'
  | 'bravura'
  | 'numeroMaglia'
  | 'nascita'
  | 'tessera'
  | 'dataRilascio'
  | 'certificatoMedico'
  | 'scadenzaCertificato'
  | 'quotaPagata'
  | 'quotaImporto'
  | 'infortunato'
  | 'rientroInfortunio'
  | 'note'
>

export function Rosa() {
  const giocatori = useCollection<Giocatore>('giocatori')
  const { items, add, update } = giocatori
  const eliminaConUndo = useEliminaUndo()
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const { toolbarRef, offsetHeader } = useAggancioLista()
  const [modale, setModale] = useState(false)
  const [form] = Form.useForm()
  // chi è SOLO dirigente non ha campi da giocatore (ruoli, certificato, quota)
  const categoriaForm = Form.useWatch('categoria', form)
  const campiGiocatore = categoriaForm !== 'dirigente'
  const campiDirigente = categoriaForm === 'dirigente' || categoriaForm === 'entrambi'
  const infortunatoForm = Form.useWatch('infortunato', form)
  const [q, setQ] = useState('')
  const [repartoF, setRepartoF] = useState<Area | undefined>()
  const [ruoloF, setRuoloF] = useState<string | undefined>()
  const [categoriaF, setCategoriaF] = useState<string | undefined>()
  const [certF, setCertF] = useState<string | undefined>()
  const [quotaF, setQuotaF] = useState<string | undefined>()
  const [tesseraF, setTesseraF] = useState<string | undefined>()

  const nFiltri = [repartoF, ruoloF, categoriaF, certF, quotaF, tesseraF].filter(Boolean).length
  function azzeraFiltri() {
    setRepartoF(undefined)
    setRuoloF(undefined)
    setCategoriaF(undefined)
    setCertF(undefined)
    setQuotaF(undefined)
    setTesseraF(undefined)
  }

  /** Può giocare nel reparto? Conta il ruolo preferito e quelli adattati. */
  function inReparto(g: Giocatore, area: Area): boolean {
    return [g.ruoloPreferito, ...(g.ruoliAdattati ?? [])].some(
      (code) => code && RUOLO_BY_CODE[code]?.area === area,
    )
  }

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
        if (repartoF && !inReparto(g, repartoF)) return false
        if (ruoloF && g.ruoloPreferito !== ruoloF && !(g.ruoliAdattati ?? []).includes(ruoloF))
          return false
        if (categoriaF === 'giocatore' && !isGiocatore(g)) return false
        if (categoriaF === 'dirigente' && !isDirigente(g)) return false
        if (categoriaF === 'extra' && !isExtra(g)) return false
        if (certF && (!isGiocatore(g) || statoCertificato(g).stato !== certF)) return false
        if (quotaF && !isGiocatore(g)) return false
        if (quotaF === 'pagata' && !statoQuota(g).completa) return false
        if (quotaF === 'no' && statoQuota(g).completa) return false
        if (tesseraF === 'si' && !g.tessera) return false
        if (tesseraF === 'no' && g.tessera) return false
        return true
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordinati, q, repartoF, ruoloF, categoriaF, certF, quotaF, tesseraF],
  )

  function apriNuovo() {
    form.resetFields()
    form.setFieldsValue({
      certificatoMedico: false,
      quotaPagata: false,
      ruoliAdattati: [],
      categoria: 'giocatore',
    })
    setModale(true)
  }

  function salva(valori: Bozza) {
    // il form nasconde i campi che non riguardano la categoria scelta: qui si
    // scartano anche i valori rimasti da un cambio di categoria
    if (valori.categoria === 'dirigente') {
      valori = {
        ...valori,
        ruoloPreferito: undefined,
        ruoliAdattati: undefined,
        bravura: undefined,
        numeroMaglia: undefined,
        certificatoMedico: undefined,
        scadenzaCertificato: undefined,
        quotaPagata: undefined,
        quotaImporto: undefined,
        infortunato: undefined,
        rientroInfortunio: undefined,
      }
    }
    if (valori.categoria === 'giocatore' || valori.categoria === 'extra')
      valori = { ...valori, ruoloDirigenza: undefined }
    if (!valori.infortunato) valori = { ...valori, rientroInfortunio: undefined }
    add(valori)
    setModale(false)
  }

  // il click su Elimina (e sul suo Popconfirm) non deve aprire la scheda del giocatore
  const stopCell = { onCell: () => ({ onClick: (e: MouseEvent) => e.stopPropagation() }) }

  const columns = [
    {
      title: 'N.',
      key: 'numero',
      width: 56,
      align: 'center' as const,
      sorter: (a: Giocatore, b: Giocatore) => (a.numeroMaglia ?? 999) - (b.numeroMaglia ?? 999),
      render: (_: unknown, g: Giocatore) =>
        g.numeroMaglia != null ? <b style={{ fontVariantNumeric: 'tabular-nums' }}>{g.numeroMaglia}</b> : '—',
    },
    {
      title: 'Giocatore',
      key: 'nome',
      width: 240,
      sorter: (a: Giocatore, b: Giocatore) =>
        `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`),
      defaultSortOrder: 'ascend' as const,
      render: (_: unknown, g: Giocatore) => (
        <span>
          <span
            className="tronca"
            style={{ maxWidth: 160, fontWeight: 600 }}
            title={`${g.cognome} ${g.nome}`}
          >
            {g.cognome} {g.nome}
          </span>
          {isDirigente(g) && (
            <Tag color="purple" style={{ marginLeft: 8 }}>
              {g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}
            </Tag>
          )}
          {isExtra(g) && (
            <Tag color="cyan" style={{ marginLeft: 8 }}>
              Extra
            </Tag>
          )}
          {isGiocatore(g) && g.infortunato && (
            <Tag color="red" icon={<MedicineBoxOutlined />} style={{ marginLeft: 8 }}>
              Infortunato
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Ruolo',
      key: 'ruolo',
      width: 100,
      sorter: (a: Giocatore, b: Giocatore) =>
        (a.ruoloPreferito ?? '').localeCompare(b.ruoloPreferito ?? ''),
      render: (_: unknown, g: Giocatore) => {
        if (g.ruoloPreferito) return <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag>
        if (!isGiocatore(g) && g.ruoloDirigenza) return <Tag color="purple">{g.ruoloDirigenza}</Tag>
        return '—'
      },
    },
    {
      title: 'Adattato',
      key: 'adattati',
      width: 150,
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
      width: 80,
      sorter: (a: Giocatore, b: Giocatore) => (presenze[a.id] ?? 0) - (presenze[b.id] ?? 0),
      render: (_: unknown, g: Giocatore) => (isGiocatore(g) ? (presenze[g.id] ?? 0) : '—'),
    },
    {
      title: 'Certificato',
      key: 'cert',
      width: 140,
      sorter: (a: Giocatore, b: Giocatore) =>
        (a.scadenzaCertificato ?? '').localeCompare(b.scadenzaCertificato ?? ''),
      render: (_: unknown, g: Giocatore) => {
        if (!isGiocatore(g)) return '—'
        const s = statoCertificato(g)
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Tessera',
      key: 'tessera',
      width: 130,
      sorter: (a: Giocatore, b: Giocatore) => (a.tessera ?? '').localeCompare(b.tessera ?? ''),
      render: (_: unknown, g: Giocatore) =>
        g.tessera ? (
          <Tag color="default">{g.tessera}</Tag>
        ) : (
          <Tag color="orange" icon={<WarningOutlined />}>
            Mancante
          </Tag>
        ),
    },
    {
      title: 'Quota',
      key: 'quota',
      width: 100,
      sorter: (a: Giocatore, b: Giocatore) => Number(!!a.quotaPagata) - Number(!!b.quotaPagata),
      ...stopCell,
      render: (_: unknown, g: Giocatore) => {
        if (!isGiocatore(g)) return '—'
        const q = statoQuota(g)
        // con l'importo impostato lo stato deriva dai versamenti (scheda giocatore)
        if (q.totale) return <Tag color={q.completa ? 'green' : q.parziale ? 'orange' : 'red'}>{q.label}</Tag>
        return (
          <Switch
            size="small"
            checked={!!g.quotaPagata}
            checkedChildren="Pagata"
            unCheckedChildren="No"
            onChange={(v) => update(g.id, { quotaPagata: v })}
          />
        )
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
          onConfirm={() => eliminaConUndo(giocatori, g, `${g.cognome} ${g.nome} eliminato.`)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  /** Scarica la lista visibile (con i filtri applicati) in un foglio Excel. */
  function esporta() {
    esportaExcel('rosa.xlsx', [
      {
        nome: 'Rosa',
        righe: filtrati.map((g) => ({
          Cognome: g.cognome,
          Nome: g.nome,
          Categoria: LABEL_CATEGORIA[g.categoria ?? 'giocatore'],
          'Ruolo dirigenza': g.ruoloDirigenza ?? '',
          Ruolo: g.ruoloPreferito ?? '',
          'Ruoli adattati': (g.ruoliAdattati ?? []).join(', '),
          'N. maglia': g.numeroMaglia ?? '',
          Nascita: g.nascita ?? '',
          Tessera: g.tessera ?? '',
          'Rilascio tessera': g.dataRilascio ?? '',
          Certificato: isGiocatore(g) ? statoCertificato(g).label : '',
          'Scadenza certificato': g.scadenzaCertificato ?? '',
          Quota: isGiocatore(g) ? statoQuota(g).label : '',
          Infortunato: g.infortunato ? 'Sì' : '',
          'Presenze allenamenti': isGiocatore(g) ? (presenze[g.id] ?? 0) : '',
          Note: g.note ?? '',
        })),
      },
    ])
  }

  return (
    <>
      <PageHeader
        titolo="Rosa"
        sottotitolo={`${items.length} tesserati · tocca un nome per la scheda`}
        azioni={
          items.length > 0 && (
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={esporta}>
                Esporta Excel
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={apriNuovo}>
                Aggiungi giocatore
              </Button>
            </Space>
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
          <div className="lista-toolbar" ref={toolbarRef}>
            <Input
              className="lista-cerca"
              allowClear
              autoComplete="off"
              prefix={<SearchOutlined />}
              placeholder="Cerca giocatore"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <FiltriDrawer count={nFiltri} onReset={azzeraFiltri}>
              <FiltroCampo label="Reparto">
                <Select
                  allowClear
                  placeholder="Tutti i reparti"
                  value={repartoF}
                  onChange={setRepartoF}
                  options={[
                    { value: 'Portiere', label: 'Portieri' },
                    { value: 'Difesa', label: 'Difensori' },
                    { value: 'Centrocampo', label: 'Centrocampisti' },
                    { value: 'Attacco', label: 'Attaccanti' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Ruolo">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tutti i ruoli"
                  value={ruoloF}
                  onChange={setRuoloF}
                  options={OPZIONI_RUOLI}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Categoria">
                <Select
                  allowClear
                  placeholder="Tutte"
                  value={categoriaF}
                  onChange={setCategoriaF}
                  options={[
                    { value: 'giocatore', label: 'Giocatori' },
                    { value: 'dirigente', label: 'Dirigenti' },
                    { value: 'extra', label: 'Giocatori Extra' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Certificato">
                <Select
                  allowClear
                  placeholder="Qualsiasi stato"
                  value={certF}
                  onChange={setCertF}
                  options={[
                    { value: 'valido', label: 'Certificato valido' },
                    { value: 'scadenza', label: 'In scadenza' },
                    { value: 'critico', label: 'Da regolarizzare' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Quota">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={quotaF}
                  onChange={setQuotaF}
                  options={[
                    { value: 'pagata', label: 'Quota pagata' },
                    { value: 'no', label: 'Quota non pagata' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
              <FiltroCampo label="Tessera">
                <Select
                  allowClear
                  placeholder="Qualsiasi"
                  value={tesseraF}
                  onChange={setTesseraF}
                  options={[
                    { value: 'si', label: 'Con tessera' },
                    { value: 'no', label: 'Senza tessera' },
                  ]}
                  style={{ width: '100%' }}
                />
              </FiltroCampo>
            </FiltriDrawer>
          </div>
          {isMobile ? (
            <div className="lista-mobile">
              {filtrati.map((g) => {
                const cert = statoCertificato(g)
                return (
                  <div key={g.id} className="lista-card" onClick={() => navigate(`/rosa/${g.id}`)}>
                    <div className="lista-card-top">
                      <div>
                        <div className="lista-card-title">
                          {g.numeroMaglia != null && (
                            <span style={{ color: 'var(--testo-2)', marginRight: 6 }}>{g.numeroMaglia}</span>
                          )}
                          {g.cognome} {g.nome}
                          {isDirigente(g) && (
                            <Tag color="purple" style={{ marginLeft: 6 }}>
                              {g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}
                            </Tag>
                          )}
                          {isExtra(g) && (
                            <Tag color="cyan" style={{ marginLeft: 6 }}>
                              Extra
                            </Tag>
                          )}
                          {isGiocatore(g) && g.infortunato && (
                            <Tag color="red" style={{ marginLeft: 6 }}>
                              Infortunato
                            </Tag>
                          )}
                        </div>
                        <div className="lista-card-meta" style={{ marginTop: 5 }}>
                          {g.ruoloPreferito ? (
                            <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag>
                          ) : !isGiocatore(g) ? (
                            g.ruoloDirigenza && <Tag color="purple">{g.ruoloDirigenza}</Tag>
                          ) : (
                            <span>Ruolo n.d.</span>
                          )}
                          {g.ruoliAdattati?.map((r) => (
                            <Tag key={r} color={coloreRuolo(r)} style={{ opacity: 0.7 }}>
                              {r}
                            </Tag>
                          ))}
                        </div>
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Popconfirm
                          title={`Eliminare ${g.nome} ${g.cognome}?`}
                          okText="Elimina"
                          cancelText="Annulla"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => eliminaConUndo(giocatori, g, `${g.cognome} ${g.nome} eliminato.`)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </span>
                    </div>
                    <div className="lista-card-meta">
                      {isGiocatore(g) && <Tag color={cert.color}>{cert.label}</Tag>}
                      {g.tessera ? (
                        <Tag>{g.tessera}</Tag>
                      ) : (
                        <Tag color="orange" icon={<WarningOutlined />}>
                          Tessera mancante
                        </Tag>
                      )}
                      {isGiocatore(g) && <span>· {presenze[g.id] ?? 0} pres.</span>}
                      {isGiocatore(g) &&
                        (statoQuota(g).totale ? (
                          <span className="lista-card-fine">
                            Quota{' '}
                            <Tag
                              color={statoQuota(g).completa ? 'green' : statoQuota(g).parziale ? 'orange' : 'red'}
                              style={{ marginInlineEnd: 0 }}
                            >
                              {statoQuota(g).label}
                            </Tag>
                          </span>
                        ) : (
                          <span className="lista-card-fine" onClick={(e) => e.stopPropagation()}>
                            Quota
                            <Switch
                              size="small"
                              checked={!!g.quotaPagata}
                              checkedChildren="Sì"
                              unCheckedChildren="No"
                              onChange={(v) => update(g.id, { quotaPagata: v })}
                            />
                          </span>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Table
              rowKey="id"
              dataSource={filtrati}
              columns={columns}
              pagination={false}
              size="middle"
              sticky={{ offsetHeader }}
              scroll={{ x: 'max-content' }}
              onRow={(g) => ({ onClick: () => navigate(`/rosa/${g.id}`), style: { cursor: 'pointer' } })}
            />
          )}
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
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="Cognome"
            name="cognome"
            rules={[{ required: true, message: 'Inserisci il cognome' }]}
          >
            <Input autoComplete="off" />
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
              <Form.Item label="Bravura" name="bravura" tooltip="Quanto è forte, da 1 a 5: pesa nel generatore di formazione">
                <Rate />
              </Form.Item>
              <Form.Item
                label="Numero di maglia (facoltativo)"
                name="numeroMaglia"
                tooltip="Precompila la distinta e la grafica della formazione"
              >
                <InputNumber min={1} max={99} style={{ width: '100%' }} placeholder="es. 10" />
              </Form.Item>
            </>
          )}
          <Form.Item label="Data di nascita (gg/mm/aaaa)" name="nascita">
            <Input placeholder="es. 12/03/2001" autoComplete="off" />
          </Form.Item>
          <Form.Item label="N. tessera" name="tessera">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="Data rilascio tessera" name="dataRilascio">
            <Input placeholder="es. 01/09/2026" autoComplete="off" />
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
                tooltip="Se impostato, lo stato della quota deriva dai versamenti registrati nella scheda"
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
            <Input.TextArea rows={3} placeholder="es. taglia maglia, recapiti, incarichi…" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
