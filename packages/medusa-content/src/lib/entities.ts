import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { EntityKind } from '../types'

/** `brand` module key of `@cloud-house/medusa-brands`; the plugin reads it without depending on it. */
export const BRAND_MODULE_KEY = 'brand'

/** A Medusa product, category or brand as the content mappers read it. */
export interface EntityDoc {
  id: string
  handle: string
  title: string
}

interface BrandReader {
  listBrands(
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<{ id: string; handle: string; name: string }[]>
}

function brandModule(container: MedusaContainer): BrandReader | null {
  try {
    return container.resolve(BRAND_MODULE_KEY) as BrandReader
  } catch {
    return null
  }
}

/** The records by id (`by: 'id'`) or by handle (`by: 'handle'`); missing ones are left out. */
export async function findEntities(
  container: MedusaContainer,
  kind: EntityKind,
  by: 'id' | 'handle',
  values: string[],
): Promise<EntityDoc[]> {
  if (values.length === 0) return []
  if (kind === 'brand') {
    const brands = brandModule(container)
    if (!brands) return []
    const rows = await brands.listBrands({ [by]: values }, { take: null })
    return rows.map((row) => ({ id: row.id, handle: row.handle, title: row.name }))
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const entity = kind === 'product' ? 'product' : 'product_category'
  const { data } = await query.graph({
    entity,
    fields: kind === 'product' ? ['id', 'handle', 'title'] : ['id', 'handle', 'name'],
    filters: { [by]: values },
  })
  return (data as { id: string; handle: string; title?: string; name?: string }[]).map((row) => ({
    id: row.id,
    handle: row.handle,
    title: row.title ?? row.name ?? '',
  }))
}

/** Current handle of a product, category or brand (default of the `resolveEntityHandle` option). */
export async function defaultEntityHandle(
  container: MedusaContainer,
  kind: EntityKind,
  entityId: string,
): Promise<string | null> {
  const [doc] = await findEntities(container, kind, 'id', [entityId])
  return doc?.handle ?? null
}
