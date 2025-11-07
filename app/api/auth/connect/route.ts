import { NextResponse } from 'next/server'
import { qboAuthService } from '@/lib/qbo-auth'

export async function GET() {
  try {
    const authUri = qboAuthService.getAuthUri()
    return NextResponse.json({ authUri })
  } catch (error: any) {
    console.error('Error generating auth URI:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}

