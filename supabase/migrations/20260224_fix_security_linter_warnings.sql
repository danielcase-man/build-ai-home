-- Fix Supabase linter security warnings
-- 2 ERRORs: Security Definer Views
-- 4 WARNs: Function Search Path Mutable
-- 1 additional: SECURITY DEFINER on calculate_bid_completeness

-- ============================================================
-- 1. Fix SECURITY DEFINER views → SECURITY INVOKER
--    This ensures views respect the querying user's RLS policies
--    instead of the view creator's permissions.
-- ============================================================

ALTER VIEW public.bids_by_category SET (security_invoker = true);
ALTER VIEW public.pending_bids_summary SET (security_invoker = true);

-- ============================================================
-- 2. Set search_path on all functions to prevent search path
--    injection attacks (CWE-426).
-- ============================================================

ALTER FUNCTION public.calculate_bid_completeness(UUID) SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.finalize_bid_to_budget(UUID) SET search_path = '';
ALTER FUNCTION public.reject_competing_bids(UUID) SET search_path = '';

-- ============================================================
-- 3. Remove SECURITY DEFINER from calculate_bid_completeness.
--    This function doesn't need elevated privileges — it only
--    reads from tables the caller should already have access to.
-- ============================================================

ALTER FUNCTION public.calculate_bid_completeness(UUID) SECURITY INVOKER;
