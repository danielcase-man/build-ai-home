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
  oauth_tokens?: OAuthTokens | EncryptedTokens
  sync_enabled?: boolean
  last_sync?: string
  sync_frequency?: number
  created_at?: string
  updated_at?: string
}

/** AES-256-GCM encrypted token payload stored in oauth_tokens JSONB */
export interface EncryptedTokens {
  _encrypted: true
  iv: string
  data: string
  tag: string
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
  actionItems: Array<{
    status: string
    text: string
    action_type?: 'draft_email' | null
    action_context?: {
      to?: string
      to_name?: string
      subject_hint?: string
      context?: string
    }
  }>
  recentCommunications: Array<{ from: string; summary: string }>
  recentDecisions: Array<{ decision: string; impact: string }>
  nextSteps: string[]
  openQuestions: Question[]
  keyDataPoints: KeyDataPoint[]
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
  planningSteps: PlanningStepRecord[]
}

export interface PlanningStepRecord {
  step_number: number
  name: string
  status: string
}

// --- Site & Building Types (from existing-app migration) ---

export interface SiteInformation {
  id?: string
  project_id: string
  property_survey?: Record<string, unknown>
  topographic_data?: Record<string, unknown>
  utility_locations?: Record<string, unknown>
  access_routes?: Record<string, unknown>
  soil_conditions?: Record<string, unknown>
  soil_bearing_capacity?: number
  water_table_depth?: number
  environmental_factors?: Record<string, unknown>
  zoning_classification?: string
  setback_requirements?: Record<string, unknown>
  hoa_restrictions?: Record<string, unknown>
  building_codes?: Record<string, unknown>
  well_location?: { x: number; y: number }
  septic_location?: { x: number; y: number }
  flood_zone?: string
  created_at?: string
  updated_at?: string
}

export interface BuildingSpecifications {
  id?: string
  project_id: string
  foundation_type?: string
  foundation_dimensions?: Record<string, unknown>
  concrete_requirements?: Record<string, unknown>
  framing_type?: string
  lumber_specifications?: Record<string, unknown>
  structural_loads?: Record<string, unknown>
  roof_specifications?: Record<string, unknown>
  wall_specifications?: Record<string, unknown>
  window_door_specifications?: Record<string, unknown>
  exterior_materials?: Record<string, unknown>
  hvac_specifications?: Record<string, unknown>
  plumbing_specifications?: Record<string, unknown>
  electrical_specifications?: Record<string, unknown>
  flooring_specifications?: Record<string, unknown>
  interior_finishes?: Record<string, unknown>
  cabinetry_specifications?: Record<string, unknown>
  appliance_specifications?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export interface VendorCategoryRequirement {
  id?: string
  category_id: string
  requirement_name: string
  requirement_description?: string
  data_type: 'text' | 'number' | 'boolean' | 'date' | 'file' | 'selection'
  is_required: boolean
  measurement_unit?: string
  min_value?: number
  max_value?: number
  selection_options?: Record<string, unknown>
  validation_pattern?: string
  help_text?: string
  display_order: number
  field_group?: string
  created_at?: string
}

export interface VendorBidRequirement {
  id?: string
  project_id: string
  category: string
  vendor_name: string
  requirement_responses: Record<string, unknown>
  completeness_score: number
  created_at?: string
  updated_at?: string
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
  bid_id?: string | null
  linked_bid?: { vendor_name: string; total_amount: number } | null
  created_at?: string
  updated_at?: string
}

// --- Vendor Types ---

export interface Vendor {
  id: string
  project_id: string
  company_name: string
  category: string | null
  status: string | null
  primary_contact: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

// --- Construction Loan Types ---

export interface ConstructionLoan {
  id?: string
  project_id: string
  lender_name: string
  loan_type: 'construction' | 'construction_permanent' | '1x_close' | '2x_close' | 'bridge' | 'other'
  loan_amount: number
  cost_of_construction?: number
  lot_value?: number
  interest_rate?: number
  loan_term_months?: number
  ltv_ratio?: number
  application_status: 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'conditionally_approved' | 'approved' | 'funded' | 'rejected' | 'withdrawn'
  application_url?: string
  application_date?: string
  approval_date?: string
  funding_date?: string
  closing_date?: string
  loan_officer_name?: string
  loan_officer_email?: string
  loan_officer_phone?: string
  loan_contact_name?: string
  loan_contact_email?: string
  loan_contact_phone?: string
  loan_contact_nmls?: string
  notes?: string
  loan_details?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

// --- Budget Forecast Types ---

export interface BudgetForecast {
  spent: number
  burnRate: number
  projectedTotal: number
  variance: number
  healthStatus: 'healthy' | 'caution' | 'over_budget'
  monthsElapsed: number
  estimatedMonthsRemaining: number
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

// --- Assistant Types ---

export type ReadToolName =
  | 'get_project_overview'
  | 'search_bids'
  | 'get_budget_items'
  | 'get_selections'
  | 'search_emails'
  | 'get_contacts'
  | 'get_planning_steps'
  | 'get_status_history'

export type WriteToolName =
  | 'update_bid'
  | 'add_bid'
  | 'update_selection'
  | 'add_selection'
  | 'update_budget_item'
  | 'add_budget_item'
  | 'update_milestone'
  | 'update_task'

export interface PendingAction {
  id: string
  tool_use_id: string
  type: WriteToolName
  description: string
  data: Record<string, unknown>
}

export interface AssistantStreamEvent {
  type: 'text_delta' | 'tool_call' | 'tool_status' | 'done' | 'error'
  content?: string
  action?: PendingAction
  toolName?: string
  error?: string
}

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: PendingAction[]
}

// --- JobTread Sync Types ---

export interface JobTreadSyncResult {
  entity: string
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface JobTreadFullSyncResult {
  results: JobTreadSyncResult[]
  totalCreated: number
  totalUpdated: number
  duration: number
}

// --- JobTread Push Types ---

export type JobTreadPushItemType = 'create_task' | 'update_task' | 'create_daily_log' | 'create_comment' | 'create_cost_item' | 'update_cost_item'

export interface JobTreadPushItem {
  type: JobTreadPushItemType
  localId?: string
  jobtreadId?: string
  label: string
  data: Record<string, unknown>
}

export interface JobTreadPushResult {
  success: boolean
  type: JobTreadPushItemType
  label: string
  jobtreadId?: string
  error?: string
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

