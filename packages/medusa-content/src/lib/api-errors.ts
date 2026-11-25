import { MedusaError } from '@medusajs/framework/utils'
import type { z } from '@medusajs/framework/zod'

/** Panel message from a failed schema check: the first issue, prefixed with its field path. */
export function invalidContent(error: z.ZodError): MedusaError {
  const [issue] = error.issues
  const path = issue?.path.length ? `${issue.path.join('.')}: ` : ''
  return new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `${path}${issue?.message ?? 'Błędne dane.'}`,
  )
}

/** 400 with the message intact (Medusa rewrites the message of every 409). */
export const notAllowed = (message: string) =>
  new MedusaError(MedusaError.Types.NOT_ALLOWED, message)

export const PROTECTED_MESSAGE = {
  delete: 'Tej strony nie można usunąć – linkują do niej checkout i e-maile.',
  slug: 'Tej stronie nie można zmienić adresu – linkują do niej checkout i e-maile.',
  unpublish: 'Tej strony nie można wycofać z publikacji – linkują do niej checkout i e-maile.',
} as const

export const SLUG_TAKEN_MESSAGE = 'Ten adres jest już zajęty – wybierz inny.'
export const CATEGORY_IN_USE_MESSAGE =
  'Ta kategoria ma artykuły – przenieś je do innej kategorii przed usunięciem.'

/** 422 – an address another entry already uses. */
export const slugTaken = () =>
  new MedusaError(MedusaError.Types.DUPLICATE_ERROR, SLUG_TAKEN_MESSAGE)
