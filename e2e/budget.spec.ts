import { test, expect } from './fixtures'

test.describe('Budget Page', () => {
  test('loads budget page', async ({ page }) => {
    await page.goto('/budget')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('displays budget content', async ({ page }) => {
    await page.goto('/budget')
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})
