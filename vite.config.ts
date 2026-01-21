import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/pocketapi': {
        target: 'https://pocketapi.48.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pocketapi/, ''),
        headers: {
          'Origin': 'https://pocket.48.cn',
          'Referer': 'https://pocket.48.cn/',
        },
      },
    },
  },
})
