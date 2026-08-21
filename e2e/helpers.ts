import type { Page } from '@playwright/test'

export const TEST_EMAIL = 'test@example.com'
export const TEST_PASSWORD = 'Test123456'
export const ADMIN_EMAIL = 'admin@example.com'
export const ADMIN_PASSWORD = 'Admin123456'

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login?method=email')
  await page.getByRole('textbox', { name: '邮箱' }).fill(email)
  await page.getByRole('textbox', { name: '密码' }).fill(password)
  await page.getByRole('button', { name: '邮箱登录' }).click()
  await page.waitForURL(/dashboard|editor|admin/)
}
