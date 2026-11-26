import { FURGONETKA_MODULE, parcelClassesOf } from '@cloud-house/medusa-furgonetka'
import type { MedusaContainer } from '@medusajs/framework/types'
import type { ResolvedCheckoutPlOptions } from '../options'
import type { ParcelBlocker } from '../types'

/**
 * Items that do not fit a parcel locker and go by the courier only – and the InPost courier does
 * not take them either: every product with a parcel class declared in `medusa-furgonetka`
 * (`parcelClassesOf` asks the shop's `resolveParcelClasses`). Without the furgonetka plugin nothing
 * is bulky.
 */
export async function parcelLockerBlockers(
  container: MedusaContainer,
  items: { product_id: string | null | undefined; title: string }[],
): Promise<ParcelBlocker[]> {
  const byProduct = new Map<string, string>()
  for (const item of items) {
    if (item.product_id && !byProduct.has(item.product_id))
      byProduct.set(item.product_id, item.title)
  }
  if (byProduct.size === 0) return []
  try {
    container.resolve(FURGONETKA_MODULE)
  } catch {
    return []
  }
  const classes = await parcelClassesOf(container, [...byProduct.keys()])
  return [...classes].map(([productId, parcelClass]) => ({
    product_id: productId,
    title: byProduct.get(productId) ?? productId,
    reason: parcelClass,
  }))
}

const named = (blockers: ParcelBlocker[], one: string, many: string) => {
  const [first] = blockers
  return blockers.length === 1
    ? `${first?.title} ${one}`
    : `${first?.title} i inne produkty ${many}`
}

/** Customer-facing reason the parcel locker is closed; `null` when nothing blocks it. */
export function blockedReason(
  blockers: ParcelBlocker[],
  options: Pick<ResolvedCheckoutPlOptions, 'blockReasons'>,
): string | null {
  if (blockers.length === 0) return null
  if (options.blockReasons.locker) return options.blockReasons.locker(blockers)
  return named(blockers, 'nie mieści się w paczkomacie.', 'nie mieszczą się w paczkomacie.')
}

/** Customer-facing reason the InPost courier is closed; `null` when nothing blocks it. */
export function courierBlockedReason(
  blockers: ParcelBlocker[],
  options: Pick<ResolvedCheckoutPlOptions, 'blockReasons'>,
): string | null {
  if (blockers.length === 0) return null
  if (options.blockReasons.inpostCourier) return options.blockReasons.inpostCourier(blockers)
  return named(blockers, 'wysyłamy tylko kurierem DPD.', 'wysyłamy tylko kurierem DPD.')
}
