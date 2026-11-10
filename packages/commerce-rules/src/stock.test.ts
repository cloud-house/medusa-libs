import { describe, expect, it } from 'vitest'
import { isAvailableNow, STOCK_RANK, STOCK_STATUSES, stockStatus } from './stock'

describe('stockStatus', () => {
  it('maps availability to stock status', () => {
    const managed = { manageInventory: true }
    expect(stockStatus({ ...managed, available: 25 })).toBe('in_stock')
    expect(stockStatus({ ...managed, available: 4 })).toBe('in_stock')
    expect(stockStatus({ ...managed, available: 3 })).toBe('low_stock')
    expect(stockStatus({ ...managed, available: 1 })).toBe('low_stock')
    expect(stockStatus({ ...managed, available: 0 })).toBe('out_of_stock')
    expect(stockStatus({ ...managed, available: null })).toBe('out_of_stock')
    expect(stockStatus({ available: null, manageInventory: false })).toBe('in_stock')
  })

  it('no pre-orders: a variant without stock is out of stock', () => {
    expect(STOCK_STATUSES).toEqual(['in_stock', 'low_stock', 'out_of_stock'])
  })

  it('only in-stock and low-stock count as available now', () => {
    expect(STOCK_STATUSES.filter(isAvailableNow)).toEqual(['in_stock', 'low_stock'])
  })

  it('ranks statuses from best to worst', () => {
    expect([...STOCK_STATUSES].sort((a, b) => STOCK_RANK[a] - STOCK_RANK[b])).toEqual([
      'in_stock',
      'low_stock',
      'out_of_stock',
    ])
  })
})
