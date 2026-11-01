import { SignJWT, jwtVerify } from 'jose'
import type { CookieOptions } from 'express'
import type { Config } from '../config.js'

export const SESSION_COOKIE = 'pericope_session'

export interface SessionClaims {
  sub: string
  ver: number
}

export class SessionService {
  private readonly key: Uint8Array

  constructor(private readonly config: Config) {
    this.key = new TextEncoder().encode(config.JWT_SECRET)
  }

  async issue(userId: string, tokenVersion: number): Promise<string> {
    return new SignJWT({ ver: tokenVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('pericope-api')
      .setAudience('pericope-web')
      .setIssuedAt()
      .setExpirationTime(`${this.config.SESSION_TTL_MINUTES}m`)
      .sign(this.key)
  }

  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: 'pericope-api',
        audience: 'pericope-web',
        algorithms: ['HS256'],
      })
      if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null
      return { sub: payload.sub, ver: payload.ver }
    } catch {
      return null
    }
  }

  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      domain: this.config.COOKIE_DOMAIN,
      maxAge: this.config.SESSION_TTL_MINUTES * 60 * 1000,
    }
  }
}
