import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { readable } from '../../../../lib/store-views'

/** Published info pages: addresses for the router and the info menu (`inInfoNav`, by `navOrder`). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pages = await readable(req.scope, 'page')
  const infoNav = pages
    .filter(({ data }) => data.inInfoNav !== false)
    .sort(
      (a, b) =>
        Number(a.data.navOrder ?? 100) - Number(b.data.navOrder ?? 100) ||
        String(a.data.title).localeCompare(String(b.data.title), 'pl'),
    )
    .slice(0, 50)
    .map(({ data }) => ({ slug: String(data.slug), title: String(data.title) }))
  res.json({ slugs: pages.map(({ data }) => String(data.slug)), infoNav })
}
