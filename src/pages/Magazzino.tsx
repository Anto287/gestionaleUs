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
  conNote: true,
  vuotoText: 'Magazzino vuoto: aggiungi il primo articolo del bar.',
  conCompilazione: true,
  esempioCompilazione: 'es. "4 patatine chips che scadono il 28/08/2026"',
  // radici di parola per indovinare la categoria dalla frase; la prima che compare vince
  paroleCategoria: {
    Caffetteria: ['caffè', 'caffe', 'cialde', 'capsule', 'zucchero', 'orzo', 'ginseng', 'camomilla', 'tisan'],
    Cibo: [
      'patatine',
      'chips',
      'snack',
      'cioccolat',
      'merendin',
      'caramell',
      'biscott',
      'cracker',
      'panin',
      'pizzett',
      'brioche',
      'croissant',
      'gomme',
      'wafer',
      'tarall',
      'nocciolin',
      'arachidi',
      'salatin',
      'gelat',
    ],
    Bevande: [
      'acqua',
      'bibit',
      'coca',
      'cola',
      'fanta',
      'sprite',
      'aranciata',
      'succ',
      'birra',
      'chinotto',
      'gassosa',
      'estath',
      'energy',
      'tè',
      'thè',
    ],
    Materiale: [
      'bicchier',
      'piatt',
      'tovagliol',
      'posate',
      'forchett',
      'cucchia',
      'coltell',
      'vassoi',
      'sacchett',
      'cannucc',
      'carta',
      'stovigli',
    ],
  },
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
  conCompilazione: true,
  esempioCompilazione: 'es. "6 palloni misura 5"',
  paroleCategoria: {
    Palloni: ['pallon', 'palla', 'palle'],
    Cinesini: ['cinesin'],
    Casacche: ['casacc', 'pettorin', 'fratin'],
    Delimitatori: ['delimitator', 'palett', 'coni', 'cono', 'cerchi', 'ostacol', 'sagome'],
    Attrezzi: ['attrezz', 'pompa', 'rete', 'reti', 'scalett', 'porte', 'porticine', 'gonfiator'],
  },
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
  conCompilazione: true,
  esempioCompilazione: 'es. "2 cinghie per il trattorino"',
  paroleCategoria: {
    Trattorino: ['trattorin', 'trattore', 'rasaerba', 'tagliaerba'],
    Irrigazione: ['irrigat', 'irrigazione', 'tubo', 'tubi', 'ugell', 'pompa'],
    Ricambi: ['ricamb', 'cinghi', 'candela', 'filtro', 'batteria', 'lama', 'lame'],
    Consumabili: ['benzina', 'miscela', 'olio', 'vernice', 'gesso', 'sement', 'concime', 'fertilizzant', 'sabbia'],
    Attrezzi: ['attrezz', 'rastrell', 'pala', 'carriola', 'decespugliator', 'soffiator', 'scopa'],
  },
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
  conCompilazione: true,
  esempioCompilazione: 'es. "3 ghiaccio spray che scadono a maggio 2027"',
  paroleCategoria: {
    'Ghiaccio/Spray': ['ghiaccio', 'spray', 'ice'],
    Medicazioni: [
      'cerott',
      'bend',
      'garz',
      'medicaz',
      'compress',
      'tampon',
      'disinfettant',
      'betadine',
      'amuchina',
      'acqua ossigenata',
      'cotone',
      'sutur',
    ],
    Farmaci: [
      'farmac',
      'aspirin',
      'paracetamol',
      'tachipirin',
      'ibuprofen',
      'oki',
      'moment',
      'brufen',
      'antinfiammator',
      'pomata',
      'voltaren',
      'lasonil',
      'arnica',
      'crema',
    ],
    Strumenti: ['forbic', 'termometr', 'pinzett', 'guant', 'laccio', 'strument', 'kit'],
  },
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
