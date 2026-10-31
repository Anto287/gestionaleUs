import { useEffect, useState } from 'react'
import { leggiLogo, type LogoSquadra } from '../lib/loghi'
export function LogoMiniatura({ logo }: { logo: LogoSquadra }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => { let active = true; setSrc(undefined); void leggiLogo(logo).then(s => { if(active) setSrc(s) }).catch(() => undefined); return () => { active = false } }, [logo])
  return src ? <img src={src} alt={`Logo ${logo.nome}`} style={{ width:'100%', height:100, objectFit:'contain' }} /> : <div style={{ height:100 }}>Stemma {logo.nome}</div>
}
