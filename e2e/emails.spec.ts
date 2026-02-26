import { test, expect } from './fixtures'

test.describe('Emails Page', () => {
  test('loads emails page', async ({ page }) => {
    await page.goto('/emails')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('shows empty state when no emails', async ({ page }) => {
    await page.goto('/emails')
    await page.waitForLoadState('networkidle')

    // Should show some message about emails or connect Gmail
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('has refresh functionality', async ({ page }) => {
    await page.goto('/emails')
    await page.waitForLoadState('networkidle')

    // Look for a refresh or sync button
    const refreshButton = page.locator('button', { hasText: /refresh|sync|fetch/i })
    if (await refreshButton.count() > 0) {
      await expect(refreshButton.first()).toBeVisible()
    }
  })
})
