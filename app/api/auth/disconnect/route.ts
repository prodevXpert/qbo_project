import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { qboAuthService } from '@/lib/qbo-auth'
import { jwtVerify } from 'jose'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('qbo_session')
    
    if (session) {
      // Decrypt tokens
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET!)
      const { payload } = await jwtVerify(session.value, secret)
      const tokens = payload.tokens as any
      
      // Revoke tokens with QBO
      try {
        await qboAuthService.revokeToken(tokens)
      } catch (error) {
        console.error('Error revoking tokens:', error)
      }
      
      // Clear session cookie
      cookieStore.delete('qbo_session')
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}

