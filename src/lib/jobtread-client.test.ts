import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { JobTreadClient } from './jobtread-client'

describe('JobTreadClient', () => {
  let client: JobTreadClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new JobTreadClient('test-grant-key')
  })

  describe('query', () => {
    it('sends correct Pave query with grant key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ job: { id: '123', name: 'Test' } }),
      })

      await client.query({ job: { $: { id: '123' }, id: {}, name: {} } })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.jobtread.com/pave',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.query.$).toEqual({ grantKey: 'test-grant-key' })
      expect(body.query.job).toEqual({ $: { id: '123' }, id: {}, name: {} })
    })

    it('returns parsed response data', async () => {
      const mockData = { job: { id: '123', name: 'Case Home' } }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      const result = await client.query({ job: { $: { id: '123' }, id: {}, name: {} } })
      expect(result).toEqual(mockData)
    })

    it('throws ExternalServiceError on HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      await expect(client.query({ job: {} })).rejects.toThrow('JobTread')
      await expect(client.query({ job: {} })).rejects.toThrow('500')
    })

    it('throws ExternalServiceError when Pave returns string error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve('Expected size of 200 to be no more than 100'),
      })

      await expect(client.query({ job: {} })).rejects.toThrow('Expected size')
    })

    it('uses custom API URL when provided', async () => {
      const customClient = new JobTreadClient('key', 'https://custom.api.com/pave')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await customClient.query({ test: {} })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/pave',
        expect.any(Object),
      )
    })
  })

  describe('queryAllPages', () => {
    it('fetches single page when results < MAX_PAGE_SIZE', async () => {
      const nodes = [{ id: '1' }, { id: '2' }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ job: { items: { nodes } } }),
      })

      const result = await client.queryAllPages<{ id: string }>(
        (page) => ({ job: { items: { $: { size: 100, page }, nodes: { id: {} } } } }),
        (res) => (res as { job: { items: { nodes: { id: string }[] } } }).job.items.nodes,
      )

      expect(result).toEqual(nodes)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('fetches multiple pages when results = MAX_PAGE_SIZE', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: String(i) }))
      const lastPage = [{ id: '100' }, { id: '101' }]

      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            job: { items: { nodes: callCount === 1 ? fullPage : lastPage } },
          }),
        })
      })

      const result = await client.queryAllPages<{ id: string }>(
        (page) => ({ job: { items: { $: { size: 100, page }, nodes: { id: {} } } } }),
        (res) => (res as { job: { items: { nodes: { id: string }[] } } }).job.items.nodes,
      )

      expect(result).toHaveLength(102)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
