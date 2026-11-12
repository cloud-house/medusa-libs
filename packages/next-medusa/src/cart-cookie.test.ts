import { cookies } from 'next/headers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCartCookie } from './cart-cookie'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const store = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }

describe('createCartCookie', () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(store as never)
    for (const fn of Object.values(store)) fn.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('reads the cart id by name, undefined when empty', async () => {
    const cart = createCartCookie({ name: 'shop_cart' })
    store.get.mockReturnValueOnce({ value: 'cart_1' })
    expect(await cart.getCartId()).toBe('cart_1')
    expect(store.get).toHaveBeenCalledWith('shop_cart')
    store.get.mockReturnValueOnce(undefined)
    expect(await cart.getCartId()).toBeUndefined()
    store.get.mockReturnValueOnce({ value: '' })
    expect(await cart.getCartId()).toBeUndefined()
  })

  it('sets an httpOnly lax cookie for 30 days by default, not secure outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    await createCartCookie({ name: 'shop_cart' }).setCartId('cart_2')
    expect(store.set).toHaveBeenCalledWith('shop_cart', 'cart_2', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  })

  it('is secure in production and honours maxAgeDays', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await createCartCookie({ name: 'c', maxAgeDays: 7 }).setCartId('cart_3')
    expect(store.set).toHaveBeenCalledWith(
      'c',
      'cart_3',
      expect.objectContaining({ secure: true, maxAge: 60 * 60 * 24 * 7 }),
    )
  })

  it('removes the cookie', async () => {
    await createCartCookie({ name: 'shop_cart' }).removeCartId()
    expect(store.delete).toHaveBeenCalledWith('shop_cart')
  })
})
