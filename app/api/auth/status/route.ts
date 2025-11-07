import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('qbo_session')
    
    if (!session) {
      return NextResponse.json({ connected: false })
    }
    
    // Verify and decrypt session
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!)
    const { payload } = await jwtVerify(session.value, secret)
    const tokens = payload.tokens as any
    
    return NextResponse.json({
      connected: true,
      environment: tokens.environment,
      realmId: tokens.realm_id,
    })
  } catch (error) {
    return NextResponse.json({ connected: false })
  }
}

