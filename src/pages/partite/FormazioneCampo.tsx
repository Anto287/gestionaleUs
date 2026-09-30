import { useState } from 'react'
import { App, Button, Card, Empty, InputNumber, Modal, Popconfirm, Select, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons'
import { ErbaCampo, posizioneSlot } from '../../components/ErbaCampo'
import { RUOLO_BY_CODE, areaHex } from '../../ruoli'
import { MODULI } from '../../lib/formazione'
import { isGiocatore } from '../../lib/categoria'
import { sommaEventi } from '../../lib/partita'
import {
  cambiOrdinati,
  cambiaModulo,
  catenaPosto,
  eventiDi,
  formazioneIniziale,
  inCampo,
  moduloDa,
  sincronizza,
  subentratiSenzaCambio,
} from '../../lib/formazionePartita'
import type { Cambio, EventoGol, FormazionePartita, Giocatore, Partita } from '../../types'

const { Text } = Typography

/** Le icone degli eventi di un giocatore: palloni, assist, cartellini. */
function IconeEventi({ p, id }: { p: Partita; id: string }) {
  const e = eventiDi(p, id)
  if (!e.gol && !e.assist && !e.giallo && !e.rosso) return null
  return (
    <span className="pt-icone">
      {e.gol > 0 && (
        <span className="pt-gol" title={`${e.gol} gol`}>
          ⚽{e.gol > 1 && <b>{e.gol}</b>}
        </span>
      )}
      {e.assist > 0 && (
        <span className="pt-assist" title={`${e.assist} assist`}>
          A{e.assist > 1 && <b>{e.assist}</b>}
        </span>
      )}
      {e.giallo && <span className="pt-cartellino giallo" title="Ammonito" />}
      {e.rosso && <span className="pt-cartellino rosso" title="Espulso" />}
    </span>
  )
}

function minutoTesto(m?: number) {
  return m !== undefined ? ` ${m}'` : ''
}

type Aperto = { tipo: 'posto'; indice: number } | { tipo: 'giocatore'; id: string } | null

/**
 * La formazione della partita sul campo: modulo, titolari nei posti, cambi e
 * le icone di gol, assist e cartellini su ogni giocatore. Tocca un posto per
 * scegliere chi ci giocava, segnare gli eventi o chi l'ha sostituito.
 */
export function FormazioneCampo({
  p,
  rosa,
  moduloSuggerito,
  onChange,
}: {
  p: Partita
  rosa: Giocatore[]
  /** il modulo dell'ultima partita segnata, per partire da quello */
  moduloSuggerito?: string
  onChange: (patch: Partial<Partita>) => void
}) {
  const { message } = App.useApp()
  const [aperto, setAperto] = useState<Aperto>(null)
  const [nuovo, setNuovo] = useState<Partial<Cambio>>({})

  const byId = new Map(rosa.map((g) => [g.id, g]))
  const cognome = (id: string) => {
    const g = byId.get(id)
    return g ? g.cognome || g.nome : 'Ex tesserato'
  }
  const nomeIntero = (id: string) => {
    const g = byId.get(id)
    return g ? `${g.cognome} ${g.nome}` : 'Ex tesserato'
  }
  const opzione = (id: string) => {
    const g = byId.get(id)
    return { value: id, label: `${g?.numeroMaglia ? `${g.numeroMaglia} · ` : ''}${nomeIntero(id)}` }
  }

  const f = p.formazione
  if (!f) {
    return (
      <Card title="Formazione in campo" size="small">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            (p.titolari ?? []).length
              ? 'Ci sono già dei titolari segnati: mettili sul campo col modulo e aggiungi i cambi.'
              : 'Segna modulo, titolari e cambi: sul campo compaiono anche gol e cartellini.'
          }
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => onChange(sincronizza(p, formazioneIniziale(p, moduloDa(moduloSuggerito), rosa)))}
          >
            Segna la formazione
          </Button>
        </Empty>
      </Card>
    )
  }

  const modulo = moduloDa(f.modulo)
  const cambi = cambiOrdinati(f.cambi)
  const entrati = new Set(f.cambi.map((c) => c.entra))
  const inCampoOra = inCampo(f)
  const liberi = subentratiSenzaCambio(p)
  const giocatoriRosa = rosa.filter(isGiocatore)

  function salva(nuova: FormazionePartita) {
    onChange(sincronizza(p, nuova))
  }

  function mettiNelPosto(indice: number, id: string | null) {
    const posti = f!.posti.map((x, i) => (i === indice ? id : x === id ? null : x))
    // chi era nel posto esce anche dai cambi in cui usciva lui
    const vecchio = f!.posti[indice]
    const cambiPuliti = vecchio && vecchio !== id ? f!.cambi.filter((c) => c.esce !== vecchio) : f!.cambi
    salva({ ...f!, posti, cambi: cambiPuliti })
  }

  function aggiungiCambio(c: Partial<Cambio>) {
    if (!c.esce || !c.entra) return
    salva({ ...f!, cambi: [...f!.cambi, { esce: c.esce, entra: c.entra, minuto: c.minuto ?? undefined }] })
    setNuovo({})
  }

  function togliCambio(c: Cambio) {
    // se chi era entrato è poi uscito a sua volta, cade anche quel cambio
    const via = new Set<Cambio>([c])
    let dentro = c.entra
    for (;;) {
      const dopo = f!.cambi.find((x) => x.esce === dentro && !via.has(x))
      if (!dopo) break
      via.add(dopo)
      dentro = dopo.entra
    }
    salva({ ...f!, cambi: f!.cambi.filter((x) => !via.has(x)) })
  }

  // --- eventi (gli stessi delle card Marcatori/Assist/Cartellini) ---
  function conQuantita(lista: EventoGol[] | undefined, id: string, delta: number): EventoGol[] {
    const out = (lista ?? []).map((e) => ({ ...e }))
    const e = out.find((x) => x.giocatoreId === id)
    if (e) e.quantita += delta
    else if (delta > 0) out.push({ giocatoreId: id, quantita: delta })
    return out.filter((x) => x.quantita > 0)
  }
  function cambiaGol(id: string, delta: number, campo: 'marcatori' | 'assist') {
    if (delta > 0 && sommaEventi(p[campo]) >= p.golFatti) {
      message.warning(
        `Sono già segnati ${campo === 'marcatori' ? 'tutti i gol' : 'assist per tutti i gol'} (${p.golFatti}): alza i gol fatti da «Modifica».`,
      )
      return
    }
    onChange({ [campo]: conQuantita(p[campo], id, delta) })
  }
  function cambiaCartellino(id: string, campo: 'ammoniti' | 'espulsi') {
    const lista = p[campo] ?? []
    onChange({ [campo]: lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id] })
  }

  function editorEventi(id: string) {
    const e = eventiDi(p, id)
    const contatore = (etichetta: string, n: number, campo: 'marcatori' | 'assist') => (
      <Space size={4}>
        <Text style={{ width: 52, display: 'inline-block' }}>{etichetta}</Text>
        <Button size="small" onClick={() => cambiaGol(id, -1, campo)} disabled={!n}>
          −
        </Button>
        <Text strong style={{ minWidth: 18, textAlign: 'center', display: 'inline-block' }}>
          {n}
        </Text>
        <Button size="small" onClick={() => cambiaGol(id, 1, campo)}>
          +
        </Button>
      </Space>
    )
    return (
      <div className="pt-editor-eventi">
        {contatore('⚽ Gol', e.gol, 'marcatori')}
        {contatore('Assist', e.assist, 'assist')}
        <Space size={6} wrap>
          <Tag.CheckableTag checked={e.giallo} onChange={() => cambiaCartellino(id, 'ammoniti')}>
            <span className="pt-cartellino giallo" /> Giallo
          </Tag.CheckableTag>
          <Tag.CheckableTag checked={e.rosso} onChange={() => cambiaCartellino(id, 'espulsi')}>
            <span className="pt-cartellino rosso" /> Rosso
          </Tag.CheckableTag>
        </Space>
      </div>
    )
  }

  // chi si può ancora mettere: non già titolare né entrato
  const liberiPerPosto = (attuale: string | null) =>
    giocatoriRosa
      .filter((g) => g.id === attuale || (!f.posti.includes(g.id) && !entrati.has(g.id)))
      .map((g) => opzione(g.id))
  const liberiPerEntrare = giocatoriRosa
    .filter((g) => !f.posti.includes(g.id) && !entrati.has(g.id))
    .map((g) => opzione(g.id))

  function contenutoModale() {
    if (!aperto) return null
    if (aperto.tipo === 'giocatore') {
      return editorEventi(aperto.id)
    }
    const i = aperto.indice
    const slot = modulo.slots[i]
    const titolare = f!.posti[i]
    const catena = titolare ? catenaPosto(titolare, f!.cambi) : []
    const ultimo = catena[catena.length - 1]?.id
    const puoUscire = ultimo && inCampoOra.includes(ultimo)
    return (
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Titolare · {RUOLO_BY_CODE[slot.role]?.label ?? slot.role}
          </Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            placeholder="Chi giocava qui dal 1'"
            showSearch
            optionFilterProp="label"
            allowClear
            value={titolare ?? undefined}
            options={liberiPerPosto(titolare)}
            onChange={(v) => mettiNelPosto(i, v ?? null)}
          />
        </div>
        {titolare && editorEventi(titolare)}

        {catena.slice(1).map((c, k) => {
          const cambio = f!.cambi.find((x) => x.entra === c.id && x.esce === catena[k].id)
          return (
            <div key={c.id} className="pt-modale-cambio">
              <div className="pt-modale-cambio-testa">
                <span>
                  <span className="pt-freccia entra">▲</span> <b>{nomeIntero(c.id)}</b>
                  <Text type="secondary">
                    {' '}
                    per {cognome(catena[k].id)}
                    {minutoTesto(c.minuto)}
                  </Text>
                </span>
                {cambio && (
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => togliCambio(cambio)} />
                )}
              </div>
              {editorEventi(c.id)}
            </div>
          )
        })}

        {puoUscire && (
          <div className="pt-modale-sostituisci">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <SwapOutlined /> Sostituisci {cognome(ultimo)}
            </Text>
            <Space.Compact style={{ width: '100%', marginTop: 4 }}>
              <Select
                style={{ flex: 1 }}
                placeholder="Chi entra"
                showSearch
                optionFilterProp="label"
                value={nuovo.esce === ultimo ? nuovo.entra : undefined}
                options={liberiPerEntrare}
                onChange={(v) => setNuovo({ ...nuovo, esce: ultimo, entra: v })}
              />
              <InputNumber
                style={{ width: 84 }}
                min={1}
                max={130}
                placeholder="min"
                value={nuovo.esce === ultimo ? nuovo.minuto : undefined}
                onChange={(v) => setNuovo({ ...nuovo, esce: ultimo, minuto: v ?? undefined })}
              />
              <Button
                type="primary"
                disabled={nuovo.esce !== ultimo || !nuovo.entra}
                onClick={() => aggiungiCambio(nuovo)}
              >
                Ok
              </Button>
            </Space.Compact>
          </div>
        )}
      </Space>
    )
  }

  const titoloModale = !aperto
    ? ''
    : aperto.tipo === 'giocatore'
      ? nomeIntero(aperto.id)
      : `${modulo.slots[aperto.indice].role}${f.posti[aperto.indice] ? ` · ${nomeIntero(f.posti[aperto.indice]!)}` : ''}`

  return (
    <Card
      title="Formazione in campo"
      size="small"
      extra={
        <Space size={6}>
          <Select
            size="small"
            style={{ width: 104 }}
            value={modulo.id}
            options={MODULI.map((m) => ({ value: m.id, label: m.label }))}
            onChange={(id) => salva(cambiaModulo(f, moduloDa(id), rosa))}
          />
          <Popconfirm
            title="Togliere la formazione dal campo?"
            description="Titolari e subentrati restano segnati."
            okText="Togli"
            cancelText="Annulla"
            onConfirm={() => onChange({ formazione: undefined })}
          >
            <Button size="small" type="text" icon={<DeleteOutlined />} aria-label="Togli formazione" />
          </Popconfirm>
        </Space>
      }
    >
      <div className="pt-griglia">
        <div className="campo pt-campo">
          <ErbaCampo />
          <div className="campo-slots">
            {modulo.slots.map((s, i) => {
              const { left, top } = posizioneSlot(s)
              const titolare = f.posti[i]
              if (!titolare) {
                return (
                  <button
                    key={i}
                    type="button"
                    className="campo-token campo-token-vuoto"
                    style={{ left, top }}
                    onClick={() => setAperto({ tipo: 'posto', indice: i })}
                  >
                    <span className="token-disc vuoto" style={{ borderColor: areaHex(s.role), color: '#fff' }}>
                      +
                    </span>
                    <span className="token-nome vuoto">{s.role}</span>
                  </button>
                )
              }
              const catena = catenaPosto(titolare, f.cambi)
              const g = byId.get(titolare)
              return (
                <button
                  key={i}
                  type="button"
                  className="campo-token pt-token"
                  style={{ left, top }}
                  onClick={() => setAperto({ tipo: 'posto', indice: i })}
                >
                  <span className="pt-disc-wrap">
                    <span className="token-disc" style={{ background: areaHex(s.role) }}>
                      {g?.numeroMaglia ?? s.role}
                    </span>
                    {catena.length > 1 && (
                      <span className="pt-uscito" title={`Uscito${minutoTesto(catena[1].minuto)}`}>
                        ▼{catena[1].minuto !== undefined ? catena[1].minuto : ''}
                      </span>
                    )}
                    <IconeEventi p={p} id={titolare} />
                  </span>
                  <span className="token-nome">{cognome(titolare)}</span>
                  {catena.slice(1).map((c) => (
                    <span key={c.id} className="pt-entrato">
                      <span className="pt-freccia entra">▲</span>
                      {cognome(c.id)}
                      {minutoTesto(c.minuto)}
                      <IconeEventi p={p} id={c.id} />
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-lato">
          <Text strong>Cambi{cambi.length ? ` (${cambi.length})` : ''}</Text>
          {cambi.length === 0 ? (
            <div>
              <Text type="secondary">Nessun cambio segnato.</Text>
            </div>
          ) : (
            <ul className="pt-cambi">
              {cambi.map((c, k) => (
                <li key={`${c.esce}-${c.entra}-${k}`}>
                  <span className="pt-cambi-min">{c.minuto !== undefined ? `${c.minuto}'` : '—'}</span>
                  <span className="pt-cambi-chi">
                    <span>
                      <span className="pt-freccia entra">▲</span>{' '}
                      <button type="button" className="pt-link" onClick={() => setAperto({ tipo: 'giocatore', id: c.entra })}>
                        {nomeIntero(c.entra)}
                      </button>
                      <IconeEventi p={p} id={c.entra} />
                    </span>
                    <span>
                      <span className="pt-freccia esce">▼</span> {nomeIntero(c.esce)}
                    </span>
                  </span>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => togliCambio(c)} />
                </li>
              ))}
            </ul>
          )}

          <div className="pt-nuovo-cambio">
            <Select
              size="small"
              placeholder="Esce"
              showSearch
              optionFilterProp="label"
              value={nuovo.esce}
              options={inCampoOra.map(opzione)}
              onChange={(v) => setNuovo({ ...nuovo, esce: v })}
            />
            <Select
              size="small"
              placeholder="Entra"
              showSearch
              optionFilterProp="label"
              value={nuovo.entra}
              options={liberiPerEntrare}
              onChange={(v) => setNuovo({ ...nuovo, entra: v })}
            />
            <Space.Compact size="small" style={{ width: '100%' }}>
              <InputNumber
                size="small"
                min={1}
                max={130}
                placeholder="minuto"
                style={{ flex: 1 }}
                value={nuovo.minuto}
                onChange={(v) => setNuovo({ ...nuovo, minuto: v ?? undefined })}
              />
              <Button
                size="small"
                type="primary"
                icon={<SwapOutlined />}
                disabled={!nuovo.esce || !nuovo.entra}
                onClick={() => aggiungiCambio(nuovo)}
              >
                Aggiungi
              </Button>
            </Space.Compact>
          </div>

          {liberi.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Subentrati senza cambio segnato
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {liberi.map((id) => (
                  <Tag
                    key={id}
                    closable
                    onClose={() => onChange({ subentrati: (p.subentrati ?? []).filter((x) => x !== id) })}
                    onClick={() => setAperto({ tipo: 'giocatore', id })}
                    style={{ cursor: 'pointer' }}
                  >
                    ▲ {nomeIntero(id)} <IconeEventi p={p} id={id} />
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <div className="pt-legenda">
            <span>⚽ gol</span>
            <span>
              <span className="pt-assist">A</span> assist
            </span>
            <span>
              <span className="pt-cartellino giallo" /> giallo
            </span>
            <span>
              <span className="pt-cartellino rosso" /> rosso
            </span>
            <span>
              <span className="pt-freccia esce">▼</span> esce
            </span>
            <span>
              <span className="pt-freccia entra">▲</span> entra
            </span>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tocca un giocatore sul campo per cambiarlo, segnargli gol e cartellini o sostituirlo.
          </Text>
        </div>
      </div>

      <Modal
        open={aperto !== null}
        title={titoloModale}
        onCancel={() => {
          setAperto(null)
          setNuovo({})
        }}
        footer={null}
        width={420}
        destroyOnHidden
      >
        {contenutoModale()}
      </Modal>
    </Card>
  )
}
