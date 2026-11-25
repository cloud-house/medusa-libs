import {
  type LayoutData,
  NEUTRAL_LAYOUT,
  type RawLayoutGlobals,
  resolveLayoutData,
} from '@cloud-house/commerce-rules'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { contentOptions } from '../../../../lib/plugin-options'
import { readPublished } from '../../../../lib/store-views'

const KEYS: Record<keyof RawLayoutGlobals, string> = {
  header: 'header',
  announcement: 'announcement-bar',
  footer: 'footer',
  settings: 'store-settings',
}

/**
 * Header, announcement bar, footer and store settings with the defaults of their kinds for anything
 * not saved yet. `settings.freeShippingThreshold` is the default here – the shop reads the real one
 * from the shipping option's price rule.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { registry } = contentOptions(req.scope)
  const raw = Object.fromEntries(
    await Promise.all(
      Object.entries(KEYS).map(
        async ([name, key]) =>
          [name, (await readPublished(req.scope, 'global', key))?.data ?? null] as const,
      ),
    ),
  ) as unknown as RawLayoutGlobals
  const defaults: LayoutData = {
    navigation:
      (registry.get('global', 'header')?.defaults as LayoutData['navigation']) ??
      NEUTRAL_LAYOUT.navigation,
    announcement:
      (registry.get('global', 'announcement-bar')?.defaults as LayoutData['announcement']) ??
      NEUTRAL_LAYOUT.announcement,
    footer:
      (registry.get('global', 'footer')?.defaults as LayoutData['footer']) ?? NEUTRAL_LAYOUT.footer,
    settings:
      (registry.get('global', 'store-settings')?.defaults as LayoutData['settings']) ??
      NEUTRAL_LAYOUT.settings,
  }
  res.json({ layout: resolveLayoutData(raw, defaults) })
}
