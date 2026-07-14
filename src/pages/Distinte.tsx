import { useMemo, useState } from 'react'
import { Card, Col, Row, Empty, Typography } from 'antd'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import type { Giocatore } from '../types'
import { SelectorList, type Convocato } from './distinte/SelectorList'
import { PdfExporter } from './distinte/PdfExporter'

const { Text } = Typography

export function Distinte() {
  const { items } = useCollection<Giocatore>('giocatori')
  const [selezionati, setSelezionati] = useState<Convocato[]>([])

  const rows = useMemo(
    () =>
      items.map((g) => ({
        Nome: g.nome,
        Cognome: g.cognome,
        Categoria: g.categoria ?? 'giocatore',
        DataNascita: g.nascita ?? '',
        Tessera: g.tessera ?? '',
        DataRilascio: g.dataRilascio ?? '',
      })),
    [items],
  )

  return (
    <>
      <PageHeader titolo="Distinte" sottotitolo="Genera la distinta di gara da stampare" />

      {items.length === 0 ? (
        <Empty description="Aggiungi prima i giocatori nella sezione Rosa: qui li convochi per la distinta." />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Card title="Convoca i giocatori">
              <SelectorList rows={rows} onListChange={setSelezionati} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="Stampa / Esporta">
              <PdfExporter list={selezionati} />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">
                  Il PDF con la distinta ufficiale verrà scaricato. Data di nascita, numero tessera
                  e data di rilascio arrivano dalla scheda di ciascun tesserato nella Rosa.
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </>
  )
}
