import type { ReactNode } from 'react'
import { Typography } from 'antd'

const { Title, Text } = Typography

export function PageHeader({
  titolo,
  sottotitolo,
  azioni,
}: {
  titolo: string
  sottotitolo?: string
  azioni?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {titolo}
        </Title>
        {sottotitolo && <Text type="secondary">{sottotitolo}</Text>}
      </div>
      {azioni && <div className="page-actions">{azioni}</div>}
    </div>
  )
}
