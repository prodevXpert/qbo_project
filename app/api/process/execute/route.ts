import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { CSVProcessor } from '@/lib/processor'
import { CSVRow, ProcessingSettings, UploadedFile } from '@/lib/types'

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
    
    // Parse multipart form data
    const formData = await request.formData()
    const rowsJson = formData.get('rows') as string
    const settingsJson = formData.get('settings') as string
    
    const rows: CSVRow[] = JSON.parse(rowsJson)
    const settings: ProcessingSettings = JSON.parse(settingsJson)
    
    // Extract uploaded files
    const attachments = new Map<string, UploadedFile>()
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_')) {
        const file = value as File
        const arrayBuffer = await file.arrayBuffer()
        attachments.set(file.name, {
          name: file.name,
          size: file.size,
          type: file.type,
          data: arrayBuffer,
        })
      }
    }
    
    // Create processor and execute
    const processor = new CSVProcessor(tokens, settings)
    const results = await processor.processAll(rows, attachments)
    
    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    )
  }
}

