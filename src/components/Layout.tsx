import { createElement, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Drawer, Grid, Typography } from 'antd'
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons'
import { config } from '../config'
import { navItems } from '../nav'
import { useAuth } from '../auth/AuthContext'
import { useSeason } from '../season/SeasonContext'
import { DataProvider } from '../data/DataProvider'

const { Sider, Header, Content } = AntLayout
const { Text } = Typography

function Brand() {
  const { attiva } = useSeason()
  return (
    <div className="brand">
      <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt={config.clubName} />
      <Text className="brand-season">Stagione {attiva}</Text>
    </div>
  )
}

export function Layout() {
  const { esci } = useAuth()
  const { attiva } = useSeason()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const [drawer, setDrawer] = useState(false)

  const isDesktop = screens.lg

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={navItems.map((item) => ({
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
        <Button block icon={<LogoutOutlined />} onClick={esci}>
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
          styles={{ body: { padding: 0 } }}
          className="app-drawer"
        >
          {sidebarContent}
        </Drawer>
      )}

      <AntLayout>
        {!isDesktop && (
          <Header className="app-topbar">
            <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawer(true)} />
            <img className="topbar-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
            <span className="topbar-title">
              {navItems.find((n) => n.to === location.pathname)?.label ?? config.clubName}
            </span>
          </Header>
        )}
        <Content className="app-content">
          <DataProvider key={attiva}>
            <div className="app-container">
              <Outlet />
            </div>
          </DataProvider>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
