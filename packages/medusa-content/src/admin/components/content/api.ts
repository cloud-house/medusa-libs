import { sdk } from '../../lib/sdk'

export type Data = Record<string, unknown>

export interface Entry {
  id: string
  /** Key of the registered kind. */
  type: string
  slug: string | null
  entity_id: string | null
  status: 'draft' | 'published'
  data: Data | null
  draft: Data | null
  published_at: string | null
  updated_at: string
}

export interface MediaDoc {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
  credit: string | null
  creditUrl: string | null
  filesize: number
  filename: string
  mimeType: string
}

/** A related document as pickers show it. */
export interface RefDoc {
  id: string
  handle?: string
  slug?: string | null
  title?: string | null
  name?: string | null
}

export interface Related {
  media: Record<string, MediaDoc>
  product: Record<string, RefDoc>
  category: Record<string, RefDoc>
  brand: Record<string, RefDoc>
  entry: Record<string, RefDoc>
}

export const emptyRelated = (): Related => ({
  media: {},
  product: {},
  category: {},
  brand: {},
  entry: {},
})

export interface EntryResponse {
  entry: Entry | null
  related: Partial<Related>
  /** The entry cannot be deleted, unpublished or renamed. */
  protected?: boolean
  /** Starting content of a global that was never saved. */
  initial?: Data | null
}

export interface Version {
  id: string
  snapshot: Data
  status: 'draft' | 'published'
  autosave: boolean
  created_by: string | null
  created_at: string
}

export type SaveMode = 'autosave' | 'draft' | 'publish'

export const contentKey = (...parts: string[]) => ['content', ...parts]

export const fetchEntry = (url: string) => sdk.client.fetch<EntryResponse>(url)

export const saveEntry = (
  url: string,
  body: { mode: SaveMode; data: Data; expected_updated_at?: string | null; type?: string },
) => sdk.client.fetch<EntryResponse>(url, { method: 'POST', body })

export interface MediaAsset {
  id: string
  kind: 'image' | 'document'
  url: string
  filename: string
  mime_type: string
  filesize: number
  width: number | null
  height: number | null
  alt: string
  credit: string | null
  credit_url: string | null
  created_at: string
}

export const toMediaDoc = (asset: MediaAsset): MediaDoc => ({
  id: asset.id,
  url: asset.url,
  alt: asset.alt,
  width: asset.width,
  height: asset.height,
  credit: asset.credit,
  creditUrl: asset.credit_url,
  filesize: Number(asset.filesize),
  filename: asset.filename,
  mimeType: asset.mime_type,
})

export const listMedia = (params: { kind?: 'image' | 'document'; q?: string; offset?: number }) => {
  const query = new URLSearchParams()
  if (params.kind) query.set('kind', params.kind)
  if (params.q) query.set('q', params.q)
  if (params.offset) query.set('offset', String(params.offset))
  return sdk.client.fetch<{ media: MediaAsset[]; count: number }>(`/admin/content/media?${query}`)
}

export async function uploadMedia(file: File, alt = ''): Promise<MediaAsset> {
  const form = new FormData()
  form.append('files', file)
  form.append('alt', alt)
  const response = await fetch('/admin/content/media', {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message ?? 'Nie udało się wysłać pliku.')
  return (body.media as MediaAsset[])[0] as MediaAsset
}

/** Pickers search Medusa records (`product`, `category`, `brand`) or entries of a kind (its `type`). */
export type RefKind = string

/** Search for pickers; `q` empty – the first results. */
export async function searchRefs(kind: RefKind, q: string): Promise<RefDoc[]> {
  if (kind === 'product') {
    const { products } = await sdk.admin.product.list({
      q: q || undefined,
      limit: 20,
      fields: 'id,handle,title',
    })
    return products.map((p) => ({ id: p.id, handle: p.handle ?? '', title: p.title }))
  }
  if (kind === 'category') {
    const { product_categories } = await sdk.admin.productCategory.list({
      q: q || undefined,
      limit: 50,
      fields: 'id,handle,name',
    })
    return product_categories.map((c) => ({ id: c.id, handle: c.handle, name: c.name }))
  }
  if (kind === 'brand') {
    const { brands } = await sdk.client.fetch<{
      brands: { id: string; handle: string; name: string }[]
    }>('/admin/brands')
    const needle = q.toLowerCase()
    return brands
      .filter((b) => !needle || b.name.toLowerCase().includes(needle))
      .map((b) => ({ id: b.id, handle: b.handle, name: b.name }))
  }
  const { entries } = await sdk.client.fetch<{
    entries: { id: string; slug: string | null; title: string }[]
  }>(`/admin/content/entries?type=${kind}`)
  const needle = q.toLowerCase()
  return entries
    .filter(
      (e) => !needle || e.title.toLowerCase().includes(needle) || (e.slug ?? '').includes(needle),
    )
    .slice(0, 30)
    .map((e) => ({ id: e.id, slug: e.slug, title: e.title }))
}

export const refLabel = (doc: RefDoc | undefined, fallback: string) =>
  doc ? (doc.title ?? doc.name ?? doc.handle ?? doc.slug ?? doc.id) : fallback

/** Panel message for a failed request – Medusa keeps our Polish messages for 400 and 422. */
export const failure = (error: unknown) =>
  error instanceof Error ? error.message : 'Coś poszło nie tak. Spróbuj ponownie.'
