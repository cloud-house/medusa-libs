import { StoreAccountReturn, StoreReturnClaim, StoreReturnLookup } from '../validators'

const ITEM = { id: 'ordli_01JABCDEFGHJKMNPQRSTVWXYZ0', quantity: 1, reason: 'size' }
const LOOKUP = { display_id: 1042, email: 'jan@example.pl' }

describe('StoreReturnLookup', () => {
  it('accepts an order number up to the largest PostgreSQL integer', () => {
    expect(StoreReturnLookup.safeParse({ ...LOOKUP, display_id: 2_147_483_647 }).success).toBe(true)
  })

  it('refuses a number that would not fit the database column (not a 500 on the lookup)', () => {
    expect(StoreReturnLookup.safeParse({ ...LOOKUP, display_id: 2_147_483_648 }).success).toBe(
      false,
    )
    expect(StoreReturnLookup.safeParse({ ...LOOKUP, display_id: 1e21 }).success).toBe(false)
  })

  it('refuses zero, fractions and text for the number', () => {
    for (const display_id of [0, -1, 1.5, '1042']) {
      expect(StoreReturnLookup.safeParse({ ...LOOKUP, display_id }).success).toBe(false)
    }
  })

  it('trims the e-mail and bounds its length', () => {
    expect(StoreReturnLookup.parse({ ...LOOKUP, email: '  jan@example.pl ' }).email).toBe(
      'jan@example.pl',
    )
    expect(StoreReturnLookup.safeParse({ ...LOOKUP, email: 'a@' }).success).toBe(false)
    expect(StoreReturnLookup.safeParse({ ...LOOKUP, email: 'x'.repeat(255) }).success).toBe(false)
  })
})

describe('StoreReturnClaim / StoreAccountReturn items', () => {
  const claim = (items: unknown[]) => StoreReturnClaim.safeParse({ ...LOOKUP, items }).success
  const account = (items: unknown[]) => StoreAccountReturn.safeParse({ items }).success

  it('an item id may be 64 characters, not 65', () => {
    for (const check of [claim, account]) {
      expect(check([{ ...ITEM, id: 'x'.repeat(64) }])).toBe(true)
      expect(check([{ ...ITEM, id: 'x'.repeat(65) }])).toBe(false)
    }
  })

  it('a Medusa item id fits', () => {
    expect(ITEM.id.length).toBeLessThanOrEqual(64)
    expect(claim([ITEM])).toBe(true)
  })

  it('1 to 50 items, quantity 1 to 99', () => {
    expect(claim([])).toBe(false)
    expect(claim(Array.from({ length: 50 }, () => ITEM))).toBe(true)
    expect(claim(Array.from({ length: 51 }, () => ITEM))).toBe(false)
    expect(claim([{ ...ITEM, quantity: 0 }])).toBe(false)
    expect(claim([{ ...ITEM, quantity: 100 }])).toBe(false)
    expect(claim([{ ...ITEM, id: '' }])).toBe(false)
  })

  it('the note is trimmed, 500 characters at most, and optional', () => {
    expect(StoreAccountReturn.parse({ items: [ITEM], note: '  Nie działa ' }).note).toBe(
      'Nie działa',
    )
    expect(StoreAccountReturn.safeParse({ items: [ITEM], note: 'x'.repeat(500) }).success).toBe(
      true,
    )
    expect(StoreAccountReturn.safeParse({ items: [ITEM], note: 'x'.repeat(501) }).success).toBe(
      false,
    )
    expect(StoreAccountReturn.safeParse({ items: [ITEM], note: null }).success).toBe(true)
    expect(StoreAccountReturn.safeParse({ items: [ITEM] }).success).toBe(true)
  })
})
