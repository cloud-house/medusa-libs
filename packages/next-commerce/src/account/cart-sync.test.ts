import { describe, expect, it, vi } from 'vitest'
import { syncCart } from './cart-sync'

const deps = (over: Partial<Parameters<typeof syncCart>[0]> = {}) => ({
  cartId: null as string | null,
  attach: vi.fn(async () => true),
  last: vi.fn(async () => null as string | null),
  remember: vi.fn(async () => {}),
  forget: vi.fn(async () => {}),
  ...over,
})

describe('syncCart', () => {
  it('koszyk z przeglądarki trafia do konta', async () => {
    const d = deps({ cartId: 'cart_1' })
    await syncCart(d)
    expect(d.attach).toHaveBeenCalledWith('cart_1')
    expect(d.last).not.toHaveBeenCalled()
  })

  it('bez koszyka w przeglądarce wraca ostatni koszyk konta', async () => {
    const d = deps({ last: vi.fn(async () => 'cart_9') })
    await syncCart(d)
    expect(d.remember).toHaveBeenCalledWith('cart_9')
  })

  it('koszyk z przeglądarki zniknął – zapomina go i bierze ostatni z konta', async () => {
    const d = deps({
      cartId: 'cart_stary',
      attach: vi.fn(async () => false),
      last: vi.fn(async () => 'cart_9'),
    })
    await syncCart(d)
    expect(d.forget).toHaveBeenCalled()
    expect(d.remember).toHaveBeenCalledWith('cart_9')
  })

  it('konto bez ostatniego koszyka – nic', async () => {
    const d = deps()
    await syncCart(d)
    expect(d.remember).not.toHaveBeenCalled()
  })
})
