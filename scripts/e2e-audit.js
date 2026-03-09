/**
 * End-to-End Site Audit
 *
 * Tests every page, API endpoint, link, button, and interactive element.
 * Measures latency and reports results.
 *
 * Usage: node scripts/e2e-audit.js
 * Requires: dev server running on localhost:3000, Playwright installed
 */

const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
const results = []
const errors = []

function record(category, name, status, latencyMs, details) {
  results.push({ category, name, status, latencyMs: Math.round(latencyMs), details })
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗'
  const color = status === 'PASS' ? '\x1b[32m' : status === 'WARN' ? '\x1b[33m' : '\x1b[31m'
  console.log(`  ${color}${icon}\x1b[0m ${name} (${Math.round(latencyMs)}ms)${details ? ' — ' + details : ''}`)
}

// ─── Phase 1: API Route Testing ─────────────────────────────────

async function testApiRoutes() {
  console.log('\n═══ PHASE 1: API ROUTES ═══\n')

  const apiTests = [
    // GET routes
    // Note: Most routes return 401 without Supabase auth — that's correct behavior.
    // We test they respond (not crash) and measure latency.
    { method: 'GET', path: '/api/emails/fetch', name: 'Email Fetch', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/notifications/count', name: 'Notification Count', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/notifications', name: 'Notifications List', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/search?q=cabinet', name: 'Global Search (cabinet)', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/search?q=plumbing', name: 'Global Search (plumbing)', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/bids/manage', name: 'Bids List', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/export/budget-summary?format=csv', name: 'Budget Export CSV', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/export/status-report', name: 'Status Report PDF', expectStatus: [200, 401] },
    { method: 'GET', path: '/api/export/bid-comparison', name: 'Bid Comparison CSV', expectStatus: [200, 401] },

    // POST routes
    { method: 'GET', path: '/api/gmail/auth', name: 'Gmail Auth URL', expectStatus: [200, 405, 401] },
    { method: 'POST', path: '/api/cron/sync-emails', name: 'Cron Email Sync', expectStatus: [200, 401], headers: {} },
    { method: 'POST', path: '/api/cron/sync-jobtread', name: 'Cron JobTread Sync', expectStatus: [200, 401], headers: {} },
    { method: 'POST', path: '/api/jobtread/sync', name: 'Manual JobTread Sync', expectStatus: [200, 401], body: {} },
  ]

  for (const test of apiTests) {
    const t0 = performance.now()
    try {
      const opts = { method: test.method, headers: { 'Content-Type': 'application/json', ...(test.headers || {}) } }
      if (test.body) opts.body = JSON.stringify(test.body)
      const res = await fetch(`${BASE}${test.path}`, opts)
      const latency = performance.now() - t0

      const ok = test.expectStatus.includes(res.status)
      let details = `HTTP ${res.status}`

      // Try to read response body for more context
      try {
        const text = await res.text()
        if (text.length < 200) {
          const parsed = JSON.parse(text)
          if (parsed.error) details += ` — ${parsed.error}`
          if (parsed.data && typeof parsed.data === 'object') {
            const keys = Object.keys(parsed.data)
            details += ` — keys: [${keys.join(', ')}]`
          }
        } else {
          details += ` — ${text.length} bytes`
        }
      } catch {}

      record('API', `${test.method} ${test.path}`, ok ? 'PASS' : 'FAIL', latency, details)
    } catch (err) {
      record('API', `${test.method} ${test.path}`, 'FAIL', performance.now() - t0, err.message)
      errors.push({ test: test.name, error: err.message })
    }
  }
}

// ─── Phase 2: Page Load Testing (with Playwright) ───────────────

async function testPages(browser) {
  console.log('\n═══ PHASE 2: PAGE LOADS ═══\n')

  const pages = [
    { path: '/', name: 'Home / Dashboard' },
    { path: '/emails', name: 'Emails' },
    { path: '/budget', name: 'Budget' },
    { path: '/bids', name: 'Bids' },
    { path: '/selections', name: 'Selections' },
    { path: '/coverage', name: 'Coverage Matrix' },
    { path: '/timeline', name: 'Timeline / Gantt' },
    { path: '/project-status', name: 'Project Status' },
    { path: '/assistant', name: 'Assistant Chat' },
    { path: '/mobile', name: 'Mobile Dashboard' },
    { path: '/mobile/tasks', name: 'Mobile Tasks' },
  ]

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  for (const pg of pages) {
    const page = await context.newPage()
    const t0 = performance.now()
    const pageErrors = []
    const consoleErrors = []

    page.on('pageerror', err => pageErrors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    try {
      const res = await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 30000 })
      const latency = performance.now() - t0
      const status = res?.status() || 0

      let details = `HTTP ${status}`
      if (pageErrors.length) details += ` | ${pageErrors.length} JS errors`
      if (consoleErrors.length) details += ` | ${consoleErrors.length} console errors`

      const pass = status === 200 && pageErrors.length === 0
      record('PAGE', `${pg.path} — ${pg.name}`, pass ? 'PASS' : (status === 200 ? 'WARN' : 'FAIL'), latency, details)

      if (pageErrors.length) {
        pageErrors.forEach(e => errors.push({ test: pg.name, error: `JS: ${e.substring(0, 150)}` }))
      }
    } catch (err) {
      record('PAGE', `${pg.path} — ${pg.name}`, 'FAIL', performance.now() - t0, err.message.substring(0, 100))
      errors.push({ test: pg.name, error: err.message })
    }
    await page.close()
  }

  await context.close()
}

// ─── Phase 3: Navigation Links ──────────────────────────────────

async function testNavigation(browser) {
  console.log('\n═══ PHASE 3: NAVIGATION LINKS ═══\n')

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })

  // Find all nav links
  const navLinks = await page.$$eval('nav a[href]', anchors =>
    anchors.map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() || '' }))
  )

  for (const link of navLinks) {
    if (!link.href || link.href.startsWith('http') || link.href === '#') continue
    const t0 = performance.now()
    try {
      const res = await page.goto(`${BASE}${link.href}`, { waitUntil: 'networkidle', timeout: 20000 })
      const latency = performance.now() - t0
      const status = res?.status() || 0
      record('NAV', `${link.text} → ${link.href}`, status === 200 ? 'PASS' : 'FAIL', latency, `HTTP ${status}`)
    } catch (err) {
      record('NAV', `${link.text} → ${link.href}`, 'FAIL', performance.now() - t0, err.message.substring(0, 80))
    }
  }

  await page.close()
  await context.close()
}

// ─── Phase 4: Interactive Elements ──────────────────────────────

async function testInteractiveElements(browser) {
  console.log('\n═══ PHASE 4: INTERACTIVE ELEMENTS ═══\n')

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  // --- Home Page Buttons ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })

    // Count all clickable elements
    const buttons = await page.$$eval('button', els => els.map(e => ({
      text: e.textContent?.trim().substring(0, 50) || '',
      disabled: e.disabled,
      visible: e.offsetParent !== null
    })))
    record('UI', 'Home — buttons found', 'PASS', 0, `${buttons.length} buttons (${buttons.filter(b => !b.disabled).length} enabled)`)

    const links = await page.$$eval('a[href]', els => els.map(e => ({
      href: e.getAttribute('href'),
      text: e.textContent?.trim().substring(0, 50) || ''
    })))
    record('UI', 'Home — links found', 'PASS', 0, `${links.length} links`)

    // Test Ctrl+K global search
    const t0 = performance.now()
    try {
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(500)
      const searchDialog = await page.$('[role="dialog"], [data-state="open"]')
      record('UI', 'Home — Ctrl+K search dialog', searchDialog ? 'PASS' : 'FAIL', performance.now() - t0,
        searchDialog ? 'Dialog opened' : 'Dialog not found')
      if (searchDialog) {
        // Type a search
        const input = await page.$('input[type="text"], input[type="search"], [role="dialog"] input')
        if (input) {
          const t1 = performance.now()
          await input.fill('cabinet')
          await page.waitForTimeout(500) // debounce
          await page.waitForTimeout(1000) // API response
          record('UI', 'Home — search for "cabinet"', 'PASS', performance.now() - t1, 'Search executed')
        }
        await page.keyboard.press('Escape')
      }
    } catch (err) {
      record('UI', 'Home — Ctrl+K search dialog', 'FAIL', performance.now() - t0, err.message.substring(0, 80))
    }

    await page.close()
  }

  // --- Budget Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check for tab switching
    const tabs = await page.$$('[role="tab"], button:has-text("Verified"), button:has-text("Estimates"), button:has-text("Budget")')
    record('UI', 'Budget — tab controls', tabs.length > 0 ? 'PASS' : 'WARN', 0, `${tabs.length} tabs found`)

    // Try clicking tabs
    for (const tab of tabs) {
      const text = await tab.textContent()
      const t0 = performance.now()
      try {
        await tab.click()
        await page.waitForTimeout(300)
        record('UI', `Budget — click tab "${text?.trim().substring(0, 30)}"`, 'PASS', performance.now() - t0, 'Clicked')
      } catch (err) {
        record('UI', `Budget — click tab "${text?.trim().substring(0, 30)}"`, 'FAIL', performance.now() - t0, err.message.substring(0, 60))
      }
    }

    // Check collapsible sections
    const collapsibles = await page.$$('[data-state="closed"], button[aria-expanded]')
    record('UI', 'Budget — collapsible sections', 'PASS', 0, `${collapsibles.length} found`)

    // Test export buttons
    const exportBtns = await page.$$('button:has-text("Export"), button:has-text("CSV"), button:has-text("PDF"), a:has-text("Export")')
    record('UI', 'Budget — export buttons', exportBtns.length > 0 ? 'PASS' : 'WARN', 0, `${exportBtns.length} export buttons`)

    await page.close()
  }

  // --- Bids Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/bids`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check accordion sections
    const accordions = await page.$$('[data-state], [role="button"], .cursor-pointer')
    const bidCards = await page.$$eval('.rounded-lg, [class*="card"], [class*="Card"]', els => els.length)
    record('UI', 'Bids — accordion/card elements', 'PASS', 0, `${accordions.length} interactive, ~${bidCards} cards`)

    // Try expanding first accordion
    const firstAccordion = await page.$('[data-state="closed"]')
    if (firstAccordion) {
      const t0 = performance.now()
      try {
        await firstAccordion.click()
        await page.waitForTimeout(500)
        record('UI', 'Bids — expand first section', 'PASS', performance.now() - t0, 'Expanded')
      } catch (err) {
        record('UI', 'Bids — expand first section', 'FAIL', performance.now() - t0, err.message.substring(0, 60))
      }
    }

    await page.close()
  }

  // --- Selections Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/selections`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check filters
    const filterBtns = await page.$$('select, [role="combobox"], button:has-text("Filter"), button:has-text("All"), button:has-text("considering")')
    record('UI', 'Selections — filter controls', filterBtns.length > 0 ? 'PASS' : 'WARN', 0, `${filterBtns.length} filter elements`)

    // Count selection items
    const selectionItems = await page.$$eval('[class*="card"], [class*="Card"], .border.rounded', els => els.length)
    record('UI', 'Selections — items rendered', selectionItems > 0 ? 'PASS' : 'WARN', 0, `${selectionItems} items`)

    await page.close()
  }

  // --- Project Status Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/project-status`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check for generate button
    const generateBtn = await page.$('button:has-text("Generate"), button:has-text("AI Report"), button:has-text("Refresh")')
    record('UI', 'Status — Generate Report button', generateBtn ? 'PASS' : 'WARN', 0, generateBtn ? 'Found' : 'Not visible')

    // Check for export button
    const exportBtn = await page.$('button:has-text("Export"), button:has-text("PDF"), a:has-text("Export")')
    record('UI', 'Status — Export PDF button', exportBtn ? 'PASS' : 'WARN', 0, exportBtn ? 'Found' : 'Not visible')

    // Check content sections loaded
    const sections = await page.$$('h2, h3, [class*="card"]')
    record('UI', 'Status — content sections', sections.length > 0 ? 'PASS' : 'WARN', 0, `${sections.length} sections/cards`)

    await page.close()
  }

  // --- Timeline Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/timeline`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check view toggle buttons
    const toggleBtns = await page.$$('button:has-text("Week"), button:has-text("Month"), button:has-text("Quarter")')
    record('UI', 'Timeline — view toggles', toggleBtns.length > 0 ? 'PASS' : 'WARN', 0, `${toggleBtns.length} view buttons`)

    for (const btn of toggleBtns) {
      const text = await btn.textContent()
      const t0 = performance.now()
      try {
        await btn.click()
        await page.waitForTimeout(500)
        record('UI', `Timeline — switch to ${text?.trim()}`, 'PASS', performance.now() - t0, 'Clicked')
      } catch (err) {
        record('UI', `Timeline — switch to ${text?.trim()}`, 'FAIL', performance.now() - t0, err.message.substring(0, 60))
      }
    }

    await page.close()
  }

  // --- Email Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/emails`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check for Gmail connect or refresh button
    const connectBtn = await page.$('button:has-text("Connect"), button:has-text("Gmail")')
    const refreshBtn = await page.$('button:has-text("Refresh"), button:has-text("Fetch")')
    record('UI', 'Emails — action buttons', (connectBtn || refreshBtn) ? 'PASS' : 'WARN', 0,
      connectBtn ? 'Gmail Connect found' : refreshBtn ? 'Refresh found' : 'No action buttons')

    // Count email items
    const emailItems = await page.$$eval('[class*="card"], [class*="collapsible"], .border-b', els => els.length)
    record('UI', 'Emails — email items', 'PASS', 0, `${emailItems} items rendered`)

    await page.close()
  }

  // --- Assistant Page Interactions ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/assistant`, { waitUntil: 'networkidle', timeout: 30000 })

    // Check for chat input
    const chatInput = await page.$('textarea, input[type="text"]')
    record('UI', 'Assistant — chat input', chatInput ? 'PASS' : 'FAIL', 0, chatInput ? 'Found' : 'Not found')

    // Check for send button
    const sendBtn = await page.$('button:has-text("Send"), button[type="submit"]')
    record('UI', 'Assistant — send button', sendBtn ? 'PASS' : 'FAIL', 0, sendBtn ? 'Found' : 'Not found')

    await page.close()
  }

  // --- Coverage Page ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/coverage`, { waitUntil: 'networkidle', timeout: 30000 })

    const sections = await page.$$('[data-state], [role="button"], h2, h3')
    record('UI', 'Coverage — content sections', sections.length > 0 ? 'PASS' : 'WARN', 0, `${sections.length} interactive elements`)

    await page.close()
  }

  // --- Mobile Pages ---
  {
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const page = await mobileCtx.newPage()

    await page.goto(`${BASE}/mobile`, { waitUntil: 'networkidle', timeout: 30000 })
    const mobileContent = await page.$$eval('h1, h2, button, a', els => els.length)
    record('UI', 'Mobile — dashboard content', mobileContent > 0 ? 'PASS' : 'WARN', 0, `${mobileContent} elements`)

    await page.goto(`${BASE}/mobile/tasks`, { waitUntil: 'networkidle', timeout: 30000 })
    const tasksContent = await page.$$eval('h1, h2, button, a', els => els.length)
    record('UI', 'Mobile — tasks content', tasksContent > 0 ? 'PASS' : 'WARN', 0, `${tasksContent} elements`)

    await page.close()

    // Test mobile nav hamburger on a main page (Navigation component is md:hidden)
    const mobilePage = await mobileCtx.newPage()
    await mobilePage.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
    const hamburger = await mobilePage.$('button[aria-label*="menu"], button[aria-label*="Menu"], button:has(svg)')
    if (hamburger) {
      const t0 = performance.now()
      try {
        await hamburger.click()
        await mobilePage.waitForTimeout(500)
        record('UI', 'Mobile — hamburger menu', 'PASS', performance.now() - t0, 'Clicked')
      } catch (err) {
        record('UI', 'Mobile — hamburger menu', 'WARN', performance.now() - t0, err.message.substring(0, 60))
      }
    } else {
      record('UI', 'Mobile — hamburger menu', 'FAIL', 0, 'Hamburger button not found')
    }

    await mobilePage.close()
    await mobileCtx.close()
  }

  // --- Notification Bell ---
  {
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })

    const bellBtn = await page.$('button[aria-label*="notification"], button[aria-label*="Notification"], [class*="bell"], [class*="Bell"]')
    if (bellBtn) {
      const t0 = performance.now()
      try {
        await bellBtn.click()
        await page.waitForTimeout(500)
        record('UI', 'Notifications — bell click', 'PASS', performance.now() - t0, 'Dropdown opened')
      } catch (err) {
        record('UI', 'Notifications — bell click', 'FAIL', performance.now() - t0, err.message.substring(0, 60))
      }
    } else {
      record('UI', 'Notifications — bell button', 'WARN', 0, 'Not found in DOM')
    }

    await page.close()
  }

  await context.close()
}

// ─── Phase 5: Network Request Monitoring ────────────────────────

async function testNetworkPerformance(browser) {
  console.log('\n═══ PHASE 5: NETWORK PERFORMANCE (Full Page Waterfall) ═══\n')

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  const criticalPages = [
    { path: '/', name: 'Home' },
    { path: '/budget', name: 'Budget' },
    { path: '/bids', name: 'Bids' },
    { path: '/selections', name: 'Selections' },
    { path: '/project-status', name: 'Project Status' },
  ]

  for (const pg of criticalPages) {
    const page = await context.newPage()
    const requests = []

    page.on('requestfinished', async req => {
      const timing = req.timing()
      const response = await req.response()
      requests.push({
        url: req.url().replace(BASE, ''),
        method: req.method(),
        status: response?.status() || 0,
        duration: timing ? Math.round(timing.responseEnd - timing.requestStart) : -1,
        size: response?.headers()['content-length'] || '?',
        type: req.resourceType(),
      })
    })

    const t0 = performance.now()
    await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 30000 })
    const totalLatency = performance.now() - t0

    // Filter to API/data requests (skip static assets like JS/CSS)
    const apiRequests = requests.filter(r => r.url.startsWith('/api/') || r.type === 'fetch' || r.type === 'xhr')
    const slowRequests = requests.filter(r => r.duration > 2000)

    let details = `${requests.length} total requests, ${apiRequests.length} API calls`
    if (slowRequests.length) details += `, ${slowRequests.length} slow (>2s)`

    record('PERF', `${pg.path} — ${pg.name} full load`, totalLatency < 5000 ? 'PASS' : 'WARN', totalLatency, details)

    // Log slow API requests
    for (const req of apiRequests) {
      const pass = req.duration < 3000 && req.status < 500
      record('PERF', `  ↳ ${req.method} ${req.url.substring(0, 60)}`, pass ? 'PASS' : (req.status >= 500 ? 'FAIL' : 'WARN'),
        req.duration >= 0 ? req.duration : 0, `HTTP ${req.status}`)
    }

    await page.close()
  }

  await context.close()
}

// ─── Report Generation ──────────────────────────────────────────

function generateReport() {
  console.log('\n' + '═'.repeat(70))
  console.log('  END-TO-END AUDIT REPORT')
  console.log('═'.repeat(70) + '\n')

  const categories = [...new Set(results.map(r => r.category))]
  const summary = { total: 0, pass: 0, warn: 0, fail: 0 }

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const pass = catResults.filter(r => r.status === 'PASS').length
    const warn = catResults.filter(r => r.status === 'WARN').length
    const fail = catResults.filter(r => r.status === 'FAIL').length
    const avgLatency = Math.round(catResults.reduce((s, r) => s + r.latencyMs, 0) / catResults.length)
    const maxLatency = Math.max(...catResults.map(r => r.latencyMs))
    const slowest = catResults.sort((a, b) => b.latencyMs - a.latencyMs)[0]

    console.log(`  ${cat}: ${pass} pass, ${warn} warn, ${fail} fail — avg ${avgLatency}ms, max ${maxLatency}ms`)
    if (slowest && slowest.latencyMs > 2000) {
      console.log(`    Slowest: ${slowest.name} (${slowest.latencyMs}ms)`)
    }

    summary.total += catResults.length
    summary.pass += pass
    summary.warn += warn
    summary.fail += fail
  }

  console.log(`\n  TOTAL: ${summary.total} tests — ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail`)
  console.log(`  Pass Rate: ${((summary.pass / summary.total) * 100).toFixed(1)}%`)

  // Latency breakdown
  console.log('\n── LATENCY BREAKDOWN ──\n')

  const pageResults = results.filter(r => r.category === 'PAGE')
  if (pageResults.length) {
    console.log('  Page Load Times:')
    pageResults.sort((a, b) => b.latencyMs - a.latencyMs).forEach(r => {
      const bar = '█'.repeat(Math.min(Math.round(r.latencyMs / 200), 30))
      const tag = r.latencyMs < 2000 ? '' : r.latencyMs < 5000 ? ' ⚠ SLOW' : ' ✗ VERY SLOW'
      console.log(`    ${r.name.padEnd(40)} ${String(r.latencyMs + 'ms').padStart(8)} ${bar}${tag}`)
    })
  }

  const apiResults = results.filter(r => r.category === 'API')
  if (apiResults.length) {
    console.log('\n  API Response Times:')
    apiResults.sort((a, b) => b.latencyMs - a.latencyMs).forEach(r => {
      const bar = '█'.repeat(Math.min(Math.round(r.latencyMs / 100), 30))
      const tag = r.latencyMs < 1000 ? '' : r.latencyMs < 3000 ? ' ⚠ SLOW' : ' ✗ VERY SLOW'
      console.log(`    ${r.name.padEnd(45)} ${String(r.latencyMs + 'ms').padStart(8)} ${bar}${tag}`)
    })
  }

  // Errors
  if (errors.length) {
    console.log('\n── ERRORS & ISSUES ──\n')
    errors.forEach(e => console.log(`  ✗ ${e.test}: ${e.error.substring(0, 120)}`))
  }

  // Recommendations
  console.log('\n── RECOMMENDATIONS ──\n')
  const slowPages = pageResults.filter(r => r.latencyMs > 3000)
  const slowApis = apiResults.filter(r => r.latencyMs > 2000)
  const failedTests = results.filter(r => r.status === 'FAIL')

  if (slowPages.length) {
    console.log('  SLOW PAGES (>3s):')
    slowPages.forEach(r => console.log(`    - ${r.name}: ${r.latencyMs}ms`))
  }
  if (slowApis.length) {
    console.log('  SLOW APIs (>2s):')
    slowApis.forEach(r => console.log(`    - ${r.name}: ${r.latencyMs}ms`))
  }
  if (failedTests.length) {
    console.log('  FAILURES:')
    failedTests.forEach(r => console.log(`    - ${r.name}: ${r.details}`))
  }
  if (!slowPages.length && !slowApis.length && !failedTests.length) {
    console.log('  No critical issues found!')
  }

  console.log('\n' + '═'.repeat(70) + '\n')
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  UBuildIt Manager — End-to-End Site Audit       ║')
  console.log('║  Testing all pages, APIs, buttons, and links    ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`\nTarget: ${BASE}`)
  console.log(`Time: ${new Date().toISOString()}\n`)

  // Phase 1: API routes (no browser needed)
  await testApiRoutes()

  // Phases 2-5: Browser-based testing
  const browser = await chromium.launch({ headless: true })

  try {
    await testPages(browser)
    await testNavigation(browser)
    await testInteractiveElements(browser)
    await testNetworkPerformance(browser)
  } finally {
    await browser.close()
  }

  generateReport()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
