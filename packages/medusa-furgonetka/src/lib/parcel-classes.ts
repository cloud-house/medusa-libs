import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { metadataParcelClasses } from './metadata-parcel-classes'
import { furgonetkaOptions, logPrefix } from './plugin-options'
import { warnOnce } from './warn-once'

/**
 * The parcel classes of the products – the shop's `resolveParcelClasses` answer without the keys no
 * class was declared for (a typo must not stop an order; it is logged once).
 */
export async function parcelClassesOf(
  container: MedusaContainer,
  productIds: string[],
): Promise<Map<string, string>> {
  const options = furgonetkaOptions(container)
  const declared = new Set(options.parcelClasses.map((candidate) => candidate.key))
  const answer = await options.resolveParcelClasses(container, productIds)
  const known = new Map<string, string>()
  for (const [productId, key] of answer) {
    if (declared.has(key)) {
      known.set(productId, key)
      continue
    }
    warnOnce(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      `parcel-class:${key}`,
      `${logPrefix(container)} Klasa gabarytów „${key}” (produkt ${productId}) nie jest zadeklarowana w parcelClasses – produkt traktuję jak zwykły.`,
    )
  }
  return known
}

export { metadataParcelClasses }
