/**
 * Shared UI helper functions
 * Extracted from components to avoid duplication
 */

import { format } from 'date-fns'

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-300'
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'low': return 'bg-green-100 text-green-800 border-green-300'
    default: return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

export function getImportanceBadge(importance: string): string {
  switch (importance) {
    case 'critical': return '●'
    case 'important': return '◆'
    case 'info': return '○'
    default: return '·'
  }
}

export function formatEmailDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a')
  } catch {
    return dateString
  }
}

export function extractEmailAddress(fromField: string): string {
  const emailMatch = fromField.match(/<([^>]+)>/)
  return emailMatch ? emailMatch[1] : fromField
}

export function extractSenderName(fromField: string): string {
  const nameMatch = fromField.match(/^([^<]+)</)
  return nameMatch ? nameMatch[1].trim().replace(/"/g, '') : fromField
}
