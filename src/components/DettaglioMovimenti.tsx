import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Button, Drawer, Empty, Grid, Typography } from 'antd'
import { WalletOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { formatData, formatEuro } from '../lib/format'
import type { Movimento } from '../types'

const { Text } = Typography

/** Quale dettaglio dei conti mostrare nel pannello. */
export type VistaDettaglio = 'cassa' | 'daIncassare' | 'daPagare'

/** quanti movimenti di cassa si mostrano per volta ("Mostra altri" carica i successivi) */
const PASSO = 20

const VERDE = '#3f7a52'
const ROSSO = '#b1352f'
const OCRA = '#9a6b1e'

const TESTI: Record<VistaDettaglio, { titolo: string; totale: string; nota: string; vuoto: string }> = {
  cassa: {
    titolo: 'Movimenti di cassa',
    totale: 'Totale in cassa',
    nota: 'Solo i movimenti saldati: sono quelli che muovono la cassa.',
    vuoto: 'Nessun movimento saldato.',
  },
  daIncassare: {
    titolo: 'Soldi da incassare',
    totale: 'Totale da incassare',
    nota: 'Entrate registrate ma non ancora incassate, raggruppate per chi ce le deve.',
    vuoto: 'Niente da incassare: tutte le entrate sono state riscosse.',
  },
  daPagare: {
    titolo: 'Soldi da dare',
    totale: 'Totale da dare',
    nota: 'Uscite registrate ma non ancora pagate, raggruppate per chi le aspetta.',
    vuoto: 'Nessun pagamento in sospeso.',
  },
}

interface Gruppo {
  chi: string
  /** true se il nome viene dalla controparte (le righe mostrano la descrizione) */
  daControparte: boolean
  movimenti: Movimento[]
  totale: number
}

/** Movimenti aperti del tipo scelto, raggruppati per controparte (o descrizione). */
function raggruppaAperti(movimenti: Movimento[], tipo: 'entrata' | 'uscita'): Gruppo[] {
  const gruppi = new Map<string, Gruppo>()
  const aperti = movimenti
    .filter((m) => !m.saldato && m.tipo === tipo)
    .sort((a, b) => a.data.localeCompare(b.data))
  for (const m of aperti) {
    const controparte = m.controparte?.trim()
    const chi = controparte || m.descrizione
    const chiave = `${controparte ? 'c' : 'd'}:${chi.toLowerCase()}`
    const g = gruppi.get(chiave) ?? { chi, daControparte: !!controparte, movimenti: [], totale: 0 }
    g.movimenti.push(m)
    g.totale += m.importo
    gruppi.set(chiave, g)
  }
  return [...gruppi.values()].sort((a, b) => b.totale - a.totale)
}

/**
 * Pannello di dettaglio delle card dei conti: ultimi movimenti di cassa,
 * soldi da incassare o da dare (per controparte). Su schermi piccoli si apre
 * dal basso come un foglio, su desktop da destra.
 */
export function DettaglioMovimenti({
  vista,
  movimenti,
  onClose,
  onApriMovimento,
  conLinkConti,
}: {
  /** quale dettaglio mostrare; null = pannello chiuso */
  vista: VistaDettaglio | null
  movimenti: Movimento[]
  onClose: () => void
  /** se presente, i movimenti si possono toccare (es. per modificarli nei Conti) */
  onApriMovimento?: (m: Movimento) => void
  /** mostra il pulsante "Apri Conti" (per le pagine fuori dai Conti) */
  conLinkConti?: boolean
}) {
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.sm
  const [visibili, setVisibili] = useState(PASSO)
  // ricorda l'ultima vista aperta: il contenuto non sparisce durante l'animazione di chiusura
  const [memoVista, setMemoVista] = useState<VistaDettaglio>('cassa')
  useEffect(() => {
    if (vista) {
      setMemoVista(vista)
      setVisibili(PASSO)
    }
  }, [vista])
  const v = vista ?? memoVista

  const cassa = useMemo(() => {
    const chrono = movimenti.filter((m) => m.saldato).sort((a, b) => a.data.localeCompare(b.data))
    let saldo = 0
    const righe = chrono.map((m) => {
      saldo += m.tipo === 'entrata' ? m.importo : -m.importo
      return { m, saldo }
    })
    return { righe: righe.reverse(), saldo }
  }, [movimenti])

  const gruppi = useMemo(
    () => (v === 'cassa' ? [] : raggruppaAperti(movimenti, v === 'daIncassare' ? 'entrata' : 'uscita')),
    [movimenti, v],
  )

  const totale = v === 'cassa' ? cassa.saldo : gruppi.reduce((s, g) => s + g.totale, 0)
  const coloreTotale =
    v === 'cassa' ? (cassa.saldo < 0 ? ROSSO : undefined) : v === 'daIncassare' ? VERDE : OCRA

  /** rende una riga toccabile (click + tastiera) solo se c'è un'azione da fare */
  function propsRiga(m: Movimento) {
    if (!onApriMovimento) return { className: 'dettaglio-riga' }
    return {
      className: 'dettaglio-riga dettaglio-riga-cliccabile',
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => onApriMovimento(m),
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onApriMovimento(m)
        }
      },
    }
  }

  return (
    <Drawer
      title={TESTI[v].titolo}
      open={!!vista}
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'right'}
      width={440}
      height="78%"
      styles={isMobile ? { content: { borderRadius: '16px 16px 0 0' } } : undefined}
      footer={
        conLinkConti ? (
          <Button
            type="primary"
            block
            icon={<WalletOutlined />}
            onClick={() => {
              onClose()
              navigate('/conti')
            }}
          >
            Apri Conti
          </Button>
        ) : undefined
      }
    >
      <div className="dettaglio-totale">
        <Text type="secondary">{TESTI[v].totale}</Text>
        <div className="dettaglio-totale-num" style={coloreTotale ? { color: coloreTotale } : undefined}>
          {formatEuro(totale)}
        </div>
        <Text type="secondary" className="dettaglio-nota">
          {TESTI[v].nota}
          {onApriMovimento && ' Tocca un movimento per aprirlo.'}
        </Text>
      </div>

      {v === 'cassa' ? (
        cassa.righe.length === 0 ? (
          <Empty description={TESTI[v].vuoto} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <div>
              {cassa.righe.slice(0, visibili).map(({ m, saldo }) => (
                <div key={m.id} {...propsRiga(m)}>
                  <div className="dettaglio-riga-sx">
                    <div className="dettaglio-riga-titolo">{m.descrizione}</div>
                    <div className="dettaglio-riga-meta">
                      {formatData(m.data, true)}
                      {m.controparte ? ` · ${m.controparte}` : ''}
                    </div>
                  </div>
                  <div className="dettaglio-riga-dx">
                    <span
                      className="dettaglio-importo"
                      style={{ color: m.tipo === 'entrata' ? VERDE : ROSSO }}
                    >
                      {m.tipo === 'entrata' ? '+ ' : '− '}
                      {formatEuro(m.importo)}
                    </span>
                    <span className="dettaglio-cassa">cassa {formatEuro(saldo)}</span>
                  </div>
                </div>
              ))}
            </div>
            {cassa.righe.length > visibili && (
              <Button block style={{ marginTop: 10 }} onClick={() => setVisibili((n) => n + PASSO)}>
                Mostra altri ({cassa.righe.length - visibili})
              </Button>
            )}
          </>
        )
      ) : gruppi.length === 0 ? (
        <Empty description={TESTI[v].vuoto} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        gruppi.map((g) => (
          <div key={`${g.daControparte ? 'c' : 'd'}:${g.chi.toLowerCase()}`} className="dettaglio-gruppo">
            <div className="dettaglio-gruppo-testa">
              <span className="dettaglio-gruppo-chi">{g.chi}</span>
              <span className="dettaglio-importo" style={{ color: coloreTotale }}>
                {formatEuro(g.totale)}
              </span>
            </div>
            {g.movimenti.map((m) => (
              <div key={m.id} {...propsRiga(m)}>
                <div className="dettaglio-riga-sx">
                  {g.daControparte ? (
                    <>
                      <div className="dettaglio-riga-titolo">{m.descrizione}</div>
                      <div className="dettaglio-riga-meta">{formatData(m.data, true)}</div>
                    </>
                  ) : (
                    <div className="dettaglio-riga-meta">registrato il {formatData(m.data, true)}</div>
                  )}
                </div>
                {g.movimenti.length > 1 && (
                  <div className="dettaglio-riga-dx">
                    <span className="dettaglio-importo">{formatEuro(m.importo)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </Drawer>
  )
}
