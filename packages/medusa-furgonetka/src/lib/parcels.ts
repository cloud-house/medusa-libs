import type { TemplateRow } from '../modules/furgonetka/service'
import type { ParcelClass } from '../options'
import type { Carrier, ParcelSpec, TemplatePurpose } from '../types'

/** The parcel a template describes, ready to be edited on a shipment. */
export function fromTemplate(template: TemplateRow): ParcelSpec {
  return {
    template_id: template.id,
    name: template.name,
    kind: template.kind,
    length_cm: template.length_cm,
    width_cm: template.width_cm,
    height_cm: template.height_cm,
    weight_g: template.weight_g,
  }
}

/**
 * The parcels suggested for an order (spec 6d §5.3). A parcel locker takes one accessories parcel.
 * Otherwise every piece of a classed item gets its own carton (classes in the order the shop
 * declared them) and whatever is left goes into one accessories carton. A purpose without a template
 * is reported as `{ missing }` – templates keep one owner per purpose, so it only happens when
 * none was set up.
 */
export function suggestParcels(
  items: { quantity: number; parcelClass: string | null }[],
  carrier: Carrier,
  templates: TemplateRow[],
  classes: Pick<ParcelClass, 'key'>[],
): ParcelSpec[] | { missing: TemplatePurpose } {
  const plan: TemplatePurpose[] = []
  if (carrier === 'inpost_locker') {
    plan.push('accessories_locker')
  } else {
    const pieces = (parcelClass: string | null) =>
      items
        .filter((item) => item.parcelClass === parcelClass)
        .reduce((sum, item) => sum + item.quantity, 0)
    for (const { key } of classes) {
      for (let i = 0; i < pieces(key); i++) plan.push(key)
    }
    if (pieces(null) > 0) plan.push('accessories_courier')
  }

  const parcels: ParcelSpec[] = []
  for (const purpose of plan) {
    const template = templates.find((candidate) => candidate.purpose === purpose)
    if (!template) return { missing: purpose }
    parcels.push(fromTemplate(template))
  }
  return parcels
}
