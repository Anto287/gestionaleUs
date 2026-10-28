import { loadValue, saveValue } from '../services/storage'

let deviceId = ''

/** Identifica questa installazione del browser, senza fingerprint hardware. */
export function getDevice() {
  if (!deviceId) {
    deviceId = loadValue('__device_id') || crypto.randomUUID()
    saveValue('__device_id', deviceId)
  }
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Altro browser'
  const sistema = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iOS / iPadOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Altro sistema'
  return { id: deviceId, browser, sistema }
}
