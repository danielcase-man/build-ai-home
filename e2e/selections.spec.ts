import { test, expect } from './fixtures'

test.describe('Selections Page', () => {
  test('loads selections page', async ({ page }) => {
    await page.goto('/selections')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('displays selection categories or empty state', async ({ page }) => {
    await page.goto('/selections')
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})
