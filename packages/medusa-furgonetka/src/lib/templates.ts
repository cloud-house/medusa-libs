import type { MedusaContainer } from '@medusajs/framework'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { TemplateKind, TemplatePurpose } from '../types'

/** A parcel template to seed: dimensions in whole cm (length × width × height), weight in grams. */
export interface DefaultTemplate {
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
  purpose: TemplatePurpose | null
}

/**
 * Creates the shop's starting templates when the table is empty. Returns how many it created (0 when
 * the shop already has templates, also when another process seeded them first). The templates – and
 * so the dimensions of the shop's cartons – are the shop's: pass one per parcel class and the two
 * accessories purposes.
 */
export async function ensureParcelTemplates(
  container: MedusaContainer,
  templates: DefaultTemplate[],
): Promise<number> {
  const furgonetka: FurgonetkaModuleService = container.resolve(FURGONETKA_MODULE)
  const [existing] = await furgonetka.listParcelTemplates({}, { select: ['id'], take: 1 })
  if (existing) return 0
  try {
    await furgonetka.createParcelTemplates(templates)
  } catch (error) {
    // A parallel seed won the race (the unique index on `purpose` refused ours).
    const [created] = await furgonetka.listParcelTemplates({}, { select: ['id'], take: 1 })
    if (created) return 0
    throw error
  }
  return templates.length
}
