import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: './src/renderer/src/routes',
        generatedRouteTree: './src/renderer/src/routeTree.gen.ts',
        autoCodeSplitting: true
      }),
      react(),
      tailwindcss()
    ]
  }
})
