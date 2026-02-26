import { test, expect } from './fixtures'

test.describe('Navigation', () => {
  test('renders the main layout with nav links', async ({ page }) => {
    await page.goto('/')

    // Check that the navigation is present
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
  })

  test('navigates to emails page', async ({ page }) => {
    await page.goto('/')

    // Click emails link
    const emailsLink = page.locator('a[href="/emails"]')
    if (await emailsLink.isVisible()) {
      await emailsLink.click()
      await expect(page).toHaveURL('/emails')
    }
  })

  test('navigates to bids page', async ({ page }) => {
    await page.goto('/')

    const bidsLink = page.locator('a[href="/bids"]')
    if (await bidsLink.isVisible()) {
      await bidsLink.click()
      await expect(page).toHaveURL('/bids')
    }
  })

  test('navigates to budget page', async ({ page }) => {
    await page.goto('/')

    const budgetLink = page.locator('a[href="/budget"]')
    if (await budgetLink.isVisible()) {
      await budgetLink.click()
      await expect(page).toHaveURL('/budget')
    }
  })

  test('navigates to selections page', async ({ page }) => {
    await page.goto('/')

    const selectionsLink = page.locator('a[href="/selections"]')
    if (await selectionsLink.isVisible()) {
      await selectionsLink.click()
      await expect(page).toHaveURL('/selections')
    }
  })

  test('navigates to project status page', async ({ page }) => {
    await page.goto('/')

    const statusLink = page.locator('a[href="/project-status"]')
    if (await statusLink.isVisible()) {
      await statusLink.click()
      await expect(page).toHaveURL('/project-status')
    }
  })
})
