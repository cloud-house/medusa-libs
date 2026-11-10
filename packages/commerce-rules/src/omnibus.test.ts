import { describe, expect, it } from 'vitest'
import { lowestPriceBeforeDiscount } from './omnibus'

const DAY = 86_400_000
const NOW = new Date(Date.UTC(2026, 9, 16, 12))
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)

describe('lowestPriceBeforeDiscount', () => {
  it('returns null when the variant is not discounted', () => {
    expect(lowestPriceBeforeDiscount([], { amount: 2199, original_amount: 2199 }, NOW)).toBeNull()
  })

  it('falls back to the regular price without history', () => {
    expect(lowestPriceBeforeDiscount([], { amount: 1899, original_amount: 2199 }, NOW)).toBe(2199)
  })

  it('takes the price in force at the window start', () => {
    const history = [
      { amount: 2199, recorded_at: daysAgo(45) },
      { amount: 1899, recorded_at: daysAgo(12) },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 1899, original_amount: 2199 }, NOW)).toBe(
      2199,
    )
  })

  it('finds a short earlier promotion inside the 30-day window', () => {
    const history = [
      { amount: 2899, recorded_at: daysAgo(45) },
      { amount: 2699, recorded_at: daysAgo(30) },
      { amount: 2899, recorded_at: daysAgo(23) },
      { amount: 2599, recorded_at: daysAgo(12) },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 2599, original_amount: 2899 }, NOW)).toBe(
      2699,
    )
  })

  it('ignores prices older than the window', () => {
    const history = [
      { amount: 1500, recorded_at: daysAgo(60) },
      { amount: 2199, recorded_at: daysAgo(50) },
      { amount: 1899, recorded_at: daysAgo(12) },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 1899, original_amount: 2199 }, NOW)).toBe(
      2199,
    )
  })

  it('counts a stepwise reduction from the latest step', () => {
    const history = [
      { amount: 2199, recorded_at: daysAgo(45) },
      { amount: 1999, recorded_at: daysAgo(20) },
      { amount: 1899, recorded_at: daysAgo(5) },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 1899, original_amount: 2199 }, NOW)).toBe(
      1999,
    )
  })

  it('treats an unrecorded change as starting now', () => {
    const history = [{ amount: 2199, recorded_at: daysAgo(45) }]
    expect(lowestPriceBeforeDiscount(history, { amount: 1899, original_amount: 2199 }, NOW)).toBe(
      2199,
    )
  })

  it('a regular-price rise disguised as a sale shows the real lowest price', () => {
    const history = [
      { amount: 1999, original_amount: 1999, recorded_at: daysAgo(60) },
      { amount: 1999, original_amount: 2199, recorded_at: daysAgo(5) },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 1999, original_amount: 2199 }, NOW)).toBe(
      1999,
    )
  })

  it('accepts unordered history with ISO dates and compares in grosze', () => {
    const history = [
      { amount: 1899.001, recorded_at: daysAgo(12).toISOString() },
      { amount: 2199, recorded_at: daysAgo(45).toISOString() },
    ]
    expect(lowestPriceBeforeDiscount(history, { amount: 1899, original_amount: 2199 }, NOW)).toBe(
      2199,
    )
  })
})
