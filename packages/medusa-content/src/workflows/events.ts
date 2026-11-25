/**
 * Content events. `published` – the state the store reads changed (a draft-only save does not
 * touch the cache); `previous_slug` – address before a publication that renamed the entry.
 */
export const ContentEvents = {
  CHANGED: 'content.changed',
  DELETED: 'content.deleted',
  HANDLE_CHANGED: 'content.handle-changed',
} as const

export interface ContentEventData {
  id: string
  type: string
  slug: string | null
  previous_slug?: string | null
  /** Handle of the Medusa product, category or brand the content belongs to. */
  handle?: string | null
  published: boolean
}
