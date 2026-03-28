-- Migration 004: Vendor Follow-Ups, Decision Log, Orchestrator Runs
-- Applied to Supabase via MCP on 2026-03-28
-- See scripts/orchestrator.ts for the daily agent that uses these tables

-- Vendor Follow-Ups: the orchestrator's task queue
-- (see full DDL in Supabase migration history)

-- Decision Log: every choice with reasoning (Phase 5 learning)
-- (see full DDL in Supabase migration history)

-- Orchestrator Run Log: track what the daily agent did
-- (see full DDL in Supabase migration history)

-- NOTE: Full DDL was applied directly via mcp__claude_ai_Supabase__apply_migration
-- This file is a reference for the git history.
