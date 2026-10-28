const POPUP = '.ant-select-dropdown, .ant-dropdown, .ant-picker-dropdown, .ant-cascader-dropdown, .ant-tree-select-dropdown'
let avviato = false

/** Ferma soltanto il gesto che uscirebbe dal popup, lasciando scorrere le
 * liste interne e senza bloccare la pagina dopo la chiusura del menu. */
export function avviaScrollPopup() {
  if (avviato) return
  avviato = true
  let gesture: { root: Element; x: number; y: number } | null = null

  function puoScorrere(target: Element, root: Element, dx: number, dy: number) {
    for (let node: Element | null = target; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      const vertical = Math.abs(dy) >= Math.abs(dx)
      const overflow = vertical ? style.overflowY : style.overflowX
      const position = vertical ? node.scrollTop : node.scrollLeft
      const max = vertical ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth
      const delta = vertical ? dy : dx
      if (/auto|scroll/.test(overflow) && max > 1 && (delta < 0 ? position > 0 : position < max - 1)) return true
      if (node === root) break
    }
    return false
  }

  document.addEventListener('touchstart', (event) => {
    gesture = null
    if (event.touches.length !== 1 || !(event.target instanceof Element)) return
    const root = event.target.closest(POPUP)
    if (root) gesture = { root, x: event.touches[0].clientX, y: event.touches[0].clientY }
  }, { passive: true, capture: true })

  document.addEventListener('touchmove', (event) => {
    if (!gesture || !gesture.root.isConnected || event.touches.length !== 1 || !(event.target instanceof Element)) return
    const touch = event.touches[0]
    const dx = gesture.x - touch.clientX, dy = gesture.y - touch.clientY
    gesture.x = touch.clientX
    gesture.y = touch.clientY
    if ((dx || dy) && !puoScorrere(event.target, gesture.root, dx, dy) && event.cancelable) event.preventDefault()
  }, { passive: false, capture: true })

  const end = () => { gesture = null }
  document.addEventListener('touchend', end, { passive: true })
  document.addEventListener('touchcancel', end, { passive: true })
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey || !(event.target instanceof Element)) return
    const root = event.target.closest(POPUP)
    if (root && !puoScorrere(event.target, root, event.deltaX, event.deltaY) && event.cancelable) event.preventDefault()
  }, { passive: false, capture: true })
}
