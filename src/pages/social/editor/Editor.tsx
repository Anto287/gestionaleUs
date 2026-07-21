import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Text as KText, Image as KImage, Circle, Transformer } from 'react-konva'
import type Konva from 'konva'
import { App, Button, Drawer, Dropdown, Grid, Tooltip, Upload } from 'antd'
import {
  BgColorsOutlined,
  BorderOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FontSizeOutlined,
  PictureOutlined,
  RedoOutlined,
  ReloadOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'
import {
  buildScene,
  coloreRuolo,
  coloriTema,
  fillRett,
  strokeCerchio,
  DISPLAY,
  ORO,
  ROSSO,
  type BuildInput,
  type Elemento,
  type ElImmagine,
  type ElTesto,
  type Scena,
  type Sfondo,
  type Tema,
} from './scene'
import { PannelloDesign, PannelloElemento, nomeTipo, type Allineamento, type MossaLivello } from './Pannelli'
import { comprimiImmagine } from '../../../lib/posterSettings'
import { leggiPrefs, salvaPrefs, azzeraPrefs } from '../../../lib/graficaPrefs'

/** Ombra morbida comune (attiva solo con el.ombra). */
const OMBRA_PROPS = {
  shadowColor: 'rgba(18,12,7,0.6)',
  shadowBlur: 18,
  shadowOffsetY: 8,
} as const

/** Colore delle guide e delle maniglie, alla Canva. */
const VIOLA = '#8b5cf6'
const ROSA_GUIDA = '#ec4899'

let seqEd = 0
function nuovoId(prefisso: string): string {
  seqEd += 1
  return `${prefisso}-${Date.now()}-${seqEd}`
}

/** Carica un'immagine da src e la ridà quando è pronta. */
function useImg(src?: string) {
  const [img, setImg] = useState<HTMLImageElement>()
  useEffect(() => {
    if (!src) {
      setImg(undefined)
      return
    }
    const i = new window.Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => setImg(i)
    i.src = src
    return () => {
      i.onload = null
    }
  }, [src])
  return img
}

/** Eventi comuni ai nodi selezionabili della tela. */
interface EventiNodo {
  draggable: boolean
  onMouseDown: () => void
  onTap: () => void
  onDblClick: () => void
  onDblTap: () => void
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
}

function NodoImmagine({
  el,
  comuni,
  onRef,
}: {
  el: ElImmagine
  comuni: EventiNodo
  onRef: (node: Konva.Image | null) => void
}) {
  const img = useImg(el.src)
  return (
    <KImage
      ref={onRef}
      image={img}
      x={el.x}
      y={el.y}
      width={el.larghezza}
      height={el.altezza}
      rotation={el.rotation}
      opacity={el.opacita ?? 1}
      shadowEnabled={!!el.ombra}
      {...OMBRA_PROPS}
      {...comuni}
    />
  )
}

const NOMI_KIND: Record<BuildInput['kind'], string> = {
  annuncio: 'Partita del giorno',
  risultato: 'Risultato',
  mese: 'Mese',
  formazione: 'Formazione',
}

/** Scena iniziale di un tipo, partendo dallo stile predefinito salvato. */
function scenaDaPrefs(input: BuildInput): Scena {
  const p = leggiPrefs(input.kind)
  const tema: Tema = p.tema ?? (input.kind === 'mese' ? 'carta' : 'notte')
  const accento = p.accento ?? (input.kind === 'mese' ? ROSSO : ORO)
  const base = buildScene(input, tema, accento)
  base.sfondo = {
    ...base.sfondo,
    fotoSrc: p.sfondoSrc,
    velo: p.velo ?? base.sfondo.velo,
    colore: p.sfondoColore,
  }
  if (p.fascia !== undefined) base.fascia = p.fascia
  if (p.cornice !== undefined) base.cornice = p.cornice
  return base
}

export function Editor({
  input,
  seedKey,
  nomeFile,
  onSalvaDrive,
}: {
  input: BuildInput
  seedKey: string
  nomeFile: string
  onSalvaDrive?: (dataUrl: string) => Promise<void> | void
}) {
  const { message } = App.useApp()
  const screens = Grid.useBreakpoint()
  const mobile = !screens.lg
  const W = input.formato.w
  const H = input.formato.h

  const [scena, setScenaRaw] = useState<Scena>(() => scenaDaPrefs(input))
  const [selId, setSelId] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [drawer, setDrawer] = useState<'el' | 'design' | null>(null)
  const [guide, setGuide] = useState<{ v?: number; h?: number }>({})

  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodiRef = useRef<Map<string, Konva.Node>>(new Map())
  const wrapRef = useRef<HTMLDivElement>(null)
  const [larg, setLarg] = useState(0)
  const primoRender = useRef(true)
  const lastKind = useRef(input.kind)
  const nomeKind = NOMI_KIND[input.kind]

  // storia per annulla/ripeti: la scena corrente vive anche in un ref, così i
  // salvataggi nello stack avvengono fuori dagli updater di React
  const scenaRef = useRef(scena)
  const undoRef = useRef<Scena[]>([])
  const redoRef = useRef<Scena[]>([])
  const mergeRef = useRef<{ tag?: string; t: number }>({ t: 0 })

  function resetScena(s: Scena) {
    undoRef.current = []
    redoRef.current = []
    mergeRef.current = { t: 0 }
    scenaRef.current = s
    setScenaRaw(s)
  }

  /** Applica una modifica registrandola nella storia; con lo stesso tag entro
   *  ~1s le modifiche si fondono (slider e digitazione non inondano l'undo). */
  function applica(mut: (s: Scena) => Scena, tag?: string) {
    const prev = scenaRef.current
    const ora = performance.now()
    const unisci = !!tag && mergeRef.current.tag === tag && ora - mergeRef.current.t < 900
    if (!unisci) {
      undoRef.current.push(prev)
      if (undoRef.current.length > 80) undoRef.current.shift()
    }
    mergeRef.current = { tag, t: ora }
    redoRef.current = []
    const next = mut(prev)
    scenaRef.current = next
    setScenaRaw(next)
  }

  function undo() {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push(scenaRef.current)
    mergeRef.current = { t: 0 }
    scenaRef.current = prev
    setScenaRaw(prev)
  }

  function redo() {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push(scenaRef.current)
    mergeRef.current = { t: 0 }
    scenaRef.current = next
    setScenaRaw(next)
  }

  const fotoImg = useImg(scena.sfondo.fotoSrc)
  const col = coloriTema(scena.tema, scena.accento, !!scena.sfondo.fotoSrc)
  const touch = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )

  // attende i font, poi disegna (così i testi hanno le misure giuste).
  // document.fonts.ready da solo non basta: ogni variante (es. Barlow 700)
  // si scarica al primo uso, e il primo uso può essere proprio la tela — che
  // allora misura col font di ripiego e centra storto (visibile sul telefono,
  // dove i font arrivano dopo). La load() esplicita le chiede subito.
  useEffect(() => {
    let vivo = true
    const fonts = document.fonts
    const attesa = fonts
      ? Promise.all([
          ...['500', '600', '700'].map((w) => fonts.load(`${w} 16px 'Barlow Condensed'`)),
          ...['400', '500', '600', '700'].map((w) => fonts.load(`${w} 16px 'Inter'`)),
        ]).then(() => fonts.ready)
      : Promise.resolve()
    Promise.resolve(attesa)
      .catch(() => undefined) // offline: si disegna col ripiego, ma coerente
      .then(() => {
        if (vivo) setPronto(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  // rete di sicurezza: se una variante arriva DOPO il primo disegno, i testi
  // vengono rimontati (entra nella key) così Konva li rimisura col font vero
  const [fontEpoca, setFontEpoca] = useState(0)
  useEffect(() => {
    const fonts = document.fonts
    if (!fonts?.addEventListener) return
    const su = () => setFontEpoca((n) => n + 1)
    fonts.addEventListener('loadingdone', su)
    return () => fonts.removeEventListener('loadingdone', su)
  }, [])

  // al cambio di grafica: se cambia il TIPO, riparte dallo stile predefinito di
  // quel tipo; se cambiano solo i dati, rigenera gli elementi tenendo lo stile.
  useEffect(() => {
    if (primoRender.current) {
      primoRender.current = false
      lastKind.current = input.kind
      return
    }
    if (input.kind !== lastKind.current) {
      lastKind.current = input.kind
      resetScena(scenaDaPrefs(input))
    } else {
      const s = scenaRef.current
      resetScena({ ...s, elementi: buildScene(input, s.tema, s.accento).elementi })
    }
    setSelId(null)
    setDrawer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey])

  // larghezza disponibile → scala di visualizzazione
  useLayoutEffect(() => {
    const elBox = wrapRef.current
    if (!elBox) return
    const ro = new ResizeObserver(([e]) => setLarg(e.contentRect.width))
    ro.observe(elBox)
    return () => ro.disconnect()
  }, [])
  const scala = larg ? larg / W : 0

  // aggancia il transformer all'elemento selezionato (fontEpoca: dopo un
  // rimontaggio dei testi il nodo selezionato è un'istanza nuova)
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = selId ? nodiRef.current.get(selId) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selId, scena.elementi, fontEpoca])

  const selElemento = scena.elementi.find((e) => e.id === selId)

  // il bottom-sheet dell'elemento si chiude se la selezione sparisce
  useEffect(() => {
    if (drawer === 'el' && !selElemento) setDrawer(null)
  }, [drawer, selElemento])

  function patchEl(id: string, p: Partial<Elemento>, tag?: string) {
    applica(
      (s) => ({ ...s, elementi: s.elementi.map((e) => (e.id === id ? ({ ...e, ...p } as Elemento) : e)) }),
      tag ? `${tag}:${id}` : undefined,
    )
  }
  function patchScena(p: Partial<Scena>, tag?: string) {
    applica((s) => ({ ...s, ...p }), tag)
  }
  function patchSfondo(p: Partial<Sfondo>, tag?: string) {
    applica((s) => ({ ...s, sfondo: { ...s.sfondo, ...p } }), tag)
  }

  // trascinamento con snap: calamita al centro e ai bordi della tela + guide
  function onDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target
    const stage = stageRef.current
    if (!stage) return
    const box = node.getClientRect({ relativeTo: stage as unknown as Konva.Container })
    const SOGLIA = 10
    let v: number | undefined
    let h: number | undefined
    const puntiV: [number, number][] = [
      [box.x + box.width / 2, W / 2],
      [box.x, 0],
      [box.x + box.width, W],
    ]
    for (const [pos, target] of puntiV) {
      if (Math.abs(target - pos) < SOGLIA) {
        node.x(node.x() + (target - pos))
        v = target
        break
      }
    }
    const puntiH: [number, number][] = [
      [box.y + box.height / 2, H / 2],
      [box.y, 0],
      [box.y + box.height, H],
    ]
    for (const [pos, target] of puntiH) {
      if (Math.abs(target - pos) < SOGLIA) {
        node.y(node.y() + (target - pos))
        h = target
        break
      }
    }
    setGuide((g) => (g.v === v && g.h === h ? g : { v, h }))
  }

  function onDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    setGuide({})
    patchEl(id, { x: e.target.x(), y: e.target.y() })
  }

  function onTransformEnd(el: Elemento, e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const sx = node.scaleX()
    const sy = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    if (el.tipo === 'testo') {
      patchEl(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        fontSize: Math.max(8, Math.round(el.fontSize * sy)),
        width: Math.max(20, Math.round(el.width * sx)),
      } as Partial<ElTesto>)
    } else if (el.tipo === 'immagine' || el.tipo === 'rett') {
      patchEl(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        larghezza: Math.max(10, Math.round(el.larghezza * sx)),
        altezza: Math.max(10, Math.round(el.altezza * sy)),
      })
    } else if (el.tipo === 'cerchio') {
      patchEl(el.id, {
        x: node.x(),
        y: node.y(),
        raggio: Math.max(6, Math.round(el.raggio * ((sx + sy) / 2))),
      })
    }
  }

  function aggiungiTesto() {
    const nuovo: ElTesto = {
      id: nuovoId('t'),
      tipo: 'testo',
      x: W / 2 - 300,
      y: H / 2 - 30,
      rotation: 0,
      testo: 'Nuovo testo',
      fontSize: 54,
      fontFamily: DISPLAY,
      bold: true,
      italic: false,
      ruolo: 'titolo',
      letterSpacing: 0,
      align: 'center',
      width: 600,
    }
    applica((s) => ({ ...s, elementi: [...s.elementi, nuovo] }))
    setSelId(nuovo.id)
  }

  function aggiungiForma(f: 'rett' | 'cerchio' | 'riga') {
    const id = nuovoId('f')
    const nuovo: Elemento =
      f === 'cerchio'
        ? { id, tipo: 'cerchio', x: W / 2, y: H / 2, rotation: 0, raggio: 110, fill: scena.accento, strokeWidth: 0 }
        : f === 'riga'
          ? { id, tipo: 'rett', x: W / 2 - 210, y: H / 2 - 5, rotation: 0, larghezza: 420, altezza: 10, cornerRadius: 5, fill: scena.accento }
          : { id, tipo: 'rett', x: W / 2 - 170, y: H / 2 - 100, rotation: 0, larghezza: 340, altezza: 200, cornerRadius: 18, fill: scena.accento }
    applica((s) => ({ ...s, elementi: [...s.elementi, nuovo] }))
    setSelId(id)
  }

  async function aggiungiImmagine(file: File) {
    try {
      const dataUrl = await comprimiImmagine(file, 800, 0.9)
      const nuovo: ElImmagine = {
        id: nuovoId('img'),
        tipo: 'immagine',
        x: W / 2 - 110,
        y: H / 2 - 110,
        rotation: 0,
        src: dataUrl,
        larghezza: 220,
        altezza: 220,
      }
      applica((s) => ({ ...s, elementi: [...s.elementi, nuovo] }))
      setSelId(nuovo.id)
    } catch {
      message.error('Immagine non valida')
    }
    return false
  }

  async function caricaSfondo(file: File) {
    try {
      const dataUrl = await comprimiImmagine(file, 1600, 0.85)
      applica((s) => ({ ...s, sfondo: { ...s.sfondo, fotoSrc: dataUrl, x: 0, y: 0, scala: 1 } }))
    } catch {
      message.error('Immagine non valida')
    }
    return false
  }

  function eliminaSel() {
    if (!selId) return
    applica((s) => ({ ...s, elementi: s.elementi.filter((e) => e.id !== selId) }))
    setSelId(null)
  }

  function duplicaSel() {
    if (!selElemento) return
    const copia = { ...selElemento, id: nuovoId('d'), x: selElemento.x + 26, y: selElemento.y + 26 } as Elemento
    if (copia.tipo === 'testo') copia.chiave = undefined
    applica((s) => ({ ...s, elementi: [...s.elementi, copia] }))
    setSelId(copia.id)
  }

  function muoviLivello(m: MossaLivello) {
    if (!selId) return
    applica((s) => {
      const i = s.elementi.findIndex((e) => e.id === selId)
      if (i < 0) return s
      const arr = [...s.elementi]
      const [e] = arr.splice(i, 1)
      const j = m === 'cima' ? arr.length : m === 'fondo' ? 0 : m === 'avanti' ? Math.min(arr.length, i + 1) : Math.max(0, i - 1)
      arr.splice(j, 0, e)
      return { ...s, elementi: arr }
    })
  }

  function allineaSel(a: Allineamento) {
    const node = selId ? nodiRef.current.get(selId) : null
    const stage = stageRef.current
    if (!selElemento || !node || !stage) return
    const box = node.getClientRect({ relativeTo: stage as unknown as Konva.Container })
    const M = 60
    let dx = 0
    let dy = 0
    if (a === 'sx') dx = M - box.x
    if (a === 'cx') dx = W / 2 - (box.x + box.width / 2)
    if (a === 'dx') dx = W - M - (box.x + box.width)
    if (a === 'alto') dy = M - box.y
    if (a === 'mezzo') dy = H / 2 - (box.y + box.height / 2)
    if (a === 'basso') dy = H - M - (box.y + box.height)
    patchEl(selElemento.id, { x: selElemento.x + dx, y: selElemento.y + dy })
  }

  // scorciatoie da tastiera (annulla/ripeti, elimina, duplica, frecce)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && k === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (!selElemento) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        eliminaSel()
        return
      }
      if (mod && k === 'd') {
        e.preventDefault()
        duplicaSel()
        return
      }
      const passo = e.shiftKey ? 10 : 2
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0
        const dy = e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0
        patchEl(selElemento.id, { x: selElemento.x + dx, y: selElemento.y + dy }, 'frecce')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // sfondo foto: dimensioni "cover" + scala utente
  const fotoBox = useMemo(() => {
    if (!fotoImg) return null
    const base = Math.max(W / fotoImg.width, H / fotoImg.height)
    const s = base * scena.sfondo.scala
    const dw = fotoImg.width * s
    const dh = fotoImg.height * s
    return { dw, dh, x: (W - dw) / 2 + scena.sfondo.x, y: (H - dh) / 2 + scena.sfondo.y }
  }, [fotoImg, scena.sfondo, W, H])

  function veloStops(): (number | string)[] {
    const v = scena.sfondo.velo
    return [
      0, `rgba(12,9,6,${Math.min(0.92, 0.3 + v * 0.4)})`,
      0.42, `rgba(12,9,6,${Math.min(0.9, v)})`,
      1, `rgba(12,9,6,${Math.min(0.95, 0.45 + v * 0.45)})`,
    ]
  }

  function esporta(): string | null {
    const stage = stageRef.current
    if (!stage) return null
    trRef.current?.nodes([])
    const pw = stage.width()
    const ph = stage.height()
    const ps = stage.scaleX()
    stage.width(W)
    stage.height(H)
    stage.scale({ x: 1, y: 1 })
    stage.draw()
    const url = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    stage.width(pw)
    stage.height(ph)
    stage.scale({ x: ps, y: ps })
    stage.draw()
    return url
  }

  function scarica() {
    const url = esporta()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = nomeFile
    document.body.appendChild(a)
    a.click()
    a.remove()
    setSelId(null)
  }

  async function salvaDrive() {
    if (!onSalvaDrive) return
    const url = esporta()
    if (!url) return
    setSalvando(true)
    try {
      await onSalvaDrive(url)
    } finally {
      setSalvando(false)
      setSelId(null)
    }
  }

  function salvaDefault() {
    const piedeEl = scena.elementi.find(
      (e): e is ElTesto => e.tipo === 'testo' && e.chiave === 'piede',
    )
    salvaPrefs(input.kind, {
      tema: scena.tema,
      accento: scena.accento,
      piede: piedeEl?.testo,
      sfondoSrc: scena.sfondo.fotoSrc,
      velo: scena.sfondo.velo,
      sfondoColore: scena.sfondo.colore,
      fascia: scena.fascia,
      cornice: scena.cornice,
    })
    message.success(`Stile salvato per «${nomeKind}»`)
  }
  function azzeraDefault() {
    azzeraPrefs(input.kind)
    // le prefs sono appena state pulite: scenaDaPrefs ridà lo stile originale
    applica(() => scenaDaPrefs(input))
    setSelId(null)
    message.success(`Predefinito di «${nomeKind}» azzerato: grafica riportata allo stile originale`)
  }

  /** Riporta la grafica com'era all'apertura (si può annullare con Ctrl+Z). */
  function azzeraGrafica() {
    applica(() => scenaDaPrefs(input))
    setSelId(null)
    setDrawer(null)
    message.success('Grafica riportata allo stato iniziale')
  }

  const setNodoRef = (id: string) => (node: Konva.Node | null) => {
    if (node) nodiRef.current.set(id, node)
    else nodiRef.current.delete(id)
  }

  const eventiNodo = (el: Elemento): EventiNodo => ({
    draggable: true,
    onMouseDown: () => setSelId(el.id),
    onTap: () => setSelId(el.id),
    onDblClick: () => setSelId(el.id),
    onDblTap: () => {
      setSelId(el.id)
      if (mobile) setDrawer('el')
    },
    onDragMove,
    onDragEnd: (e) => onDragEnd(el.id, e),
    onTransformEnd: (e) => onTransformEnd(el, e),
  })

  const menuForme = {
    items: [
      { key: 'rett', label: 'Rettangolo' },
      { key: 'cerchio', label: 'Cerchio' },
      { key: 'riga', label: 'Riga' },
    ],
    onClick: ({ key }: { key: string }) => aggiungiForma(key as 'rett' | 'cerchio' | 'riga'),
  }

  const pannelloElemento = selElemento && (
    <PannelloElemento
      el={selElemento}
      col={col}
      accento={scena.accento}
      patch={(p, tag) => patchEl(selElemento.id, p, tag)}
      onDuplica={duplicaSel}
      onElimina={eliminaSel}
      onLivello={muoviLivello}
      onAllinea={allineaSel}
    />
  )
  const pannelloDesign = (
    <PannelloDesign
      scena={scena}
      patchScena={patchScena}
      patchSfondo={patchSfondo}
      caricaSfondo={caricaSfondo}
      salvaDefault={salvaDefault}
      azzeraDefault={azzeraDefault}
      nomeKind={nomeKind}
    />
  )

  return (
    <div className="ed-wrap">
      {/* barra strumenti */}
      <div className="ed-toolbar">
        <Tooltip title="Annulla (Ctrl+Z)">
          <Button size="small" icon={<UndoOutlined />} disabled={!undoRef.current.length} onClick={undo} />
        </Tooltip>
        <Tooltip title="Ripeti (Ctrl+Shift+Z)">
          <Button size="small" icon={<RedoOutlined />} disabled={!redoRef.current.length} onClick={redo} />
        </Tooltip>
        <span className="ed-sep" />
        <Button size="small" icon={<FontSizeOutlined />} onClick={aggiungiTesto}>
          Testo
        </Button>
        <Dropdown menu={menuForme} trigger={['click']}>
          <Button size="small" icon={<BorderOutlined />}>
            Forme
          </Button>
        </Dropdown>
        <Upload accept="image/*" showUploadList={false} beforeUpload={aggiungiImmagine}>
          <Button size="small" icon={<PictureOutlined />}>
            Immagine
          </Button>
        </Upload>
        {mobile && (
          <Button size="small" icon={<BgColorsOutlined />} onClick={() => setDrawer('design')}>
            Design
          </Button>
        )}
        <span className="ed-sep" />
        <Tooltip title="Riporta la grafica allo stato iniziale (Ctrl+Z per annullare)">
          <Button size="small" icon={<ReloadOutlined />} onClick={azzeraGrafica}>
            Azzera
          </Button>
        </Tooltip>
      </div>

      <div className="ed-corpo">
        <div className="ed-col-tela">
          {/* su mobile: azioni rapide sull'elemento selezionato */}
          {mobile && (
            <div className="ed-ctx">
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                disabled={!selElemento}
                onClick={() => setDrawer('el')}
              >
                Modifica
              </Button>
              <Button size="small" icon={<CopyOutlined />} disabled={!selElemento} onClick={duplicaSel} />
              <Button
                size="small"
                icon={<VerticalAlignTopOutlined />}
                disabled={!selElemento}
                onClick={() => muoviLivello('avanti')}
              />
              <Button
                size="small"
                icon={<VerticalAlignBottomOutlined />}
                disabled={!selElemento}
                onClick={() => muoviLivello('indietro')}
              />
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!selElemento} onClick={eliminaSel} />
              {!selElemento && <span className="ed-ctx-hint">Tocca un elemento della tela</span>}
            </div>
          )}

          {/* tela */}
          <div ref={wrapRef} className="ed-stage-wrap">
            {pronto && larg > 0 && (
              <Stage
                ref={stageRef}
                width={W * scala}
                height={H * scala}
                scaleX={scala}
                scaleY={scala}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) setSelId(null)
                }}
                onTouchStart={(e) => {
                  if (e.target === e.target.getStage()) setSelId(null)
                }}
              >
                <Layer>
                  {/* fondo */}
                  {scena.sfondo.fotoSrc && fotoBox ? (
                    <>
                      <KImage
                        image={fotoImg}
                        x={fotoBox.x}
                        y={fotoBox.y}
                        width={fotoBox.dw}
                        height={fotoBox.dh}
                        draggable
                        onDragEnd={(e) =>
                          patchSfondo({
                            x: e.target.x() - (W - fotoBox.dw) / 2,
                            y: e.target.y() - (H - fotoBox.dh) / 2,
                          })
                        }
                        onMouseDown={() => setSelId(null)}
                        onTap={() => setSelId(null)}
                      />
                      <Rect
                        x={0}
                        y={0}
                        width={W}
                        height={H}
                        listening={false}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{ x: 0, y: H }}
                        fillLinearGradientColorStops={veloStops()}
                      />
                    </>
                  ) : scena.sfondo.colore ? (
                    <Rect x={0} y={0} width={W} height={H} listening={false} fill={scena.sfondo.colore} />
                  ) : (
                    <Rect
                      x={0}
                      y={0}
                      width={W}
                      height={H}
                      listening={false}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: 0, y: H }}
                      fillLinearGradientColorStops={[0, col.bg[0], 1, col.bg[1]]}
                    />
                  )}

                  {/* decorazioni: fascia e cornice */}
                  {scena.fascia && (
                    <Rect
                      x={0}
                      y={0}
                      width={W}
                      height={18}
                      listening={false}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: W, y: 0 }}
                      fillLinearGradientColorStops={[0, ROSSO, 0.62, ROSSO, 0.62, ORO, 1, ORO]}
                    />
                  )}
                  {scena.cornice && (
                    <Rect
                      x={34}
                      y={40}
                      width={W - 68}
                      height={H - 74}
                      listening={false}
                      stroke={col.frame}
                      strokeWidth={1.5}
                      cornerRadius={8}
                    />
                  )}

                  {/* elementi */}
                  {scena.elementi.map((el) => {
                    if (el.tipo === 'testo') {
                      return (
                        <KText
                          key={`${el.id}-f${fontEpoca}`}
                          ref={setNodoRef(el.id)}
                          x={el.x}
                          y={el.y}
                          width={el.width}
                          text={el.testo}
                          fontSize={el.fontSize}
                          fontFamily={el.fontFamily}
                          fontStyle={`${el.bold ? 'bold' : ''}${el.italic ? ' italic' : ''}`.trim() || 'normal'}
                          fill={el.fill ?? coloreRuolo(el.ruolo, col, scena.accento)}
                          align={el.align}
                          letterSpacing={el.letterSpacing}
                          rotation={el.rotation}
                          lineHeight={el.interlinea ?? 1}
                          opacity={el.opacita ?? 1}
                          stroke={el.contorno}
                          strokeWidth={el.contorno ? (el.contornoSpessore ?? 2) : 0}
                          fillAfterStrokeEnabled
                          shadowEnabled={!!el.ombra}
                          {...OMBRA_PROPS}
                          {...eventiNodo(el)}
                        />
                      )
                    }
                    if (el.tipo === 'immagine') {
                      return <NodoImmagine key={el.id} el={el} comuni={eventiNodo(el)} onRef={setNodoRef(el.id)} />
                    }
                    if (el.tipo === 'rett') {
                      return (
                        <Rect
                          key={el.id}
                          ref={setNodoRef(el.id)}
                          x={el.x}
                          y={el.y}
                          width={el.larghezza}
                          height={el.altezza}
                          cornerRadius={el.cornerRadius}
                          fill={fillRett(el, col, scena.accento)}
                          stroke={el.stroke}
                          strokeWidth={el.stroke ? (el.strokeWidth ?? 3) : 0}
                          rotation={el.rotation}
                          opacity={el.opacita ?? 1}
                          shadowEnabled={!!el.ombra}
                          {...OMBRA_PROPS}
                          {...eventiNodo(el)}
                        />
                      )
                    }
                    // cerchio
                    return (
                      <Circle
                        key={el.id}
                        ref={setNodoRef(el.id)}
                        x={el.x}
                        y={el.y}
                        radius={el.raggio}
                        fill={el.fill}
                        stroke={strokeCerchio(el, col, scena.accento)}
                        strokeWidth={el.strokeWidth}
                        rotation={el.rotation}
                        opacity={el.opacita ?? 1}
                        shadowEnabled={!!el.ombra}
                        {...OMBRA_PROPS}
                        {...eventiNodo(el)}
                      />
                    )
                  })}

                  {/* guide di allineamento durante il trascinamento */}
                  {guide.v !== undefined && (
                    <Line
                      points={[guide.v, 0, guide.v, H]}
                      stroke={ROSA_GUIDA}
                      strokeWidth={1.6 / (scala || 1)}
                      dash={[14, 10]}
                      listening={false}
                    />
                  )}
                  {guide.h !== undefined && (
                    <Line
                      points={[0, guide.h, W, guide.h]}
                      stroke={ROSA_GUIDA}
                      strokeWidth={1.6 / (scala || 1)}
                      dash={[14, 10]}
                      listening={false}
                    />
                  )}

                  <Transformer
                    ref={trRef}
                    rotateEnabled
                    rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                    rotationSnapTolerance={7}
                    keepRatio={selElemento?.tipo === 'immagine'}
                    enabledAnchors={
                      selElemento?.tipo === 'cerchio'
                        ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                        : undefined
                    }
                    anchorSize={touch ? 16 : 10}
                    anchorCornerRadius={touch ? 8 : 3}
                    anchorStroke={VIOLA}
                    borderStroke={VIOLA}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 ? oldBox : newBox)}
                  />
                </Layer>
              </Stage>
            )}
          </div>

          {/* export */}
          <div className="ed-export">
            <Button icon={<DownloadOutlined />} onClick={scarica} disabled={!pronto} block>
              Scarica PNG
            </Button>
            {onSalvaDrive && (
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={salvaDrive}
                loading={salvando}
                disabled={!pronto}
                block
              >
                Salva su Drive
              </Button>
            )}
          </div>
        </div>

        {/* pannello laterale (desktop): proprietà elemento o design */}
        {!mobile && <div className="ed-lato">{pannelloElemento || pannelloDesign}</div>}
      </div>

      {/* bottom-sheet (mobile) */}
      {mobile && (
        <Drawer
          placement="bottom"
          height={400}
          open={drawer !== null}
          onClose={() => setDrawer(null)}
          mask={false}
          rootClassName="ed-drawer"
          title={drawer === 'design' ? 'Design della grafica' : selElemento ? nomeTipo(selElemento) : ''}
        >
          {drawer === 'design' ? pannelloDesign : pannelloElemento}
        </Drawer>
      )}
    </div>
  )
}
