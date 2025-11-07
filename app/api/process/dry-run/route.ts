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
    
    // Create processor and run dry-run
    const processor = new CSVProcessor(tokens, settings)
    const dryRunResults = await processor.dryRun(rows)
    
    return NextResponse.json({ results: dryRunResults })
  } catch (error: any) {
    console.error('Dry-run error:', error)
    return NextResponse.json(
      { error: error.message || 'Dry-run failed' },
      { status: 500 }
    )
  }
}

