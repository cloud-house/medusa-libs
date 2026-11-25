import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/** The default `resolveParcelClasses`: the class key in `product.metadata.parcel_class`. */
export async function metadataParcelClasses(
  container: MedusaContainer,
  productIds: string[],
): Promise<Map<string, string>> {
  const classes = new Map<string, string>()
  if (productIds.length === 0) return classes
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'product',
    fields: ['id', 'metadata'],
    filters: { id: productIds },
  })
  for (const product of data as unknown as {
    id: string
    metadata?: Record<string, unknown> | null
  }[]) {
    const key = product.metadata?.parcel_class
    if (typeof key === 'string' && key.trim()) classes.set(product.id, key.trim())
  }
  return classes
}
