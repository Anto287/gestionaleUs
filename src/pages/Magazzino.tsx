import { Grid, Tabs } from 'antd'
import {
  CoffeeOutlined,
  AppstoreOutlined,
  ToolOutlined,
  MedicineBoxOutlined,
  SkinOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { InventarioTab, type ConfigInventario } from './magazzino/InventarioTab'
import { DivisaManager } from './magazzino/DivisaManager'

/** Le scorte del bar: quantità e scadenze, come sempre. */
const BAR: ConfigInventario = {
  collezione: 'magazzino',
  nuovoLabel: 'Nuovo articolo',
  singolare: 'articolo',
  plurale: 'articoli',
  placeholderNome: 'es. Acqua naturale 0,5L',
  categorie: ['Bevande', 'Cibo', 'Caffetteria', 'Materiale', 'Altro'],
  conQuantita: true,
  conScadenza: true,
  vuotoText: 'Magazzino vuoto: aggiungi il primo articolo del bar.',
}

/** Materiale per gli allenamenti: palloni, cinesini, casacche… */
const MATERIALE: ConfigInventario = {
  collezione: 'materiale',
  nuovoLabel: 'Nuovo materiale',
  singolare: 'materiale',
  plurale: 'materiali',
  placeholderNome: 'es. Palloni misura 5',
  categorie: ['Palloni', 'Cinesini', 'Casacche', 'Delimitatori', 'Attrezzi', 'Altro'],
  conQuantita: true,
  conNote: true,
  vuotoText: 'Nessun materiale: aggiungi la roba da allenamento.',
}

/** Manutenzione del campo: ricambi, attrezzi, consumabili… */
const MANUTENZIONE: ConfigInventario = {
  collezione: 'manutenzione',
  nuovoLabel: 'Nuova voce',
  singolare: 'voce',
  plurale: 'voci',
  placeholderNome: 'es. Cinghia trattorino',
  categorie: ['Trattorino', 'Irrigazione', 'Attrezzi', 'Ricambi', 'Consumabili', 'Altro'],
  conQuantita: true,
  conNote: true,
  vuotoText: 'Niente qui: aggiungi ricambi e attrezzi per il campo.',
}

/** Borsa medica: prodotti con scadenza da tenere d'occhio. */
const BORSA_MEDICA: ConfigInventario = {
  collezione: 'borsaMedica',
  nuovoLabel: 'Nuovo prodotto',
  singolare: 'prodotto',
  plurale: 'prodotti',
  placeholderNome: 'es. Ghiaccio spray',
  categorie: ['Farmaci', 'Medicazioni', 'Ghiaccio/Spray', 'Strumenti', 'Altro'],
  conQuantita: true,
  conScadenza: true,
  conNote: true,
  vuotoText: 'Borsa vuota: aggiungi i prodotti della cassetta di pronto soccorso.',
}

export function Magazzino() {
  const screens = Grid.useBreakpoint()
  const tabs = [
    { key: 'bar', label: 'Bar', icon: <CoffeeOutlined />, children: <InventarioTab config={BAR} /> },
    {
      key: 'materiale',
      label: 'Materiale',
      icon: <AppstoreOutlined />,
      children: <InventarioTab config={MATERIALE} />,
    },
    {
      key: 'manutenzione',
      label: 'Manutenzione',
      icon: <ToolOutlined />,
      children: <InventarioTab config={MANUTENZIONE} />,
    },
    {
      key: 'borsa',
      label: 'Borsa medica',
      icon: <MedicineBoxOutlined />,
      children: <InventarioTab config={BORSA_MEDICA} />,
    },
    { key: 'tute', label: 'Tute da gara', icon: <SkinOutlined />, children: <DivisaManager /> },
  ]

  return (
    <>
      <PageHeader
        titolo="Magazzino"
        sottotitolo="Bar, materiale allenamento, manutenzione campo, borsa medica e tute da gara"
      />
      <Tabs defaultActiveKey="bar" items={tabs} size={screens.sm ? 'large' : 'middle'} />
    </>
  )
}
