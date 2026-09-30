/** Il prato del campo verticale (porta nostra in basso), sotto i token dei giocatori. */
export function ErbaCampo() {
  return (
    <svg className="campo-erba" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="0" width="100" height="150" fill="#2f8f4e" />
      {/* fasce d'erba alternate */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="0" y={i * 25} width="100" height="12.5" fill="#2b8549" opacity="0.55" />
      ))}
      <g stroke="#ffffff" strokeWidth="0.5" fill="none" opacity="0.8">
        <rect x="3" y="3" width="94" height="144" />
        <line x1="3" y1="75" x2="97" y2="75" />
        <circle cx="50" cy="75" r="11" />
        <circle cx="50" cy="75" r="0.8" fill="#fff" />
        {/* area in basso (porta nostra) */}
        <rect x="22" y="123" width="56" height="24" />
        <rect x="37" y="139" width="26" height="8" />
        {/* area in alto */}
        <rect x="22" y="3" width="56" height="24" />
        <rect x="37" y="3" width="26" height="8" />
      </g>
    </svg>
  )
}

/** Posizione in % di uno slot del modulo sul campo. */
export function posizioneSlot(s: { x: number; y: number }): { left: string; top: string } {
  return { left: `${5 + s.x * 90}%`, top: `${5 + (1 - s.y) * 90}%` }
}
