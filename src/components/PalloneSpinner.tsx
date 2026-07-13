import { useId } from 'react'

/**
 * Lo spinner del gestionale: un pallone da calcio che rotola a mezz'aria
 * sopra la sua ombra. Il disegno è quello classico del pallone visto di
 * fronte — tacca pentagonale al centro, cuciture verso le tacche sul
 * bordo, ritagliate dal cerchio. Stili e animazioni in styles/global.css.
 */
export function PalloneSpinner({ size = 56 }: { size?: number }) {
  const clipId = useId()
  return (
    <div className="pallone-spinner" role="status" aria-label="Caricamento">
      <div className="pallone-salto">
        <svg className="pallone" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
          <clipPath id={clipId}>
            <circle cx="32" cy="32" r="29" />
          </clipPath>
          <circle cx="32" cy="32" r="29" fill="#fff" />
          <g clipPath={`url(#${clipId})`} fill="currentColor" stroke="currentColor">
            <polygon
              stroke="none"
              points="32,21.5 41.99,28.76 38.17,40.49 25.83,40.49 22.01,28.76"
            />
            <g strokeWidth="2.6">
              <line x1="32" y1="21.5" x2="32" y2="8.8" />
              <line x1="41.99" y1="28.76" x2="54.06" y2="24.83" />
              <line x1="38.17" y1="40.49" x2="45.64" y2="50.77" />
              <line x1="25.83" y1="40.49" x2="18.36" y2="50.77" />
              <line x1="22.01" y1="28.76" x2="9.94" y2="24.83" />
            </g>
            <g stroke="none">
              <polygon points="32,9.5 23.44,3.28 26.71,-6.78 37.29,-6.78 40.56,3.28" />
              <polygon points="53.4,25.05 56.67,14.98 67.25,14.98 70.52,25.05 61.96,31.27" />
              <polygon points="45.23,50.2 55.81,50.2 59.07,60.27 50.52,66.48 41.96,60.27" />
              <polygon points="18.77,50.2 22.04,60.27 13.48,66.48 4.93,60.27 8.19,50.2" />
              <polygon points="10.6,25.05 2.04,31.27 -6.52,25.05 -3.25,14.98 7.33,14.98" />
            </g>
          </g>
          <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
      </div>
      <div className="pallone-ombra" style={{ width: size * 0.72 }} />
    </div>
  )
}
