import { RETURN_WINDOW_DAYS } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { ReturnContact } from '../types'
import { logPrefix, returnsOptions } from './plugin-options'
import { warnOnce } from './warn-once'

/** The shop's return rules: the length of the window and where the goods go back. */
export interface ReturnPolicy {
  days: number
  address: string[] | null
}

/** `days` falls back to the default while the contact cannot be read or has no valid value. */
export function returnPolicyOf(contact: ReturnContact | null): ReturnPolicy {
  return {
    days: contact?.returnDays ?? RETURN_WINDOW_DAYS,
    address: contact?.returnAddress ?? null,
  }
}

/**
 * The policy from the shop's contact (`resolveContact`); the 30-day default when it cannot be
 * read. The account pages and guest routes call it on every request, so the resolver should be a
 * cheap read.
 */
export async function loadReturnPolicy(container: MedusaContainer): Promise<ReturnPolicy> {
  const contact = await readContact(container)
  if (!contact) {
    warnOnce(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      'return-policy',
      `${logPrefix(container)} Ustawienia zwrotów niedostępne – przyjmuję ${RETURN_WINDOW_DAYS} dni.`,
    )
  }
  return returnPolicyOf(contact)
}

/** The contact from the shop; a resolver that throws counts as no contact. */
export async function readContact(container: MedusaContainer): Promise<ReturnContact | null> {
  try {
    return await returnsOptions(container).resolveContact(container)
  } catch {
    return null
  }
}
