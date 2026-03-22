'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  FileText,
  File,
  Ruler,
  Image,
  Upload,
  ExternalLink,
  Search,
  FolderOpen,
  Plus,
  Calendar,
  HardDrive,
  Tags,
  CloudDownload,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  project_id: string
  name: string
  file_url: string | null
  file_type: string | null
  file_size: number | null
  category: string | null
  description: string | null
  upload_date: string | null
  jobtread_id: string | null
  created_at: string
}

interface DocumentsClientProps {
  documents: Document[]
  projectId: string
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Derive file extension from name or file_type MIME */
function getExtension(doc: Document): string {
  const fromName = doc.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName

  // Fall back to MIME type mapping
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/dxf': 'dxf',
    'image/vnd.dxf': 'dxf',
    'application/x-dxf': 'dxf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'text/plain': 'txt',
  }
  if (doc.file_type && mimeMap[doc.file_type]) return mimeMap[doc.file_type]
  return ''
}

function getFileIcon(ext: string) {
  switch (ext) {
    case 'pdf':
      return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' }
    case 'dxf':
      return { icon: Ruler, color: 'text-blue-500', bg: 'bg-blue-50' }
    case 'doc':
    case 'docx':
      return { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      return { icon: Image, color: 'text-emerald-500', bg: 'bg-emerald-50' }
    case 'txt':
      return { icon: File, color: 'text-gray-500', bg: 'bg-gray-50' }
    default:
      return { icon: File, color: 'text-gray-400', bg: 'bg-gray-50' }
  }
}

function getCategoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'plans':
    case 'plan':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'contracts':
    case 'contract':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'permits':
    case 'permit':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'uploaded':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'photos':
    case 'photo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'reports':
    case 'report':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'specifications':
    case 'specs':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'invoices':
    case 'invoice':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

// ─── Document Card ──────────────────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: Document }) {
  const ext = getExtension(doc)
  const { icon: Icon, color, bg } = getFileIcon(ext)
  const isJobTread = doc.jobtread_id !== null

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* File icon */}
          <div className={`shrink-0 rounded-lg p-2.5 ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-tight truncate" title={doc.name}>
                  {doc.name}
                </h3>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {doc.description}
                  </p>
                )}
              </div>

              {/* Open link */}
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </a>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {doc.category && (
                <Badge variant="outline" className={`text-[11px] ${getCategoryColor(doc.category)}`}>
                  {doc.category}
                </Badge>
              )}

              <Badge
                variant="outline"
                className={`text-[11px] ${
                  isJobTread
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {isJobTread ? 'JobTread' : 'Uploaded'}
              </Badge>

              {ext && (
                <span className="text-[11px] text-muted-foreground font-medium uppercase">
                  {ext}
                </span>
              )}

              {doc.file_size != null && doc.file_size > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(doc.file_size)}
                </span>
              )}

              {(doc.upload_date || doc.created_at) && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(doc.upload_date || doc.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function DocumentsClient({ documents, projectId }: DocumentsClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')

  // ─── Derived Data ───────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const doc of documents) {
      if (doc.category) cats.add(doc.category)
    }
    return Array.from(cats).sort()
  }, [documents])

  const summary = useMemo(() => {
    const total = documents.length
    const categoryCount = categories.length
    const jobTreadCount = documents.filter((d) => d.jobtread_id !== null).length
    const uploadCount = total - jobTreadCount
    return { total, categoryCount, jobTreadCount, uploadCount }
  }, [documents, categories])

  const filteredDocuments = useMemo(() => {
    let result = documents

    // Category filter
    if (activeCategory) {
      result = result.filter((d) => d.category === activeCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          (d.category && d.category.toLowerCase().includes(query)) ||
          (d.description && d.description.toLowerCase().includes(query))
      )
    }

    return result
  }, [documents, searchQuery, activeCategory])

  // ─── Upload Handler ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setUploadStatus('uploading')
      setUploadProgress(10)
      setUploadMessage(`Uploading ${file.name}...`)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId)

        // Simulate progress steps while awaiting response
        setUploadProgress(30)

        const progressTimer = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 85) {
              clearInterval(progressTimer)
              return 85
            }
            return prev + 5
          })
        }, 500)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressTimer)

        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          throw new Error(errData?.error || `Upload failed (${res.status})`)
        }

        const data = await res.json()
        setUploadProgress(100)
        setUploadStatus('success')
        setUploadMessage(data.data?.message || 'Document uploaded successfully')

        // Refresh server data after short delay so user sees success state
        setTimeout(() => {
          router.refresh()
          // Reset after refresh
          setTimeout(() => {
            setUploadStatus('idle')
            setUploadProgress(0)
            setUploadMessage('')
          }, 1500)
        }, 1000)
      } catch (err) {
        setUploadStatus('error')
        setUploadProgress(0)
        setUploadMessage(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        // Reset the file input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [projectId, router]
  )

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const dismissUpload = () => {
    setUploadStatus('idle')
    setUploadProgress(0)
    setUploadMessage('')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Project files, plans, and documents from uploads and JobTread
          </p>
        </div>
        <Button onClick={handleUploadClick} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.dxf,.doc,.docx,.txt,.eml,.msg"
          onChange={handleUpload}
          className="hidden"
          aria-label="Upload document"
        />
      </div>

      {/* Upload Status Banner */}
      {uploadStatus !== 'idle' && (
        <Card
          className={`border ${
            uploadStatus === 'error'
              ? 'border-red-200 bg-red-50'
              : uploadStatus === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {uploadStatus === 'uploading' && (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
              )}
              {uploadStatus === 'success' && (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              )}
              {uploadStatus === 'error' && (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    uploadStatus === 'error'
                      ? 'text-red-800'
                      : uploadStatus === 'success'
                      ? 'text-emerald-800'
                      : 'text-blue-800'
                  }`}
                >
                  {uploadMessage}
                </p>
                {uploadStatus === 'uploading' && (
                  <Progress value={uploadProgress} className="mt-2 h-1.5" />
                )}
              </div>

              {(uploadStatus === 'error' || uploadStatus === 'success') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissUpload}
                  className="shrink-0 h-8 w-8 p-0"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Total Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.categoryCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CloudDownload className="h-4 w-4" />
              From JobTread
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.jobTreadCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Upload className="h-4 w-4" />
              From Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.uploadCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, category, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category Filter Badges */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={activeCategory === null ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setActiveCategory(null)}
          >
            All ({documents.length})
          </Badge>
          {categories.map((cat) => {
            const count = documents.filter((d) => d.category === cat).length
            const isActive = activeCategory === cat
            return (
              <Badge
                key={cat}
                variant={isActive ? 'default' : 'outline'}
                className={`cursor-pointer text-xs ${
                  !isActive ? getCategoryColor(cat) : ''
                }`}
                onClick={() => setActiveCategory(isActive ? null : cat)}
              >
                {cat} ({count})
              </Badge>
            )
          })}
        </div>
      )}

      {/* Filter info */}
      {(searchQuery || activeCategory) && filteredDocuments.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredDocuments.length} of {documents.length} documents
          {activeCategory && (
            <>
              {' '}in <span className="font-medium">{activeCategory}</span>
            </>
          )}
        </p>
      )}

      {/* Document List */}
      {filteredDocuments.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        /* Empty state: no documents at all */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No documents yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Documents will appear here once they are uploaded or synced from JobTread.
            </p>
            <Button onClick={handleUploadClick} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload your first document
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Empty state: no matching results */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No matching documents</h3>
            <p className="text-sm text-muted-foreground">
              No documents match your current filters. Try a different search term
              {activeCategory && ' or clear the category filter'}.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
