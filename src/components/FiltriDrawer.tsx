import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Drawer, Space } from 'antd'
import { FilterOutlined } from '@ant-design/icons'

/** Un campo del pannello filtri: etichetta sopra, controllo (Select…) sotto. */
export function FiltroCampo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filtro-campo">
      <span className="filtro-campo-label">{label}</span>
      {children}
    </div>
  )
}

/**
 * Pulsante "Filtri" con badge dei filtri attivi che apre un pannello laterale
 * (da destra) con i controlli. La ricerca testuale resta fuori, nella toolbar.
 */
export function FiltriDrawer({
  count,
  onReset,
  children,
}: {
  /** quanti filtri sono attivi (per il badge) */
  count: number
  onReset: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Badge count={count} size="small" offset={[-2, 2]}>
        <Button icon={<FilterOutlined />} onClick={() => setOpen(true)}>
          Filtri
        </Button>
      </Badge>
      <Drawer
        title="Filtri"
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={320}
        footer={
          <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onReset} disabled={!count}>
              Azzera
            </Button>
            <Button type="primary" onClick={() => setOpen(false)}>
              Chiudi
            </Button>
          </Space>
        }
      >
        <div className="filtri-panel">{children}</div>
      </Drawer>
    </>
  )
}
