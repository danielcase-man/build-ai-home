import { test as base, expect } from '@playwright/test'

/**
 * Extended test fixture that intercepts Supabase API calls
 * so E2E tests run without a real database.
 */
export const test = base.extend<{ mockApi: void }>({
  mockApi: [async ({ page }, use) => {
    // Intercept Supabase REST API calls
    await page.route('**/rest/v1/**', async (route) => {
      const url = route.request().url()

      if (url.includes('/projects')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'proj-001',
            name: 'Purple Salvia Cove',
            address: '708 Purple Salvia Cove, Liberty Hill, TX',
            phase: 'planning',
            budget_total: '450000',
            estimated_duration_days: 117,
            created_at: '2025-06-01T00:00:00Z',
          }]),
        })
      } else if (url.includes('/planning_phase_steps')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { step_number: 1, name: 'Consultation', status: 'completed' },
            { step_number: 2, name: 'Lot Analysis', status: 'completed' },
            { step_number: 3, name: 'Plans Selection', status: 'in_progress' },
            { step_number: 4, name: 'Specifications', status: 'pending' },
            { step_number: 5, name: 'Cost Review', status: 'pending' },
            { step_number: 6, name: 'Final Approval', status: 'pending' },
          ]),
        })
      } else if (url.includes('/budget_items')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { category: 'Site Work', estimated_cost: '15000', actual_cost: '14500', status: 'paid' },
            { category: 'Foundation', estimated_cost: '85000', actual_cost: null, status: 'pending' },
          ]),
        })
      } else if (url.includes('/emails')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': '0-0/1' },
          body: JSON.stringify([]),
        })
      } else if (url.includes('/tasks')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'content-range': '0-0/0' },
          body: JSON.stringify([]),
        })
      } else if (url.includes('/milestones')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (url.includes('/bids')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (url.includes('/selections')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else if (url.includes('/project_status')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    await use()
  }, { auto: true }],
})

export { expect }
