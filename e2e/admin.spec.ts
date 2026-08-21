import { expect, test } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, TEST_EMAIL, TEST_PASSWORD, login } from './helpers'

test.describe('管理后台深链', () => {
  test('管理员登录后菜单深链直达分析提示词面板', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)

    await page.goto('/admin?view=analysis-prompts')
    await expect(page.getByRole('heading', { name: '求职场景' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('tab', { name: '工作党' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '学生党冲秋招' })).toBeVisible()
  })

  test('普通用户访问管理深链被弹回工作台', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await page.goto('/admin?view=analysis-prompts')
    await page.waitForURL(/dashboard/)
    await expect(page.getByRole('heading', { name: '求职场景' })).toHaveCount(0)
  })
})
