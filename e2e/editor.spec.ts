import { expect, test } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, login } from './helpers'

test.describe('简历创建与自动保存', () => {
  test('创建简历、编辑姓名、自动保存并刷新恢复', async ({ page }) => {
    await login(page, TEST_EMAIL, TEST_PASSWORD)
    await page.waitForURL(/dashboard/)

    const stamp = Date.now().toString(36)
    const resumeTitle = `E2E-自动保存-${stamp}`
    const uniqueName = `E2E用户${stamp}`

    await page.getByRole('button', { name: '新建简历' }).click()
    await page.locator('#resume-title').fill(resumeTitle)
    await page.getByRole('button', { name: '确认创建' }).click()
    await page.waitForURL(/\/editor\/\d+/, { timeout: 15_000 })

    const basicInfoButton = page.getByRole('button', { name: '基本信息', exact: true })
    if (await basicInfoButton.isVisible()) {
      await basicInfoButton.click()
    }

    // BasicInfoForm 的字段 label 未通过 htmlFor 关联输入框，姓名是主区域的第一个输入框。
    const nameField = page.locator('main').getByRole('textbox').first()
    await expect(nameField).toBeVisible({ timeout: 10_000 })
    await nameField.fill(uniqueName)

    // 防抖 1.5s + 保存请求 + 冗余。
    await page.waitForTimeout(4000)
    await page.reload()

    await expect(
      page.locator('main').getByRole('textbox').first(),
    ).toHaveValue(uniqueName, { timeout: 10_000 })
  })
})
