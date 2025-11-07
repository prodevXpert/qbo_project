import { NextRequest, NextResponse } from 'next/server'
import { qboAuthService } from '@/lib/qbo-auth'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'

export async function GET(request: NextRequest) {
  try {
    const url = request.url
    
    // Exchange authorization code for tokens
    const tokens = await qboAuthService.createToken(url)
    
    // Encrypt and store tokens in secure cookie
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!)
    const encryptedTokens = await new SignJWT({ tokens })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret)
    
    const cookieStore = await cookies()
    cookieStore.set('qbo_session', encryptedTokens, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })
    
    // Redirect to main app
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/?error=auth_failed', request.url)
    )
  }
}

