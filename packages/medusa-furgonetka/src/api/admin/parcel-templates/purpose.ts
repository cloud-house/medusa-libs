import type { MedusaContainer } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'
import { furgonetkaOptions } from '../../../lib/plugin-options'
import { ACCESSORIES_PURPOSES } from '../../../types'

/** The purposes a template can have: the shop's parcel classes and the two accessories ones. */
export function allowedPurposes(container: Pick<MedusaContainer, 'resolve'>): string[] {
  return [
    ...furgonetkaOptions(container).parcelClasses.map((parcelClass) => parcelClass.key),
    ...ACCESSORIES_PURPOSES,
  ]
}

/** Refuses a purpose that is not a parcel class of the shop or an accessories purpose. */
export function checkPurpose(container: Pick<MedusaContainer, 'resolve'>, purpose: string | null) {
  if (purpose !== null && !allowedPurposes(container).includes(purpose)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Wybierz przeznaczenie szablonu.')
  }
}
