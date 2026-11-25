import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pages = ['index.html', 'games/bellwind-post/index.html', 'games/aphelion-run/index.html']

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/mymario/' : '/',
  build: {
    rollupOptions: {
      input: pages.map(path => fileURLToPath(new URL(path, import.meta.url))),
    },
  },
}))
