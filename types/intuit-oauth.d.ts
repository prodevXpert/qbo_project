declare module 'intuit-oauth' {
  interface OAuthConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
  }

  interface AuthUriOptions {
    scope: string[]
    state: string
  }

  interface Token {
    access_token: string
    refresh_token: string
    expires_in: number
    realmId: string
  }

  interface AuthResponse {
    token: Token
  }

  class OAuthClient {
    constructor(config: OAuthConfig)
    
    static scopes: {
      Accounting: string
      OpenId: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
    }

    environment: string

    authorizeUri(options: AuthUriOptions): string
    
    createToken(url: string): Promise<AuthResponse>
    
    refresh(): Promise<AuthResponse>
    
    revoke(): Promise<void>
    
    setToken(token: Partial<Token>): void
  }

  export = OAuthClient
}

