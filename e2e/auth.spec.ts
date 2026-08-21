import { expect, test } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, login } from './helpers'

test.describe('邮箱认证链路', () => {
  test('登录成功后刷新保持登录态，退出后回到未登录', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)

    await page.reload()
    await expect(page.getByRole('button', { name: /账号菜单/ })).toBeVisible()

    await page.getByRole('button', { name: /账号菜单/ }).click()
    await page.getByRole('menuitem', { name: '退出登录' }).click()
    await expect(page.getByRole('link', { name: '本地邮箱登录' })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('未注册邮箱请求重置不暴露账号存在性', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('textbox', { name: /邮箱/ }).first().fill('e2e-nonexistent@example.com')
    await page.getByRole('button', { name: '发送重置验证码' }).click()

    await expect(
      page.getByText('如果该邮箱已注册，重置验证码会发送到邮箱'),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('账号注销按钮受确认文字与密码双重前置约束', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/settings/account')

    const deleteButton = page.getByRole('button', { name: '永久注销账号' })
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toBeDisabled()

    await page.locator('#delete-account-confirmation').fill('错误文字')
    await expect(deleteButton).toBeDisabled()

    await page.locator('#delete-account-confirmation').fill('注销账号')
    await expect(deleteButton).toBeDisabled()
  })
})
