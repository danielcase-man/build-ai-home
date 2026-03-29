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

/** Email with thread and direction metadata for draft generation */
export interface ThreadedEmail extends Email {
  threadId: string
  direction: 'sent' | 'received'
}

/** A conversation thread grouped by thread_id */
export interface EmailThread {
  threadId: string
  subject: string
  participants: string[]
  messages: ThreadedEmail[]
  lastMessageDate: string
  danielReplied: boolean
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

// --- Bid Line Items & Documents ---

export interface BidLineItem {
  id: string
  bid_id: string
  item_name: string
  item_description?: string
  specs?: string
  room?: string
  location_detail?: string
  quantity: number
  unit?: string
  unit_price?: number
  total_price: number
  brand?: string
  model_number?: string
  finish?: string
  color?: string
  material?: string
  category?: string
  subcategory?: string
  selection_id?: string | null
  sort_order: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface BidDocument {
  id: string
  bid_id?: string | null
  project_id: string
  filename: string
  file_type?: string
  file_size?: number
  storage_path: string
  source: 'upload' | 'email_attachment' | 'dropbox'
  email_id?: string | null
  dropbox_path?: string | null
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
  extracted_text?: string | null
  ai_confidence?: number | null
  ai_extraction_notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface BidWithLineItems extends Bid {
  line_items_normalized: BidLineItem[]
  document?: BidDocument | null
}

export interface ExtractedLineItem {
  item_name: string
  item_description?: string
  room?: string
  quantity: number
  unit?: string
  unit_price?: number
  total_price: number
  brand?: string
  model_number?: string
  finish?: string
  color?: string
  material?: string
  specs?: string
  notes?: string
  category?: string
  subcategory?: string
}

export interface ExtractedBidV2 extends ExtractedBid {
  line_items_v2: ExtractedLineItem[]
}

export interface VendorBidComparison {
  category: string
  vendors: Array<{
    bid_id: string
    vendor_name: string
    total_amount: number
    line_item_count: number
    status: string
    lead_time_weeks?: number
    pros?: string
    cons?: string
  }>
}

// --- Selection Types ---

export type SelectionStatus = 'considering' | 'selected' | 'ordered' | 'received' | 'installed' | 'alternative'
export type SelectionCategory = 'plumbing' | 'lighting' | 'hardware' | 'appliance' | 'tile' | 'paint' | 'countertop' | 'flooring' | 'cabinetry' | 'windows'

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
  knowledge_id?: string | null
  needed_by_phase?: number | null
  needed_by_date?: string | null
  lead_time_days?: number | null
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
  is_active?: boolean
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

// --- Construction Knowledge Graph Types ---

export type KnowledgeItemType = 'task' | 'material' | 'inspection' | 'decision_point'

export type KnowledgeStateStatus = 'not_applicable' | 'pending' | 'ready' | 'in_progress' | 'completed' | 'blocked'

export interface KnowledgeItem {
  id: string
  phase_number: number
  trade: string
  item_name: string
  item_type: KnowledgeItemType
  parent_id: string | null
  sort_order: number
  dependencies: string[]
  triggers: string[]
  materials: Array<{ name: string; quantity_formula?: string; unit?: string; specs?: string }>
  inspection_required: boolean
  code_references: Array<{ code: string; section?: string; description?: string }>
  typical_duration_days: number | null
  typical_cost_range: { min: number; max: number } | null
  decision_required: boolean
  decision_options: Array<{ option: string; pros?: string; cons?: string; cost_impact?: string }> | null
  description: string | null
  created_at?: string
  updated_at?: string
}

export interface KnowledgeTreeNode extends KnowledgeItem {
  children: KnowledgeTreeNode[]
  state?: ProjectKnowledgeState | null
}

export interface ProjectKnowledgeState {
  id: string
  project_id: string
  knowledge_id: string
  status: KnowledgeStateStatus
  blocking_reason: string | null
  actual_cost: number | null
  completed_date: string | null
  notes: string | null
}

export interface KnowledgeSeedItem {
  phase_number: number
  trade: string
  item_name: string
  item_type: KnowledgeItemType
  sort_order: number
  description?: string
  inspection_required?: boolean
  decision_required?: boolean
  typical_duration_days?: number
  typical_cost_range?: { min: number; max: number }
  materials?: Array<{ name: string; quantity_formula?: string; unit?: string; specs?: string }>
  code_references?: Array<{ code: string; section?: string; description?: string }>
  decision_options?: Array<{ option: string; pros?: string; cons?: string; cost_impact?: string }>
  children?: Omit<KnowledgeSeedItem, 'phase_number' | 'trade'>[]
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
  | 'get_knowledge_tree'
  | 'get_blockers'
  | 'get_cascade_requirements'
  | 'get_workflow_status'
  | 'get_workflow_alerts'
  | 'research_topic'
  | 'get_plan_extractions'
  | 'get_vendor_threads'
  | 'get_follow_ups'
  | 'get_change_orders'
  | 'get_draw_schedule'
  | 'get_warranties'
  | 'get_punch_list'
  | 'get_inspections'

export type WriteToolName =
  | 'update_bid'
  | 'add_bid'
  | 'update_selection'
  | 'add_selection'
  | 'update_budget_item'
  | 'add_budget_item'
  | 'update_milestone'
  | 'update_task'
  | 'complete_workflow_item'
  | 'link_selection_to_decision'
  | 'create_change_order'
  | 'add_punch_item'
  | 'schedule_inspection'

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

// --- Plaid / Financial Tracking Types ---

export interface PlaidConnection {
  id: string
  project_id: string
  institution_name: string
  institution_id?: string
  item_id: string
  access_token: string  // Encrypted in DB
  consent_expiration?: string
  cursor?: string
  accounts: PlaidAccount[]
  status: 'active' | 'needs_reauth' | 'disconnected' | 'error'
  error_code?: string
  last_sync?: string
  created_at?: string
  updated_at?: string
}

export interface PlaidAccount {
  account_id: string
  name: string
  mask: string
  type: string
  subtype: string
}

export interface Transaction {
  id: string
  project_id: string
  plaid_connection_id?: string
  plaid_transaction_id?: string
  account_id?: string
  account_name?: string
  date: string
  authorized_date?: string
  amount: number
  merchant_name?: string
  name?: string
  payment_channel?: string
  transaction_type?: string
  plaid_category?: string[]
  pending: boolean
  vendor_id?: string
  budget_item_id?: string
  invoice_id?: string
  match_status: 'unmatched' | 'auto_matched' | 'confirmed' | 'excluded' | 'manual'
  match_confidence?: number
  category_override?: string
  is_construction_related: boolean
  notes?: string
  created_at?: string
  updated_at?: string
  // Joined fields
  vendor_name?: string
  budget_category?: string
}

export interface Contract {
  id: string
  project_id: string
  vendor_id?: string
  bid_id?: string
  budget_item_id?: string
  title: string
  description?: string
  total_amount: number
  payment_terms?: string
  start_date?: string
  end_date?: string
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'disputed'
  document_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
  // Computed
  total_invoiced?: number
  total_paid?: number
  remaining?: number
  vendor_name?: string
}

export interface Invoice {
  id: string
  project_id: string
  contract_id?: string
  vendor_id?: string
  invoice_number?: string
  description?: string
  amount: number
  tax_amount: number
  total_amount: number
  date_issued: string
  date_due?: string
  date_paid?: string
  status: 'received' | 'approved' | 'partial' | 'paid' | 'overdue' | 'disputed' | 'voided'
  payment_method?: string
  document_url?: string
  notes?: string
  created_at?: string
  updated_at?: string
  vendor_name?: string
}

export interface Payment {
  id: string
  project_id: string
  transaction_id?: string
  invoice_id?: string
  contract_id?: string
  vendor_id?: string
  amount: number
  date: string
  payment_method?: string
  reference_number?: string
  source: 'plaid' | 'manual' | 'construction_loan_draw'
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface VendorMatchRule {
  id: string
  project_id: string
  vendor_id: string
  match_pattern: string
  budget_category?: string
  match_type: 'exact' | 'contains' | 'regex'
  priority: number
  is_active: boolean
}

export interface FinancialOverview {
  totalContracted: number
  totalInvoiced: number
  totalPaid: number
  outstandingBalance: number
  overdueInvoices: number
  unmatchedTransactions: number
  recentTransactions: Transaction[]
  vendorBalances: VendorBalance[]
}

export interface VendorBalance {
  vendor_id: string
  vendor_name: string
  category: string | null
  contract_total: number
  invoiced: number
  paid: number
  remaining: number
  overdue_amount: number
}

export interface PlaidSyncResult {
  added: number
  modified: number
  removed: number
  autoMatched: number
  errors: string[]
}

// --- Takeoff & Bid Package Types ---

export type TakeoffStatus = 'draft' | 'review' | 'final' | 'superseded'
export type TakeoffItemConfidence = 'verified' | 'calculated' | 'estimated' | 'gap'
export type TakeoffItemSource = 'calculated' | 'structural_plan' | 'estimated' | 'vendor_spec'
export type BidPackageStatus = 'draft' | 'ready' | 'sent' | 'responses_received' | 'evaluating' | 'awarded' | 'cancelled'

export interface PlanSource {
  name: string
  type: 'architectural' | 'structural' | 'foundation' | 'detail' | 'site' | 'electrical' | 'mechanical' | 'plumbing'
  confidence: 'text_extractable' | 'image_ocr' | 'estimated'
  version?: string
}

export interface TakeoffRun {
  id: string
  project_id: string
  trade: string
  name: string
  description?: string
  plan_sources?: PlanSource[]
  confidence_pct?: number
  gaps?: string[]
  notes?: string
  status: TakeoffStatus
  superseded_by?: string
  created_at?: string
  updated_at?: string
}

export interface TakeoffItem {
  id: string
  takeoff_run_id: string
  project_id: string
  category: string
  subcategory?: string
  trade: string
  item_name: string
  description?: string
  material_spec?: string
  species_grade?: string
  quantity: number
  unit: string
  waste_factor?: number
  quantity_with_waste?: number
  nominal_width?: string
  length_inches?: number
  length_feet?: number
  unit_cost?: number
  total_cost?: number
  source: TakeoffItemSource
  confidence: TakeoffItemConfidence
  source_detail?: string
  knowledge_id?: string
  budget_item_id?: string
  sort_order?: number
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface BidPackage {
  id: string
  project_id: string
  takeoff_run_id?: string
  trade: string
  title: string
  scope_of_work?: string
  special_requirements?: string
  item_count?: number
  estimated_total?: number
  status: BidPackageStatus
  deadline?: string
  sent_date?: string
  awarded_date?: string
  awarded_bid_id?: string
  vendors_contacted?: Array<{
    vendor_id?: string
    vendor_name: string
    contact_email: string
    sent_date?: string
    status: string
    bid_id?: string
  }>
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface BidPackageItem {
  id: string
  bid_package_id: string
  takeoff_item_id?: string
  item_name: string
  description?: string
  material_spec?: string
  quantity: number
  unit: string
  notes?: string
  sort_order?: number
  created_at?: string
}

export interface TakeoffRunWithItems extends TakeoffRun {
  items: TakeoffItem[]
}

// --- Selection Decision Queue Types ---

export type DecisionUrgency = 'urgent' | 'high' | 'medium' | 'low' | 'none'

/** A competing bid summary shown in the Decision Queue */
export interface DecisionQueueBid {
  bidId: string
  vendorName: string
  totalAmount: number
  leadTimeWeeks?: number
  status: Bid['status']
  pros?: string
  cons?: string
}

/** A single category in the decision queue with its zone, urgency, and competing bids */
export interface DecisionQueueCategory {
  category: string
  bidCategory: string
  phase: number
  phaseName: string
  zone: 'decision' | 'locked' | 'future'
  urgency: DecisionUrgency
  urgencyReason?: string
  bids: DecisionQueueBid[]
  selectedBid?: DecisionQueueBid
  selectionCount: number
  statusSummary: Partial<Record<SelectionStatus, number>>
  leadTimeAlert?: {
    priority: 'low' | 'medium' | 'high' | 'urgent'
    title: string
    message: string
    order_by_date?: string
  }
}

/** Full result from getSelectionDecisionQueue() */
export interface DecisionQueueResult {
  decisionQueue: DecisionQueueCategory[]  // Zone 1: has bids, no selected vendor
  lockedIn: DecisionQueueCategory[]       // Zone 2: vendor selected
  future: DecisionQueueCategory[]         // Zone 3: no bids, future phase
  activePhase: number | null
  activePhaseName: string | null
}

// --- Vendor Follow-Up Types ---

export type FollowUpStatus = 'pending' | 'sent' | 'awaiting_response' | 'responded' | 'follow_up_sent' | 'escalated' | 'completed' | 'cancelled' | 'stale'
export type FollowUpCategory = 'bid_request' | 'bid_follow_up' | 'contract' | 'scheduling' | 'payment' | 'general'

export interface VendorFollowUp {
  id: string
  project_id: string
  vendor_id?: string
  vendor_name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  category: FollowUpCategory
  subject: string
  context?: string
  related_bid_id?: string
  related_bid_package_id?: string
  created_date: string
  initial_outreach_date?: string
  next_follow_up_date: string
  deadline?: string
  escalation_date?: string
  status: FollowUpStatus
  follow_up_count: number
  max_follow_ups: number
  escalation_action?: string
  auto_send: boolean
  last_contact_date?: string
  last_contact_method?: string
  response_summary?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

// --- Decision Log Types ---

export type DecisionType = 'vendor_selection' | 'material_choice' | 'design_change' | 'budget_adjustment' | 'schedule_change'
export type OutcomeStatus = 'pending' | 'successful' | 'problematic' | 'reversed'

export interface DecisionLogEntry {
  id: string
  project_id: string
  decision_type: DecisionType
  category?: string
  title: string
  description?: string
  chosen_option: string
  alternatives?: Array<{ name: string; amount?: number; reason_rejected?: string }>
  reasoning?: string
  cost_impact?: number
  schedule_impact_days?: number
  risk_notes?: string
  decided_by: string
  decided_date: string
  related_bid_id?: string
  related_vendor_id?: string
  outcome_status: OutcomeStatus
  outcome_notes?: string
  outcome_date?: string
  confidence_score?: number
  created_at?: string
  updated_at?: string
}

// --- Orchestrator Types ---

export interface OrchestratorAction {
  type: string
  vendor?: string
  detail: string
  timestamp?: string
}

export interface OrchestratorAlert {
  priority: 'high' | 'medium' | 'low'
  message: string
}

export interface OrchestratorRun {
  id: string
  project_id: string
  run_date: string
  started_at: string
  completed_at?: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  actions_taken: OrchestratorAction[]
  alerts_generated: OrchestratorAlert[]
  decisions_recommended: Array<{ title: string; reasoning: string }>
  emails_processed: number
  follow_ups_sent: number
  bids_extracted: number
  statuses_updated: number
  errors: Array<{ message: string; context?: string }>
  notes?: string
  created_at?: string
}

// --- Intelligence Engine Types ---

export type IntelligenceSource = 'gmail' | 'dropbox' | 'jobtread' | 'manual'

export interface SourceWatermark {
  source: IntelligenceSource
  last_processed_at: string
  last_processed_id?: string
  items_processed: number
  errors: number
  metadata?: Record<string, unknown>
  updated_at?: string
}

export type AgentDomain = 'bid_analysis' | 'takeoff' | 'follow_up' | 'financial' | 'contract' | 'scheduling' | 'general'

export interface ChangeEvent {
  source: IntelligenceSource
  domain: AgentDomain
  file_path?: string
  file_name?: string
  file_type?: string
  email_id?: string
  metadata?: Record<string, unknown>
  detected_at: string
}

export interface AgentResult {
  domain: AgentDomain
  source: IntelligenceSource
  action: string
  details: string
  records_created: number
  records_updated: number
  errors: string[]
  duration_ms: number
}

export interface IntelligenceRunResult {
  run_id?: string
  started_at: string
  completed_at: string
  sources_checked: IntelligenceSource[]
  changes_detected: number
  agents_invoked: AgentDomain[]
  results: AgentResult[]
  errors: string[]
  duration_ms: number
}

export interface FileInventoryRecord {
  id?: string
  project_id: string
  file_path: string
  file_name: string
  file_type: string
  file_size: number
  modified_at: string
  folder_category?: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  processed_at?: string
  agent_domain?: AgentDomain
  result_id?: string
  error_message?: string
  created_at?: string
  updated_at?: string
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

