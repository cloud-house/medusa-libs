import { type AddressFields, type CheckoutForm, sameAddress } from './form'

/** An address saved in the customer account (as the account loader shapes it). */
export interface SavedAddress {
  id: string
  name: string | null
  fields: AddressFields
  company: string | null
  nip: string | null
  defaultShipping: boolean
  defaultBilling: boolean
}

/** What the checkout shows of a signed-in customer (spec 5a §3.12). */
export interface CheckoutAccount {
  firstName: string
  lastName: string
  email: string
  phone: string
  addresses: SavedAddress[]
}

const isEmpty = (fields: AddressFields) => Object.values(fields).every((value) => !value.trim())

/**
 * Empty fields of the checkout form get the account data: the e-mail always, the phone, the
 * default delivery address, and invoice data from the default invoice address with a NIP.
 * Data already saved in the cart (an earlier attempt) wins.
 */
export function prefillFromAccount(form: CheckoutForm, account: CheckoutAccount): CheckoutForm {
  const delivery = account.addresses.find((address) => address.defaultShipping)
  const shipping = isEmpty(form.shipping)
    ? (delivery?.fields ?? {
        ...form.shipping,
        firstName: account.firstName,
        lastName: account.lastName,
      })
    : form.shipping
  const next: CheckoutForm = {
    ...form,
    email: account.email,
    phone: form.phone.trim() ? form.phone : account.phone,
    shipping,
    saveToAccount: true,
  }
  if (form.invoice || form.nip || form.company) return next
  const invoice = account.addresses.find(
    (address) => address.defaultBilling && address.company && address.nip,
  )
  if (!invoice) return next
  const separate = !sameAddress(invoice.fields, shipping)
  return {
    ...next,
    invoice: true,
    company: invoice.company ?? '',
    nip: invoice.nip ?? '',
    separateBilling: separate,
    billing: separate ? invoice.fields : next.billing,
  }
}
