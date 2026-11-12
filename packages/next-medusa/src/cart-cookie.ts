import 'server-only'
import { cookies } from 'next/headers'

export interface CartCookieOptions {
  name: string
  /** Default 30. */
  maxAgeDays?: number
}

export interface CartCookie {
  getCartId(): Promise<string | undefined>
  setCartId(id: string): Promise<void>
  removeCartId(): Promise<void>
}

/** `Lax` – the cookie survives the return from a payment redirect (e.g. Przelewy24). */
export function createCartCookie(options: CartCookieOptions): CartCookie {
  const { name, maxAgeDays = 30 } = options
  return {
    async getCartId() {
      return (await cookies()).get(name)?.value || undefined
    },
    async setCartId(id) {
      ;(await cookies()).set(name, id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * maxAgeDays,
        path: '/',
      })
    },
    async removeCartId() {
      ;(await cookies()).delete(name)
    },
  }
}
