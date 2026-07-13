import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@ant-design/v5-patch-for-react-19'
import { App as AntApp, ConfigProvider } from 'antd'
import itIT from 'antd/locale/it_IT'
import 'antd/dist/reset.css'
import { AuthProvider } from './auth/AuthContext'
import './styles/global.css'
import App from './App.tsx'

/**
 * Tema "programma della partita": carta calda, cartoncini bianchi,
 * rosso e oro del crest. I dettagli fuori portata dei token (titoli
 * condensed, fascia giallorossa, lametta del menu) sono in global.css.
 */
const theme = {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme} locale={itIT}>
      <AntApp>
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
)
