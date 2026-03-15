/**
 * Document Analyzer — AI-powered document analysis for construction projects.
 *
 * Handles both text-based analysis (from pdf-parse) and vision-based analysis
 * (from rendered PDF pages as images) using Claude Sonnet 4.6.
 */

import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import type { ProjectData } from '@/types'

const MODEL = 'claude-sonnet-4-6'

/** Analyze a text-based document and extract project information */
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
${content.substring(0, 8000)}

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
      return parseAIJsonResponse(text.text) as ProjectData
    }
    return {}
  } catch (error) {
    console.error('Error analyzing document:', error)
    return {}
  }
}

/** Analyze an architectural drawing image using Claude vision API */
export async function analyzeArchitecturalDrawing(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  context?: string
): Promise<Record<string, unknown>> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      system: `You are an expert construction plan analyst. Analyze architectural drawings and extract structured data. You are reviewing plans for a 7,526 SF French Country Estate in Liberty Hill, TX. Extract ONLY what you can see in the image — do NOT fabricate dimensions, counts, or specifications. Return valid JSON only.`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `${context ? `Context: ${context}\n\n` : ''}Analyze this architectural drawing and extract all relevant construction data. Include:

1. Room names, dimensions, and square footage visible
2. Door and window locations with sizes if labeled
3. Fixture locations (sinks, toilets, lights, outlets)
4. Material callouts or finish notes
5. Dimensions and measurements
6. Any schedules or tables shown
7. Section/detail references

Return JSON:
{
  "drawing_type": "floor_plan|elevation|section|detail|schedule|other",
  "rooms_visible": [{"name": "Room Name", "dimensions": "12x14", "square_footage": 168}],
  "windows": [{"mark": "W1", "size": "36x48", "location": "south wall"}],
  "doors": [{"mark": "D1", "size": "36x80", "type": "entry"}],
  "fixtures": [{"type": "sink", "count": 1, "location": "north wall"}],
  "materials_noted": [{"surface": "floor", "material": "hardwood"}],
  "dimensions": ["key dimensions noted"],
  "annotations": ["important notes or callouts"],
  "confidence": 0.85
}`,
          },
        ],
      }],
    })

    const text = response.content[0]
    if (text.type === 'text') {
      return parseAIJsonResponse(text.text) as Record<string, unknown>
    }
    return {}
  } catch (error) {
    console.error('Error analyzing architectural drawing:', error)
    return {}
  }
}

/** Extract text content from a PDF buffer */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdf = await import('pdf-parse-fork')
    const pdfData = await pdf.default(buffer)
    return pdfData.text
  } catch (error) {
    console.error('PDF text extraction failed:', error)
    return ''
  }
}
