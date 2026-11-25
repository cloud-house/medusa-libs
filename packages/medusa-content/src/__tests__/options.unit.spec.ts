import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import { resolveOptions } from '../options'

const schema = z.object({}).passthrough()
const kind = (extra: Partial<ContentKind> = {}): ContentKind => ({
  type: 'page',
  label: 'Page',
  schema,
  ...extra,
})

describe('resolveOptions', () => {
  it('requires kinds', () => {
    expect(() => resolveOptions({} as never)).toThrow('[content_missing_option]')
    expect(() => resolveOptions({ kinds: undefined } as never)).toThrow('[content_missing_option]')
  })

  it('rejects an empty list, repeated types, bad keys and globals without a slug', () => {
    const bad: Partial<ContentKind>[][] = [
      [],
      [{ type: 'page' }, { type: 'page' }],
      [{ type: 'Page' }],
      [{ type: 'a'.repeat(41) }],
      [{ type: 'global' }],
      [{ type: 'global', slug: 'Header' }],
      [
        { type: 'global', slug: 'header' },
        { type: 'global', slug: 'header' },
      ],
      [{ type: 'page', slug: 'x' }],
      [{ type: 'faq', entity: 'order' as never }],
      [{ type: 'product_faq', entity: 'product' }],
      [{ type: 'faq', label: ' ' }],
      [{ type: 'faq', versions: { drafts: true, maxVersions: -1 } }],
    ]
    const accepted = bad.filter((list) => {
      try {
        resolveOptions({ kinds: list.map(kind) })
        return true
      } catch (error) {
        expect(String(error)).toContain('[content_invalid_option]')
        return false
      }
    })
    expect(accepted).toEqual([])
  })

  it('accepts a valid registry and fills the defaults', () => {
    delete process.env.CONTENT_PREVIEW_SECRET
    const resolved = resolveOptions({
      kinds: [
        kind(),
        kind({ type: 'global', slug: 'header' }),
        kind({ type: 'product', entity: 'product' }),
      ],
    })
    expect(resolved).toMatchObject({
      previewSecret: null,
      previewHeader: 'x-preview-token',
      mediaFolder: 'content',
      logPrefix: '[Content]',
      resolveEntityHandle: null,
    })
    expect(resolved.registry.kinds()).toHaveLength(3)
  })

  it('reads the preview secret from the environment and treats undefined as unset', () => {
    process.env.CONTENT_PREVIEW_SECRET = 'from-env'
    expect(resolveOptions({ kinds: [kind()], previewHeader: undefined }).previewSecret).toBe(
      'from-env',
    )
    expect(resolveOptions({ kinds: [kind()], previewSecret: 'given' }).previewSecret).toBe('given')
    delete process.env.CONTENT_PREVIEW_SECRET
  })

  it('rejects an unusable header or media folder', () => {
    expect(() => resolveOptions({ kinds: [kind()], previewHeader: 'X Token' })).toThrow(
      '[content_invalid_option]',
    )
    expect(() => resolveOptions({ kinds: [kind()], previewPath: '//evil.example/x' })).toThrow(
      '[content_invalid_option]',
    )
    expect(() => resolveOptions({ kinds: [kind()], mediaFolder: '../x' })).toThrow(
      '[content_invalid_option]',
    )
  })
})
