// ─── Accessibility Testing Utility ───────────────────────────────────────────
// WCAG 2.1 AA automated audit for construction management UI

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info'
  category: 'perceivable' | 'operable' | 'understandable' | 'robust'
  element?: string
  description: string
  wcagCriteria: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
}

export interface AccessibilityTest {
  name: string
  description: string
  category: 'perceivable' | 'operable' | 'understandable' | 'robust'
  run: (root: HTMLElement) => AccessibilityIssue[]
}

export interface AccessibilityTestResult {
  testName: string
  passed: boolean
  issues: AccessibilityIssue[]
}

export interface AccessibilityAuditResult {
  score: number
  totalTests: number
  passed: number
  failed: number
  issues: AccessibilityIssue[]
  results: AccessibilityTestResult[]
  timestamp: string
  categories: {
    perceivable: { score: number; issues: number }
    operable: { score: number; issues: number }
    understandable: { score: number; issues: number }
    robust: { score: number; issues: number }
  }
}

export class AccessibilityTester {
  private tests: AccessibilityTest[] = []

  constructor() {
    this.registerDefaultTests()
  }

  private registerDefaultTests(): void {
    // Perceivable
    this.tests.push({
      name: 'Image Alt Text',
      description: 'All images must have alt text',
      category: 'perceivable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        root.querySelectorAll('img').forEach((img) => {
          if (!img.hasAttribute('alt')) {
            issues.push({
              type: 'error',
              category: 'perceivable',
              element: img.outerHTML.slice(0, 100),
              description: 'Image missing alt attribute',
              wcagCriteria: '1.1.1 Non-text Content',
              impact: 'critical',
            })
          } else if (img.alt === '') {
            // Empty alt is ok for decorative images, but flag as info
            issues.push({
              type: 'info',
              category: 'perceivable',
              element: img.outerHTML.slice(0, 100),
              description: 'Image has empty alt text — ensure it is decorative',
              wcagCriteria: '1.1.1 Non-text Content',
              impact: 'minor',
            })
          }
        })
        return issues
      },
    })

    this.tests.push({
      name: 'Color Contrast',
      description: 'Text must have sufficient color contrast',
      category: 'perceivable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const textElements = root.querySelectorAll<HTMLElement>(
          'p, span, h1, h2, h3, h4, h5, h6, a, button, label, td, th, li'
        )
        textElements.forEach((el) => {
          const style = window.getComputedStyle(el)
          const color = style.color
          const bgColor = style.backgroundColor

          if (color && bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const fgLum = this.getRelativeLuminance(color)
            const bgLum = this.getRelativeLuminance(bgColor)

            if (fgLum !== null && bgLum !== null) {
              const ratio =
                (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05)
              const fontSize = parseFloat(style.fontSize)
              const isBold = parseInt(style.fontWeight) >= 700
              const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold)
              const minRatio = isLargeText ? 3 : 4.5

              if (ratio < minRatio) {
                issues.push({
                  type: 'error',
                  category: 'perceivable',
                  element: `<${el.tagName.toLowerCase()}> "${el.textContent?.slice(0, 30)}"`,
                  description: `Contrast ratio ${ratio.toFixed(2)}:1 is below ${minRatio}:1 minimum`,
                  wcagCriteria: '1.4.3 Contrast (Minimum)',
                  impact: 'serious',
                })
              }
            }
          }
        })
        return issues
      },
    })

    this.tests.push({
      name: 'Heading Structure',
      description: 'Headings must be in logical order',
      category: 'perceivable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6')
        let lastLevel = 0

        headings.forEach((heading) => {
          const level = parseInt(heading.tagName[1])
          if (lastLevel > 0 && level > lastLevel + 1) {
            issues.push({
              type: 'warning',
              category: 'perceivable',
              element: `<${heading.tagName.toLowerCase()}> "${heading.textContent?.slice(0, 30)}"`,
              description: `Heading level skipped from h${lastLevel} to h${level}`,
              wcagCriteria: '1.3.1 Info and Relationships',
              impact: 'moderate',
            })
          }
          lastLevel = level
        })
        return issues
      },
    })

    // Operable
    this.tests.push({
      name: 'Focus Indicators',
      description: 'Interactive elements must have visible focus indicators',
      category: 'operable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const interactive = root.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]'
        )
        interactive.forEach((el) => {
          const style = window.getComputedStyle(el)
          if (style.outlineStyle === 'none' && style.outlineWidth === '0px') {
            const hasRingClass =
              el.className?.includes('ring') || el.className?.includes('focus')
            if (!hasRingClass) {
              issues.push({
                type: 'warning',
                category: 'operable',
                element: `<${el.tagName.toLowerCase()}> "${el.textContent?.slice(0, 30)}"`,
                description: 'Element may lack visible focus indicator',
                wcagCriteria: '2.4.7 Focus Visible',
                impact: 'serious',
              })
            }
          }
        })
        return issues
      },
    })

    this.tests.push({
      name: 'Touch Targets',
      description: 'Touch targets must be at least 44x44px',
      category: 'operable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const interactive = root.querySelectorAll<HTMLElement>('a[href], button, input, select')
        interactive.forEach((el) => {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            if (rect.width < 44 || rect.height < 44) {
              issues.push({
                type: 'warning',
                category: 'operable',
                element: `<${el.tagName.toLowerCase()}> (${Math.round(rect.width)}x${Math.round(rect.height)}px)`,
                description: `Touch target is ${Math.round(rect.width)}x${Math.round(rect.height)}px, should be at least 44x44px`,
                wcagCriteria: '2.5.5 Target Size',
                impact: 'moderate',
              })
            }
          }
        })
        return issues
      },
    })

    // Understandable
    this.tests.push({
      name: 'Form Labels',
      description: 'Form inputs must have associated labels',
      category: 'understandable',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const inputs = root.querySelectorAll<HTMLInputElement>(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
        )
        inputs.forEach((input) => {
          const hasLabel =
            (input.labels?.length ?? 0) > 0 ||
            input.hasAttribute('aria-label') ||
            input.hasAttribute('aria-labelledby') ||
            input.hasAttribute('title') ||
            input.placeholder

          if (!hasLabel) {
            issues.push({
              type: 'error',
              category: 'understandable',
              element: `<${input.tagName.toLowerCase()} type="${input.type}">`,
              description: 'Form input has no associated label',
              wcagCriteria: '3.3.2 Labels or Instructions',
              impact: 'critical',
            })
          }
        })
        return issues
      },
    })

    // Robust
    this.tests.push({
      name: 'ARIA Compliance',
      description: 'ARIA attributes must be used correctly',
      category: 'robust',
      run: (root) => {
        const issues: AccessibilityIssue[] = []
        const ariaElements = root.querySelectorAll<HTMLElement>('[role]')

        ariaElements.forEach((el) => {
          const role = el.getAttribute('role')
          if (role === 'button' && el.tagName !== 'BUTTON') {
            if (!el.hasAttribute('tabindex')) {
              issues.push({
                type: 'error',
                category: 'robust',
                element: `<${el.tagName.toLowerCase()} role="button">`,
                description: 'Element with role="button" missing tabindex for keyboard access',
                wcagCriteria: '4.1.2 Name, Role, Value',
                impact: 'serious',
              })
            }
          }
          if (role === 'img' && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
            issues.push({
              type: 'error',
              category: 'robust',
              element: `<${el.tagName.toLowerCase()} role="img">`,
              description: 'Element with role="img" missing aria-label or aria-labelledby',
              wcagCriteria: '4.1.2 Name, Role, Value',
              impact: 'critical',
            })
          }
        })

        // Check for duplicate IDs
        const allIds = root.querySelectorAll('[id]')
        const idMap = new Map<string, number>()
        allIds.forEach((el) => {
          const id = el.id
          idMap.set(id, (idMap.get(id) ?? 0) + 1)
        })
        idMap.forEach((count, id) => {
          if (count > 1) {
            issues.push({
              type: 'error',
              category: 'robust',
              element: `id="${id}"`,
              description: `Duplicate ID "${id}" found ${count} times`,
              wcagCriteria: '4.1.1 Parsing',
              impact: 'serious',
            })
          }
        })

        return issues
      },
    })
  }

  private getRelativeLuminance(color: string): number | null {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) return null

    const [r, g, b] = [
      parseInt(match[1]) / 255,
      parseInt(match[2]) / 255,
      parseInt(match[3]) / 255,
    ].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  runAudit(root?: HTMLElement): AccessibilityAuditResult {
    const target = root ?? document.body
    const results: AccessibilityTestResult[] = []
    const allIssues: AccessibilityIssue[] = []

    const categoryIssues = {
      perceivable: 0,
      operable: 0,
      understandable: 0,
      robust: 0,
    }

    const categoryTests = {
      perceivable: 0,
      operable: 0,
      understandable: 0,
      robust: 0,
    }

    for (const test of this.tests) {
      categoryTests[test.category]++
      const issues = test.run(target)
      const passed = issues.filter((i) => i.type === 'error').length === 0

      if (!passed) {
        categoryIssues[test.category]++
      }

      results.push({ testName: test.name, passed, issues })
      allIssues.push(...issues)
    }

    const totalTests = this.tests.length
    const passed = results.filter((r) => r.passed).length
    const failed = totalTests - passed
    const score = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 100

    const calcCategoryScore = (cat: keyof typeof categoryTests) =>
      categoryTests[cat] > 0
        ? Math.round(((categoryTests[cat] - categoryIssues[cat]) / categoryTests[cat]) * 100)
        : 100

    return {
      score,
      totalTests,
      passed,
      failed,
      issues: allIssues,
      results,
      timestamp: new Date().toISOString(),
      categories: {
        perceivable: { score: calcCategoryScore('perceivable'), issues: categoryIssues.perceivable },
        operable: { score: calcCategoryScore('operable'), issues: categoryIssues.operable },
        understandable: {
          score: calcCategoryScore('understandable'),
          issues: categoryIssues.understandable,
        },
        robust: { score: calcCategoryScore('robust'), issues: categoryIssues.robust },
      },
    }
  }
}
