import OAuthClient from 'intuit-oauth'
import { QBOTokens } from './types'

export class QBOAuthService {
  private oauthClient: OAuthClient

  constructor() {
    this.oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID!,
      clientSecret: process.env.QBO_CLIENT_SECRET!,
      environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      redirectUri: process.env.QBO_REDIRECT_URI!,
    })
  }

  getAuthUri(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: 'testState',
    })
  }

  async createToken(url: string): Promise<QBOTokens> {
    const authResponse = await this.oauthClient.createToken(url)
    const token = authResponse.token
    
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + (token.expires_in * 1000),
      realm_id: token.realmId,
      environment: this.oauthClient.environment as 'sandbox' | 'production',
    }
  }

  async refreshToken(refreshToken: string): Promise<QBOTokens> {
    this.oauthClient.setToken({
      refresh_token: refreshToken,
    })
    
    const authResponse = await this.oauthClient.refresh()
    const token = authResponse.token
    
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: Date.now() + (token.expires_in * 1000),
      realm_id: token.realmId,
      environment: this.oauthClient.environment as 'sandbox' | 'production',
    }
  }

  async revokeToken(tokens: QBOTokens): Promise<void> {
    this.oauthClient.setToken({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })
    
    await this.oauthClient.revoke()
  }

  isTokenExpired(tokens: QBOTokens): boolean {
    return Date.now() >= tokens.expires_at
  }

  async getValidToken(tokens: QBOTokens): Promise<QBOTokens> {
    if (this.isTokenExpired(tokens)) {
      return await this.refreshToken(tokens.refresh_token)
    }
    return tokens
  }
}

export const qboAuthService = new QBOAuthService()

