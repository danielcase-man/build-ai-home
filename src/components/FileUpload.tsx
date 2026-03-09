'use client'

import { useState } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

interface UploadResult {
  filename: string
  size: number
  analysis?: Record<string, unknown>
  message?: string
}

interface FileUploadProps {
  onUploadComplete?: (data: UploadResult) => void
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadStatus('idle')
    setUploadMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        const msg = `Successfully analyzed ${file.name}. Found: ${
          data.analysis?.hotTopics?.length || 0
        } hot topics, ${
          data.analysis?.tasks?.length || 0
        } tasks`
        setUploadStatus('success')
        setUploadMessage(msg)
        toast.success('Document uploaded successfully')

        if (onUploadComplete) {
          onUploadComplete(data)
        }
      } else {
        setUploadStatus('error')
        setUploadMessage(data.error || 'Failed to upload file')
        toast.error('Upload failed')
      }
    } catch {
      setUploadStatus('error')
      setUploadMessage('Error uploading file')
      toast.error('Error uploading file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleChange}
          accept=".pdf,.txt,.doc,.docx,.eml,.msg"
        />

        <label
          htmlFor="file-upload"
          className={`
            flex flex-col items-center justify-center w-full h-32
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors
            ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <p className="text-sm text-muted-foreground mt-2">Analyzing document...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, TXT, DOC, DOCX, Email files
                </p>
              </>
            )}
          </div>
        </label>
      </form>

      {uploadStatus !== 'idle' && (
        <Alert variant={uploadStatus === 'success' ? 'success' : 'destructive'}>
          {uploadStatus === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{uploadMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
