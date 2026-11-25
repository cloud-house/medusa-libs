import { z } from '@medusajs/framework/zod'
import { KindRegistry } from '../../kinds'
import { invalidContent } from '../api-errors'

const registry = new KindRegistry([
  {
    type: 'page',
    label: 'Page',
    schema: z.object({
      title: z.string().min(1, 'Podaj tytuł.'),
      slug: z.string().min(1, 'Podaj adres.'),
    }),
    draftSchema: z.object({ title: z.string(), slug: z.string() }),
  },
  { type: 'faq', label: 'FAQ', schema: z.object({ q: z.string().min(1, 'Podaj pytanie.') }) },
])

const message = (type: string, mode: 'publish' | 'draft', data: unknown) => {
  const result = registry.schemaFor(type, null, mode).safeParse(data)
  return result.success ? null : invalidContent(result.error).message
}

describe('publishing checks (Review Focus 1)', () => {
  it('reports the first issue with its field path, like the old panel', () => {
    expect(message('page', 'publish', { title: '', slug: 'a' })).toBe('title: Podaj tytuł.')
    expect(message('faq', 'publish', { q: '' })).toBe('q: Podaj pytanie.')
  })

  it('lets a working copy through with the softer schema, a kind without one uses the publish schema', () => {
    expect(message('page', 'draft', { title: '', slug: '' })).toBeNull()
    expect(message('faq', 'draft', { q: '' })).toBe('q: Podaj pytanie.')
  })
})
