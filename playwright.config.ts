import { defineConfig } from '@playwright/test'

// 本地/隔离环境 E2E：要求前端 5173 与后端 8084 已启动（见 e2e/global-setup.ts），
// 数据指向本机 MySQL 开发库，绝不指向生产。
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  globalSetup: './e2e/global-setup.ts',
})
