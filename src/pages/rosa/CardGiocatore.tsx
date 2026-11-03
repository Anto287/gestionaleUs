import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Popconfirm, Tag } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { iniziali, formatData } from '../../lib/format'
import { statoCertificato } from '../../lib/certificato'
import { statoScadenza } from '../../lib/scadenza'
import { isDirigente, isExtra, isGiocatore } from '../../lib/categoria'
import { coloreRuolo } from '../../ruoli'
import type { Giocatore } from '../../types'

export function CardGiocatore({ g, foto, presenze, quota, avvisoElimina, elimina }: { g: Giocatore; foto?: string; presenze: number; quota: ReactNode; avvisoElimina?: string; elimina: () => void }) {
  const cert = statoCertificato(g), doc = statoScadenza(g.scadenzaDocumento)
  const ruoli = [...new Set(g.ruoliAdattati || [])].filter((r) => r !== g.ruoloPreferito)
  return <article className="lista-card rosa-card">
    <Link className="rosa-card-identita" to={`/rosa/${g.id}`} aria-label={`Apri scheda di ${g.nome} ${g.cognome}`}>
      <Avatar src={foto} size={52} style={{ background: 'var(--rosso)', flex: 'none' }}>{iniziali(g)}</Avatar>
      <div className="rosa-card-nome">
        <strong>{g.cognome} {g.nome}</strong>
        <div className="rosa-card-ruolo">
          {g.numeroMaglia != null && <span className="rosa-card-numero">#{g.numeroMaglia}</span>}
          {g.ruoloPreferito && <Tag color={coloreRuolo(g.ruoloPreferito)}>{g.ruoloPreferito}</Tag>}
          {ruoli.length > 0 && <span>+{ruoli.length} ruoli</span>}
          {isDirigente(g) && <span>{g.categoria === 'entrambi' ? 'Gioc. + Dir.' : 'Dirigente'}</span>}
          {isExtra(g) && <span>Extra</span>}
        </div>
      </div>
    </Link>
    <div className="rosa-card-stato">
      {isGiocatore(g) && <span>Certificato <Tag color={cert.color}>{cert.label}</Tag></span>}
      {doc.critico && <Tag color={doc.color}>Documento {doc.label.toLowerCase()}</Tag>}
      {!g.tessera && <Tag color="orange">Tessera mancante</Tag>}
      {g.infortunato && <Tag color="red">Infortunato</Tag>}
    </div>
    {isGiocatore(g) && <div className="rosa-card-piede"><span>{presenze} {presenze === 1 ? 'presenza' : 'presenze'}</span><span className="rosa-card-quota">Quota {quota}</span></div>}
    <details className="rosa-card-dettagli">
      <summary>Dettagli</summary>
      <dl><div><dt>Tessera</dt><dd>{g.tessera || 'Mancante'}</dd></div>
        {g.ruoloDirigenza && <div><dt>Incarico</dt><dd>{g.ruoloDirigenza}</dd></div>}
        {ruoli.length > 0 && <div><dt>Ruoli adattati</dt><dd>{ruoli.map((r) => <Tag key={r} color={coloreRuolo(r)}>{r}</Tag>)}</dd></div>}
        <div><dt>Documento</dt><dd>{g.scadenzaDocumento ? `${doc.label ? doc.label + ' · ' : ''}${formatData(g.scadenzaDocumento)}` : 'Scadenza non indicata'}</dd></div>
      </dl>
      <Popconfirm title={`Eliminare ${g.nome} ${g.cognome}?`} description={avvisoElimina} okText="Elimina" cancelText="Annulla" okButtonProps={{ danger: true }} onConfirm={elimina}>
        <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Elimina ${g.nome} ${g.cognome}`}>Elimina tesserato</Button>
      </Popconfirm>
    </details>
  </article>
}
