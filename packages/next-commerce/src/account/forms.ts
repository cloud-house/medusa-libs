import { isValidNip, normalizeNip, PASSWORD_MIN_LENGTH } from '@cloud-house/commerce-rules'
import { normalizePhone, normalizePostalCode } from '../checkout/form'
import { normalizeEmail } from '../newsletter/email'
import type { AccountAddressInput, RegisterInput } from './client'

/** Result of an account form action (`useActionState`); `values` refill the form after an error. */
export type AccountFormState<F extends string = string> =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | {
      status: 'error'
      values: Partial<Record<F, string>>
      fieldErrors: Partial<Record<F, string>>
      message?: string
    }

export type Validation<F extends string, V> =
  | { ok: true; value: V }
  | { ok: false; fieldErrors: Partial<Record<F, string>>; values: Partial<Record<F, string>> }

export const ACCOUNT_MESSAGES = {
  firstName: 'Podaj imię.',
  lastName: 'Podaj nazwisko.',
  emailMissing: 'Podaj adres e-mail.',
  emailInvalid: 'Sprawdź adres e-mail.',
  phoneMissing: 'Podaj numer telefonu.',
  phoneInvalid: 'Podaj polski numer telefonu (9 cyfr).',
  password: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`,
  terms: 'Zaakceptuj regulamin, żeby założyć konto.',
  required: 'Uzupełnij to pole.',
  postalCode: 'Kod pocztowy w formacie 00-000.',
  nip: 'Sprawdź NIP – suma kontrolna się nie zgadza.',
  company: 'Podaj nazwę firmy.',
  login: 'Nieprawidłowy e-mail lub hasło.',
  duplicate: 'Konto z tym adresem już istnieje – zaloguj się albo ustaw nowe hasło.',
  rateLimited: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
  failed: 'Coś poszło nie tak. Spróbuj ponownie za chwilę.',
  wrongCurrentPassword: 'Obecne hasło jest nieprawidłowe.',
  wrongPassword: 'Nieprawidłowe hasło.',
  expiredLink: 'Link wygasł albo został już użyty.',
} as const

const text = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}
const checked = (form: FormData, name: string) => form.get(name) === 'tak'

/** Typed values to refill the form – never the password. */
function valuesOf<F extends string>(
  form: FormData,
  fields: readonly F[],
): Partial<Record<F, string>> {
  return Object.fromEntries(
    fields.filter((f) => f !== 'password').map((f) => [f, text(form, f)]),
  ) as Partial<Record<F, string>>
}

function phoneError(phone: string): string | undefined {
  if (!phone) return ACCOUNT_MESSAGES.phoneMissing
  return normalizePhone(phone) ? undefined : ACCOUNT_MESSAGES.phoneInvalid
}

export function passwordError(password: string): string | undefined {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= 128
    ? undefined
    : ACCOUNT_MESSAGES.password
}

export const REGISTER_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'password',
  'terms',
  'newsletter',
] as const
export type RegisterField = (typeof REGISTER_FIELDS)[number]

export function validateRegistration(
  form: FormData,
): Validation<RegisterField, RegisterInput & { newsletter: boolean }> {
  const firstName = text(form, 'firstName')
  const lastName = text(form, 'lastName')
  const rawEmail = text(form, 'email')
  const email = normalizeEmail(rawEmail)
  const phone = text(form, 'phone')
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : ''
  const errors: Partial<Record<RegisterField, string>> = {}
  if (!firstName) errors.firstName = ACCOUNT_MESSAGES.firstName
  if (!lastName) errors.lastName = ACCOUNT_MESSAGES.lastName
  if (!rawEmail) errors.email = ACCOUNT_MESSAGES.emailMissing
  else if (!email) errors.email = ACCOUNT_MESSAGES.emailInvalid
  const phoneProblem = phoneError(phone)
  if (phoneProblem) errors.phone = phoneProblem
  const passwordProblem = passwordError(password)
  if (passwordProblem) errors.password = passwordProblem
  if (!checked(form, 'terms')) errors.terms = ACCOUNT_MESSAGES.terms
  if (Object.keys(errors).length || !email) {
    return { ok: false, fieldErrors: errors, values: valuesOf(form, REGISTER_FIELDS) }
  }
  return {
    ok: true,
    value: {
      firstName,
      lastName,
      email,
      phone: normalizePhone(phone) as string,
      password,
      newsletter: checked(form, 'newsletter'),
    },
  }
}

export const ADDRESS_FORM_FIELDS = [
  'addressName',
  'firstName',
  'lastName',
  'address1',
  'postalCode',
  'city',
  'company',
  'nip',
  'defaultShipping',
  'defaultBilling',
] as const
export type AddressFormField = (typeof ADDRESS_FORM_FIELDS)[number]

const REQUIRED_ADDRESS = ['firstName', 'lastName', 'address1', 'postalCode', 'city'] as const

export function validateAddressForm(
  form: FormData,
): Validation<AddressFormField, AccountAddressInput> {
  const errors: Partial<Record<AddressFormField, string>> = {}
  for (const field of REQUIRED_ADDRESS) {
    if (!text(form, field)) errors[field] = ACCOUNT_MESSAGES.required
  }
  const postalCode = normalizePostalCode(text(form, 'postalCode'))
  if (text(form, 'postalCode') && !postalCode) errors.postalCode = ACCOUNT_MESSAGES.postalCode
  const nip = text(form, 'nip')
  const company = text(form, 'company')
  if (nip && !isValidNip(nip)) errors.nip = ACCOUNT_MESSAGES.nip
  if (nip && !company) errors.company = ACCOUNT_MESSAGES.company
  if (Object.keys(errors).length || !postalCode) {
    return { ok: false, fieldErrors: errors, values: valuesOf(form, ADDRESS_FORM_FIELDS) }
  }
  return {
    ok: true,
    value: {
      address_name: text(form, 'addressName') || null,
      first_name: text(form, 'firstName'),
      last_name: text(form, 'lastName'),
      address_1: text(form, 'address1'),
      postal_code: postalCode,
      city: text(form, 'city'),
      country_code: 'pl',
      company: company || null,
      metadata: { nip: nip ? normalizeNip(nip) : '' },
      is_default_shipping: checked(form, 'defaultShipping'),
      is_default_billing: checked(form, 'defaultBilling'),
    },
  }
}

export const PROFILE_FIELDS = ['firstName', 'lastName', 'phone'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]

export function validateProfileForm(
  form: FormData,
): Validation<ProfileField, { first_name: string; last_name: string; phone: string }> {
  const firstName = text(form, 'firstName')
  const lastName = text(form, 'lastName')
  const phone = text(form, 'phone')
  const errors: Partial<Record<ProfileField, string>> = {}
  if (!firstName) errors.firstName = ACCOUNT_MESSAGES.firstName
  if (!lastName) errors.lastName = ACCOUNT_MESSAGES.lastName
  const phoneProblem = phoneError(phone)
  if (phoneProblem) errors.phone = phoneProblem
  if (Object.keys(errors).length) {
    return { ok: false, fieldErrors: errors, values: valuesOf(form, PROFILE_FIELDS) }
  }
  return {
    ok: true,
    value: { first_name: firstName, last_name: lastName, phone: normalizePhone(phone) as string },
  }
}
