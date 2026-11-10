import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { newsletterOptions } from '../../../../lib/plugin-options'

/** Texts of the admin page – the `locale` dictionary with the `messages` overrides. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { locale, messages } = newsletterOptions(req.scope)
  res.json({ locale, messages })
}
