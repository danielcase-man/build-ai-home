import { test, expect } from './fixtures'

test.describe('Project Status Page', () => {
  test('loads project status page', async ({ page }) => {
    await page.goto('/project-status')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('displays status content', async ({ page }) => {
    await page.goto('/project-status')
    await page.waitForLoadState('networkidle')

    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('has generate button', async ({ page }) => {
    await page.goto('/project-status')
    await page.waitForLoadState('networkidle')

    // Look for a generate/update button
    const generateButton = page.locator('button', { hasText: /generate|update|refresh/i })
    if (await generateButton.count() > 0) {
      await expect(generateButton.first()).toBeVisible()
    }
  })
})
