import type { OrderSummary, OrderSummaryAddress } from '@cloud-house/commerce-rules'
import { type AddressFields, sameAddress } from '../checkout/form'
import type { AccountAddressInput, SavedAddress } from './client'

const fieldsOf = (address: OrderSummaryAddress): AddressFields => ({
  firstName: address.first_name ?? '',
  lastName: address.last_name ?? '',
  address1: address.address_1 ?? '',
  postalCode: address.postal_code ?? '',
  city: address.city ?? '',
})

const input = (
  fields: AddressFields,
  extra: { company: string | null; nip: string; shipping: boolean; billing: boolean },
): AccountAddressInput => ({
  address_name: null,
  first_name: fields.firstName,
  last_name: fields.lastName,
  address_1: fields.address1,
  postal_code: fields.postalCode,
  city: fields.city,
  country_code: 'pl',
  company: extra.company,
  metadata: { nip: extra.nip },
  is_default_shipping: extra.shipping,
  is_default_billing: extra.billing,
})

/**
 * „Zapisz dane w koncie” after the order (spec 5a §3.12): the delivery address and the invoice
 * data, unless an identical address is already saved. One entry when both share the address.
 */
export function addressesToSave(
  order: OrderSummary,
  existing: SavedAddress[],
): AccountAddressInput[] {
  const result: AccountAddressInput[] = []
  const hasDefaultShipping = existing.some((address) => address.defaultShipping)
  const hasDefaultBilling = existing.some((address) => address.defaultBilling)
  const nip = typeof order.metadata?.nip === 'string' ? order.metadata.nip : ''
  const company = order.billing_address?.company?.trim() || null
  const shipping = order.shipping_address ? fieldsOf(order.shipping_address) : null
  const billing = order.billing_address && nip && company ? fieldsOf(order.billing_address) : null

  const known = (fields: AddressFields, withCompany: boolean) =>
    existing.some(
      (address) =>
        sameAddress(address.fields, fields) &&
        (!withCompany || (address.company === company && address.nip === nip)),
    )

  if (billing && shipping && sameAddress(billing, shipping)) {
    if (!known(billing, true)) {
      result.push(
        input(billing, {
          company,
          nip,
          shipping: !hasDefaultShipping && !known(shipping, false),
          billing: !hasDefaultBilling,
        }),
      )
    }
    return result
  }
  if (shipping && !known(shipping, false)) {
    result.push(
      input(shipping, { company: null, nip: '', shipping: !hasDefaultShipping, billing: false }),
    )
  }
  if (billing && !known(billing, true)) {
    result.push(input(billing, { company, nip, shipping: false, billing: !hasDefaultBilling }))
  }
  return result
}
