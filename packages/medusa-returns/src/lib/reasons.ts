import { RETURN_REASONS } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { createReturnReasonsWorkflow } from '@medusajs/medusa/core-flows'

/**
 * Creates the return reasons of `RETURN_REASONS` that do not exist yet (`value` = the code the
 * storefront sends). Existing ones – and any edits the owner made – stay untouched. Returns how
 * many reasons it created. Call it from the shop's seed or migration script.
 */
export async function ensureReturnReasons(container: MedusaContainer): Promise<number> {
  const existing = await container
    .resolve(Modules.ORDER)
    .listReturnReasons({ value: RETURN_REASONS.map((reason) => reason.id) })
  const present = new Set(existing.map((reason) => reason.value))
  const missing = RETURN_REASONS.filter((reason) => !present.has(reason.id))
  if (missing.length === 0) return 0

  await createReturnReasonsWorkflow(container).run({
    input: { data: missing.map((reason) => ({ value: reason.id, label: reason.label })) },
  })
  return missing.length
}
