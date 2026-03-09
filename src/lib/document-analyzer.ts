import { getAnthropicClient } from './ai-clients'
import type { ProjectData } from '@/types'

const MODEL = 'claude-sonnet-4-6'

export async function analyzeProjectDocument(content: string, filename: string): Promise<ProjectData> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: 'You are analyzing construction project documents for a home being built using the UBuildIt process. Extract key project data and return it as structured JSON. Only include fields where you found actual data. Don\'t make up values. Return valid JSON only, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Analyze this document and extract project information.
Document: ${filename}

Extract any of the following that you find:
- Current project phase (Planning, Construction, etc)
- Step number within the phase
- Budget amounts (spent and total)
- Upcoming milestones and dates
- Hot topics or urgent items
- Tasks to be completed
- Decisions made with cost impacts
- Vendor/team member information

Content:
${content.substring(0, 4000)}

Return as JSON with these fields:
{
  "phase": "Planning|Construction|etc",
  "currentStep": number,
  "totalSteps": number,
  "budgetUsed": number,
  "budgetTotal": number,
  "upcomingMilestone": "string",
  "milestoneDate": "string",
  "hotTopics": ["string"],
  "tasks": ["string"],
  "decisions": [{"decision": "string", "impact": "string"}],
  "vendors": [{"name": "string", "role": "string", "contact": "string"}]
}`
      }]
    })

    const text = response.content[0]
    if (text.type === 'text') {
      let jsonText = text.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json?\n/, '').replace(/\n```$/, '')
      }
      return JSON.parse(jsonText) as ProjectData
    }
    return {}
  } catch (error) {
    console.error('Error analyzing document:', error)
    return {}
  }
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // For PDF extraction, we'd normally use a library like pdf-parse
  // For now, return a message that PDFs need special handling
  return "PDF parsing will be implemented with pdf-parse library"
}
