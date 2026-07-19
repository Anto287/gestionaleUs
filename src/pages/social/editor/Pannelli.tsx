/**
 * Pannelli dell'editor grafico, in stile Canva:
 * - PannelloElemento: proprietà dell'elemento selezionato (testo/forma/immagine)
 * - PannelloDesign: tema, accento, sfondo e decorazioni della grafica
 * Su desktop vivono nella colonna a destra della tela, su mobile dentro un
 * bottom-sheet (Drawer dal basso).
 */
import type { ReactNode } from 'react'
import { Button, ColorPicker, Dropdown, Input, InputNumber, Segmented, Select, Slider, Switch, Tooltip, Upload } from 'antd'
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BlockOutlined,
  BoldOutlined,
  CopyOutlined,
  DeleteOutlined,
  ItalicOutlined,
  PictureOutlined,
  StarOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'
import {
  FONTS,
  ORO,
  ROSSO,
  coloreRuolo,
  fillRett,
  strokeCerchio,
  type ColoriTema,
  type ElTesto,
  type Elemento,
  type Scena,
  type Sfondo,
  type Tema,
} from './scene'

export type MossaLivello = 'cima' | 'avanti' | 'indietro' | 'fondo'
export type Allineamento = 'sx' | 'cx' | 'dx' | 'alto' | 'mezzo' | 'basso'

const NOMI_TIPO: Record<Elemento['tipo'], string> = {
  testo: 'Testo',
  immagine: 'Immagine',
  rett: 'Rettangolo',
  cerchio: 'Cerchio',
}

export function nomeTipo(el: Elemento): string {
  return NOMI_TIPO[el.tipo]
}

/** Riga etichetta + controllo del pannello. */
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ed-campo">
      <span className="ed-campo-l">{label}</span>
      <div className="ed-campo-c">{children}</div>
    </div>
  )
}

function Sezione({ titolo, children }: { titolo?: string; children: ReactNode }) {
  return (
    <div className="ed-sez">
      {titolo && <div className="ed-sez-t">{titolo}</div>}
      {children}
    </div>
  )
}

export function PannelloElemento({
  el,
  col,
  accento,
  patch,
  onDuplica,
  onElimina,
  onLivello,
  onAllinea,
}: {
  el: Elemento
  col: ColoriTema
  accento: string
  patch: (p: Partial<Elemento>, tag?: string) => void
  onDuplica: () => void
  onElimina: () => void
  onLivello: (m: MossaLivello) => void
  onAllinea: (a: Allineamento) => void
}) {
  const menuLivelli = {
    items: [
      { key: 'cima', icon: <VerticalAlignTopOutlined />, label: 'Porta in primo piano' },
      { key: 'avanti', label: 'Porta avanti' },
      { key: 'indietro', label: 'Porta indietro' },
      { key: 'fondo', icon: <VerticalAlignBottomOutlined />, label: 'Porta in fondo' },
    ],
    onClick: ({ key }: { key: string }) => onLivello(key as MossaLivello),
  }
  const menuAllinea = {
    items: [
      { key: 'sx', icon: <AlignLeftOutlined />, label: 'A sinistra' },
      { key: 'cx', icon: <AlignCenterOutlined />, label: 'Centro orizzontale' },
      { key: 'dx', icon: <AlignRightOutlined />, label: 'A destra' },
      { type: 'divider' as const },
      { key: 'alto', icon: <VerticalAlignTopOutlined />, label: 'In alto' },
      { key: 'mezzo', icon: <VerticalAlignMiddleOutlined />, label: 'Centro verticale' },
      { key: 'basso', icon: <VerticalAlignBottomOutlined />, label: 'In basso' },
    ],
    onClick: ({ key }: { key: string }) => onAllinea(key as Allineamento),
  }

  return (
    <div className="ed-pannello">
      <div className="ed-sez-azioni">
        <span className="ed-pannello-t">{nomeTipo(el)}</span>
        <span style={{ flex: 1 }} />
        <Tooltip title="Duplica (Ctrl+D)">
          <Button size="small" icon={<CopyOutlined />} onClick={onDuplica} />
        </Tooltip>
        <Dropdown menu={menuLivelli} trigger={['click']}>
          <Tooltip title="Livello">
            <Button size="small" icon={<BlockOutlined />} />
          </Tooltip>
        </Dropdown>
        <Dropdown menu={menuAllinea} trigger={['click']}>
          <Tooltip title="Allinea sulla tela">
            <Button size="small" icon={<AlignCenterOutlined />} />
          </Tooltip>
        </Dropdown>
        <Tooltip title="Elimina (Canc)">
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onElimina} />
        </Tooltip>
      </div>

      {el.tipo === 'testo' && <CampiTesto el={el} col={col} accento={accento} patch={patch} />}

      {el.tipo === 'rett' && (
        <Sezione>
          <Campo label="Riempimento">
            <ColorPicker
              size="small"
              value={fillRett(el, col, accento)}
              onChange={(c) => patch({ fill: c.toHexString() }, 'fill')}
            />
          </Campo>
          <Campo label="Angoli arrotondati">
            <InputNumber
              size="small"
              min={0}
              max={200}
              value={el.cornerRadius}
              onChange={(v) => patch({ cornerRadius: Number(v) || 0 })}
            />
          </Campo>
          <Campo label="Bordo">
            <ColorPicker
              size="small"
              allowClear
              value={el.stroke ?? '#241d16'}
              onChange={(c) => patch({ stroke: c.toHexString(), strokeWidth: el.strokeWidth || 3 }, 'stroke')}
              onClear={() => patch({ stroke: undefined })}
            />
            <InputNumber
              size="small"
              min={1}
              max={30}
              disabled={!el.stroke}
              value={el.strokeWidth ?? 3}
              onChange={(v) => patch({ strokeWidth: Number(v) || 1 })}
            />
          </Campo>
          <CampiComuni el={el} patch={patch} />
        </Sezione>
      )}

      {el.tipo === 'cerchio' && (
        <Sezione>
          <Campo label="Riempimento">
            <ColorPicker
              size="small"
              allowClear
              value={el.fill ?? accento}
              onChange={(c) => patch({ fill: c.toHexString() }, 'fill')}
              onClear={() => patch({ fill: undefined })}
            />
          </Campo>
          <Campo label="Bordo">
            <ColorPicker
              size="small"
              value={strokeCerchio(el, col, accento)}
              onChange={(c) => patch({ stroke: c.toHexString() }, 'stroke')}
            />
            <InputNumber
              size="small"
              min={0}
              max={30}
              value={el.strokeWidth}
              onChange={(v) => patch({ strokeWidth: Number(v) || 0 })}
            />
          </Campo>
          <CampiComuni el={el} patch={patch} />
        </Sezione>
      )}

      {el.tipo === 'immagine' && (
        <Sezione>
          <CampiComuni el={el} patch={patch} />
          <div className="ed-nota">Trascina gli angoli sulla tela per ridimensionare o ruotare.</div>
        </Sezione>
      )}
    </div>
  )
}

/** Opacità e ombra, uguali per tutti gli elementi. */
function CampiComuni({ el, patch }: { el: Elemento; patch: (p: Partial<Elemento>, tag?: string) => void }) {
  return (
    <>
      <Campo label="Opacità">
        <Slider
          style={{ flex: 1, margin: '0 6px' }}
          min={10}
          max={100}
          value={Math.round((el.opacita ?? 1) * 100)}
          onChange={(v: number) => patch({ opacita: v / 100 }, 'opacita')}
        />
      </Campo>
      <Campo label="Ombra">
        <Switch size="small" checked={!!el.ombra} onChange={(v) => patch({ ombra: v })} />
      </Campo>
    </>
  )
}

function CampiTesto({
  el,
  col,
  accento,
  patch,
}: {
  el: ElTesto
  col: ColoriTema
  accento: string
  patch: (p: Partial<Elemento>, tag?: string) => void
}) {
  const patchT = patch as (p: Partial<ElTesto>, tag?: string) => void
  return (
    <Sezione>
      <Input.TextArea
        value={el.testo}
        autoSize={{ minRows: 1, maxRows: 4 }}
        onChange={(e) => patchT({ testo: e.target.value }, 'testo')}
        placeholder="Testo"
      />
      <Campo label="Carattere">
        <Select
          size="small"
          style={{ width: '100%' }}
          value={el.fontFamily}
          onChange={(v) => patchT({ fontFamily: v })}
          options={FONTS.map((f) => ({
            value: f.value,
            label: <span style={{ fontFamily: f.value }}>{f.label}</span>,
          }))}
        />
      </Campo>
      <Campo label="Dimensione">
        <InputNumber
          size="small"
          min={8}
          max={320}
          value={el.fontSize}
          onChange={(v) => patchT({ fontSize: Number(v) || el.fontSize })}
        />
        <Tooltip title="Grassetto">
          <Button
            size="small"
            type={el.bold ? 'primary' : 'default'}
            icon={<BoldOutlined />}
            onClick={() => patchT({ bold: !el.bold })}
          />
        </Tooltip>
        <Tooltip title="Corsivo">
          <Button
            size="small"
            type={el.italic ? 'primary' : 'default'}
            icon={<ItalicOutlined />}
            onClick={() => patchT({ italic: !el.italic })}
          />
        </Tooltip>
        <Tooltip title="Tutto maiuscolo">
          <Button size="small" onClick={() => patchT({ testo: el.testo.toUpperCase() })}>
            AA
          </Button>
        </Tooltip>
      </Campo>
      <Campo label="Allineamento">
        <Segmented
          size="small"
          value={el.align}
          onChange={(v) => patchT({ align: v as ElTesto['align'] })}
          options={[
            { value: 'left', icon: <AlignLeftOutlined /> },
            { value: 'center', icon: <AlignCenterOutlined /> },
            { value: 'right', icon: <AlignRightOutlined /> },
          ]}
        />
      </Campo>
      <Campo label="Colore">
        <ColorPicker
          size="small"
          allowClear
          value={el.fill ?? coloreRuolo(el.ruolo, col, accento)}
          onChange={(c) => patchT({ fill: c.toHexString() }, 'fill')}
          onClear={() => patchT({ fill: undefined })}
        />
        <span className="ed-nota">vuoto = colore del tema</span>
      </Campo>
      <Campo label="Spaziatura">
        <InputNumber
          size="small"
          min={-2}
          max={40}
          value={el.letterSpacing}
          onChange={(v) => patchT({ letterSpacing: Number(v) || 0 })}
        />
      </Campo>
      <Campo label="Interlinea">
        <InputNumber
          size="small"
          min={0.7}
          max={2.2}
          step={0.05}
          value={el.interlinea ?? 1}
          onChange={(v) => patchT({ interlinea: Number(v) || 1 })}
        />
      </Campo>
      <Campo label="Contorno">
        <ColorPicker
          size="small"
          allowClear
          value={el.contorno ?? '#241d16'}
          onChange={(c) => patchT({ contorno: c.toHexString(), contornoSpessore: el.contornoSpessore || 2 }, 'contorno')}
          onClear={() => patchT({ contorno: undefined })}
        />
        <InputNumber
          size="small"
          min={1}
          max={16}
          disabled={!el.contorno}
          value={el.contornoSpessore ?? 2}
          onChange={(v) => patchT({ contornoSpessore: Number(v) || 1 })}
        />
      </Campo>
      <CampiComuni el={el} patch={patch} />
    </Sezione>
  )
}

export function PannelloDesign({
  scena,
  patchScena,
  patchSfondo,
  caricaSfondo,
  salvaDefault,
  azzeraDefault,
  nomeKind,
}: {
  scena: Scena
  patchScena: (p: Partial<Scena>, tag?: string) => void
  patchSfondo: (p: Partial<Sfondo>, tag?: string) => void
  caricaSfondo: (file: File) => Promise<boolean> | boolean
  salvaDefault: () => void
  azzeraDefault: () => void
  nomeKind: string
}) {
  return (
    <div className="ed-pannello">
      <Sezione titolo="Tema">
        <Campo label="Tema">
          <Segmented
            size="small"
            value={scena.tema}
            onChange={(v) => patchScena({ tema: v as Tema })}
            options={[
              { value: 'notte', label: 'Notte' },
              { value: 'carta', label: 'Chiaro' },
            ]}
          />
        </Campo>
        <Campo label="Colore accento">
          <ColorPicker
            size="small"
            value={scena.accento}
            onChange={(c) => patchScena({ accento: c.toHexString() }, 'accento')}
            presets={[{ label: 'Squadra', colors: [ROSSO, ORO, '#ffffff', '#241d16', '#3f7a52'] }]}
          />
        </Campo>
      </Sezione>

      <Sezione titolo="Sfondo">
        <Campo label="Foto">
          <Upload accept="image/*" showUploadList={false} beforeUpload={caricaSfondo}>
            <Button size="small" icon={<PictureOutlined />}>
              {scena.sfondo.fotoSrc ? 'Cambia' : 'Carica'}
            </Button>
          </Upload>
          {scena.sfondo.fotoSrc && (
            <Button size="small" onClick={() => patchSfondo({ fotoSrc: undefined })}>
              Togli
            </Button>
          )}
        </Campo>
        {scena.sfondo.fotoSrc ? (
          <>
            <Campo label="Zoom foto">
              <Slider
                style={{ flex: 1, margin: '0 6px' }}
                min={1}
                max={3}
                step={0.05}
                value={scena.sfondo.scala}
                onChange={(v: number) => patchSfondo({ scala: v }, 'zoom')}
              />
            </Campo>
            <Campo label="Velo scuro">
              <Slider
                style={{ flex: 1, margin: '0 6px' }}
                min={0.2}
                max={0.9}
                step={0.05}
                value={scena.sfondo.velo}
                onChange={(v: number) => patchSfondo({ velo: v }, 'velo')}
              />
            </Campo>
            <div className="ed-nota">Trascina la foto sulla tela per inquadrarla.</div>
          </>
        ) : (
          <Campo label="Tinta unita">
            <ColorPicker
              size="small"
              allowClear
              value={scena.sfondo.colore ?? '#2a211a'}
              onChange={(c) => patchSfondo({ colore: c.toHexString() }, 'sfondo')}
              onClear={() => patchSfondo({ colore: undefined })}
            />
            <span className="ed-nota">vuoto = sfumatura del tema</span>
          </Campo>
        )}
      </Sezione>

      <Sezione titolo="Decorazioni">
        <Campo label="Fascia in alto">
          <Switch size="small" checked={scena.fascia} onChange={(v) => patchScena({ fascia: v })} />
        </Campo>
        <Campo label="Cornice">
          <Switch size="small" checked={scena.cornice} onChange={(v) => patchScena({ cornice: v })} />
        </Campo>
      </Sezione>

      <Sezione titolo="Stile predefinito">
        <div className="ed-sez-azioni">
          <Button size="small" icon={<StarOutlined />} onClick={salvaDefault}>
            Salva come predefinito
          </Button>
          <Button size="small" type="text" onClick={azzeraDefault}>
            Azzera
          </Button>
        </div>
        <div className="ed-nota">
          Stile di «{nomeKind}»: tema, colore, sfondo, decorazioni e testo in fondo.
        </div>
      </Sezione>
    </div>
  )
}
