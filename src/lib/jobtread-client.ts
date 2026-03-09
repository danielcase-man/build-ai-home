import { ExternalServiceError } from './errors'

const DEFAULT_API_URL = 'https://api.jobtread.com/pave'
const MAX_PAGE_SIZE = 100
const RATE_LIMIT_MS = 500

export class JobTreadClient {
  private grantKey: string
  private apiUrl: string
  private lastRequestTime = 0

  constructor(grantKey: string, apiUrl?: string) {
    this.grantKey = grantKey
    this.apiUrl = apiUrl || DEFAULT_API_URL
  }

  /**
   * Execute a Pave query against the JobTread API.
   * The grant key is injected automatically at the root `$` level.
   */
  async query<T = unknown>(paveQuery: Record<string, unknown>): Promise<T> {
    await this.enforceRateLimit()

    const body = JSON.stringify({
      query: {
        $: { grantKey: this.grantKey },
        ...paveQuery,
      },
    })

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new ExternalServiceError('JobTread', `HTTP ${response.status}: ${text}`)
    }

    const data = await response.json()

    // Pave returns errors as a top-level string or array
    if (typeof data === 'string') {
      throw new ExternalServiceError('JobTread', data)
    }

    return data as T
  }

  /**
   * Fetch nodes from a connection, auto-paging if needed.
   * @param buildQuery - function that builds a Pave query for a given page number
   * @param extractNodes - function that extracts the nodes array from the response
   */
  async queryAllPages<T>(
    buildQuery: (page: number) => Record<string, unknown>,
    extractNodes: (response: unknown) => T[],
  ): Promise<T[]> {
    const allNodes: T[] = []
    let page = 1

    // Safety limit: 10 pages max (1000 items) to avoid runaway loops
    while (page <= 10) {
      const result = await this.query(buildQuery(page))
      const nodes = extractNodes(result)
      allNodes.push(...nodes)

      // If we got fewer than MAX_PAGE_SIZE, we've reached the end
      if (nodes.length < MAX_PAGE_SIZE) break
      page++
    }

    return allNodes
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < RATE_LIMIT_MS && this.lastRequestTime > 0) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed))
    }
    this.lastRequestTime = Date.now()
  }
}
