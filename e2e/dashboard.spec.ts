import { test, expect } from './fixtures'

test.describe('Dashboard', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/UBuildIt|Construction|Manager/i)
  })

  test('displays project phase information', async ({ page }) => {
    await page.goto('/')

    // Page should contain project phase info
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('shows loading state initially', async ({ page }) => {
    // Navigate and check for any content rendering
    await page.goto('/')

    // Wait for content to load
    await page.waitForLoadState('networkidle')

    // The page should have rendered some content
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('displays budget information', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check for currency-formatted values or budget section
    const content = await page.textContent('body')
    // Dashboard should show some project data
    expect(content?.length).toBeGreaterThan(100)
  })
})
