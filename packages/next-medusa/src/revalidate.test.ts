import { revalidateTag } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateTags } from './revalidate'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

describe('revalidateTags', () => {
  beforeEach(() => vi.mocked(revalidateTag).mockReset())

  it('purges each tag once with expire: 0', () => {
    expect(revalidateTags(['layout', 'cms', 'layout', null, undefined, false, ''])).toEqual([
      'layout',
      'cms',
    ])
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([
      ['layout', { expire: 0 }],
      ['cms', { expire: 0 }],
    ])
  })

  it('swallows only the missing Next context error', () => {
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag layout')
    })
    expect(() => revalidateTags(['layout'])).not.toThrow()

    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => revalidateTags(['layout'])).toThrow('boom')
  })
})
