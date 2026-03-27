import { JobTreadClient } from './jobtread-client'
import { env } from './env'

// ─── JobTread Data Types ───────────────────────────────────────────

export interface JTJob {
  id: string
  name: string
  number: string
  status: string
  description: string | null
  createdAt: string
}

export interface JTCostItem {
  id: string
  name: string
  description: string | null
  quantity: number | null
  unitCost: number | null
  unitPrice: number | null
  cost: number
  price: number
  costCode: { name: string; number: string } | null
}

export interface JTTask {
  id: string
  name: string
  description: string | null
  progress: number | null
  startDate: string | null
  endDate: string | null
  completed: number // 0 or 1 in Pave
  taskType: { name: string } | null
  createdAt: string
}

export interface JTDailyLog {
  id: string
  date: string
  notes: string | null
  createdAt: string
}

export interface JTComment {
  id: string
  message: string
  createdAt: string
}

export interface JTFile {
  id: string
  name: string
  url: string
  size: number | null
  folder: string | null
  createdAt: string
}

export interface JTAccount {
  id: string
  name: string
  type: string
  contacts: { nodes: Array<{ id: string; name: string; title: string | null }> }
}

// ─── Service Class ─────────────────────────────────────────────────

export class JobTreadService {
  private client: JobTreadClient
  private orgId: string
  private jobId: string

  constructor(grantKey: string, orgId: string, jobId: string, apiUrl?: string) {
    this.client = new JobTreadClient(grantKey, apiUrl)
    this.orgId = orgId
    this.jobId = jobId
  }

  async getJob(): Promise<JTJob> {
    const result = await this.client.query<{ job: JTJob }>({
      job: {
        $: { id: this.jobId },
        id: {}, name: {}, number: {}, status: {},
        description: {}, createdAt: {},
      },
    })
    return result.job
  }

  async getJobs(): Promise<JTJob[]> {
    const result = await this.client.query<{
      organization: { jobs: { nodes: JTJob[] } }
    }>({
      organization: {
        $: { id: this.orgId },
        jobs: {
          $: { size: 100 },
          nodes: { id: {}, name: {}, number: {}, status: {}, description: {}, createdAt: {} },
        },
      },
    })
    return result.organization.jobs.nodes
  }

  async getCostItems(): Promise<JTCostItem[]> {
    return this.client.queryAllPages<JTCostItem>(
      () => ({
        job: {
          $: { id: this.jobId },
          costItems: {
            $: { size: 100 },
            nodes: {
              id: {}, name: {}, description: {},
              quantity: {}, unitCost: {}, unitPrice: {}, cost: {}, price: {},
              costCode: { name: {}, number: {} },
            },
          },
        },
      }),
      (res) => (res as { job: { costItems: { nodes: JTCostItem[] } } }).job.costItems.nodes,
    )
  }

  async getTasks(): Promise<JTTask[]> {
    return this.client.queryAllPages<JTTask>(
      () => ({
        job: {
          $: { id: this.jobId },
          tasks: {
            $: { size: 100 },
            nodes: {
              id: {}, name: {}, description: {},
              progress: {}, startDate: {}, endDate: {},
              completed: {}, createdAt: {},
              taskType: { name: {} },
            },
          },
        },
      }),
      (res) => (res as { job: { tasks: { nodes: JTTask[] } } }).job.tasks.nodes,
    )
  }

  async getDailyLogs(): Promise<JTDailyLog[]> {
    return this.client.queryAllPages<JTDailyLog>(
      () => ({
        job: {
          $: { id: this.jobId },
          dailyLogs: {
            $: { size: 100 },
            nodes: { id: {}, date: {}, notes: {}, createdAt: {} },
          },
        },
      }),
      (res) => (res as { job: { dailyLogs: { nodes: JTDailyLog[] } } }).job.dailyLogs.nodes,
    )
  }

  async getComments(): Promise<JTComment[]> {
    return this.client.queryAllPages<JTComment>(
      () => ({
        job: {
          $: { id: this.jobId },
          comments: {
            $: { size: 100 },
            nodes: { id: {}, message: {}, createdAt: {} },
          },
        },
      }),
      (res) => (res as { job: { comments: { nodes: JTComment[] } } }).job.comments.nodes,
    )
  }

  async getFiles(): Promise<JTFile[]> {
    return this.client.queryAllPages<JTFile>(
      () => ({
        job: {
          $: { id: this.jobId },
          files: {
            $: { size: 100 },
            nodes: { id: {}, name: {}, url: {}, size: {}, folder: {}, createdAt: {} },
          },
        },
      }),
      (res) => (res as { job: { files: { nodes: JTFile[] } } }).job.files.nodes,
    )
  }

  async getAccounts(type?: string): Promise<JTAccount[]> {
    const where = type ? ['type', '=', type] : undefined
    const result = await this.client.query<{
      organization: { accounts: { nodes: JTAccount[] } }
    }>({
      organization: {
        $: { id: this.orgId },
        accounts: {
          $: { size: 100, ...(where ? { where } : {}) },
          nodes: {
            id: {}, name: {}, type: {},
            contacts: { $: { size: 10 }, nodes: { id: {}, name: {}, title: {} } },
          },
        },
      },
    })
    return result.organization.accounts.nodes
  }

  // ─── Write Operations ──────────────────────────────────────────

  async createComment(message: string): Promise<{ id: string }> {
    const result = await this.client.query<{ createComment: { id: string } }>({
      createComment: {
        $: { targetId: this.jobId, targetType: 'job', message },
      },
    })
    return result.createComment
  }

  async createDailyLog(date: string, notes: string): Promise<{ id: string }> {
    const result = await this.client.query<{ createDailyLog: { id: string } }>({
      createDailyLog: {
        $: { jobId: this.jobId, date, notes },
        id: {},
      },
    })
    return result.createDailyLog
  }

  async createTask(
    name: string,
    opts?: { description?: string; startDate?: string; endDate?: string }
  ): Promise<{ id: string }> {
    const params: Record<string, unknown> = { targetId: this.jobId, targetType: 'job', name }
    if (opts?.description) params.description = opts.description
    if (opts?.startDate) params.startDate = opts.startDate
    if (opts?.endDate) params.endDate = opts.endDate

    const result = await this.client.query<{ createTask: { id: string } }>({
      createTask: {
        $: params,
      },
    })
    return result.createTask
  }

  async updateTask(
    taskId: string,
    fields: { name?: string; description?: string; completed?: number; startDate?: string; endDate?: string }
  ): Promise<{ id: string }> {
    const result = await this.client.query<{ updateTask: { id: string } }>({
      updateTask: {
        $: { id: taskId, ...fields },
        id: {},
      },
    })
    return result.updateTask
  }

  async createCostItem(fields: {
    name: string
    description?: string
    cost: number // in cents
    quantity?: number
    unitCost?: number // in cents
  }): Promise<{ id: string }> {
    const params: Record<string, unknown> = { jobId: this.jobId, name: fields.name, cost: fields.cost }
    if (fields.description) params.description = fields.description
    if (fields.quantity != null) params.quantity = fields.quantity
    if (fields.unitCost != null) params.unitCost = fields.unitCost

    const result = await this.client.query<{ createCostItem: { id: string } }>({
      createCostItem: {
        $: params,
        id: {},
      },
    })
    return result.createCostItem
  }

  async updateCostItem(
    costItemId: string,
    fields: { name?: string; description?: string; cost?: number; quantity?: number; unitCost?: number }
  ): Promise<{ id: string }> {
    const result = await this.client.query<{ updateCostItem: { id: string } }>({
      updateCostItem: {
        $: { id: costItemId, ...fields },
        id: {},
      },
    })
    return result.updateCostItem
  }
}

// ─── Singleton Factory ─────────────────────────────────────────────

let _service: JobTreadService | null = null

export function getJobTreadService(): JobTreadService | null {
  if (!env.jobtreadApiKey) return null
  if (!_service) {
    _service = new JobTreadService(
      env.jobtreadApiKey,
      env.jobtreadOrgId || '22P8e7iPShMR',
      env.jobtreadJobId || '22PEVyJVCikd',
      env.jobtreadApiUrl,
    )
  }
  return _service
}
