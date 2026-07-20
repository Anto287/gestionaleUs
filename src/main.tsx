import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@ant-design/v5-patch-for-react-19'
import { App as AntApp } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/it'
import 'antd/dist/reset.css'

dayjs.locale('it')
import { AuthProvider } from './auth/AuthContext'
import { TemaProvider } from './theme/TemaProvider'
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemaProvider>
      <AntApp>
        <HashRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </AntApp>
    </TemaProvider>
  </StrictMode>,
)
