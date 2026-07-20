import { App as AntApp, Button } from 'antd'
import { UndoOutlined } from '@ant-design/icons'
import type { Collection } from './useCollection'

/**
 * Eliminazione con ripensamento: rimuove il record e mostra un toast con
 * «Annulla» per qualche secondo. L'annulla rimette il record com'era, con lo
 * stesso id (così presenze, marcatori e riferimenti restano validi).
 */
export function useEliminaUndo() {
  const { message } = AntApp.useApp()

  return function elimina<T extends { id: string }>(coll: Collection<T>, item: T, testo: string) {
    coll.remove(item.id)
    const key = `undo-${item.id}-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      content: (
        <span>
          {testo}
          <Button
            size="small"
            type="link"
            icon={<UndoOutlined />}
            style={{ paddingInline: 6 }}
            onClick={() => {
              coll.ripristina(item)
              message.destroy(key)
            }}
          >
            Annulla
          </Button>
        </span>
      ),
    })
  }
}
