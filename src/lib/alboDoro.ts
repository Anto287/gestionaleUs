/**
 * Albo d'oro: i record di tutte le stagioni messe insieme.
 *
 * I dati delle stagioni passate si leggono direttamente dal Drive (o dal
 * browser senza Drive) con `store.list`, fuori dal DataProvider che conosce
 * solo la stagione attiva. Ogni stagione ha i suoi giocatori con id propri:
 * la stessa persona si riconosce per nome e cognome (normalizzati), l'unico
 * aggancio possibile tra stagioni.
 */
import * as store from '../services/driveStore'
import { esitoPartita } from './social'
import { formatData } from './format'
import type { Allenamento, Giocatore, Partita } from '../types'

export interface StagioneStorico {
  stagione: string
  giocatori: Giocatore[]
  /** solo le partite giocate (con risultato) */
  partite: Partita[]
  allenamenti: Allenamento[]
}

/** Una voce delle classifiche di tutti i tempi. */
export interface RigaAlbo {
  nome: string
  totale: number
  /** in quante stagioni ha messo insieme il totale */
  stagioni: number
  /** es. "5 nel 2024/25 · 7 nel 2025/26" */
  dettaglio: string
}

export interface CampioneStagione {
  nome: string
  n: number
}

/** Il quadro di una singola stagione per l'albo. */
export interface AlboStagione {
  stagione: string
  giocate: number
  v: number
  p: number
  s: number
  gf: number
  gs: number
  sedute: number
  capocannoniere?: CampioneStagione
  reAssist?: CampioneStagione
  piuPresente?: CampioneStagione
  stakanovista?: CampioneStagione
}

export interface PartitaRecord {
  stagione: string
  data: string
  avversario: string
  gf: number
  gs: number
}

export interface Curiosita {
  vittoriaPiuLarga?: PartitaRecord
  partitaPiuSpettacolare?: PartitaRecord
  piuGolInPartita?: PartitaRecord & { nome: string; n: number }
  strisciaVittorie?: { n: number; dal: string; al: string }
  strisciaUtile?: { n: number; dal: string; al: string }
  affluenzaRecord?: { stagione: string; data: string; presenti: number; su: number }
  porteInviolate: number
}

export interface Albo {
  stagioniConDati: number
  partiteTotali: number
  golTotali: number
  seduteTotali: number
  gol: RigaAlbo[]
  assist: RigaAlbo[]
  presenzePartita: RigaAlbo[]
  presenzeAllenamenti: RigaAlbo[]
  perStagione: AlboStagione[]
  curiosita: Curiosita
}

// le stagioni passate non cambiano: una volta lette restano in memoria
let cache: { chiave: string; dati: StagioneStorico[] } | null = null

export async function caricaStorico(stagioni: string[], forza = false): Promise<StagioneStorico[]> {
  const chiave = stagioni.join('|')
  if (!forza && cache?.chiave === chiave) return cache.dati
  const dati = await Promise.all(
    stagioni.map(async (stagione) => {
      const [giocatori, partite, allenamenti] = await Promise.all([
        store.list<Giocatore>('giocatori', stagione),
        store.list<Partita>('partite', stagione),
        store.list<Allenamento>('allenamenti', stagione),
      ])
      return {
        stagione,
        giocatori,
        partite: partite
          .filter((p) => p.giocata !== false)
          .sort((a, b) => a.data.localeCompare(b.data)),
        allenamenti,
      }
    }),
  )
  cache = { chiave, dati }
  return dati
}

/** "Rossi Mario" e "ROSSI mario" sono la stessa persona. */
function chiaveNome(g: Giocatore): string {
  return `${g.cognome} ${g.nome}`.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface Accumulo {
  nome: string
  perStagione: Map<string, number>
}

function accumula(
  mappa: Map<string, Accumulo>,
  chiave: string,
  nome: string,
  stagione: string,
  n: number,
) {
  if (n <= 0) return
  let voce = mappa.get(chiave)
  if (!voce) {
    voce = { nome, perStagione: new Map() }
    mappa.set(chiave, voce)
  }
  voce.nome = nome // resta il nome più recente (le stagioni si scorrono in ordine)
  voce.perStagione.set(stagione, (voce.perStagione.get(stagione) ?? 0) + n)
}

function classifica(mappa: Map<string, Accumulo>): RigaAlbo[] {
  return [...mappa.values()]
    .map((v) => ({
      nome: v.nome,
      totale: [...v.perStagione.values()].reduce((t, n) => t + n, 0),
      stagioni: v.perStagione.size,
      dettaglio: [...v.perStagione.entries()].map(([s, n]) => `${n} nel ${s}`).join(' · '),
    }))
    .sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome))
}

function migliore(righe: { nome: string; n: number }[]): CampioneStagione | undefined {
  const top = righe.filter((r) => r.n > 0).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome))[0]
  return top ? { nome: top.nome, n: top.n } : undefined
}

/** Da tutto lo storico ricava classifiche di sempre, albo per stagione e curiosità. */
export function calcolaAlbo(storico: StagioneStorico[]): Albo {
  const gol = new Map<string, Accumulo>()
  const assist = new Map<string, Accumulo>()
  const presenze = new Map<string, Accumulo>()
  const sedute = new Map<string, Accumulo>()
  const perStagione: AlboStagione[] = []
  const curiosita: Curiosita = { porteInviolate: 0 }
  const tutteLePartite: { p: Partita; stagione: string }[] = []

  for (const anno of storico) {
    const { stagione, giocatori, partite, allenamenti } = anno
    // id → persona di questa stagione (i nomi agganciano le stagioni tra loro)
    const persone = new Map(giocatori.map((g) => [g.id, { chiave: chiaveNome(g), nome: `${g.cognome} ${g.nome}` }]))

    const golAnno = new Map<string, { nome: string; n: number }>()
    const assistAnno = new Map<string, { nome: string; n: number }>()
    const presenzeAnno = new Map<string, { nome: string; n: number }>()
    const seduteAnno = new Map<string, { nome: string; n: number }>()
    const somma = (m: Map<string, { nome: string; n: number }>, id: string, n: number) => {
      const per = persone.get(id)
      if (!per || n <= 0) return
      const voce = m.get(per.chiave) ?? { nome: per.nome, n: 0 }
      voce.n += n
      m.set(per.chiave, voce)
    }

    let v = 0
    let p = 0
    let s = 0
    let gf = 0
    let gs = 0
    for (const partita of partite) {
      tutteLePartite.push({ p: partita, stagione })
      const esito = esitoPartita(partita).code
      if (esito === 'V') v++
      else if (esito === 'P') p++
      else s++
      gf += partita.golFatti
      gs += partita.golSubiti
      if (partita.golSubiti === 0) curiosita.porteInviolate++

      for (const m of partita.marcatori ?? []) {
        somma(golAnno, m.giocatoreId, m.quantita)
        const rec = curiosita.piuGolInPartita
        const per = persone.get(m.giocatoreId)
        if (per && (!rec || m.quantita > rec.n)) {
          curiosita.piuGolInPartita = {
            stagione,
            data: partita.data,
            avversario: partita.avversario,
            gf: partita.golFatti,
            gs: partita.golSubiti,
            nome: per.nome,
            n: m.quantita,
          }
        }
      }
      for (const a of partita.assist ?? []) somma(assistAnno, a.giocatoreId, a.quantita)
      for (const id of partita.titolari ?? []) somma(presenzeAnno, id, 1)
      for (const id of partita.subentrati ?? []) somma(presenzeAnno, id, 1)

      if (esito === 'V') {
        const scarto = partita.golFatti - partita.golSubiti
        const rec = curiosita.vittoriaPiuLarga
        if (!rec || scarto > rec.gf - rec.gs) {
          curiosita.vittoriaPiuLarga = {
            stagione,
            data: partita.data,
            avversario: partita.avversario,
            gf: partita.golFatti,
            gs: partita.golSubiti,
          }
        }
      }
      const totaleReti = partita.golFatti + partita.golSubiti
      const spett = curiosita.partitaPiuSpettacolare
      if (totaleReti > 0 && (!spett || totaleReti > spett.gf + spett.gs)) {
        curiosita.partitaPiuSpettacolare = {
          stagione,
          data: partita.data,
          avversario: partita.avversario,
          gf: partita.golFatti,
          gs: partita.golSubiti,
        }
      }
    }

    for (const seduta of allenamenti) {
      const presenti = Object.entries(seduta.presenze).filter(([, ok]) => ok)
      for (const [id] of presenti) somma(seduteAnno, id, 1)
      const rec = curiosita.affluenzaRecord
      if (presenti.length > 0 && (!rec || presenti.length > rec.presenti)) {
        curiosita.affluenzaRecord = {
          stagione,
          data: seduta.data,
          presenti: presenti.length,
          su: giocatori.length,
        }
      }
    }

    // travaso nei totali di sempre
    for (const [chiave, voce] of golAnno) accumula(gol, chiave, voce.nome, stagione, voce.n)
    for (const [chiave, voce] of assistAnno) accumula(assist, chiave, voce.nome, stagione, voce.n)
    for (const [chiave, voce] of presenzeAnno) accumula(presenze, chiave, voce.nome, stagione, voce.n)
    for (const [chiave, voce] of seduteAnno) accumula(sedute, chiave, voce.nome, stagione, voce.n)

    if (partite.length > 0 || allenamenti.length > 0) {
      perStagione.push({
        stagione,
        giocate: partite.length,
        v,
        p,
        s,
        gf,
        gs,
        sedute: allenamenti.length,
        capocannoniere: migliore([...golAnno.values()]),
        reAssist: migliore([...assistAnno.values()]),
        piuPresente: migliore([...presenzeAnno.values()]),
        stakanovista: migliore([...seduteAnno.values()]),
      })
    }
  }

  // strisce: le partite di tutte le stagioni in fila, in ordine di data
  tutteLePartite.sort((a, b) => a.p.data.localeCompare(b.p.data))
  let correnteV = 0
  let correnteU = 0
  let inizioV = ''
  let inizioU = ''
  for (const { p: partita } of tutteLePartite) {
    const esito = esitoPartita(partita).code
    if (esito === 'V') {
      if (correnteV === 0) inizioV = partita.data
      correnteV++
      const rec = curiosita.strisciaVittorie
      if (!rec || correnteV > rec.n)
        curiosita.strisciaVittorie = { n: correnteV, dal: inizioV, al: partita.data }
    } else {
      correnteV = 0
    }
    if (esito === 'V' || esito === 'P') {
      if (correnteU === 0) inizioU = partita.data
      correnteU++
      const rec = curiosita.strisciaUtile
      if (!rec || correnteU > rec.n)
        curiosita.strisciaUtile = { n: correnteU, dal: inizioU, al: partita.data }
    } else {
      correnteU = 0
    }
  }

  return {
    stagioniConDati: perStagione.length,
    partiteTotali: tutteLePartite.length,
    golTotali: perStagione.reduce((t, a) => t + a.gf, 0),
    seduteTotali: perStagione.reduce((t, a) => t + a.sedute, 0),
    gol: classifica(gol),
    assist: classifica(assist),
    presenzePartita: classifica(presenze),
    presenzeAllenamenti: classifica(sedute),
    perStagione: [...perStagione].sort((a, b) => b.stagione.localeCompare(a.stagione, 'it', { numeric: true })),
    curiosita,
  }
}

/** "vs Pievepelago · 12/10/2025 · 2025/26" per le tessere dei record. */
export function descrizionePartita(r: PartitaRecord): string {
  return `vs ${r.avversario} · ${formatData(r.data, true)} · ${r.stagione}`
}
