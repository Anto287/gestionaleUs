import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Per le liste con filtri e tabella: la toolbar resta agganciata in alto
 * (position sticky, vedi .lista-toolbar / .filtri-aggancio in global.css) e
 * qui si misura quanto spazio occupa dal bordo del viewport, così il thead
 * della tabella (prop `sticky` di antd) si aggancia subito sotto di lei.
 */
export function useAggancioLista() {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [offsetHeader, setOffsetHeader] = useState(0)

  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const misura = () => {
      const top = parseFloat(getComputedStyle(el).top) || 0
      setOffsetHeader(Math.round(top + el.offsetHeight))
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    window.addEventListener('resize', misura)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', misura)
    }
  }, [])

  return { toolbarRef, offsetHeader }
}
