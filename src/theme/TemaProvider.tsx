import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import itIT from 'antd/es/locale/it_IT'
import type { ThemeConfig } from 'antd'

export type Tema = 'chiaro' | 'scuro'

const CHIAVE = 'usriolunato:tema'

/**
 * Tema "programma della partita": carta calda, cartoncini bianchi,
 * rosso e oro del crest. I dettagli fuori portata dei token (titoli
 * condensed, fascia giallorossa, lametta del menu) sono in global.css.
 */
const chiaro: ThemeConfig = {
  token: {
    colorPrimary: '#c22026',
    colorLink: '#c22026',
    colorText: '#241d16',
    colorTextSecondary: '#75695a',
    colorTextTertiary: '#9c9184',
    colorBgLayout: '#f5f2eb',
    colorBorder: '#dcd2c2',
    colorBorderSecondary: '#ece4d6',
    borderRadius: 10,
    controlHeight: 36,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  components: {
    Layout: { siderBg: '#ffffff', headerBg: '#ffffff', bodyBg: '#f5f2eb' },
    Menu: {
      itemHeight: 42,
      itemBorderRadius: 10,
      itemColor: '#4d453b',
      itemSelectedBg: '#f9ebe6',
      itemSelectedColor: '#c22026',
      itemHoverBg: '#f4efe5',
    },
    Card: { borderRadiusLG: 14 },
    Modal: { borderRadiusLG: 14 },
    Table: {
      headerBg: '#ffffff',
      headerColor: '#8a7d6b',
      headerSplitColor: 'transparent',
      rowHoverBg: '#faf6ec',
      borderColor: '#efe8da',
    },
    Statistic: { titleFontSize: 11, contentFontSize: 30 },
  },
}

/** Variante notturna: stessa identità giallorossa su carta scura. */
const scuro: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#d4373d',
    colorLink: '#e0565b',
    colorText: '#ece5da',
    colorTextSecondary: '#a89c8c',
    colorTextTertiary: '#8a7d6b',
    colorBgLayout: '#16120d',
    colorBgContainer: '#211b14',
    colorBgElevated: '#2b241a',
    colorBorder: '#463c2e',
    colorBorderSecondary: '#3a3227',
    borderRadius: 10,
    controlHeight: 36,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  components: {
    Layout: { siderBg: '#211b14', headerBg: '#211b14', bodyBg: '#16120d' },
    Menu: {
      itemHeight: 42,
      itemBorderRadius: 10,
      itemColor: '#cfc4b2',
      itemSelectedBg: 'rgba(212, 55, 61, 0.18)',
      itemSelectedColor: '#ff9497',
      itemHoverBg: 'rgba(255, 255, 255, 0.05)',
    },
    Card: { borderRadiusLG: 14 },
    Modal: { borderRadiusLG: 14 },
    Table: {
      headerBg: '#211b14',
      headerColor: '#a89c8c',
      headerSplitColor: 'transparent',
      rowHoverBg: '#2b241a',
      borderColor: '#3a3227',
    },
    Statistic: { titleFontSize: 11, contentFontSize: 30 },
  },
}

interface TemaValue {
  tema: Tema
  alterna: () => void
}

const TemaContext = createContext<TemaValue>({ tema: 'chiaro', alterna: () => {} })

function temaIniziale(): Tema {
  const salvato = localStorage.getItem(CHIAVE)
  if (salvato === 'scuro' || salvato === 'chiaro') return salvato
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'scuro' : 'chiaro'
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaIniziale)

  useEffect(() => {
    // global.css legge questo attributo per le variabili CSS fuori dai token antd
    document.documentElement.dataset.tema = tema
    localStorage.setItem(CHIAVE, tema)
  }, [tema])

  return (
    <TemaContext.Provider value={{ tema, alterna: () => setTema((t) => (t === 'scuro' ? 'chiaro' : 'scuro')) }}>
      <ConfigProvider theme={tema === 'scuro' ? scuro : chiaro} locale={itIT}>
        {children}
      </ConfigProvider>
    </TemaContext.Provider>
  )
}

export function useTema(): TemaValue {
  return useContext(TemaContext)
}
