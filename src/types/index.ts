// ============================================================
// Centralized Type Definitions
// Single source of truth for all shared interfaces
// ============================================================

// --- Email Types ---

/** Lightweight email shape used for AI analysis inputs */
export interface Email {
  subject: string
  from: string
  body: string
  date: string
}

/** Full email record as stored in the database */
export interface EmailRecord {
  id?: string
  project_id?: string
  email_account_id?: string
  message_id: string
  thread_id?: string
  sender_email: string
  sender_name?: string
  recipients?: Record<string, string[]>
  subject: string
  body_text?: string
  body_html?: string
  received_date: string
  is_read?: boolean
  is_flagged?: boolean
  category?: string
  urgency_level?: 'low' | 'medium' | 'high'
  has_attachments?: boolean
  attachment_urls?: string[]
  ai_summary?: string
  action_items?: ActionItem[]
  created_at?: string
  updated_at?: string
}

/** OAuth-linked email account stored in the database */
export interface EmailAccountRecord {
  id?: string
  user_id?: string
  email_address: string
  provider?: string
  oauth_tokens?: OAuthTokens
  sync_enabled?: boolean
  last_sync?: string
  sync_frequency?: number
  created_at?: string
  updated_at?: string
}

export interface OAuthTokens {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  token_type?: string | null
  scope?: string | null
  id_token?: string | null
}

// --- AI Email Analysis Types ---

export interface ActionItem {
  item: string
  priority: 'high' | 'medium' | 'low'
  owner?: string
  deadline?: string
  source?: string
}

export interface Question {
  question: string
  askedBy: string
  needsResponseFrom?: string
}

export interface KeyDataPoint {
  category: string
  data: string
  importance: 'critical' | 'important' | 'info'
}

export interface EmailInsights {
  actionItems: ActionItem[]
  nextSteps: string[]
  questions: Question[]
  keyDataPoints: KeyDataPoint[]
  summary: string
}

export interface EmailTriage {
  urgent: boolean
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  suggestedAction: string
}

export interface ProjectInsights {
  actionItems: ActionItem[]
  nextSteps: string[]
  openQuestions: Question[]
  keyDataPoints: KeyDataPoint[]
  overallStatus: string
  urgentMatters: string[]
}

export interface ProjectSummary {
  hotTopics: string[]
  actionItems: string[]
  decisions: string[]
  concerns: string[]
  nextSteps: string[]
  overallStatus: string
}

// --- Project Status Types ---

export interface ProjectStatusData {
  date: Date
  phase: string
  currentStep: string
  stepNumber: number
  totalSteps: number
  progressPercentage: number
  daysElapsed: number
  totalDays: number
  budgetStatus: string
  budgetUsed: number
  budgetTotal: number
  contingencyRemaining: number
  nextMilestone: string
  milestoneDate: string
  hotTopics: Array<{ priority: string; text: string }>
  actionItems: Array<{ status: string; text: string }>
  recentCommunications: Array<{ from: string; summary: string }>
  recentDecisions: Array<{ decision: string; impact: string }>
  aiSummary: string
}

export interface DashboardData {
  phase: string
  currentStep: number
  totalSteps: number
  daysElapsed: number
  totalDays: number
  budgetUsed: number
  budgetTotal: number
  unreadEmails: number
  pendingTasks: number
  upcomingMilestone: string
  milestoneDate: string
}

// --- Document Analysis Types ---

export interface ProjectData {
  phase?: string
  currentStep?: number
  totalSteps?: number
  budgetUsed?: number
  budgetTotal?: number
  upcomingMilestone?: string
  milestoneDate?: string
  hotTopics?: string[]
  tasks?: string[]
  decisions?: { decision: string; impact: string }[]
  vendors?: { name: string; role: string; contact?: string }[]
}

// --- Bid Types ---

export interface LineItem {
  item: string
  quantity?: number
  unit_price?: number
  total: number
  specs?: string
  notes?: string
}

export interface ExtractedBid {
  vendor_name: string
  vendor_contact?: string
  vendor_email?: string
  vendor_phone?: string
  category: string
  subcategory?: string
  description: string
  total_amount: number
  line_items?: LineItem[]
  scope_of_work?: string
  inclusions?: string[]
  exclusions?: string[]
  payment_terms?: string
  warranty_terms?: string
  estimated_duration?: string
  lead_time_weeks?: number
  valid_until?: string
  ai_confidence: number
  ai_extraction_notes: string
}

export interface BidExtractionResult {
  success: boolean
  bids: ExtractedBid[]
  error?: string
  raw_response?: string
}

export interface Bid {
  id: string
  vendor_name: string
  vendor_contact?: string
  vendor_email?: string
  vendor_phone?: string
  category: string
  subcategory?: string
  description: string
  total_amount: number
  line_items?: LineItem[]
  scope_of_work?: string
  inclusions?: string[]
  exclusions?: string[]
  payment_terms?: string
  warranty_terms?: string
  lead_time_weeks?: number
  valid_until?: string
  status: 'pending' | 'under_review' | 'selected' | 'rejected' | 'expired'
  ai_extracted: boolean
  ai_confidence?: number
  ai_extraction_notes?: string
  needs_review: boolean
  bid_date: string
  received_date: string
  source?: string
  source_document?: string
  internal_notes?: string
  pros?: string
  cons?: string
  selection_notes?: string
}

// --- Selection Types ---

export type SelectionStatus = 'considering' | 'selected' | 'ordered' | 'received' | 'installed' | 'alternative'
export type SelectionCategory = 'plumbing' | 'lighting' | 'hardware' | 'appliance' | 'tile' | 'paint'

export interface Selection {
  id: string
  project_id: string
  room: string
  location_detail?: string
  category: string
  subcategory?: string
  product_name: string
  brand?: string
  collection?: string
  model_number?: string
  finish?: string
  color?: string
  material?: string
  quantity: number
  unit_price?: number
  total_price?: number
  price_source?: string
  status: SelectionStatus
  lead_time?: string
  order_date?: string
  expected_delivery?: string
  product_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

// --- Draft Email Types ---

export interface DraftEmail {
  id: string
  to: string
  toName?: string
  subject: string
  body: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  relatedActionItem?: string
  status: 'draft' | 'editing' | 'sent' | 'dismissed'
}

// --- API Response Types ---

export interface ApiResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: string
  details?: string
}
