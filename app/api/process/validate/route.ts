import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { CSVProcessor } from '@/lib/processor'
import { CSVRow, ProcessingSettings } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const session = cookieStore.get('qbo_session')
    
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Decrypt tokens
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!)
    const { payload } = await jwtVerify(session.value, secret)
    const tokens = payload.tokens as any
    
    // Parse request
    const { rows, settings } = await request.json() as {
      rows: CSVRow[]
      settings: ProcessingSettings
    }
    
    // Create processor and run validation
    const processor = new CSVProcessor(tokens, settings)
    const validationResults = []
    
    for (let i = 0; i < rows.length; i++) {
      const errors = processor.validateRow(rows[i], i)
      if (errors.length > 0) {
        validationResults.push({
          rowIndex: i,
          errors: errors.map(e => `${e.field}: ${e.message}`),
        })
      }
    }
    
    return NextResponse.json({
      valid: validationResults.length === 0,
      errors: validationResults,
    })
  } catch (error: any) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: error.message || 'Validation failed' },
      { status: 500 }
    )
  }
}

