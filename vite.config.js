import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function recursosSinConexion() {
  let isServe = false;
  return {
    name: 'recursos-sin-conexion',
    enforce: 'post',
    configResolved(resolvedConfig) {
      isServe = resolvedConfig.command === 'serve';
    },
    buildStart() {
      if (isServe) return;
      try {
        this.emitFile({
          type: 'asset',
          fileName: 'data/sistemas_riego.json',
          source: readFileSync(new URL('./data/sistemas_riego.json', import.meta.url)),
        })
      } catch (e) {
        // Si el archivo no existe o hay ruta relativa en build, se omite de forma segura
      }
    },
    generateBundle(_, bundle) {
      if (isServe) return;
      const archivos = Object.keys(bundle).filter((archivo) =>
        archivo === 'index.html' || archivo === 'data/sistemas_riego.json' ||
        (archivo.startsWith('assets/') && !archivo.endsWith('.map')),
      )
      const version = createHash('sha256')
        .update(archivos.map((archivo) => {
          const item = bundle[archivo]
          return archivo + (item.type === 'asset' ? item.source : item.code)
        }).join(''))
        .digest('hex').slice(0, 16)
      
      try {
        const plantilla = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
        this.emitFile({
          type: 'asset',
          fileName: 'service-worker.js',
          source: plantilla
            .replace('__CACHE_VERSION__', version)
            .replace('__PRECACHE_FILES__', JSON.stringify(archivos)),
        })
      } catch (e) {
        // Manejo seguro si la plantilla no está presente
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), recursosSinConexion()],
  base: '/R-cultivos/',
})