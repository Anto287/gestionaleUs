import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { callDrive, driveAttivo, getSecret } from '../services/driveStore'

import { Context } from './useManagement'

export function ManagementProvider({ children }: { children: ReactNode }) {
  const { sbloccato: accessoApp } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState<{ token: string; expiresAt: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm()
  const clicks = useRef({ count: 0, start: 0 })
  const generation = useRef(0)
  const hello = useRef(false)
  const credentials = useRef<{ token: string; secret: string } | null>(null)

  const chiudi = useCallback(() => {
    generation.current++
    const previous = credentials.current
    credentials.current = null
    if (previous) void callDrive({ action: 'managementLogout', adminToken: previous.token, secret: previous.secret }).catch(() => undefined)
    setSession(null)
    setOpen(false)
    form.resetFields()
  }, [form])

  useEffect(() => () => {
    const previous = credentials.current
    credentials.current = null
    if (previous) void callDrive({ action: 'managementLogout', adminToken: previous.token, secret: previous.secret }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!accessoApp) { chiudi(); hello.current = false; return }
    if (driveAttivo() && !hello.current) {
      hello.current = true
      // Non blocca l'app se lo script non è ancora aggiornato.
      void callDrive({ action: 'deviceHello', secret: getSecret(), requestId: crypto.randomUUID() }).catch(() => undefined)
    }
  }, [accessoApp, chiudi])

  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(chiudi, Math.max(0, session.expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [session, chiudi])

  function logoClick() {
    const now = Date.now()
    const count = now - clicks.current.start <= 3000 ? clicks.current.count + 1 : 1
    clicks.current = { count, start: count === 1 ? now : clicks.current.start }
    if (count < 5) return
    clicks.current.count = 0
    if (session && session.expiresAt > now) { navigate('/management'); return }
    setError('')
    setOpen(true)
  }

  async function login({ password }: { password: string }) {
    setBusy(true)
    setError('')
    const current = generation.current
    try {
      if (!driveAttivo()) throw new Error('Il Management richiede Google Drive e lo script aggiornato.')
      const res = await callDrive({ action: 'managementLogin', secret: getSecret(), password })
      if (generation.current !== current) {
        if (res.ok && res.token) void callDrive({ action: 'managementLogout', adminToken: res.token, secret: getSecret() }).catch(() => undefined)
        return
      }
      if (!res.ok) throw new Error(res.error === 'azione sconosciuta' ? 'Aggiorna Google Apps Script per attivare il Management.' : res.error || 'Accesso non riuscito')
      credentials.current = { token: res.token, secret: getSecret() }
      setSession({ token: res.token, expiresAt: Date.now() + res.expiresIn * 1000 })
      setOpen(false)
      form.resetFields()
      navigate('/management')
    } catch (e) { if (generation.current === current) setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const request = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}): Promise<T> => {
    if (!session || Date.now() >= session.expiresAt) { chiudi(); throw new Error('Sessione amministratore scaduta.') }
    const res = await callDrive({ ...body, action, secret: getSecret(), adminToken: session.token, requestId: crypto.randomUUID() })
    if (!res.ok) {
      if (res.code === 'ADMIN_AUTH') chiudi()
      throw new Error(res.error || 'Operazione non riuscita')
    }
    return res as T
  }, [session, chiudi])

  return <Context.Provider value={{ sbloccato: !!session && session.expiresAt > Date.now() && accessoApp, logoClick, chiudi, request }}>
    {children}
    <Modal title="Accesso Management" open={open && accessoApp} onCancel={chiudi} onOk={() => form.submit()} okText="Accedi" okButtonProps={{ 'aria-label': 'Accedi' }} cancelText="Annulla" confirmLoading={busy} destroyOnHidden>
      <p>Inserisci la password amministratore. La sessione dura 30 minuti.</p>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={login} preserve={false}>
        <Form.Item name="password" label="Password amministratore" rules={[{ required: true, message: 'Inserisci la password amministratore' }]}>
          <Input.Password aria-label="Password amministratore" autoFocus autoComplete="off" disabled={busy} />
        </Form.Item>
      </Form>
    </Modal>
  </Context.Provider>
}
