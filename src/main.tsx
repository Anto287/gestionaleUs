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

const theme = {
  token: {
    colorPrimary: '#c22026',
    colorLink: '#c22026',
    borderRadius: 8,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
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
