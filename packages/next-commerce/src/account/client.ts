import type {
  AccountCartResponse,
  AccountOrderDetail,
  AccountOrderListItem,
  AccountProfile,
  ConfirmEmailResponse,
  SetPasswordResponse,
} from '@cloud-house/commerce-rules'
import type { AddressFields } from '../checkout/form'
import { normalizeEmail } from '../newsletter/email'

export interface AccountFetchInit {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
  cache?: 'no-store'
}

/** The SDK client (`getSdk().client`) – tests pass `fakeClient`. */
export interface AccountClient {
  fetch<T>(path: string, init?: AccountFetchInit): Promise<T>
}

/** Medusa rejected the customer token (expired, older than a password change, deleted account). */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sesja wygasła.')
    this.name = 'SessionExpiredError'
  }
}

export interface SavedAddress {
  id: string
  name: string | null
  fields: AddressFields
  company: string | null
  nip: string | null
  defaultShipping: boolean
  defaultBilling: boolean
}

/** Body of `POST /store/customers/me/addresses` (country always Poland). */
export interface AccountAddressInput {
  address_name: string | null
  first_name: string
  last_name: string
  address_1: string
  postal_code: string
  city: string
  country_code: 'pl'
  company: string | null
  metadata: { nip: string }
  is_default_shipping: boolean
  is_default_billing: boolean
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}

type MedusaAddress = {
  id: string
  address_name?: string | null
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  postal_code?: string | null
  city?: string | null
  company?: string | null
  metadata?: Record<string, unknown> | null
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

export const statusOf = (error: unknown) => (error as { status?: number } | null)?.status
const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

/** Authenticated call – a 401 means the session is over. */
export async function withToken<T>(
  client: AccountClient,
  token: string,
  path: string,
  init: AccountFetchInit = {},
) {
  try {
    return await client.fetch<T>(path, {
      ...init,
      headers: { ...init.headers, ...bearer(token) },
      cache: 'no-store',
    })
  } catch (error) {
    if (statusOf(error) === 401) throw new SessionExpiredError()
    throw error
  }
}

export async function login(client: AccountClient, email: string, password: string) {
  const normalized = normalizeEmail(email)
  if (!normalized || !password) return null
  try {
    const { token } = await client.fetch<{ token?: string }>('/auth/customer/emailpass', {
      method: 'POST',
      body: { email: normalized, password },
      cache: 'no-store',
    })
    return typeof token === 'string' ? token : null
  } catch (error) {
    if (statusOf(error) === 401) return null
    throw error
  }
}

export async function register(
  client: AccountClient,
  input: RegisterInput,
): Promise<'ok' | 'duplicate'> {
  try {
    await client.fetch('/store/account/register', {
      method: 'POST',
      body: {
        email: normalizeEmail(input.email) ?? input.email,
        password: input.password,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
      },
      cache: 'no-store',
    })
    return 'ok'
  } catch (error) {
    if (statusOf(error) === 422) return 'duplicate'
    throw error
  }
}

export async function registerFromOrder(
  client: AccountClient,
  input: { orderId: string; cartId: string; password: string },
): Promise<{ status: 'ok'; email: string } | { status: 'duplicate' | 'not-found' }> {
  try {
    const { customer } = await client.fetch<{ customer: { email: string } }>(
      '/store/account/register-from-order',
      {
        method: 'POST',
        body: { order_id: input.orderId, cart_id: input.cartId, password: input.password },
        cache: 'no-store',
      },
    )
    return { status: 'ok', email: customer.email }
  } catch (error) {
    if (statusOf(error) === 422) return { status: 'duplicate' }
    if (statusOf(error) === 404) return { status: 'not-found' }
    throw error
  }
}

/**
 * „Ustaw hasło” z maila po zamówieniu z „Chcę założyć konto” (spec 5a część 2 §6): bez sesji,
 * dostęp daje kod. 400 – link wygasł, został użyty albo nie należy do konta czekającego na hasło.
 */
export async function setPasswordFromLink(
  client: AccountClient,
  code: string,
  password: string,
): Promise<SetPasswordResponse | null> {
  try {
    return await client.fetch<SetPasswordResponse>('/store/account/set-password', {
      method: 'POST',
      body: { code, password },
      cache: 'no-store',
    })
  } catch (error) {
    if (statusOf(error) === 400) return null
    throw error
  }
}

export async function requestPasswordReset(client: AccountClient, email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return
  await client.fetch('/auth/customer/emailpass/reset-password', {
    method: 'POST',
    body: { identifier: normalized },
    // Medusa odpowiada 201 z tekstem „Created” – bez tego SDK parsuje odpowiedź jako JSON.
    headers: { accept: 'text/plain' },
    cache: 'no-store',
  })
}

/** The token from the e-mail link; `false` when it expired or was already used. */
export async function setNewPassword(client: AccountClient, resetToken: string, password: string) {
  try {
    await client.fetch('/auth/customer/emailpass/update', {
      method: 'POST',
      body: { password },
      headers: bearer(resetToken),
      cache: 'no-store',
    })
    return true
  } catch (error) {
    if (statusOf(error) === 401 || statusOf(error) === 400) return false
    throw error
  }
}

export async function profile(
  client: AccountClient,
  token: string,
): Promise<AccountProfile | null> {
  try {
    return (await withToken<{ customer: AccountProfile }>(client, token, '/store/account/profile'))
      .customer
  } catch (error) {
    if (error instanceof SessionExpiredError) return null
    throw error
  }
}

export async function orders(
  client: AccountClient,
  token: string,
): Promise<AccountOrderListItem[]> {
  return (
    await withToken<{ orders: AccountOrderListItem[] }>(client, token, '/store/account/orders')
  ).orders
}

/**
 * PDF faktury zamówienia konta (spec 6c §5.8). Z `accept` innym niż JSON SDK oddaje surową
 * odpowiedź – route handler przekazuje ją dalej strumieniem. 404 (brak faktury, cudze) – `null`.
 */
export async function invoicePdf(
  client: AccountClient,
  token: string,
  id: string,
): Promise<Response | null> {
  try {
    return await withToken<Response>(
      client,
      token,
      `/store/account/orders/${encodeURIComponent(id)}/invoice`,
      { headers: { accept: 'application/pdf' } },
    )
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export async function order(
  client: AccountClient,
  token: string,
  id: string,
): Promise<AccountOrderDetail | null> {
  try {
    return (
      await withToken<{ order: AccountOrderDetail }>(
        client,
        token,
        `/store/account/orders/${encodeURIComponent(id)}`,
      )
    ).order
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export function toSavedAddress(address: MedusaAddress): SavedAddress {
  const nip = address.metadata?.nip
  return {
    id: address.id,
    name: address.address_name || null,
    fields: {
      firstName: address.first_name ?? '',
      lastName: address.last_name ?? '',
      address1: address.address_1 ?? '',
      postalCode: address.postal_code ?? '',
      city: address.city ?? '',
    },
    company: address.company || null,
    nip: typeof nip === 'string' && nip ? nip : null,
    defaultShipping: Boolean(address.is_default_shipping),
    defaultBilling: Boolean(address.is_default_billing),
  }
}

export async function addresses(client: AccountClient, token: string): Promise<SavedAddress[]> {
  const { addresses } = await withToken<{ addresses: MedusaAddress[] }>(
    client,
    token,
    '/store/customers/me/addresses',
    { query: { limit: '50' } },
  )
  return addresses.map(toSavedAddress)
}

export async function saveAddress(
  client: AccountClient,
  token: string,
  input: AccountAddressInput,
  id?: string,
): Promise<void> {
  const path = id
    ? `/store/customers/me/addresses/${encodeURIComponent(id)}`
    : '/store/customers/me/addresses'
  await withToken(client, token, path, { method: 'POST', body: input })
}

export async function deleteAddress(client: AccountClient, token: string, id: string) {
  await withToken(client, token, `/store/customers/me/addresses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function updateProfile(
  client: AccountClient,
  token: string,
  input: { first_name: string; last_name: string; phone: string },
): Promise<void> {
  await withToken(client, token, '/store/customers/me', { method: 'POST', body: input })
}

export async function changePassword(
  client: AccountClient,
  token: string,
  current: string,
  next: string,
): Promise<'ok' | 'wrong-password'> {
  try {
    await withToken(client, token, '/store/account/password', {
      method: 'POST',
      body: { current_password: current, new_password: next },
    })
    return 'ok'
  } catch (error) {
    if (statusOf(error) === 400) return 'wrong-password'
    throw error
  }
}

export async function endOtherSessions(client: AccountClient, token: string): Promise<void> {
  await withToken(client, token, '/store/account/sessions/end-others', { method: 'POST', body: {} })
}

export async function deleteAccount(
  client: AccountClient,
  token: string,
  password: string,
): Promise<'ok' | 'wrong-password'> {
  try {
    await withToken(client, token, '/store/account/delete', { method: 'POST', body: { password } })
    return 'ok'
  } catch (error) {
    if (statusOf(error) === 400) return 'wrong-password'
    throw error
  }
}

export async function resendConfirmation(
  client: AccountClient,
  token: string,
): Promise<'sent' | 'confirmed' | 'throttled'> {
  try {
    const { sent } = await withToken<{ sent: boolean }>(
      client,
      token,
      '/store/account/email-confirmation',
      { method: 'POST', body: {} },
    )
    return sent ? 'sent' : 'confirmed'
  } catch (error) {
    // Backend: najwyżej 3 maile na 15 minut na adres (każdy nowy link unieważnia poprzedni).
    if (statusOf(error) === 429) return 'throttled'
    throw error
  }
}

/**
 * The code from the e-mail link, confirmed by the signed-in owner of the account – a link alone
 * (a mail scanner, someone who did not create the account) confirms nothing. `null` – expired,
 * used or not this account's link.
 */
export async function confirmEmail(
  client: AccountClient,
  token: string,
  code: string,
): Promise<ConfirmEmailResponse | null> {
  try {
    return await withToken<ConfirmEmailResponse>(client, token, '/store/account/confirm-email', {
      method: 'POST',
      body: { code },
    })
  } catch (error) {
    if (statusOf(error) === 400) return null
    throw error
  }
}

/** The browser's cart belongs to the customer; `false` – the cart is gone or completed. */
export async function attachCart(client: AccountClient, token: string, cartId: string) {
  try {
    await withToken<AccountCartResponse>(client, token, '/store/account/cart', {
      method: 'POST',
      body: { cart_id: cartId },
    })
    return true
  } catch (error) {
    if (statusOf(error) === 404) return false
    throw error
  }
}

export async function lastCart(client: AccountClient, token: string): Promise<string | null> {
  return (await withToken<AccountCartResponse>(client, token, '/store/account/cart')).cart_id
}
