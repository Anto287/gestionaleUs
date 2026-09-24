import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Avatar, Button, Empty, Input, Segmented, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CheckOutlined,
  CloudUploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { PalloneSpinner } from '../components/PalloneSpinner'
import { StatCard } from '../components/StatCard'
import { AnteprimaFile } from '../components/archivio/AnteprimaFile'
import { CaricaFile, type AperturaCarica } from '../components/archivio/CaricaFile'
import { useArchivio } from '../data/ArchivioProvider'
import { useCollection } from '../hooks/useCollection'
import { parole, type FileArchivio } from '../lib/archivio'
import type { Giocatore } from '../types'
import { iniziali } from '../lib/format'

const { Text, Paragraph } = Typography

type Genere = 'foto' | 'fronte' | 'retro'

const ETICHETTA: Record<Genere, string> = { foto: 'Foto', fronte: 'Fronte', retro: 'Retro' }

/**
 * Archivio tesserati: le due cartelle del Drive con i documenti
 * (fronte/retro) e le foto. Qui si vede a colpo d'occhio chi è a posto e
 * chi no, e si caricano file nuovi anche per chi non è in rosa.
 */
export function Archivio() {
  const { stato, errore, scheda, miniatura, chiediMiniature, aggancio, documenti, foto, ricarica } =
    useArchivio()
  const { items: rosa } = useCollection<Giocatore>('giocatori')
  const navigate = useNavigate()
  const [vista, setVista] = useState<'rosa' | 'orfani'>('rosa')
  const [q, setQ] = useState('')
  const [anteprima, setAnteprima] = useState<FileArchivio | null>(null)
  const [carica, setCarica] = useState<AperturaCarica | null>(null)

  const tesserati = useMemo(
    () =>
      [...rosa].sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`)),
    [rosa],
  )

  const cerca = parole(q)
  const filtrati = tesserati.filter((g) =>
    cerca.every((p) => parole(`${g.nome} ${g.cognome}`).some((w) => w.startsWith(p))),
  )
  const orfani = aggancio.orfani.filter(
    (o) => !q.trim() || o.file.nome.toLowerCase().includes(q.trim().toLowerCase()),
  )

  // le miniature dei documenti si chiedono solo quando si guarda la pagina
  useEffect(() => {
    chiediMiniature(filtrati.slice(0, 40).flatMap((g) => [scheda(g.id).foto?.id]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato, q])

  const conFoto = tesserati.filter((g) => scheda(g.id).foto).length
  const completi = tesserati.filter((g) => {
    const s = scheda(g.id)
    return s.fronte && s.retro
  }).length

  const azioni = (
    <Space>
      <Tooltip title="Rileggi le cartelle dal Drive">
        <Button icon={<ReloadOutlined />} onClick={ricarica} aria-label="Aggiorna" />
      </Tooltip>
      <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setCarica({ genere: 'foto' })}>
        Carica
      </Button>
    </Space>
  )

  if (stato === 'assente') {
    return (
      <>
        <PageHeader titolo="Archivio tesserati" sottotitolo="Documenti e foto dei tesserati." />
        <Alert
          type="info"
          showIcon
          message="Manca un pezzo dello script sul Drive"
          description={
            <Paragraph style={{ marginBottom: 0 }}>
              Per collegare le due cartelle (documenti e foto) va incollato nell'editor Apps Script il
              contenuto di <Text code>docs/apps-script-archivio.gs</Text>, seguendo le istruzioni scritte
              in cima al file. Fino ad allora il resto dell'app funziona normalmente.
            </Paragraph>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        titolo="Archivio tesserati"
        sottotitolo="Documenti e foto, agganciati ai tesserati per nome e cognome."
        azioni={azioni}
      />

      {stato === 'errore' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Non riesco a leggere le cartelle dell'archivio"
          description={errore}
          action={
            <Button size="small" onClick={ricarica}>
              Riprova
            </Button>
          }
        />
      )}

      {stato === 'carico' ? (
        <div className="anteprima-caricamento">
          <PalloneSpinner />
          <Text type="secondary">Leggo l'archivio dal Drive…</Text>
        </div>
      ) : (
        <>
          <div className="archivio-stat">
            <StatCard icona={<CheckOutlined />} titolo="Con foto" valore={`${conFoto}/${tesserati.length}`} />
            <StatCard
              icona={<CheckOutlined />}
              titolo="Documento completo"
              valore={`${completi}/${tesserati.length}`}
              sotto="fronte e retro"
            />
            <StatCard
              icona={<CloudUploadOutlined />}
              titolo="File in archivio"
              valore={documenti.length + foto.length}
              sotto={`${documenti.length} documenti · ${foto.length} foto`}
            />
          </div>

          <Space wrap className="filtri-inline" style={{ margin: '16px 0' }}>
            <Segmented
              value={vista}
              onChange={(v) => setVista(v as 'rosa' | 'orfani')}
              options={[
                { value: 'rosa', label: 'Tesserati in rosa' },
                { value: 'orfani', label: `Senza corrispondenza (${aggancio.orfani.length})` },
              ]}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cerca…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </Space>

          {vista === 'rosa' ? (
            filtrati.length === 0 ? (
              <Empty description="Nessun tesserato" />
            ) : (
              <div className="lista-mobile">
                {filtrati.map((g) => {
                  const s = scheda(g.id)
                  return (
                    <div key={g.id} className="lista-card archivio-riga">
                      <Avatar
                        src={miniatura(s.foto?.id)}
                        size={40}
                        style={{ background: 'var(--rosso)', fontSize: 15, flex: 'none' }}
                      >
                        {iniziali(g)}
                      </Avatar>
                      <button
                        type="button"
                        className="archivio-riga-nome"
                        onClick={() => navigate(`/rosa/${g.id}`)}
                      >
                        {g.cognome} {g.nome}
                      </button>
                      <Space size={[6, 6]} wrap>
                        {(['foto', 'fronte', 'retro'] as Genere[]).map((genere) => {
                          const file = s[genere]
                          const apri = () =>
                            file ? setAnteprima(file) : setCarica({ genere, idTesserato: g.id })
                          return (
                            <Tag
                              key={genere}
                              color={file ? 'green' : undefined}
                              icon={file ? <CheckOutlined /> : <PlusOutlined />}
                              style={{ cursor: 'pointer', margin: 0 }}
                              role="button"
                              tabIndex={0}
                              aria-label={`${ETICHETTA[genere]} di ${g.cognome} ${g.nome}: ${file ? 'apri' : 'carica'}`}
                              onClick={apri}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  apri()
                                }
                              }}
                            >
                              {ETICHETTA[genere]}
                            </Tag>
                          )
                        })}
                      </Space>
                    </div>
                  )
                })}
              </div>
            )
          ) : orfani.length === 0 ? (
            <Empty description="Tutti i file dell'archivio sono agganciati a un tesserato" />
          ) : (
            <>
              <Paragraph type="secondary">
                File che non corrispondono a nessuno in rosa: gente di altri anni, oppure nomi scritti in
                modo diverso. Restano dove sono, l'app non li tocca.
              </Paragraph>
              <div className="lista-mobile">
                {orfani.map((o) => (
                  <div key={o.file.id} className="lista-card archivio-riga">
                    <button
                      type="button"
                      className="archivio-riga-nome"
                      onClick={() => setAnteprima(o.file)}
                    >
                      {o.file.nome}
                    </button>
                    <Space size={[6, 6]} wrap>
                      {o.omonimia && <Tag color="orange">Omonimi: manca la data</Tag>}
                      <Tag>{o.cartella === 'foto' ? 'Foto' : 'Documenti'}</Tag>
                    </Space>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <AnteprimaFile file={anteprima} onChiudi={() => setAnteprima(null)} />
      <CaricaFile apertura={carica} onChiudi={() => setCarica(null)} />
    </>
  )
}
