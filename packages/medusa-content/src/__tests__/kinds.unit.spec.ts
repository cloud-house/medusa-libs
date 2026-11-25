import { z } from '@medusajs/framework/zod'
import { defineKind, KindRegistry } from '../kinds'

const publish = z.object({ title: z.string().min(1) })
const draft = z.object({ title: z.string() })

const registry = new KindRegistry([
  {
    type: 'page',
    label: 'Page',
    schema: publish,
    draftSchema: draft,
    versions: { drafts: true, maxVersions: 0 },
    refs: [['content', 'lexical']],
  },
  { type: 'faq', label: 'FAQ', schema: publish },
  { type: 'global', slug: 'header', label: 'Header', schema: publish },
  { type: 'brand', label: 'Brand', schema: publish, entity: 'brand' },
])

describe('KindRegistry', () => {
  it('looks kinds up by type and by slug for globals', () => {
    expect(registry.get('page')?.label).toBe('Page')
    expect(registry.get('global', 'header')?.label).toBe('Header')
    expect(registry.get('global', 'footer')).toBeUndefined()
    expect(registry.get('nope')).toBeUndefined()
    expect(registry.isGlobalKey('header')).toBe(true)
    expect(registry.isGlobalKey('page')).toBe(false)
    expect(registry.globalKeys()).toEqual(['header'])
    expect(registry.entityKinds().map((kind) => kind.type)).toEqual(['brand'])
  })

  it('checks a working copy with the draft schema, or the publish schema when there is none', () => {
    expect(registry.schemaFor('page', null, 'draft').safeParse({ title: '' }).success).toBe(true)
    expect(registry.schemaFor('page', null, 'publish').safeParse({ title: '' }).success).toBe(false)
    expect(registry.schemaFor('faq', null, 'draft').safeParse({ title: '' }).success).toBe(false)
    expect(() => registry.schemaFor('nope', null, 'publish')).toThrow('Nieznany typ treści: nope/')
  })

  it('has the default policy (no drafts, no history) and the paths of the kind', () => {
    expect(registry.policyFor('page', null)).toEqual({ drafts: true, maxVersions: 0 })
    expect(registry.policyFor('faq', null)).toEqual({ drafts: false, maxVersions: null })
    expect(registry.policyFor('unknown', null)).toEqual({ drafts: false, maxVersions: null })
    expect(registry.refPathsFor('page', null)).toEqual([['content', 'lexical']])
    expect(registry.refPathsFor('faq', null)).toEqual([])
  })

  it('defineKind returns a copy with the defaults', () => {
    const input = { type: 'faq', label: 'FAQ', schema: publish }
    const kind = defineKind(input)
    expect(kind).not.toBe(input)
    expect(kind.versions).toEqual({ drafts: false, maxVersions: null })
    expect(kind.refs).toEqual([])
  })
})
