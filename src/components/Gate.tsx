import { useState } from 'react'
import { Button, Card, Form, Input, Typography, Alert } from 'antd'
import { config } from '../config'
import { useAuth } from '../auth/AuthContext'

const { Title, Text } = Typography

/** Schermata di accesso: la password è la chiave del Drive. */
export function Gate() {
  const { sblocca } = useAuth()
  const [errore, setErrore] = useState(false)
  const [verifica, setVerifica] = useState(false)

  async function onFinish({ password }: { password: string }) {
    setVerifica(true)
    setErrore(false)
    const ok = await sblocca(password)
    if (!ok) setErrore(true)
    setVerifica(false)
  }

  return (
    <div className="gate">
      <Card className="gate-card" variant="borderless">
        <div className="gate-bar" />
        <img className="gate-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt={config.clubName} />
        <Title level={3} className="gate-title">
          Gestionale
        </Title>
        <Text type="secondary" className="gate-sub">
          Accesso riservato alla società
        </Text>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} style={{ marginTop: 20 }}>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Inserisci la password' }]}
          >
            <Input.Password
              autoFocus
              size="large"
              placeholder="••••••••"
              onChange={() => setErrore(false)}
            />
          </Form.Item>

          {errore && (
            <Alert
              type="error"
              message="Password errata. Riprova."
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Button type="primary" htmlType="submit" size="large" block loading={verifica}>
            Entra
          </Button>
        </Form>
      </Card>
      <Text type="secondary" className="gate-foot">
        Stagione {config.season}
      </Text>
    </div>
  )
}
