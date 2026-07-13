import type { ReactNode } from 'react'
import { Typography } from 'antd'

const { Title, Text } = Typography

export function PageHeader({
  titolo,
  sottotitolo,
  azioni,
  onTitleClick,
}: {
  titolo: string
  sottotitolo?: string
  azioni?: ReactNode
  /** click/tocco sul blocco del titolo (usato per gesti nascosti) */
  onTitleClick?: () => void
}) {
  return (
    <div className="page-header">
      <div onClick={onTitleClick}>
        <Title level={3} className="page-title">
          {titolo}
        </Title>
        <span className="page-band" aria-hidden />
        {sottotitolo && (
          <Text type="secondary" className="page-sub">
            {sottotitolo}
          </Text>
        )}
      </div>
      {azioni && <div className="page-actions">{azioni}</div>}
    </div>
  )
}
