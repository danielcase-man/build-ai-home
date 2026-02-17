'use client'

import * as React from 'react'
import { cn, a11y } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Zap,
  Contrast,
  Type,
  Keyboard,
  Smartphone,
  Settings,
  Play,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import {
  AccessibilityTester,
  type AccessibilityAuditResult,
} from '@/lib/accessibility-testing'

export interface AccessibilityPanelProps {
  isOpen?: boolean
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showQuickToggles?: boolean
  showTestingTools?: boolean
  mobile?: boolean
  onClose?: () => void
}

export interface AccessibilitySettings {
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
  screenReaderMode: boolean
  focusIndicators: boolean
  voiceAnnouncements: boolean
  keyboardNavigation: boolean
  touchOptimized: boolean
}

const POSITION_CLASSES = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
}

export function AccessibilityPanel({
  isOpen = false,
  position = 'bottom-right',
  showQuickToggles = true,
  showTestingTools = true,
  mobile = false,
  onClose,
}: AccessibilityPanelProps) {
  const [settings, setSettings] = React.useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReaderMode: false,
    focusIndicators: true,
    voiceAnnouncements: true,
    keyboardNavigation: true,
    touchOptimized: false,
  })

  const [auditResult, setAuditResult] = React.useState<AccessibilityAuditResult | null>(null)
  const [isAuditing, setIsAuditing] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'settings' | 'testing' | 'results'>('settings')

  const panelId = React.useId()

  // Apply accessibility settings to document
  React.useEffect(() => {
    const html = document.documentElement
    const toggleClass = (cls: string, active: boolean) => {
      if (active) html.classList.add(cls)
      else html.classList.remove(cls)
    }

    toggleClass('accessibility-high-contrast', settings.highContrast)
    toggleClass('accessibility-large-text', settings.largeText)
    toggleClass('accessibility-reduce-motion', settings.reduceMotion)
    toggleClass('accessibility-touch-optimized', settings.touchOptimized)
    toggleClass('accessibility-no-focus', !settings.focusIndicators)
  }, [settings])

  const toggleSetting = React.useCallback(
    (key: keyof AccessibilitySettings) => {
      setSettings((prev) => {
        const newSettings = { ...prev, [key]: !prev[key] }
        if (settings.voiceAnnouncements) {
          const action = newSettings[key] ? 'enabled' : 'disabled'
          const name = key.replace(/([A-Z])/g, ' $1').toLowerCase()
          a11y.announce(`${name} ${action}`, 'polite')
        }
        return newSettings
      })
    },
    [settings.voiceAnnouncements]
  )

  const runAccessibilityAudit = React.useCallback(() => {
    setIsAuditing(true)
    setActiveTab('results')

    // Run asynchronously to let UI update
    requestAnimationFrame(() => {
      try {
        const tester = new AccessibilityTester()
        const result = tester.runAudit()
        setAuditResult(result)

        if (settings.voiceAnnouncements) {
          a11y.announce(
            `Accessibility audit complete. Score: ${result.score}%. ${result.failed} issues found.`,
            'polite'
          )
        }
      } catch (error) {
        console.error('Accessibility audit failed:', error)
      } finally {
        setIsAuditing(false)
      }
    })
  }, [settings.voiceAnnouncements])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed z-50 w-96 max-h-[80vh] overflow-hidden',
        POSITION_CLASSES[position],
        mobile && 'w-full max-w-sm'
      )}
    >
      <Card
        className="shadow-2xl border-2"
        role="dialog"
        aria-labelledby={`${panelId}-title`}
        aria-modal="true"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle id={`${panelId}-title`} className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              Accessibility
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close accessibility panel">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            {(['settings', 'testing', 'results'] as const)
              .filter((tab) => tab !== 'testing' || showTestingTools)
              .map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize',
                    activeTab === tab
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={activeTab === tab}
                >
                  {tab}
                </button>
              ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-h-96 overflow-y-auto">
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <SettingsGroup title="Visual">
                <SettingToggle
                  icon={Contrast}
                  label="High Contrast"
                  active={settings.highContrast}
                  onToggle={() => toggleSetting('highContrast')}
                />
                <SettingToggle
                  icon={Type}
                  label="Large Text"
                  active={settings.largeText}
                  onToggle={() => toggleSetting('largeText')}
                />
                <SettingToggle
                  icon={Zap}
                  label="Reduce Motion"
                  active={settings.reduceMotion}
                  onToggle={() => toggleSetting('reduceMotion')}
                />
              </SettingsGroup>

              <SettingsGroup title="Interaction">
                <SettingToggle
                  icon={Keyboard}
                  label="Keyboard Navigation"
                  active={settings.keyboardNavigation}
                  onToggle={() => toggleSetting('keyboardNavigation')}
                />
                <SettingToggle
                  icon={Smartphone}
                  label="Touch Optimized"
                  active={settings.touchOptimized}
                  onToggle={() => toggleSetting('touchOptimized')}
                />
                <SettingToggle
                  icon={settings.voiceAnnouncements ? Volume2 : VolumeX}
                  label="Voice Announcements"
                  active={settings.voiceAnnouncements}
                  onToggle={() => toggleSetting('voiceAnnouncements')}
                />
              </SettingsGroup>
            </div>
          )}

          {/* Testing Tab */}
          {activeTab === 'testing' && showTestingTools && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Accessibility Testing</h3>
                <Button
                  onClick={runAccessibilityAudit}
                  disabled={isAuditing}
                  className="w-full"
                  variant="construction"
                >
                  {isAuditing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running Audit...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Accessibility Audit
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tests WCAG 2.1 AA compliance including color contrast, keyboard navigation,
                  form labels, and screen reader support.
                </p>
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {auditResult ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Audit Results</h3>
                      <Badge
                        variant={
                          auditResult.score >= 80
                            ? 'default'
                            : auditResult.score >= 60
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {auditResult.score}%
                      </Badge>
                    </div>

                    <Progress value={auditResult.score} className="h-2" />

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{auditResult.passed} Passed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>{auditResult.failed} Failed</span>
                      </div>
                    </div>
                  </div>

                  {auditResult.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Issues Found</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {auditResult.issues.slice(0, 5).map((issue, index) => (
                          <div
                            key={index}
                            className={cn(
                              'p-2 rounded text-xs border-l-2',
                              issue.type === 'error' && 'border-red-500 bg-red-50 dark:bg-red-950/20',
                              issue.type === 'warning' && 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
                              issue.type === 'info' && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            )}
                          >
                            <div className="font-medium">{issue.description}</div>
                            <div className="text-muted-foreground mt-1">{issue.wcagCriteria}</div>
                          </div>
                        ))}
                        {auditResult.issues.length > 5 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{auditResult.issues.length - 5} more issues
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Category Scores */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Categories</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(Object.entries(auditResult.categories) as [string, { score: number; issues: number }][]).map(
                        ([cat, data]) => (
                          <div key={cat} className="flex items-center justify-between">
                            <span className="capitalize">{cat}</span>
                            <Badge
                              variant={data.score >= 80 ? 'default' : data.score >= 60 ? 'secondary' : 'destructive'}
                              className="text-[10px]"
                            >
                              {data.score}%
                            </Badge>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Run an accessibility audit to see results</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </div>
  )
}

function SettingToggle({
  icon: Icon,
  label,
  active,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <Button
        variant={active ? 'construction' : 'outline'}
        size="sm"
        onClick={onToggle}
        aria-label={`${active ? 'Disable' : 'Enable'} ${label.toLowerCase()}`}
      >
        {active ? (
          <Eye className="h-3 w-3" />
        ) : (
          <EyeOff className="h-3 w-3" />
        )}
      </Button>
    </label>
  )
}
