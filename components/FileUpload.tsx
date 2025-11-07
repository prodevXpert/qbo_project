'use client'

import { useCallback, useState } from 'react'
import { Upload, X, FileText, Image, File } from 'lucide-react'
import { Button } from './ui/button'

interface FileUploadProps {
  onFilesChange: (files: File[]) => void
  accept?: string
  maxSize?: number
  multiple?: boolean
}

export function FileUpload({
  onFilesChange,
  accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx',
  maxSize = 50 * 1024 * 1024, // 50MB
  multiple = true,
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string>('')

  const validateFile = (file: File): boolean => {
    if (file.size > maxSize) {
      setError(`File ${file.name} exceeds ${maxSize / 1024 / 1024}MB limit`)
      return false
    }
    return true
  }

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return

      const validFiles: File[] = []
      Array.from(newFiles).forEach((file) => {
        if (validateFile(file)) {
          validFiles.push(file)
        }
      })

      const updatedFiles = multiple ? [...files, ...validFiles] : validFiles
      setFiles(updatedFiles)
      onFilesChange(updatedFiles)
      setError('')
    },
    [files, multiple, onFilesChange, maxSize]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
    },
    [handleFiles]
  )

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-5 h-5" />
    if (file.type.includes('pdf')) return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleChange}
          accept={accept}
          multiple={multiple}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop files here or click to upload
          </p>
          <p className="text-sm text-gray-500">
            PDF, images, or documents (max {maxSize / 1024 / 1024}MB per file)
          </p>
        </label>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-medium text-gray-700">Uploaded Files ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file)}
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

