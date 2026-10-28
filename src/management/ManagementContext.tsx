import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { callDrive, driveAttivo, getSecret } from '../services/driveStore'
import { loadValue, removeValue, saveValue } from '../services/storage'

import { Context } from './useManagement'

const SESSION_KEY = '__management_token'

export function ManagementProvider({ children }: { children: ReactNode }) {
  const { sbloccato: accessoApp } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState<string | null>(() => loadValue(SESSION_KEY))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm()
  const clicks = useRef({ count: 0, start: 0 })
  const generation = useRef(0)
  const hello = useRef(false)
  const credentials = useRef<{ token: string; secret: string } | null>(session ? { token: session, secret: getSecret() } : null)

  const chiudi = useCallback(() => {
    generation.current++
    const previous = credentials.current
    credentials.current = null
    if (!previous || loadValue(SESSION_KEY) === previous.token) removeValue(SESSION_KEY)
    if (previous) void callDrive({ action: 'managementLogout', adminToken: previous.token, secret: previous.secret }).catch(() => undefined)
    setSession(null)
    setOpen(false)
    form.resetFields()
  }, [form])

  // La chiusura della pagina non equivale alla disconnessione.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== `usriolunato:${SESSION_KEY}`) return
      generation.current++
      const token = loadValue(SESSION_KEY)
      credentials.current = token ? { token, secret: getSecret() } : null
      setSession(token)
      setOpen(false)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
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
    let active = true
    void callDrive({ action: 'managementSession', secret: getSecret(), adminToken: session }).then((res) => {
      if (active && res.code === 'ADMIN_AUTH' && credentials.current?.token === session) chiudi()
    }).catch(() => undefined) // Un errore di rete non cancella l'accesso ricordato.
    return () => { active = false }
  }, [session, chiudi])

  function logoClick() {
    const now = Date.now()
    const count = now - clicks.current.start <= 3000 ? clicks.current.count + 1 : 1
    clicks.current = { count, start: count === 1 ? now : clicks.current.start }
    if (count < 5) return
    clicks.current.count = 0
    if (session) { navigate('/management'); return }
    setError('')
    setOpen(true)
  }

  async function login({ password }: { password: string }) {
    setBusy(true)
    setError('')
    const current = generation.current
    const secret = getSecret()
    try {
      if (!driveAttivo()) throw new Error('Il Management richiede Google Drive e lo script aggiornato.')
      const res = await callDrive({ action: 'managementLogin', secret, password })
      if (generation.current !== current) {
        if (res.ok && res.token) void callDrive({ action: 'managementLogout', adminToken: res.token, secret }).catch(() => undefined)
        return
      }
      if (!res.ok) throw new Error(res.error === 'azione sconosciuta' ? 'Aggiorna Google Apps Script per attivare il Management.' : res.error || 'Accesso non riuscito')
      if (!res.persistent) {
        void callDrive({ action: 'managementLogout', adminToken: res.token, secret }).catch(() => undefined)
        throw new Error('Aggiorna e ripubblica Google Apps Script per attivare l’accesso Management persistente.')
      }
      saveValue(SESSION_KEY, res.token)
      if (loadValue(SESSION_KEY) !== res.token) {
        void callDrive({ action: 'managementLogout', adminToken: res.token, secret }).catch(() => undefined)
        throw new Error('Il browser non permette di memorizzare l’accesso. Abilita il salvataggio dei dati del sito e riprova.')
      }
      credentials.current = { token: res.token, secret }
      setSession(res.token)
      setOpen(false)
      form.resetFields()
      navigate('/management')
    } catch (e) { if (generation.current === current) setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const request = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}): Promise<T> => {
    if (!session) throw new Error('Accedi al Management dal logo.')
    const res = await callDrive({ ...body, action, secret: getSecret(), adminToken: session, requestId: crypto.randomUUID() })
    if (!res.ok) {
      if (res.code === 'ADMIN_AUTH' && credentials.current?.token === session) chiudi()
      throw new Error(res.error || 'Operazione non riuscita')
    }
    return res as T
  }, [session, chiudi])

  return <Context.Provider value={{ sbloccato: !!session && accessoApp, logoClick, chiudi, request }}>
    {children}
    <Modal title="Accesso Management" open={open && accessoApp} onCancel={chiudi} onOk={() => form.submit()} okText="Accedi" okButtonProps={{ 'aria-label': 'Accedi' }} cancelText="Annulla" confirmLoading={busy} forceRender>
      <p>L’accesso resta attivo su questo browser fino alla disconnessione. La voce Management rimarrà nel menu.</p>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={login} preserve={false}>
        <Form.Item name="password" label="Password amministratore" rules={[{ required: true, message: 'Inserisci la password amministratore' }]}>
          <Input.Password aria-label="Password amministratore" autoFocus autoComplete="off" disabled={busy} />
        </Form.Item>
      </Form>
    </Modal>
  </Context.Provider>
}
