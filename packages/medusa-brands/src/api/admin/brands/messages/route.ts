import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { brandsOptions } from '../../../../lib/plugin-options'

/** Texts of the admin pages (`locale` dictionary + `messages` overrides) and their `settings`. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { locale, messages, adminDetailLinks } = brandsOptions(req.scope)
  res.json({ locale, messages, settings: { detailLinks: adminDetailLinks } })
}
