/**
 * Project Configuration Service
 *
 * Provides project-level configuration lookup (Dropbox paths, email accounts, etc.).
 * Falls back to environment variables and hardcoded defaults when no DB record exists.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  projectId: string
  dropboxBasePath: string | null
  emailAccountId: string | null
  projectAddress: string | null
  inceptionDate: string | null
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_DROPBOX_BASE = 'C:/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Get the full project configuration.
 * Queries the project_config table. Returns defaults if not found.
 */
export async function getProjectConfig(projectId: string): Promise<ProjectConfig> {
  const { data } = await supabase
    .from('project_config')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (data) {
    return {
      projectId: data.project_id ?? projectId,
      dropboxBasePath: data.dropbox_base_path ?? null,
      emailAccountId: data.email_account_id ?? null,
      projectAddress: data.project_address ?? null,
      inceptionDate: data.inception_date ?? null,
    }
  }

  // Return defaults when no config row exists
  return {
    projectId,
    dropboxBasePath: null,
    emailAccountId: null,
    projectAddress: null,
    inceptionDate: null,
  }
}

/**
 * Get the Dropbox base path for a project.
 *
 * Lookup chain:
 *   1. project_config.dropbox_base_path (DB)
 *   2. process.env.DROPBOX_BASE (environment variable)
 *   3. Hardcoded default for the 708 Purple Salvia Cove project
 */
export async function getDropboxBasePath(projectId: string): Promise<string> {
  const config = await getProjectConfig(projectId)

  if (config.dropboxBasePath) {
    return config.dropboxBasePath
  }

  if (process.env.DROPBOX_BASE) {
    return process.env.DROPBOX_BASE
  }

  return DEFAULT_DROPBOX_BASE
}
