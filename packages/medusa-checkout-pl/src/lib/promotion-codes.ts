import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

type AdjustedRow = { adjustments?: ({ code?: string | null } | null)[] | null } | null

/** Promotion codes on the lines' adjustments, in line order, without repeats. */
export function adjustmentCodes(items: AdjustedRow[]): string[] {
  return [
    ...new Set(
      items.flatMap((item) => (item?.adjustments ?? []).flatMap((a) => (a?.code ? [a.code] : []))),
    ),
  ]
}

/**
 * The codes among `codes` that the customer typed – automatic (bundle) promotions carry a code
 * too, but nobody enters it.
 */
export async function typedPromotionCodes(
  container: MedusaContainer,
  codes: string[],
): Promise<Set<string>> {
  if (!codes.length) return new Set()
  const { data: promotions } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'promotion',
    fields: ['code', 'is_automatic'],
    filters: { code: codes },
  })
  return new Set(
    (promotions as { code?: string | null; is_automatic?: boolean | null }[]).flatMap((p) =>
      p.code && !p.is_automatic ? [p.code] : [],
    ),
  )
}
