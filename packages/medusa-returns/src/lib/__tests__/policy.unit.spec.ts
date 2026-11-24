import type { ReturnContact } from '../../types'
import { loadReturnPolicy, returnPolicyOf } from '../policy'
import { warnOnce } from '../warn-once'

jest.mock('../warn-once', () => ({ warnOnce: jest.fn() }))

const contact = (over: Partial<ReturnContact> = {}): ReturnContact => ({
  email: null,
  phone: null,
  hours: null,
  seller: null,
  returnDays: null,
  returnAddress: null,
  ...over,
})

describe('returnPolicyOf', () => {
  it('takes the length and the address from the shop settings', () => {
    expect(
      returnPolicyOf(contact({ returnDays: 45, returnAddress: ['Shop', 'ul. Morska 1'] })),
    ).toEqual({
      days: 45,
      address: ['Shop', 'ul. Morska 1'],
    })
  })

  it('without the setting or without settings: 30 days, no address', () => {
    expect(returnPolicyOf(contact())).toEqual({ days: 30, address: null })
    expect(returnPolicyOf(null)).toEqual({ days: 30, address: null })
  })
})

describe('loadReturnPolicy', () => {
  const logger = { warn: jest.fn(), error: jest.fn() }
  const resolveContact = jest.fn()
  const container = {
    resolve: (key: string) => {
      if (key === 'shopReturns') {
        return { getOptions: () => ({ resolveContact, logPrefix: '[Shop]' }) }
      }
      return logger
    },
  } as never

  beforeEach(() => {
    resolveContact.mockReset()
    jest.mocked(warnOnce).mockClear()
  })

  it('reads the policy from the shop contact on every call', async () => {
    resolveContact.mockResolvedValueOnce(contact({ returnDays: 45 }))
    resolveContact.mockResolvedValueOnce(contact({ returnDays: 21 }))

    expect((await loadReturnPolicy(container)).days).toBe(45)
    expect((await loadReturnPolicy(container)).days).toBe(21)
    expect(resolveContact).toHaveBeenCalledWith(container)
  })

  it('without a readable contact: 30 days and one warning with the shop prefix', async () => {
    resolveContact.mockResolvedValue(null)

    expect(await loadReturnPolicy(container)).toEqual({ days: 30, address: null })
    expect(warnOnce).toHaveBeenCalledWith(
      logger,
      'return-policy',
      '[Shop] Ustawienia zwrotów niedostępne – przyjmuję 30 dni.',
    )
  })

  it('a contact resolver that throws is the same as no contact', async () => {
    resolveContact.mockRejectedValue(new Error('cms down'))

    expect(await loadReturnPolicy(container)).toEqual({ days: 30, address: null })
    expect(warnOnce).toHaveBeenCalledTimes(1)
  })
})
