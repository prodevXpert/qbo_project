'use client'

import { ProcessingResult } from '@/lib/types'
import { CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { Button } from './ui/button'

interface ResultsTableProps {
  results: ProcessingResult[]
  onRetry?: (rowIndex: number) => void
}

export function ResultsTable({ results, onRetry }: ResultsTableProps) {
  const downloadJSON = () => {
    const dataStr = JSON.stringify(results, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `qbo-results-${new Date().toISOString()}.json`
    link.click()
  }

  const downloadCSV = () => {
    const headers = [
      'Row',
      'Status',
      'Customer ID',
      'Project ID',
      'Vendor ID',
      'Bill ID',
      'Invoice ID',
      'Error',
    ]
    
    const rows = results.map((r) => [
      r.rowIndex + 1,
      r.status,
      r.customerId || '',
      r.subCustomerId || '',
      r.vendorId || '',
      r.billId || '',
      r.invoiceId || '',
      r.error || '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const dataBlob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `qbo-results-${new Date().toISOString()}.csv`
    link.click()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'needs_review':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const reviewCount = results.filter((r) => r.status === 'needs_review').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="text-sm">
            <span className="font-medium text-green-600">{successCount}</span> Success
          </div>
          <div className="text-sm">
            <span className="font-medium text-red-600">{errorCount}</span> Errors
          </div>
          <div className="text-sm">
            <span className="font-medium text-yellow-600">{reviewCount}</span> Needs Review
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadJSON}>
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bill
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result) => (
                <tr key={result.rowIndex} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {result.rowIndex + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="text-sm capitalize">{result.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.customerId || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.subCustomerId || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.vendorId || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.billId || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {result.invoiceId || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {result.error && (
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 text-xs">{result.error}</span>
                        {result.status === 'needs_review' && onRetry && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRetry(result.rowIndex)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    )}
                    {result.attachmentResults && result.attachmentResults.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {result.attachmentResults.filter((a) => a.status === 'success').length}/
                        {result.attachmentResults.length} attachments
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

