import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const runtimeEnv = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }).process?.env ?? {}
  const backendPort = runtimeEnv.SERVER_PORT || env.SERVER_PORT || '8084'
  const apiProxyTarget = runtimeEnv.VITE_API_PROXY_TARGET || env.VITE_API_PROXY_TARGET || `http://localhost:${backendPort}`
  const port = Number.parseInt(runtimeEnv.VITE_PORT || env.VITE_PORT || '5173', 10)
  const openBrowser = (runtimeEnv.VITE_OPEN_BROWSER || 'true').toLowerCase() !== 'false'

  return {
    plugins: [react()],
    server: {
      port: Number.isNaN(port) ? 5173 : port,
      open: openBrowser,
      proxy: {
        '/api/v2/apps/protocols/compatible-mode/v1/responses': {
          target: 'https://dashscope.aliyuncs.com',
          changeOrigin: true,
          secure: true,
        },
        '/api/v1/services/aigc/text-generation/generation': {
          target: 'https://dashscope.aliyuncs.com',
          changeOrigin: true,
          secure: true,
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
