import { createElement, Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Layout as AntLayout,
  Menu,
  Button,
  Drawer,
  Grid,
  Typography,
} from 'antd'
import {
  LogoutOutlined,
  SafetyOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useManagement } from '../management/useManagement'
import { useAuth } from '../auth/AuthContext'
import { useSeason } from '../season/SeasonContext'
import { useTema } from '../theme/TemaProvider'
import { DataProvider, DataFeedback } from '../data/DataProvider'
import { ArchivioProvider } from '../data/ArchivioProvider'
import { PalloneSpinner } from './PalloneSpinner'

const { Sider, Header, Content } = AntLayout
const { Text } = Typography

/** Segnaposto mentre si scarica il pezzo della pagina (vedi le lazy in App.tsx). */
function PaginaInArrivo() {
  return (
    <div className="pagina-in-arrivo">
      <PalloneSpinner />
    </div>
  )
}

function Brand() {
  const { logoClick } = useManagement()
  const { attiva } = useSeason()
  return (
    <div className="brand">
      <img
        className="brand-logo"
        onClick={logoClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logoClick() } }}
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt={config.clubName}
      />
      <Text className="brand-season">Stagione {attiva}</Text>
    </div>
  )
}

export function Layout() {
  const { attiva } = useSeason()
  return <DataProvider key={attiva}><LayoutPronto /></DataProvider>
}

function LayoutPronto() {
  const { esci } = useAuth()
  const { sbloccato: admin, logoClick, chiudi } = useManagement()
  const navigation = admin ? [...navItems, { to: '/management', label: 'Management', icon: SafetyOutlined, descrizione: 'Dispositivi e attività' }] : navItems
  const { tema, alterna } = useTema()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const [drawer, setDrawer] = useState(false)

  const isDesktop = screens.lg
  const sezione = navigation.find((n) => n.to !== '/' && (location.pathname === n.to || location.pathname.startsWith(n.to + '/'))) ?? navItems[0]

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[sezione.to]}
      items={navigation.map((item) => ({
        key: item.to,
        icon: createElement(item.icon),
        label: item.label,
      }))}
      onClick={({ key }) => {
        navigate(key)
        setDrawer(false)
      }}
      style={{ border: 'none' }}
    />
  )

  const sidebarContent = (
    <div className="sidebar-inner">
      <Brand />
      <div className="sidebar-nav">{menu}</div>
      <div className="sidebar-foot">
        <Button
          block
          icon={tema === 'scuro' ? <SunOutlined /> : <MoonOutlined />}
          onClick={alterna}
          style={{ marginBottom: 8 }}
        >
          {tema === 'scuro' ? 'Tema chiaro' : 'Tema scuro'}
        </Button>
        <Button block icon={<LogoutOutlined />} onClick={() => { chiudi(); void esci() }}>
          Esci
        </Button>
      </div>
    </div>
  )

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {isDesktop ? (
        <Sider theme="light" width={252} className="app-sider">
          {sidebarContent}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={drawer}
          onClose={() => setDrawer(false)}
          width={252}
          // stesso colore della sidebar (in scuro l'elevated di antd stona)
          styles={{
            body: { padding: 0 },
            content: { background: 'var(--cartoncino)' },
          }}
          className="app-drawer"
        >
          {sidebarContent}
        </Drawer>
      )}

      <AntLayout>
        {!isDesktop && (
          <Header className="app-topbar">
            <Button
              type="text"
              icon={<MenuOutlined />}
              aria-label="Apri menu"
              onClick={() => setDrawer(true)}
            />
            <img
              className="topbar-logo"
              onClick={logoClick}
              role="button"
              tabIndex={0}
              aria-label={config.clubName}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logoClick() } }}
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
            />
            <span className="topbar-title">
              {sezione.label}
            </span>
            <Button
              type="text"
              style={{ marginLeft: 'auto' }}
              icon={tema === 'scuro' ? <SunOutlined /> : <MoonOutlined />}
              onClick={alterna}
              aria-label={
                tema === 'scuro'
                  ? 'Passa al tema chiaro'
                  : 'Passa al tema scuro'
              }
            />
          </Header>
        )}
        <Content className="app-content">
          <DataFeedback />
            <ArchivioProvider
              attivo={
                location.pathname === '/archivio' ||
                location.pathname === '/rosa' ||
                location.pathname.startsWith('/rosa/')
              }
            >
              <div className="app-container">
                <Suspense fallback={<PaginaInArrivo />}>
                  <Outlet />
                </Suspense>
              </div>
            </ArchivioProvider>

        </Content>
      </AntLayout>
    </AntLayout>
  )
}
