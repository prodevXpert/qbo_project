'use client'

import { useEffect, useState } from 'react'
import { FieldMapping } from '@/lib/types'

interface FieldMapperProps {
  csvHeaders: string[]
  onMappingChange: (mapping: FieldMapping) => void
}

const REQUIRED_FIELDS = [
  { key: 'ProjectName', label: 'Project Name', required: true },
  { key: 'CustomerName', label: 'Customer Name', required: true },
  { key: 'VendorName', label: 'Vendor Name', required: true },
  { key: 'BillDate', label: 'Bill Date', required: true },
  { key: 'BillLineDescription', label: 'Bill Line Description', required: true },
  { key: 'BillLineAmount', label: 'Bill Line Amount', required: true },
  { key: 'Currency', label: 'Currency', required: false },
  { key: 'InvoiceDate', label: 'Invoice Date', required: true },
  { key: 'PONumber', label: 'PO Number', required: true },
  { key: 'PointOfContact', label: 'Point of Contact', required: true },
  { key: 'AttachmentFiles', label: 'Attachment Files (semicolon-separated)', required: false },
]

export function FieldMapper({ csvHeaders, onMappingChange }: FieldMapperProps) {
  const [mapping, setMapping] = useState<FieldMapping>({} as FieldMapping)

  useEffect(() => {
    // Load saved mapping from localStorage
    const saved = localStorage.getItem('fieldMapping')
    if (saved) {
      try {
        const savedMapping = JSON.parse(saved)
        setMapping(savedMapping)
        onMappingChange(savedMapping)
      } catch (e) {
        console.error('Failed to load saved mapping:', e)
      }
    } else {
      // Auto-map fields with exact matches
      const autoMapping: any = {}
      REQUIRED_FIELDS.forEach((field) => {
        const match = csvHeaders.find(
          (h) => h.toLowerCase() === field.key.toLowerCase()
        )
        if (match) {
          autoMapping[field.key] = match
        }
      })
      setMapping(autoMapping)
      onMappingChange(autoMapping)
    }
  }, [csvHeaders])

  const handleMappingChange = (fieldKey: string, csvColumn: string) => {
    const newMapping = { ...mapping, [fieldKey]: csvColumn }
    setMapping(newMapping)
    onMappingChange(newMapping)
    
    // Save to localStorage
    localStorage.setItem('fieldMapping', JSON.stringify(newMapping))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Map CSV Columns to Fields</h3>
        <button
          onClick={() => {
            setMapping({} as FieldMapping)
            localStorage.removeItem('fieldMapping')
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Reset Mapping
        </button>
      </div>

      <div className="grid gap-4">
        {REQUIRED_FIELDS.map((field) => (
          <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={mapping[field.key as keyof FieldMapping] || ''}
              onChange={(e) => handleMappingChange(field.key, e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select Column --</option>
              {csvHeaders.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Mappings are automatically saved and will be restored next time.
        </p>
      </div>
    </div>
  )
}

