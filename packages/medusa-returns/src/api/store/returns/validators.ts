import { RETURN_NOTE_MAX } from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'

/** The reason is a code from `RETURN_REASONS`; `claimReturn` checks it to answer in Polish. */
export const StoreReturnItems = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(99),
      reason: z.string().min(1).max(40),
    }),
  )
  .min(1)
  .max(50)

const note = z.string().trim().max(RETURN_NOTE_MAX).nullish()

/** `POST /store/account/orders/:id/return` – a signed-in customer's request. */
export const StoreAccountReturn = z.object({ items: StoreReturnItems, note })
export type StoreAccountReturnType = z.infer<typeof StoreAccountReturn>

/** `POST /store/returns/lookup` – a guest finds the order by its number and e-mail. */
export const StoreReturnLookup = z.object({
  // The largest PostgreSQL integer: a bigger number would be a database error, not the guest 404.
  display_id: z.number().int().positive().max(2_147_483_647),
  email: z.string().trim().min(3).max(254),
})
export type StoreReturnLookupType = z.infer<typeof StoreReturnLookup>

/** `POST /store/returns/claim` – a guest's request. */
export const StoreReturnClaim = StoreReturnLookup.extend({ items: StoreReturnItems, note })
export type StoreReturnClaimType = z.infer<typeof StoreReturnClaim>
