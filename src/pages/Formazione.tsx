import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Empty, Segmented, Space, Tag, Typography } from 'antd'
import { ThunderboltOutlined, ClearOutlined, InstagramOutlined } from '@ant-design/icons'
import { useCollection } from '../hooks/useCollection'
import { PageHeader } from '../components/PageHeader'
import { coloreRuolo } from '../ruoli'
import { isGiocatore } from '../lib/categoria'
import {
  MODULI,
  generaFormazione,
  classificaModuli,
  fitGiocatore,
  qualita,
  type Assegnazione,
} from '../lib/formazione'
import { Campo } from './formazione/Campo'
import type { Allenamento, Giocatore } from '../types'

const { Text } = Typography

export function Formazione() {
  const giocatori = useCollection<Giocatore>('giocatori')
  const allenamenti = useCollection<Allenamento>('allenamenti')
  const navigate = useNavigate()

  const [moduloId, setModuloId] = useState(MODULI[0].id)
  const [selezione, setSelezione] = useState<Set<string>>(new Set())
  const [titolari, setTitolari] = useState<(Assegnazione | null)[] | null>(null)

  const modulo = MODULI.find((m) => m.id === moduloId) ?? MODULI[0]

  // presenze cumulative agli allenamenti (spinta minore nella scelta)
  const presenze = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of allenamenti.items) {
      for (const [id, presente] of Object.entries(a.presenze)) {
        if (presente) c[id] = (c[id] ?? 0) + 1
      }
    }
    return c
  }, [allenamenti.items])

  // solo i giocatori tesserati (con numero di tessera), niente dirigenti puri né infortunati
  const tesserati = useMemo(
    () =>
      giocatori.items
        .filter((g) => isGiocatore(g) && !!g.tessera && !g.infortunato)
        .sort((a, b) => `${a.cognome}${a.nome}`.localeCompare(`${b.cognome}${b.nome}`)),
    [giocatori.items],
  )
  const infortunati = useMemo(
    () => giocatori.items.filter((g) => isGiocatore(g) && !!g.tessera && g.infortunato),
    [giocatori.items],
  )

  const byId = useMemo(() => new Map(tesserati.map((g) => [g.id, g])), [tesserati])
  const disponibili = useMemo(() => tesserati.filter((g) => selezione.has(g.id)), [tesserati, selezione])

  // quanto rende ciascun modulo con i disponibili scelti (per consigliare)
  const valModuli = useMemo(
    () => (disponibili.length ? classificaModuli(disponibili, presenze) : []),
    [disponibili, presenze],
  )
  const valById = useMemo(() => new Map(valModuli.map((v) => [v.modulo.id, v.val])), [valModuli])
  const consigliatoId = valModuli[0]?.modulo.id
  const labelConsigliato = MODULI.find((m) => m.id === consigliatoId)?.label

  const maxPres = Math.max(0, ...Object.values(presenze))
  const panchina = useMemo(() => {
    if (!titolari) return []
    const schierati = new Set(titolari.map((a) => a?.giocatoreId).filter(Boolean) as string[])
    return disponibili
      .filter((g) => !schierati.has(g.id))
      .sort((a, b) => qualita(b, presenze, maxPres) - qualita(a, presenze, maxPres))
      .map((g) => g.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titolari, disponibili, presenze])

  function toggle(id: string) {
    setSelezione((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function genera(id = moduloId) {
    const m = MODULI.find((x) => x.id === id) ?? MODULI[0]
    const f = generaFormazione(m, disponibili, presenze)
    setTitolari(f.titolari)
  }

  function cambiaModulo(id: string) {
    setModuloId(id)
    if (titolari) genera(id) // se ho già una formazione, la ricalcolo sul nuovo modulo
  }

  function rimuovi(slot: number) {
    setTitolari((t) => t?.map((a, i) => (i === slot ? null : a)) ?? null)
  }
  function assegna(slot: number, gid: string) {
    const g = byId.get(gid)
    if (!g) return
    const fit = fitGiocatore(g, modulo.slots[slot].role)
    setTitolari((t) => t?.map((a, i) => (i === slot ? { giocatoreId: gid, fit } : a)) ?? null)
  }

  const nSchierati = titolari ? titolari.filter(Boolean).length : 0
  const nVuoti = titolari ? titolari.length - nSchierati : 0

  /** Passa l'undici alla pagina Grafiche IG (tipo «Formazione»). */
  function grafIG() {
    if (!titolari) return
    const payload = {
      creata: Date.now(),
      modulo: modulo.label,
      titolari: titolari
        .map((a, i) =>
          a
            ? {
                nome: byId.get(a.giocatoreId)?.cognome || byId.get(a.giocatoreId)?.nome || '—',
                role: modulo.slots[i].role,
                numero: byId.get(a.giocatoreId)?.numeroMaglia,
                x: modulo.slots[i].x,
                y: modulo.slots[i].y,
              }
            : null,
        )
        .filter(Boolean),
      panchina: panchina.map((id) => byId.get(id)?.cognome || byId.get(id)?.nome || '—'),
    }
    sessionStorage.setItem('usriolunato:grafFormazione', JSON.stringify(payload))
    navigate('/social?kind=formazione')
  }

  if (tesserati.length === 0) {
    return (
      <>
        <PageHeader titolo="Formazione" />
        <Empty description="Servono giocatori con tessera: aggiungili nella Rosa (con numero di tessera) e assegna loro un ruolo." />
      </>
    )
  }

  return (
    <>
      <PageHeader
        titolo="Formazione"
        sottotitolo="Scegli il modulo, spunta i disponibili e genero titolari e panchina in base a ruolo, bravura e presenze"
      />

      <Card title="Modulo" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <Segmented
            value={moduloId}
            onChange={(v) => cambiaModulo(v as string)}
            options={MODULI.map((m) => {
              const v = valById.get(m.id)
              return {
                value: m.id,
                label: (
                  <span className="modulo-opt">
                    {m.label}
                    {v && (
                      <span className={`modulo-badge${v.vuoti === 0 && v.emergenze === 0 ? ' ok' : ''}`}>
                        {v.pieni}
                      </span>
                    )}
                  </span>
                ),
              }
            })}
          />
        </div>
        {consigliatoId && (
          <div className="modulo-consiglio">
            {consigliatoId === moduloId ? (
              <Text type="secondary">
                ✓ È il modulo che sfrutta meglio i tuoi {disponibili.length} disponibili.
              </Text>
            ) : (
              <>
                <Text type="secondary">
                  Con questi disponibili rende meglio il <b>{labelConsigliato}</b>.
                </Text>
                <Button size="small" type="link" style={{ padding: 0 }} onClick={() => cambiaModulo(consigliatoId)}>
                  Usa {labelConsigliato}
                </Button>
              </>
            )}
            <div className="modulo-hint">Il numero su ogni modulo = titolari schierabili con la tua rosa.</div>
          </div>
        )}
      </Card>

      <Card
        title={`Disponibili · ${selezione.size}/${tesserati.length}`}
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button size="small" onClick={() => setSelezione(new Set(tesserati.map((g) => g.id)))}>
              Tutti
            </Button>
            <Button size="small" onClick={() => setSelezione(new Set())} disabled={selezione.size === 0}>
              Nessuno
            </Button>
          </Space>
        }
      >
        <Space size={[8, 8]} wrap>
          {tesserati.map((g) => {
            const on = selezione.has(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={`presenza-chip${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(g.id)}
              >
                {g.cognome} {g.nome[0] ? g.nome[0] + '.' : ''}
                {g.ruoloPreferito && (
                  <span style={{ opacity: 0.75, fontSize: 12, marginLeft: 2 }}>· {g.ruoloPreferito}</span>
                )}
              </button>
            )
          })}
        </Space>
        {infortunati.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              🚑 Esclusi perché infortunati:{' '}
              {infortunati.map((g) => `${g.cognome}${g.rientroInfortunio ? ` (rientro ${g.rientroInfortunio.split('-').reverse().join('/')})` : ''}`).join(', ')}
            </Text>
          </div>
        )}
      </Card>

      <Space wrap style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          disabled={disponibili.length === 0}
          onClick={() => genera()}
        >
          {titolari ? 'Rigenera' : 'Genera formazione'}
        </Button>
        {titolari && (
          <Button icon={<ClearOutlined />} onClick={() => setTitolari(null)}>
            Cancella
          </Button>
        )}
        {titolari && nSchierati > 0 && (
          <Button icon={<InstagramOutlined />} onClick={grafIG}>
            Grafica IG
          </Button>
        )}
        {disponibili.length > 0 && !titolari && (
          <Text type="secondary">{disponibili.length} disponibili · modulo {modulo.label}</Text>
        )}
      </Space>

      {titolari && (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color="green">{nSchierati} titolari</Tag>
            {nVuoti > 0 && <Tag color="orange">{nVuoti} da scegliere</Tag>}
            <Tag>{panchina.length} in panchina</Tag>
          </Space>

          <Campo
            modulo={modulo}
            formazione={{ titolari, panchina }}
            byId={byId}
            presenze={presenze}
            onRimuovi={rimuovi}
            onAssegna={assegna}
          />

          <Card title="Panchina" style={{ marginTop: 16 }}>
            {panchina.length === 0 ? (
              <Text type="secondary">Nessuno in panchina.</Text>
            ) : (
              <Space size={[8, 8]} wrap>
                {panchina.map((id) => {
                  const g = byId.get(id)
                  if (!g) return null
                  return (
                    <span key={id} className="panchina-chip">
                      <b>{g.cognome}</b>
                      {g.ruoloPreferito && (
                        <Tag color={coloreRuolo(g.ruoloPreferito)} style={{ margin: 0 }}>
                          {g.ruoloPreferito}
                        </Tag>
                      )}
                      {g.bravura ? <span className="panchina-stelle">★{g.bravura}</span> : null}
                    </span>
                  )
                })}
              </Space>
            )}
          </Card>
        </>
      )}
    </>
  )
}
