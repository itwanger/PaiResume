import http from 'node:http'

function serviceReady(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(true)
    })
    request.on('error', () => resolve(false))
  })
}

async function waitForService(
  name: string,
  url: string,
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await serviceReady(url)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(
    `[E2E] ${name} 未就绪（${url}）。请先启动本地环境：\n` +
      '  后端：cd server && APP_ENV=development mvn spring-boot:run\n' +
      '  前端：npm run dev\n' +
      'E2E 只允许指向本地隔离环境，禁止对生产运行。',
  )
}

export default async function globalSetup() {
  await waitForService('后端', 'http://127.0.0.1:8084/api/health')
  await waitForService('前端', 'http://localhost:5173')
}
