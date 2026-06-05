// Types for the auth flow (routes/auth_routes.py).

export interface AuthStatus {
  configured: boolean
  authenticated: boolean
  username: string | null
  is_admin: boolean
  privileges?: Record<string, unknown>
  signup_enabled: boolean
}

export interface LoginPayload {
  username: string
  password: string
  remember: boolean
  totp_code?: string
}

export interface LoginResult {
  ok: boolean
  username?: string
  requires_totp?: boolean
}
