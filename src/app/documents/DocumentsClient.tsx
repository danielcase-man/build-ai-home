'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  GitBranch,
  Sparkles,
  Link2,
  Eye,
  EyeOff,
  History,
  ChevronDown,
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
  // Versioning
  document_group_id: string | null
  is_current: boolean | null
  superseded_by: string | null
  source_path: string | null
  // Entity linking
  vendor_id: string | null
  contact_id: string | null
  related_bid_id: string | null
  related_selection_id: string | null
  // AI
  ai_summary: string | null
  ai_classification: string | null
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

function getClassificationColor(classification: string): string {
  switch (classification.toLowerCase()) {
    case 'bid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'contract':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'plan':
    case 'plans':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'permit':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'correspondence':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'invoice':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'photo':
      return 'bg-teal-50 text-teal-700 border-teal-200'
    case 'report':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

// ─── Document Card ──────────────────────────────────────────────────────────────

function DocumentCard({ doc, allDocuments }: { doc: Document; allDocuments: Document[] }) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const ext = getExtension(doc)
  const { icon: Icon, color, bg } = getFileIcon(ext)
  const isJobTread = doc.jobtread_id !== null
  const isSuperseded = doc.is_current === false

  // Version group: find siblings with same document_group_id
  const versionGroup = useMemo(() => {
    if (!doc.document_group_id) return []
    return allDocuments
      .filter((d) => d.document_group_id === doc.document_group_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [doc.document_group_id, allDocuments])

  // Determine version number within the group (1-based)
  const versionNumber = versionGroup.length > 1
    ? versionGroup.findIndex((d) => d.id === doc.id) + 1
    : null

  // Other versions (excluding current doc) for history display
  const otherVersions = versionGroup.filter((d) => d.id !== doc.id)

  // Entity link flags
  const hasVendor = doc.vendor_id !== null
  const hasBid = doc.related_bid_id !== null
  const hasSelection = doc.related_selection_id !== null

  return (
    <Card className={`transition-shadow hover:shadow-md ${isSuperseded ? 'opacity-60' : ''}`}>
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
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold leading-tight truncate" title={doc.name}>
                    {doc.name}
                  </h3>
                  {versionNumber !== null && (
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-gray-50 text-gray-600 border-gray-200 font-mono">
                      v{versionNumber}
                    </Badge>
                  )}
                  {isSuperseded && (
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-orange-50 text-orange-600 border-orange-200">
                      <EyeOff className="h-2.5 w-2.5 mr-1" />
                      Superseded
                    </Badge>
                  )}
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {doc.description}
                  </p>
                )}
                {/* AI summary as expandable line below description */}
                {doc.ai_summary && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1 cursor-help italic">
                          <Sparkles className="h-3 w-3 inline mr-1 text-violet-400" />
                          {doc.ai_summary}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm text-xs">
                        {doc.ai_summary}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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

              {/* AI classification badge */}
              {doc.ai_classification && (
                <Badge variant="outline" className={`text-[11px] ${getClassificationColor(doc.ai_classification)}`}>
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  {doc.ai_classification}
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

              {/* Entity link badges */}
              {hasVendor && (
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                  <Link2 className="h-2.5 w-2.5 mr-1" />
                  Vendor
                </Badge>
              )}
              {hasBid && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  <Link2 className="h-2.5 w-2.5 mr-1" />
                  Bid
                </Badge>
              )}
              {hasSelection && (
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                  <Link2 className="h-2.5 w-2.5 mr-1" />
                  Selection
                </Badge>
              )}
            </div>

            {/* Version history collapsible */}
            {otherVersions.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <History className="h-3 w-3" />
                    <span>{otherVersions.length} other version{otherVersions.length > 1 ? 's' : ''}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 ml-1 border-l-2 border-muted pl-3 space-y-1.5">
                    {otherVersions.map((v, idx) => {
                      const vIdx = versionGroup.findIndex((d) => d.id === v.id) + 1
                      const vIsCurrent = v.is_current !== false
                      return (
                        <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <GitBranch className="h-3 w-3 shrink-0" />
                          <span className="font-mono text-[10px]">v{vIdx}</span>
                          <span className="truncate" title={v.name}>{v.name}</span>
                          <span className="shrink-0">{formatDate(v.upload_date || v.created_at)}</span>
                          {vIsCurrent && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 bg-emerald-50 text-emerald-600 border-emerald-200">
                              Current
                            </Badge>
                          )}
                          {v.file_url && (
                            <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <ExternalLink className="h-3 w-3 hover:text-foreground transition-colors" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
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
  const [showAllVersions, setShowAllVersions] = useState(false)
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
    const aiClassifiedCount = documents.filter((d) => d.ai_classification !== null).length
    const versionGroupCount = new Set(
      documents.filter((d) => d.document_group_id !== null).map((d) => d.document_group_id)
    ).size
    return { total, categoryCount, jobTreadCount, uploadCount, aiClassifiedCount, versionGroupCount }
  }, [documents, categories])

  const filteredDocuments = useMemo(() => {
    let result = documents

    // Version filter: hide superseded documents by default
    if (!showAllVersions) {
      result = result.filter((d) => d.is_current !== false)
    }

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
          (d.description && d.description.toLowerCase().includes(query)) ||
          (d.ai_classification && d.ai_classification.toLowerCase().includes(query))
      )
    }

    return result
  }, [documents, searchQuery, activeCategory, showAllVersions])

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Total
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
              JobTread
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
              Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.uploadCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Classified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.aiClassifiedCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Version Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.versionGroupCount}</p>
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

          {/* Separator and version toggle */}
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Badge
            variant={showAllVersions ? 'default' : 'outline'}
            className="cursor-pointer text-xs gap-1"
            onClick={() => setShowAllVersions(!showAllVersions)}
          >
            {showAllVersions ? (
              <><Eye className="h-3 w-3" /> All versions</>
            ) : (
              <><EyeOff className="h-3 w-3" /> Current only</>
            )}
          </Badge>
        </div>
      )}

      {/* Filter info */}
      {(searchQuery || activeCategory || !showAllVersions) && filteredDocuments.length > 0 && filteredDocuments.length !== documents.length && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredDocuments.length} of {documents.length} documents
          {activeCategory && (
            <>
              {' '}in <span className="font-medium">{activeCategory}</span>
            </>
          )}
          {!showAllVersions && (
            <> (current versions only)</>
          )}
        </p>
      )}

      {/* Document List */}
      {filteredDocuments.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} allDocuments={documents} />
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
