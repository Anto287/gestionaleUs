import { useMemo, useState } from 'react'
import { Button, Card, Col, Row, Empty, Flex, Popconfirm, Select, Typography } from 'antd'
import { FileAddOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { formatData } from '../lib/format'
import type { Distinta, Divisa, Giocatore, TestataDistinta, Torneo } from '../types'
import { SelectorList, type Convocato } from './distinte/SelectorList'
import { TestataForm } from './distinte/TestataForm'
import { PdfExporter } from './distinte/PdfExporter'

const { Text } = Typography

/** Etichetta di una distinta salvata per l'elenco a tendina. */
function etichetta(d: Distinta): string {
  const dataGara = d.data ? formatData(d.data, true) : ''
  const avversario = d.avversario || 'senza avversario'
  const salvata = d.creata ? formatData(d.creata.slice(0, 10), true) : ''
  return `${dataGara ? dataGara + ' · ' : ''}${avversario}${salvata ? ` — salvata il ${salvata}` : ''}`
}

export function Distinte() {
  const { items } = useCollection<Giocatore>('giocatori')
  const tornei = useCollection<Torneo>('tornei')
  const divise = useCollection<Divisa>('divise')
  const distinte = useCollection<Distinta>('distinte')

  const [selezionati, setSelezionati] = useState<Convocato[]>([])
  const [testata, setTestata] = useState<TestataDistinta>({})
  // distinta ripresa dall'elenco (se presente, la stampa la aggiorna)
  const [caricataId, setCaricataId] = useState<string | null>(null)
  const [initTestata, setInitTestata] = useState<TestataDistinta | undefined>()
  const [initConvocati, setInitConvocati] = useState<Convocato[] | undefined>()
  // bump a ogni carica/nuova per rimontare i form con i nuovi valori di partenza
  const [resetKey, setResetKey] = useState(0)

  const rows = useMemo(() => {
    // gli omonimi (stesso nome E cognome) si distinguono con la data di nascita
    const conteggio = new Map<string, number>()
    for (const g of items) {
      const k = `${g.nome} ${g.cognome}`.trim().toLowerCase()
      conteggio.set(k, (conteggio.get(k) ?? 0) + 1)
    }
    return items.map((g) => {
      const nomeCompleto = `${g.nome} ${g.cognome}`.trim()
      const omonimi = (conteggio.get(nomeCompleto.toLowerCase()) ?? 0) > 1
      return {
        Id: g.id,
        Nome: g.nome,
        Cognome: g.cognome,
        Categoria: g.categoria ?? 'giocatore',
        DataNascita: g.nascita ?? '',
        Tessera: g.tessera ?? '',
        DataRilascio: g.dataRilascio ?? '',
        // etichetta mostrata nel selettore (la stampa usa i campi qui sopra)
        Etichetta: omonimi
          ? `${nomeCompleto} (${g.nascita ? formatData(g.nascita, true) : 'senza data di nascita'})`
          : nomeCompleto,
      }
    })
  }, [items])

  const salvate = useMemo(
    () => [...distinte.items].sort((a, b) => (b.creata ?? '').localeCompare(a.creata ?? '')),
    [distinte.items],
  )

  function carica(id: string) {
    const d = distinte.items.find((x) => x.id === id)
    if (!d) return
    // rinfresca i dati anagrafici dei convocati con la rosa attuale (tessera rinnovata, ecc.),
    // tenendo numero di maglia e ruoli salvati
    const rowById = new Map(rows.map((r) => [String(r.Id), r]))
    const convocati = (d.convocati ?? []).map((c) => {
      const row = rowById.get(String(c.id))
      return row ? { ...c, raw: row, label: row.Etichetta } : c
    })
    setCaricataId(id)
    setInitTestata(d.testata ?? {})
    setInitConvocati(convocati)
    setTestata(d.testata ?? {})
    setSelezionati(convocati)
    setResetKey((k) => k + 1)
  }

  function nuova() {
    setCaricataId(null)
    setInitTestata(undefined)
    setInitConvocati(undefined)
    setTestata({})
    setSelezionati([])
    setResetKey((k) => k + 1)
  }

  function elimina() {
    if (!caricataId) return
    distinte.remove(caricataId)
    nuova()
  }

  // salva la distinta dopo la stampa: aggiorna quella ripresa, altrimenti ne crea una nuova
  function salvaStampata() {
    const record = {
      creata: new Date().toISOString(),
      data: testata.dataGara,
      avversario: testata.avversario,
      testata,
      convocati: selezionati,
    }
    if (caricataId) distinte.update(caricataId, record)
    else setCaricataId(distinte.add(record))
  }

  return (
    <>
      <PageHeader titolo="Distinte" sottotitolo="Genera la distinta di gara da stampare" />

      {items.length === 0 ? (
        <Empty description="Aggiungi prima i giocatori nella sezione Rosa: qui li convochi per la distinta." />
      ) : (
        <>
          {salvate.length > 0 && (
            <Card title="Distinte salvate" style={{ marginBottom: 16 }}>
              <Flex wrap gap={12} align="center">
                <Select
                  style={{ minWidth: 280, flex: 1 }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Riprendi una distinta salvata…"
                  value={caricataId ?? undefined}
                  onChange={(id) => (id ? carica(id) : nuova())}
                  options={salvate.map((d) => ({ value: d.id, label: etichetta(d) }))}
                />
                <Button icon={<FileAddOutlined />} onClick={nuova}>
                  Nuova distinta
                </Button>
                <Popconfirm
                  title="Eliminare questa distinta salvata?"
                  okText="Elimina"
                  cancelText="Annulla"
                  okButtonProps={{ danger: true }}
                  onConfirm={elimina}
                  disabled={!caricataId}
                >
                  <Button danger icon={<DeleteOutlined />} disabled={!caricataId}>
                    Elimina
                  </Button>
                </Popconfirm>
              </Flex>
              {caricataId && (
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Stai modificando una distinta salvata: «Stampa» la aggiorna. Usa «Nuova distinta» per
                  partirne una da zero.
                </Text>
              )}
            </Card>
          )}

          <Card title="Testata della distinta (facoltativa)" style={{ marginBottom: 16 }}>
            <TestataForm
              key={resetKey}
              tornei={tornei.items}
              divise={divise.items}
              initialTestata={initTestata}
              onChange={setTestata}
            />
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={16}>
              <Card title="Convoca i giocatori">
                <SelectorList
                  key={resetKey}
                  rows={rows}
                  initialList={initConvocati}
                  onListChange={setSelezionati}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card title="Stampa / Esporta">
                <PdfExporter list={selezionati} testata={testata} onStampato={salvaStampata} />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    Il PDF con la distinta ufficiale verrà scaricato e la distinta salvata: potrai
                    riprenderla dall'elenco qui sopra per modificarla e ristamparla. I campi di testata
                    lasciati vuoti restano righe da compilare a mano.
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  )
}
