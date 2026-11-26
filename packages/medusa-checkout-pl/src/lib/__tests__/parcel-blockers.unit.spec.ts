import { resolveOptions } from '../../options'
import type { ParcelBlocker } from '../../types'
import { blockedReason, courierBlockedReason, parcelLockerBlockers } from '../parcel-blockers'

const mockClasses = jest.fn()
jest.mock('@cloud-house/medusa-furgonetka', () => ({
  FURGONETKA_MODULE: 'furgonetka',
  parcelClassesOf: (...args: unknown[]) => mockClasses(...args),
}))

const defaults = resolveOptions({ resolveContact: async () => null })
const board: ParcelBlocker = { product_id: 'prod_board', title: 'Deska', reason: 'board' }
const paddle: ParcelBlocker = { product_id: 'prod_paddle', title: 'Wiosło', reason: 'oversized' }
const sup: ParcelBlocker = { product_id: 'prod_sup', title: 'Hamak', reason: 'oversized' }

const container = (registered: boolean) =>
  ({
    resolve: (key: string) => {
      if (key === 'furgonetka' && registered) return {}
      throw new Error(`no ${key}`)
    },
  }) as never

describe('parcelLockerBlockers', () => {
  beforeEach(() => mockClasses.mockReset())

  it('every product with a parcel class blocks, the rest do not; titles by product', async () => {
    mockClasses.mockResolvedValue(new Map([['prod_a', 'board']]))
    const blockers = await parcelLockerBlockers(container(true), [
      { product_id: 'prod_a', title: 'A' },
      { product_id: 'prod_a', title: 'A again' },
      { product_id: 'prod_b', title: 'B' },
      { product_id: null, title: 'custom line' },
    ])
    expect(blockers).toEqual([{ product_id: 'prod_a', title: 'A', reason: 'board' }])
    expect(mockClasses).toHaveBeenCalledWith(expect.anything(), ['prod_a', 'prod_b'])
  })

  it('does not ask without products and does not throw without the furgonetka plugin', async () => {
    expect(await parcelLockerBlockers(container(true), [])).toEqual([])
    expect(await parcelLockerBlockers(container(false), [{ product_id: 'p', title: 'P' }])).toEqual(
      [],
    )
    expect(mockClasses).not.toHaveBeenCalled()
  })
})

describe('a custom reason that says nothing', () => {
  it('falls back to the default text, so every endpoint agrees the method is closed', () => {
    const options = resolveOptions({
      resolveContact: async () => null,
      blockReasons: { locker: () => null, inpostCourier: () => '' },
    })
    expect(blockedReason([paddle], options)).toBe('Wiosło nie mieści się w paczkomacie.')
    expect(courierBlockedReason([paddle], options)).toBe('Wiosło wysyłamy tylko kurierem DPD.')
  })
})

describe('default reasons', () => {
  it('are null when nothing blocks', () => {
    expect(blockedReason([], defaults)).toBeNull()
    expect(courierBlockedReason([], defaults)).toBeNull()
  })

  it('name one product, or the first and „others”', () => {
    expect(blockedReason([paddle], defaults)).toBe('Wiosło nie mieści się w paczkomacie.')
    expect(blockedReason([paddle, sup], defaults)).toBe(
      'Wiosło i inne produkty nie mieszczą się w paczkomacie.',
    )
    expect(courierBlockedReason([paddle], defaults)).toBe('Wiosło wysyłamy tylko kurierem DPD.')
    expect(courierBlockedReason([paddle, sup], defaults)).toBe(
      'Wiosło i inne produkty wysyłamy tylko kurierem DPD.',
    )
  })

  it('the shop can replace them', () => {
    const options = resolveOptions({
      resolveContact: async () => null,
      blockReasons: {
        locker: (blockers) =>
          blockers.some((b) => b.reason === 'board')
            ? 'Deski nie mieszczą się w paczkomacie.'
            : null,
      },
    })
    expect(blockedReason([board, paddle], options)).toBe('Deski nie mieszczą się w paczkomacie.')
    expect(blockedReason([paddle], options)).toBe('Wiosło nie mieści się w paczkomacie.')
    expect(courierBlockedReason([paddle], options)).toBe('Wiosło wysyłamy tylko kurierem DPD.')
  })
})
