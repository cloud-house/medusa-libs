/**
 * Preview token for drafts in the shop: `{payload}.{signature}`, base64url, HMAC-SHA256 with the
 * secret shared by Medusa and the storefront. Web Crypto – works in Node and in edge runtimes.
 */
export interface PreviewClaims {
  /** Medusa admin user who opened the preview. */
  sub: string
  /** Expiry, seconds since epoch. */
  exp: number
}

export const PREVIEW_TOKEN_TTL_SECONDS = 2 * 60 * 60

const encoder = new TextEncoder()

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const key = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])

export async function signPreviewToken(claims: PreviewClaims, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

/** Claims of a valid, unexpired token; `null` for anything else (constant-time signature check). */
export async function verifyPreviewToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  now = Date.now(),
): Promise<PreviewClaims | null> {
  if (!token || !secret) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await key(secret),
      fromBase64Url(signature),
      encoder.encode(payload),
    )
    if (!valid) return null
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as PreviewClaims
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null
    return claims.exp * 1000 > now ? claims : null
  } catch {
    return null
  }
}
