import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { brandsOptions } from '../../../../lib/plugin-options'

/** Texts of the admin pages – the `locale` dictionary with the `messages` overrides. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { locale, messages } = brandsOptions(req.scope)
  res.json({ locale, messages })
}
