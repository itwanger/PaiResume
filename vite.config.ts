import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const serverEnv = loadEnv(mode, 'server', '')
  const backendPort = serverEnv.SERVER_PORT || '8084'
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || `http://localhost:${backendPort}`
  const port = Number.parseInt(env.VITE_PORT || '5173', 10)

  return {
    plugins: [react()],
    server: {
      port: Number.isNaN(port) ? 5173 : port,
      open: true,
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
