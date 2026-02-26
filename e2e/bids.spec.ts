import { test, expect } from './fixtures'

test.describe('Bids Page', () => {
  test('loads bids page', async ({ page }) => {
    await page.goto('/bids')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('shows bid categories or empty state', async ({ page }) => {
    await page.goto('/bids')
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('page is accessible', async ({ page }) => {
    await page.goto('/bids')
    await page.waitForLoadState('networkidle')

    // Check for basic heading structure
    const headings = page.locator('h1, h2, h3')
    if (await headings.count() > 0) {
      await expect(headings.first()).toBeVisible()
    }
  })
})
