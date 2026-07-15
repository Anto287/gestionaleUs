import type { ComponentType } from 'react'
import {
  DashboardOutlined,
  TeamOutlined,
  ScheduleOutlined,
  TrophyOutlined,
  ClusterOutlined,
  SolutionOutlined,
  InboxOutlined,
  WalletOutlined,
  FolderOpenOutlined,
  SettingOutlined,
} from '@ant-design/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType
  /** descrizione breve, usata nella dashboard */
  descrizione: string
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Panoramica', icon: DashboardOutlined, descrizione: 'Il colpo d’occhio sulla stagione.' },
  { to: '/rosa', label: 'Rosa', icon: TeamOutlined, descrizione: 'Giocatori e statistiche.' },
  { to: '/allenamenti', label: 'Allenamenti', icon: ScheduleOutlined, descrizione: 'Presenze alle sedute.' },
  { to: '/partite', label: 'Partite', icon: TrophyOutlined, descrizione: 'Risultati, marcatori e cartellini.' },
  { to: '/formazione', label: 'Formazione', icon: ClusterOutlined, descrizione: 'Genera titolari e panchina.' },
  { to: '/distinte', label: 'Distinte', icon: SolutionOutlined, descrizione: 'Genera la distinta per la partita.' },
  { to: '/magazzino', label: 'Magazzino', icon: InboxOutlined, descrizione: 'Scorte del bar.' },
  { to: '/conti', label: 'Conti', icon: WalletOutlined, descrizione: 'Entrate, uscite e insoluti.' },
  { to: '/documenti', label: 'Documenti', icon: FolderOpenOutlined, descrizione: 'Archivio della società.' },
  { to: '/impostazioni', label: 'Impostazioni', icon: SettingOutlined, descrizione: 'Stagioni e preferenze.' },
]
