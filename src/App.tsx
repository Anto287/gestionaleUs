import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './auth/AuthContext'
import { SeasonProvider } from './season/SeasonContext'
import { Gate } from './components/Gate'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Rosa } from './pages/Rosa'
import { GiocatoreDettaglio } from './pages/GiocatoreDettaglio'
import { Allenamenti } from './pages/Allenamenti'
import { Partite } from './pages/Partite'
import { PartitaDettaglio } from './pages/PartitaDettaglio'
import { Magazzino } from './pages/Magazzino'
import { Conti } from './pages/Conti'
import { Documenti } from './pages/Documenti'
import { Impostazioni } from './pages/Impostazioni'

// caricata su richiesta: porta con sé jspdf/html2canvas (pesanti)
const Distinte = lazy(() => import('./pages/Distinte').then((m) => ({ default: m.Distinte })))

function Caricamento() {
  return (
    <div className="drive-splash">
      <Spin size="large" />
    </div>
  )
}

function App() {
  const { sbloccato } = useAuth()

  if (!sbloccato) return <Gate />

  return (
    <SeasonProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rosa" element={<Rosa />} />
          <Route path="/rosa/:id" element={<GiocatoreDettaglio />} />
          <Route path="/allenamenti" element={<Allenamenti />} />
          <Route path="/partite" element={<Partite />} />
          <Route path="/partite/:id" element={<PartitaDettaglio />} />
          <Route
            path="/distinte"
            element={
              <Suspense fallback={<Caricamento />}>
                <Distinte />
              </Suspense>
            }
          />
          <Route path="/magazzino" element={<Magazzino />} />
          <Route path="/conti" element={<Conti />} />
          <Route path="/documenti" element={<Documenti />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SeasonProvider>
  )
}

export default App
