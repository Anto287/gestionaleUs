import { useEffect, useRef } from 'react'
import { App as AntApp, Button } from 'antd'
import { UndoOutlined } from '@ant-design/icons'
import type { Collection } from './useCollection'

// messaggi «Annulla» ancora aperti: vanno chiusi quando cambia la stagione,
// altrimenti l'annulla ripristinerebbe nel DataProvider vecchio
const chiaviAperte = new Set<string>()

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
    chiaviAperte.add(key)
    message.open({
      key,
      type: 'success',
      duration: 6,
      onClose: () => chiaviAperte.delete(key),
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
              chiaviAperte.delete(key)
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

/** Chiude i messaggi «Annulla» aperti quando il componente (il DataProvider) si smonta. */
export function useChiudiUndoAlloSmontaggio() {
  const { message } = AntApp.useApp()
  // ref: la pulizia deve girare solo allo smontaggio, non se cambia l'istanza
  const msgRef = useRef(message)
  useEffect(() => {
    msgRef.current = message
  }, [message])
  useEffect(
    () => () => {
      for (const k of chiaviAperte) msgRef.current.destroy(k)
      chiaviAperte.clear()
    },
    [],
  )
}
