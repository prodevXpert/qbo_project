import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function parseDate(dateStr: string, strict: boolean = false): Date | null {
  if (!dateStr) return null
  
  // Try ISO format first
  const isoDate = new Date(dateStr)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }
  
  if (strict) return null
  
  // Try common formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or DD/MM/YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,   // YYYY-MM-DD
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      const [, p1, p2, p3] = match
      // Try both interpretations for ambiguous formats
      const date1 = new Date(parseInt(p1), parseInt(p2) - 1, parseInt(p3))
      const date2 = new Date(parseInt(p3), parseInt(p1) - 1, parseInt(p2))
      
      if (!isNaN(date1.getTime())) return date1
      if (!isNaN(date2.getTime())) return date2
    }
  }
  
  return null
}

export function validateAmount(amountStr: string): number | null {
  if (!amountStr) return null
  
  // Remove currency symbols and commas
  const cleaned = amountStr.replace(/[$,]/g, '').trim()
  const amount = parseFloat(cleaned)
  
  if (isNaN(amount) || amount < 0) return null
  
  return amount
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateIdempotencyKey(row: any, index: number): string {
  // Create a unique key based on row content
  const keyData = `${row.ProjectName}-${row.VendorName}-${row.BillDate}-${row.BillLineAmount}-${index}`
  return Buffer.from(keyData).toString('base64')
}

