import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text as KText, Image as KImage, Circle, Transformer } from 'react-konva'
import type Konva from 'konva'
import {
  App,
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Segmented,
  Slider,
  Space,
  Tooltip,
  Upload,
} from 'antd'
import {
  BoldOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FontSizeOutlined,
  PictureOutlined,
  PlusOutlined,
  StarOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
} from '@ant-design/icons'
import {
  buildScene,
  coloreRuolo,
  coloriTema,
  ORO,
  ROSSO,
  type BuildInput,
  type Elemento,
  type ElTesto,
  type Scena,
  type Tema,
} from './scene'
import { comprimiImmagine } from '../../../lib/posterSettings'
import { leggiPrefs, salvaPrefs, azzeraPrefs } from '../../../lib/graficaPrefs'

const DISPLAY = "'Barlow Condensed', 'Inter', sans-serif"

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

function NodoImmagine({
  el,
  onRef,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  el: Extract<Elemento, { tipo: 'immagine' }>
  onRef: (node: Konva.Image | null) => void
  onSelect: () => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
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
      draggable
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  )
}

const NOMI_KIND: Record<BuildInput['kind'], string> = {
  annuncio: 'Partita del giorno',
  risultato: 'Risultato',
  mese: 'Mese',
}

/** Scena iniziale di un tipo, partendo dallo stile predefinito salvato. */
function scenaDaPrefs(input: BuildInput): Scena {
  const p = leggiPrefs(input.kind)
  const tema: Tema = p.tema ?? (input.kind === 'mese' ? 'carta' : 'notte')
  const accento = p.accento ?? (input.kind === 'mese' ? ROSSO : ORO)
  const base = buildScene(input, tema, accento)
  base.sfondo = { ...base.sfondo, fotoSrc: p.sfondoSrc, velo: p.velo ?? base.sfondo.velo }
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
  const W = input.formato.w
  const H = input.formato.h

  const [scena, setScena] = useState<Scena>(() => scenaDaPrefs(input))
  const [selId, setSelId] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodiRef = useRef<Map<string, Konva.Node>>(new Map())
  const wrapRef = useRef<HTMLDivElement>(null)
  const [larg, setLarg] = useState(0)
  const primoRender = useRef(true)
  const lastKind = useRef(input.kind)
  const nomeKind = NOMI_KIND[input.kind]

  const fotoImg = useImg(scena.sfondo.fotoSrc)
  const col = coloriTema(scena.tema, scena.accento, !!scena.sfondo.fotoSrc)
  const cornice = input.kind !== 'mese'

  // attende i font, poi disegna (così i testi hanno le misure giuste)
  useEffect(() => {
    let vivo = true
    const f = document.fonts?.ready ?? Promise.resolve()
    f.then(() => {
      if (vivo) setPronto(true)
    })
    return () => {
      vivo = false
    }
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
      setScena(scenaDaPrefs(input))
    } else {
      setScena((s) => ({ ...s, elementi: buildScene(input, s.tema, s.accento).elementi }))
    }
    setSelId(null)
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

  // aggancia il transformer all'elemento selezionato
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = selId ? nodiRef.current.get(selId) : null
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selId, scena.elementi])

  const selElemento = scena.elementi.find((e) => e.id === selId)

  function aggiornaEl(id: string, patch: Partial<Elemento>) {
    setScena((s) => ({
      ...s,
      elementi: s.elementi.map((e) => (e.id === id ? ({ ...e, ...patch } as Elemento) : e)),
    }))
  }

  function onDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    aggiornaEl(id, { x: e.target.x(), y: e.target.y() })
  }

  function onTransformEnd(el: Elemento, e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const sx = node.scaleX()
    const sy = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    if (el.tipo === 'testo') {
      aggiornaEl(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        fontSize: Math.max(8, Math.round(el.fontSize * sy)),
        width: Math.max(20, Math.round(el.width * sx)),
      } as Partial<ElTesto>)
    } else if (el.tipo === 'immagine') {
      aggiornaEl(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        larghezza: Math.max(10, Math.round(el.larghezza * sx)),
        altezza: Math.max(10, Math.round(el.altezza * sy)),
      })
    } else if (el.tipo === 'rett') {
      aggiornaEl(el.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        larghezza: Math.max(10, Math.round(el.larghezza * sx)),
        altezza: Math.max(10, Math.round(el.altezza * sy)),
      })
    } else if (el.tipo === 'cerchio') {
      aggiornaEl(el.id, {
        x: node.x(),
        y: node.y(),
        raggio: Math.max(6, Math.round(el.raggio * ((sx + sy) / 2))),
      })
    }
  }

  function aggiungiTesto() {
    const nuovo: ElTesto = {
      id: `t${Date.now()}`,
      tipo: 'testo',
      x: W / 2 - 250,
      y: H / 2,
      rotation: 0,
      testo: 'Nuovo testo',
      fontSize: 48,
      fontFamily: DISPLAY,
      bold: true,
      italic: false,
      ruolo: 'titolo',
      letterSpacing: 0,
      align: 'center',
      width: 500,
    }
    setScena((s) => ({ ...s, elementi: [...s.elementi, nuovo] }))
    setSelId(nuovo.id)
  }

  function eliminaSel() {
    if (!selId) return
    setScena((s) => ({ ...s, elementi: s.elementi.filter((e) => e.id !== selId) }))
    setSelId(null)
  }

  function spostaLivello(su: boolean) {
    if (!selId) return
    setScena((s) => {
      const i = s.elementi.findIndex((e) => e.id === selId)
      if (i < 0) return s
      const j = su ? i + 1 : i - 1
      if (j < 0 || j >= s.elementi.length) return s
      const arr = [...s.elementi]
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...s, elementi: arr }
    })
  }

  async function caricaSfondo(file: File) {
    try {
      const dataUrl = await comprimiImmagine(file, 1600, 0.85)
      setScena((s) => ({ ...s, sfondo: { ...s.sfondo, fotoSrc: dataUrl, x: 0, y: 0, scala: 1 } }))
    } catch {
      message.error('Immagine non valida')
    }
    return false
  }

  async function caricaLogoAvv(file: File) {
    try {
      const dataUrl = await comprimiImmagine(file, 600, 0.9)
      const nuovo: Elemento = {
        id: `logo${Date.now()}`,
        tipo: 'immagine',
        x: W / 2 - 80,
        y: H / 2 - 80,
        rotation: 0,
        src: dataUrl,
        larghezza: 160,
        altezza: 160,
      }
      setScena((s) => ({ ...s, elementi: [...s.elementi, nuovo] }))
      setSelId(nuovo.id)
    } catch {
      message.error('Immagine non valida')
    }
    return false
  }

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
    })
    message.success(`Stile salvato per «${nomeKind}»`)
  }
  function azzeraDefault() {
    azzeraPrefs(input.kind)
    message.success(`Predefinito di «${nomeKind}» azzerato`)
  }

  const setNodoRef = (id: string) => (node: Konva.Node | null) => {
    if (node) nodiRef.current.set(id, node)
    else nodiRef.current.delete(id)
  }

  function coloreEl(el: ElTesto): string {
    return el.fill ?? coloreRuolo(el.ruolo, col, scena.accento)
  }

  return (
    <div className="ed-wrap">
      {/* barra strumenti */}
      <div className="ed-toolbar">
        <Segmented
          size="small"
          value={scena.tema}
          onChange={(v) => setScena((s) => ({ ...s, tema: v as Tema }))}
          options={[
            { value: 'notte', label: 'Notte' },
            { value: 'carta', label: 'Chiaro' },
          ]}
        />
        <Tooltip title="Colore accento">
          <ColorPicker
            size="small"
            value={scena.accento}
            onChange={(c) => setScena((s) => ({ ...s, accento: c.toHexString() }))}
            presets={[{ label: 'Squadra', colors: [ROSSO, ORO, '#ffffff', '#241d16', '#3f7a52'] }]}
          />
        </Tooltip>
        <Upload accept="image/*" showUploadList={false} beforeUpload={caricaSfondo}>
          <Tooltip title="Foto di sfondo">
            <Button size="small" icon={<PictureOutlined />} />
          </Tooltip>
        </Upload>
        <Upload accept="image/*" showUploadList={false} beforeUpload={caricaLogoAvv}>
          <Tooltip title="Logo avversario">
            <Button size="small" icon={<CloudUploadOutlined />}>
              Logo
            </Button>
          </Tooltip>
        </Upload>
        <Button size="small" icon={<PlusOutlined />} onClick={aggiungiTesto}>
          Testo
        </Button>
        <span style={{ flex: 1 }} />
        <Tooltip title="Porta avanti">
          <Button size="small" icon={<VerticalAlignTopOutlined />} disabled={!selId} onClick={() => spostaLivello(true)} />
        </Tooltip>
        <Tooltip title="Porta indietro">
          <Button size="small" icon={<VerticalAlignBottomOutlined />} disabled={!selId} onClick={() => spostaLivello(false)} />
        </Tooltip>
        <Tooltip title="Elimina">
          <Button size="small" danger icon={<DeleteOutlined />} disabled={!selId} onClick={eliminaSel} />
        </Tooltip>
      </div>

      {/* zoom sfondo, se presente */}
      {scena.sfondo.fotoSrc && (
        <div className="ed-riga">
          <span className="ed-mini">Sfondo</span>
          <span className="ed-mini2">zoom</span>
          <Slider
            style={{ flex: 1 }}
            min={1}
            max={3}
            step={0.05}
            value={scena.sfondo.scala}
            onChange={(v) => setScena((s) => ({ ...s, sfondo: { ...s.sfondo, scala: v } }))}
          />
          <span className="ed-mini2">velo</span>
          <Slider
            style={{ flex: 1 }}
            min={0.2}
            max={0.9}
            step={0.05}
            value={scena.sfondo.velo}
            onChange={(v) => setScena((s) => ({ ...s, sfondo: { ...s.sfondo, velo: v } }))}
          />
          <Button size="small" onClick={() => setScena((s) => ({ ...s, sfondo: { ...s.sfondo, fotoSrc: undefined } }))}>
            Togli
          </Button>
        </div>
      )}

      {/* stile predefinito */}
      <div className="ed-riga">
        <Button size="small" icon={<StarOutlined />} onClick={salvaDefault}>
          Salva come predefinito
        </Button>
        <Button size="small" type="text" onClick={azzeraDefault}>
          Azzera
        </Button>
        <span className="ed-mini2">stile di «{nomeKind}»: tema, colore, sfondo e testo in fondo</span>
      </div>

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
                      setScena((s) => ({
                        ...s,
                        sfondo: {
                          ...s.sfondo,
                          x: e.target.x() - (W - fotoBox.dw) / 2,
                          y: e.target.y() - (H - fotoBox.dh) / 2,
                        },
                      }))
                    }
                    onMouseDown={() => setSelId(null)}
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
              {cornice && (
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
                      key={el.id}
                      ref={setNodoRef(el.id)}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      text={el.testo}
                      fontSize={el.fontSize}
                      fontFamily={el.fontFamily}
                      fontStyle={`${el.bold ? 'bold' : ''}${el.italic ? ' italic' : ''}`.trim() || 'normal'}
                      fill={coloreEl(el)}
                      align={el.align}
                      letterSpacing={el.letterSpacing}
                      rotation={el.rotation}
                      lineHeight={1}
                      draggable
                      onMouseDown={() => setSelId(el.id)}
                      onTap={() => setSelId(el.id)}
                      onDragEnd={(e) => onDragEnd(el.id, e)}
                      onTransformEnd={(e) => onTransformEnd(el, e)}
                    />
                  )
                }
                if (el.tipo === 'immagine') {
                  return (
                    <NodoImmagine
                      key={el.id}
                      el={el}
                      onRef={setNodoRef(el.id)}
                      onSelect={() => setSelId(el.id)}
                      onDragEnd={(e) => onDragEnd(el.id, e)}
                      onTransformEnd={(e) => onTransformEnd(el, e)}
                    />
                  )
                }
                if (el.tipo === 'rett') {
                  const fill =
                    el.fill ?? (el.ruoloFill === 'accento' ? scena.accento : el.ruoloFill === 'tile' ? col.tile : '#888')
                  return (
                    <Rect
                      key={el.id}
                      ref={setNodoRef(el.id)}
                      x={el.x}
                      y={el.y}
                      width={el.larghezza}
                      height={el.altezza}
                      cornerRadius={el.cornerRadius}
                      fill={fill}
                      rotation={el.rotation}
                      draggable
                      onMouseDown={() => setSelId(el.id)}
                      onTap={() => setSelId(el.id)}
                      onDragEnd={(e) => onDragEnd(el.id, e)}
                      onTransformEnd={(e) => onTransformEnd(el, e)}
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
                    stroke={el.strokeRuolo === 'accento' ? scena.accento : col.testo}
                    strokeWidth={el.strokeWidth}
                    draggable
                    onMouseDown={() => setSelId(el.id)}
                    onTap={() => setSelId(el.id)}
                    onDragEnd={(e) => onDragEnd(el.id, e)}
                    onTransformEnd={(e) => onTransformEnd(el, e)}
                  />
                )
              })}

              <Transformer
                ref={trRef}
                rotateEnabled
                keepRatio={selElemento?.tipo === 'immagine'}
                enabledAnchors={
                  selElemento?.tipo === 'cerchio'
                    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                    : undefined
                }
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 ? oldBox : newBox)}
              />
            </Layer>
          </Stage>
        )}
      </div>

      {/* proprietà del testo selezionato */}
      {selElemento?.tipo === 'testo' && (
        <div className="ed-props">
          <Input
            value={selElemento.testo}
            onChange={(e) => aggiornaEl(selElemento.id, { testo: e.target.value })}
            placeholder="Testo"
          />
          <Space wrap>
            <InputNumber
              size="small"
              min={8}
              max={260}
              value={selElemento.fontSize}
              onChange={(v) => aggiornaEl(selElemento.id, { fontSize: Number(v) || selElemento.fontSize })}
              prefix={<FontSizeOutlined />}
              style={{ width: 100 }}
            />
            <Tooltip title="Grassetto">
              <Button
                size="small"
                type={selElemento.bold ? 'primary' : 'default'}
                icon={<BoldOutlined />}
                onClick={() => aggiornaEl(selElemento.id, { bold: !selElemento.bold })}
              />
            </Tooltip>
            <Segmented
              size="small"
              value={selElemento.align}
              onChange={(v) => aggiornaEl(selElemento.id, { align: v as ElTesto['align'] })}
              options={[
                { value: 'left', label: 'Sx' },
                { value: 'center', label: 'Cen' },
                { value: 'right', label: 'Dx' },
              ]}
            />
            <Tooltip title="Colore testo (vuoto = tema)">
              <ColorPicker
                size="small"
                allowClear
                value={selElemento.fill ?? coloreEl(selElemento)}
                onChange={(c) => aggiornaEl(selElemento.id, { fill: c.toHexString() })}
                onClear={() => aggiornaEl(selElemento.id, { fill: undefined })}
              />
            </Tooltip>
          </Space>
        </div>
      )}

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
  )
}
