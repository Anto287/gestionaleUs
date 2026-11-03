import { createRoot } from 'react-dom/client'
import { App, Alert, Button, Card, Space } from 'antd'
import { TemaProvider } from '../src/theme/TemaProvider'
import { AffluenzaChart } from '../src/pages/allenamenti/AffluenzaChart'
import { BilancioMensile } from '../src/pages/conti/BilancioMensile'
import { PerCategoria } from '../src/pages/conti/PerCategoria'
import { GolChart } from '../src/pages/statistiche/GolChart'
import '@ant-design/v5-patch-for-react-19'
import 'antd/dist/reset.css'
import '../src/styles/global.css'
const lungo = 'Errore durante il salvataggio: la richiesta non è stata completata. '.repeat(8) + 'https://esempio.it/' + 'documento'.repeat(30) + ' FINE MESSAGGIO'
function Harness() {
 const { message, notification } = App.useApp()
 return <div className="app-content"><main className="app-container">
  <Space wrap><Button onClick={() => message.error({ content: lungo, duration: 0 })}>Mostra messaggio lungo</Button><Button onClick={() => notification.error({ message: 'Errore con descrizione lunga', description: lungo, duration: 0 })}>Mostra notifica lunga</Button></Space>
  <Alert showIcon type="warning" message="Una modifica non è stata salvata sul Drive" description={lungo} action={<Button>Riprova salvataggio</Button>} style={{ margin: '20px 0' }} />
  <p className="tronca">{'Descrizione importante con contenuto completo '.repeat(8)}FINE TESTO</p>
  <Card title="Presenze"><AffluenzaChart dati={[{ label: '01/10', valore: 7 }, { label: '02/10', valore: 12 }, { label: '03/10', valore: 9 }]} scala={16} media={28/3} /></Card>
  <Card title="Andamento"><AffluenzaChart tipo="linea" dati={[{ label: '01/10', valore: 7 }, { label: '02/10', valore: 12 }, { label: '03/10', valore: 9 }]} scala={16} media={28/3} /></Card>
  <Card title="Bilancio"><BilancioMensile dati={[{ mese: '09/2026', entrate: 1000, uscite: 400, movimenti: 4, daIncassare: 200 }, { mese: '10/2026', entrate: 500, uscite: 750, movimenti: 6, daPagare: 100 }]} /></Card>
  <Card title="Saldo"><BilancioMensile tipo="saldo" dati={[{ mese: '09/2026', entrate: 1000, uscite: 400 }, { mese: '10/2026', entrate: 500, uscite: 750 }]} /></Card>
  <Card title="Categorie"><PerCategoria tipo="uscita" dati={[{ categoria: 'Manutenzione impianti e locali della società '.repeat(4), importo: 700 }, { categoria: 'Attrezzature sportive', importo: 300 }]} /></Card>
  <Card title="Gol"><GolChart dati={[{ label: '01/10', data: '01/10/2026', inCasa: true, avversario: 'Associazione Sportiva con un nome molto lungo '.repeat(4), fatti: 3, subiti: 1 }, { label: '08/10', data: '08/10/2026', inCasa: false, avversario: 'Altra squadra', fatti: 1, subiti: 2 }]} /></Card>
 </main></div>
}
createRoot(document.getElementById('root')!).render(<TemaProvider><App message={{ duration: 8, maxCount: 3 }}><Harness /></App></TemaProvider>)
