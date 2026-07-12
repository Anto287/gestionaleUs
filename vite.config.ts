import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In produzione (build per GitHub Pages) l'app vive sotto /gestionaleUs/.
// In sviluppo resta alla radice.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gestionaleUs/' : '/',
  plugins: [react()],
}))
