'use client'

import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'

interface CSVUploadProps {
  onDataLoaded: (data: any[], headers: string[]) => void
}

export function CSVUpload({ onDataLoaded }: CSVUploadProps) {
  const [fileName, setFileName] = useState<string>('')
  const [error, setError] = useState<string>('')

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.name.endsWith('.csv')) {
        setError('Please upload a CSV file')
        return
      }

      setFileName(file.name)
      setError('')

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`)
            return
          }

          const headers = results.meta.fields || []
          onDataLoaded(results.data, headers)
        },
        error: (error) => {
          setError(`Failed to parse CSV: ${error.message}`)
        },
      })
    },
    [onDataLoaded]
  )

  return (
    <div className="w-full">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          id="csv-upload"
          className="hidden"
          onChange={handleFileChange}
          accept=".csv"
        />
        <label
          htmlFor="csv-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Upload CSV File
          </p>
          <p className="text-sm text-gray-500">
            Click to select a CSV file with your data
          </p>
        </label>
      </div>

      {fileName && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">
            ✓ Loaded: <span className="font-medium">{fileName}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}

