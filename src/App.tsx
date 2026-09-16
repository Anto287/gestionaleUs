import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { SeasonProvider } from './season/SeasonContext'
import { Gate } from './components/Gate'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'

/**
 * Solo la Panoramica parte insieme all'app: ogni altra pagina si scarica
 * quando ci si entra (poi il service worker se la tiene). Così all'apertura
 * il telefono non tira giù anche Recharts, Konva, jsPDF e compagnia, che
 * servono in tre pagine su sedici. Il segnaposto durante il caricamento lo
 * mette il Layout, intorno all'Outlet.
 */
const Rosa = lazy(() => import('./pages/Rosa').then((m) => ({ default: m.Rosa })))
const GiocatoreDettaglio = lazy(() =>
  import('./pages/GiocatoreDettaglio').then((m) => ({ default: m.GiocatoreDettaglio })),
)
const Allenamenti = lazy(() => import('./pages/Allenamenti').then((m) => ({ default: m.Allenamenti })))
const Partite = lazy(() => import('./pages/Partite').then((m) => ({ default: m.Partite })))
const PartitaDettaglio = lazy(() =>
  import('./pages/PartitaDettaglio').then((m) => ({ default: m.PartitaDettaglio })),
)
const Formazione = lazy(() => import('./pages/Formazione').then((m) => ({ default: m.Formazione })))
const Piazzati = lazy(() => import('./pages/Piazzati').then((m) => ({ default: m.Piazzati })))
const Calendario = lazy(() => import('./pages/Calendario').then((m) => ({ default: m.Calendario })))
const Statistiche = lazy(() => import('./pages/Statistiche').then((m) => ({ default: m.Statistiche })))
const Distinte = lazy(() => import('./pages/Distinte').then((m) => ({ default: m.Distinte })))
const Social = lazy(() => import('./pages/Social').then((m) => ({ default: m.Social })))
const Magazzino = lazy(() => import('./pages/Magazzino').then((m) => ({ default: m.Magazzino })))
const Conti = lazy(() => import('./pages/Conti').then((m) => ({ default: m.Conti })))
const Spese = lazy(() => import('./pages/Spese').then((m) => ({ default: m.Spese })))
const Documenti = lazy(() => import('./pages/Documenti').then((m) => ({ default: m.Documenti })))
const Archivio = lazy(() => import('./pages/Archivio').then((m) => ({ default: m.Archivio })))
const Impostazioni = lazy(() => import('./pages/Impostazioni').then((m) => ({ default: m.Impostazioni })))

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
          <Route path="/formazione" element={<Formazione />} />
          <Route path="/piazzati" element={<Piazzati />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/statistiche" element={<Statistiche />} />
          <Route path="/distinte" element={<Distinte />} />
          <Route path="/social" element={<Social />} />
          <Route path="/magazzino" element={<Magazzino />} />
          <Route path="/conti" element={<Conti />} />
          <Route path="/spese" element={<Spese />} />
          <Route path="/documenti" element={<Documenti />} />
          <Route path="/archivio" element={<Archivio />} />
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SeasonProvider>
  )
}

export default App
