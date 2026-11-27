import {
  isPolishMobile,
  isValidNip,
  MOBILE_FOR_LOCKER,
  normalizeNip,
} from '@cloud-house/commerce-rules'

export type PaymentMethod = 'blik' | 'p24' | 'card'

export interface AddressFields {
  firstName: string
  lastName: string
  address1: string
  postalCode: string
  city: string
}

export interface CheckoutForm {
  email: string
  phone: string
  shipping: AddressFields
  invoice: boolean
  nip: string
  company: string
  /** Only with `invoice`: the invoice goes to a different address than the parcel. */
  separateBilling: boolean
  billing: AddressFields
  deliveryOptionId: string | null
  deliveryCode: string | null
  parcelLocker: string | null
  /** Adres punktu z Geowidgetu – tylko do pokazania klientowi. */
  parcelLockerLabel: string | null
  payment: PaymentMethod
  blikCode: string
  terms: boolean
  /** Signed-in customer: save the new address / invoice data in the account after the order (5a). */
  saveToAccount: boolean
  /** „Uwagi do zamówienia (opcjonalnie)” – do `cart.metadata.customer_note` (część 2 §4.3). */
  customerNote: string
  /** Zgoda na newsletter w kasie – zapis przy wysłaniu formularza, nie trafia do koszyka. */
  newsletter: boolean
  /** Gość: „Chcę założyć konto w sklepie” → konto po zamówieniu z linkiem „Ustaw hasło”. */
  createAccount: boolean
}

/** Field path used for error messages, e.g. `shipping.postalCode`, `nip`, `delivery`, `terms`. */
export type FieldKey = string

export type CheckoutErrors = Partial<Record<FieldKey, string>>

export const PARCEL_LOCKER_CODE = 'paczkomat-inpost'
export const MAX_CUSTOMER_NOTE = 500

const REQUIRED = 'Uzupełnij to pole.'
const ADDRESS_KEYS = ['firstName', 'lastName', 'address1', 'postalCode', 'city'] as const

const emptyAddress = (): AddressFields => ({
  firstName: '',
  lastName: '',
  address1: '',
  postalCode: '',
  city: '',
})

export function emptyCheckoutForm(): CheckoutForm {
  return {
    email: '',
    phone: '',
    shipping: emptyAddress(),
    invoice: false,
    nip: '',
    company: '',
    separateBilling: false,
    billing: emptyAddress(),
    deliveryOptionId: null,
    deliveryCode: null,
    parcelLocker: null,
    parcelLockerLabel: null,
    payment: 'blik',
    blikCode: '',
    terms: false,
    saveToAccount: false,
    customerNote: '',
    newsletter: false,
    createAccount: false,
  }
}

/** `80001` and `80-001` → `80-001`; anything else → `null`. */
export function normalizePostalCode(value: string): string | null {
  const match = /^(\d{2})-?(\d{3})$/.exec(value.trim())
  return match ? `${match[1]}-${match[2]}` : null
}

/** Polish mobile or landline: 9 digits, optionally after +48 / 0048; spaces and dashes allowed. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s\-()]/g, '').replace(/^(\+48|0048)/, '')
  return /^\d{9}$/.test(digits) ? `+48${digits}` : null
}

const blikDigits = (value: string) => value.replace(/\s/g, '')

function validateAddress(prefix: string, fields: AddressFields, errors: CheckoutErrors) {
  for (const key of ADDRESS_KEYS) {
    if (!fields[key].trim()) errors[`${prefix}.${key}`] = REQUIRED
  }
  if (fields.postalCode.trim() && !normalizePostalCode(fields.postalCode)) {
    errors[`${prefix}.postalCode`] = 'Kod pocztowy w formacie 00-000.'
  }
}

export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {}
  const email = form.email.trim()
  if (!email) errors.email = 'Podaj adres e-mail.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Sprawdź adres e-mail.'

  if (!form.phone.trim()) errors.phone = 'Podaj numer telefonu.'
  else if (!normalizePhone(form.phone)) errors.phone = 'Podaj polski numer telefonu (9 cyfr).'
  // Kod odbioru paczkomat wysyła SMS-em – numer stacjonarny nie wystarczy (kurier przyjmie każdy).
  else if (form.deliveryCode === PARCEL_LOCKER_CODE && !isPolishMobile(form.phone)) {
    errors.phone = MOBILE_FOR_LOCKER
  }

  validateAddress('shipping', form.shipping, errors)

  if (form.invoice) {
    if (!form.nip.trim()) errors.nip = 'Podaj NIP.'
    else if (!isValidNip(form.nip)) errors.nip = 'Sprawdź NIP – suma kontrolna się nie zgadza.'
    if (!form.company.trim()) errors.company = 'Podaj nazwę firmy.'
    if (form.separateBilling) validateAddress('billing', form.billing, errors)
  }

  if (!form.deliveryOptionId) errors.delivery = 'Wybierz sposób dostawy.'
  else if (form.deliveryCode === PARCEL_LOCKER_CODE && !form.parcelLocker) {
    errors.delivery = 'Wybierz paczkomat.'
  }

  if (form.payment === 'blik' && !/^\d{6}$/.test(blikDigits(form.blikCode))) {
    errors.blikCode = 'Kod BLIK ma 6 cyfr.'
  }
  if (form.customerNote.trim().length > MAX_CUSTOMER_NOTE) {
    errors.customerNote = `Uwagi mogą mieć najwyżej ${MAX_CUSTOMER_NOTE} znaków.`
  }
  if (!form.terms) errors.terms = 'Zaakceptuj regulamin, żeby złożyć zamówienie.'
  return errors
}

export function blikCode(form: CheckoutForm): string {
  return blikDigits(form.blikCode)
}

export interface CartAddress {
  first_name: string
  last_name: string
  address_1: string
  postal_code: string
  city: string
  country_code: 'pl'
  phone?: string
  company?: string
}

export interface CartUpdate {
  email: string
  shipping_address: CartAddress
  billing_address: CartAddress
  /** Każdy klucz jest zawsze wysyłany: `''` usuwa go – Medusa scala `metadata` koszyka. */
  metadata: {
    nip: string
    terms_accepted_at: string
    save_to_account: 'tak' | ''
    customer_note: string
    /** Backend zakłada konto po `order.placed` (część 2 §5.1). */
    create_account: 'tak' | ''
  }
}

function cartAddress(fields: AddressFields): CartAddress {
  return {
    first_name: fields.firstName.trim(),
    last_name: fields.lastName.trim(),
    address_1: fields.address1.trim(),
    postal_code: normalizePostalCode(fields.postalCode) ?? fields.postalCode.trim(),
    city: fields.city.trim(),
    country_code: 'pl',
  }
}

/** Cart data for a validated form (spec 3b §3: company in the billing address, NIP in metadata). */
export function toCartUpdate(form: CheckoutForm, termsAcceptedAt: string): CartUpdate {
  const phone = normalizePhone(form.phone) ?? form.phone.trim()
  const shipping: CartAddress = { ...cartAddress(form.shipping), phone }
  if (!form.invoice) {
    return {
      email: form.email.trim(),
      shipping_address: shipping,
      billing_address: shipping,
      // Medusa scala `metadata`; pusty `nip` usuwa NIP z wcześniejszej próby z fakturą.
      metadata: {
        nip: '',
        terms_accepted_at: termsAcceptedAt,
        save_to_account: form.saveToAccount ? 'tak' : '',
        customer_note: form.customerNote.trim(),
        create_account: form.createAccount ? 'tak' : '',
      },
    }
  }
  const base = form.separateBilling ? cartAddress(form.billing) : shipping
  return {
    email: form.email.trim(),
    shipping_address: shipping,
    billing_address: { ...base, company: form.company.trim() },
    metadata: {
      nip: normalizeNip(form.nip),
      terms_accepted_at: termsAcceptedAt,
      save_to_account: form.saveToAccount ? 'tak' : '',
      customer_note: form.customerNote.trim(),
      create_account: form.createAccount ? 'tak' : '',
    },
  }
}

const MAX_TEXT = 200
const PAYMENT_METHODS: readonly PaymentMethod[] = ['blik', 'p24', 'card']

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TEXT
const isTextOrNull = (value: unknown) => value === null || isText(value)

function parseAddress(value: unknown): AddressFields | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (!ADDRESS_KEYS.every((key) => isText(row[key]))) return null
  return Object.fromEntries(ADDRESS_KEYS.map((key) => [key, row[key]])) as unknown as AddressFields
}

/** Server action to publiczny endpoint – formularz z przeglądarki sprawdzamy, zanim trafi dalej. */
export function parseCheckoutForm(value: unknown): CheckoutForm | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const shipping = parseAddress(row.shipping)
  const billing = parseAddress(row.billing)
  const texts = ['email', 'phone', 'nip', 'company', 'blikCode'] as const
  const flags = ['invoice', 'separateBilling', 'terms', 'newsletter', 'createAccount'] as const
  const nullable = [
    'deliveryOptionId',
    'deliveryCode',
    'parcelLocker',
    'parcelLockerLabel',
  ] as const
  if (
    !shipping ||
    !billing ||
    !texts.every((key) => isText(row[key])) ||
    !flags.every((key) => typeof row[key] === 'boolean') ||
    !nullable.every((key) => isTextOrNull(row[key])) ||
    !PAYMENT_METHODS.includes(row.payment as PaymentMethod) ||
    typeof row.customerNote !== 'string' ||
    row.customerNote.length > MAX_CUSTOMER_NOTE
  ) {
    return null
  }
  return {
    email: row.email as string,
    phone: row.phone as string,
    shipping,
    invoice: row.invoice as boolean,
    nip: row.nip as string,
    company: row.company as string,
    separateBilling: row.separateBilling as boolean,
    billing,
    deliveryOptionId: row.deliveryOptionId as string | null,
    deliveryCode: row.deliveryCode as string | null,
    parcelLocker: row.parcelLocker as string | null,
    parcelLockerLabel: row.parcelLockerLabel as string | null,
    payment: row.payment as PaymentMethod,
    blikCode: row.blikCode as string,
    terms: row.terms as boolean,
    saveToAccount: row.saveToAccount === true,
    customerNote: row.customerNote,
    newsletter: row.newsletter as boolean,
    createAccount: row.createAccount as boolean,
  }
}

// `object`: typy adresów Medusy nie mają sygnatury indeksu – pola czytamy po nazwie.
type SavedAddress = object | null | undefined

const fieldOf = (address: SavedAddress, key: string): unknown =>
  address ? (address as Record<string, unknown>)[key] : undefined

/** Koszyk w kształcie potrzebnym do wypełnienia formularza (`CHECKOUT_FIELDS`). */
export interface SavedCheckout {
  email?: string | null
  shipping_address?: SavedAddress
  billing_address?: SavedAddress
  metadata?: Record<string, unknown> | null
  shipping_methods?:
    | { shipping_option_id?: string | null; data?: Record<string, unknown> | null }[]
    | null
}

const textOf = (value: unknown) => (typeof value === 'string' ? value : '')
const textOrNull = (value: unknown) => (typeof value === 'string' && value ? value : null)

function addressFields(address: SavedAddress): AddressFields {
  return {
    firstName: textOf(fieldOf(address, 'first_name')),
    lastName: textOf(fieldOf(address, 'last_name')),
    address1: textOf(fieldOf(address, 'address_1')),
    postalCode: textOf(fieldOf(address, 'postal_code')),
    city: textOf(fieldOf(address, 'city')),
  }
}

export const sameAddress = (a: AddressFields, b: AddressFields) =>
  ADDRESS_KEYS.every((key) => a[key] === b[key])

/** Formularz z danych zapisanych już w koszyku (np. po powrocie z niedokończonej płatności). */
export function formFromCart(
  cart: SavedCheckout,
  options: { id: string; code: string }[],
): CheckoutForm {
  const shipping = addressFields(cart.shipping_address)
  const billing = addressFields(cart.billing_address)
  const company = textOf(fieldOf(cart.billing_address, 'company'))
  const nip = textOf(cart.metadata?.nip)
  const invoice = Boolean(company || nip)
  const [method] = cart.shipping_methods ?? []
  const option = options.find((o) => o.id === method?.shipping_option_id)
  const locker = option?.code === PARCEL_LOCKER_CODE ? method?.data : null
  const hasBilling = ADDRESS_KEYS.some((key) => billing[key])
  return {
    ...emptyCheckoutForm(),
    email: textOf(cart.email),
    phone: textOf(fieldOf(cart.shipping_address, 'phone')),
    shipping,
    invoice,
    nip,
    company,
    separateBilling: invoice && hasBilling && !sameAddress(billing, shipping),
    billing:
      invoice && hasBilling && !sameAddress(billing, shipping) ? billing : addressFields(null),
    deliveryOptionId: option?.id ?? null,
    deliveryCode: option?.code ?? null,
    parcelLocker: textOrNull(locker?.parcel_locker),
    parcelLockerLabel: textOrNull(locker?.parcel_locker_label),
    // Newsletter nie wraca – zapis odbył się przy pierwszym wysłaniu (część 2 §4.3).
    customerNote: textOf(cart.metadata?.customer_note),
    createAccount: cart.metadata?.create_account === 'tak',
  }
}
