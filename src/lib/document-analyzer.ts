import { getOpenAIClient } from './ai-clients'
import type { ProjectData } from '@/types'

export async function analyzeProjectDocument(content: string, filename: string): Promise<ProjectData> {
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing construction project documents for a home being built using the UBuildIt process. Extract key project data and return it as structured JSON.`
        },
        {
          role: 'user',
          content: `
            Analyze this document and extract project information.
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
            }

            Only include fields where you found actual data. Don't make up values.
          `
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return result as ProjectData
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
