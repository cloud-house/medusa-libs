import { describe, expect, it } from 'vitest'
import {
  brandTag,
  categoryTag,
  createTagRules,
  isKitTagAllowed,
  KIT_TAG_KINDS,
  KIT_TAGS,
  MAX_TAG_LENGTH,
  productTag,
  tagFor,
} from './cache-tags'

describe('cache tags', () => {
  it('builds product, category and brand tags', () => {
    expect(productTag('allround-wave')).toBe('product:allround-wave')
    expect(categoryTag('boards')).toBe('category:boards')
    expect(brandTag('f2')).toBe('brand:f2')
    expect(KIT_TAGS).toEqual({ catalog: 'catalog', promotions: 'promotions' })
    expect(KIT_TAG_KINDS).toEqual(['product', 'category', 'brand'])
    expect(MAX_TAG_LENGTH).toBe(256)
  })

  it('builds tags of a custom kind', () => {
    expect(tagFor('page')('o-nas')).toBe('page:o-nas')
  })

  it('URI-encodes handles with non-ASCII letters and arbitrary category handles', () => {
    expect(productTag('wiosło-karbonowe')).toBe('product:wios%C5%82o-karbonowe')
    expect(categoryTag('Deski SUP')).toBe('category:Deski%20SUP')
    for (const tag of [
      productTag('wiosło-karbonowe'),
      categoryTag('Deski SUP/2'),
      brandTag('żółw'),
    ]) {
      expect(isKitTagAllowed(tag)).toBe(true)
    }
  })

  it('allows the kit allowlist and rejects typos', () => {
    for (const tag of ['catalog', 'promotions', 'product:x', 'category:y', 'brand:f2']) {
      expect(isKitTagAllowed(tag)).toBe(true)
    }
    for (const tag of [
      '',
      'promotion',
      'Product:x',
      'product:',
      'product:../x',
      'product:a b',
      'product:wiosło',
      'brand:f2;drop',
      'other',
    ]) {
      expect(isKitTagAllowed(tag)).toBe(false)
    }
  })

  it('rejects tags longer than the Next.js limit', () => {
    expect(isKitTagAllowed(productTag('a'.repeat(MAX_TAG_LENGTH - 'product:'.length)))).toBe(true)
    expect(isKitTagAllowed(productTag('a'.repeat(MAX_TAG_LENGTH)))).toBe(false)
    expect(isKitTagAllowed('product:' + 'a'.repeat(MAX_TAG_LENGTH - 7))).toBe(false)
  })

  it('rejects quiz by default and accepts it with custom tags', () => {
    expect(isKitTagAllowed('quiz')).toBe(false)
    const rules = createTagRules({
      tags: [...Object.values(KIT_TAGS), 'quiz'],
      kinds: KIT_TAG_KINDS,
    })
    expect(rules.isAllowedTag('quiz')).toBe(true)
    expect(rules.isAllowedTag('quiz:1')).toBe(false)
    expect(rules.isAllowedTag('catalog')).toBe(true)
  })

  it('accepts kind:value only when the kind is registered', () => {
    expect(isKitTagAllowed('page:x')).toBe(false)
    const rules = createTagRules({ tags: ['pages'], kinds: [...KIT_TAG_KINDS, 'page'] })
    expect(rules.isAllowedTag('page:x')).toBe(true)
    expect(rules.isAllowedTag('page:')).toBe(false)
    expect(rules.isAllowedTag('page')).toBe(false)
    expect(rules.isAllowedTag('pages')).toBe(true)
  })

  it('does not treat regex metacharacters in tags or kinds as patterns', () => {
    const rules = createTagRules({ tags: ['a.b'], kinds: ['x+y'] })
    expect(rules.isAllowedTag('a.b')).toBe(true)
    expect(rules.isAllowedTag('aXb')).toBe(false)
    expect(rules.isAllowedTag('x+y:1')).toBe(true)
    expect(rules.isAllowedTag('xxy:1')).toBe(false)
  })
})
