import {
  RETURN_MESSAGES,
  type ReturnClaimItemInput,
  type ReturnClaimResponse,
  type ReturnLookupResponse,
} from '@cloud-house/commerce-rules'
import { type AccountClient, statusOf, withToken } from '../account/client'

/**
 * Wywołania Medusy dla zwrotów (spec 6e-b). Tylko po stronie serwera: klient (`accountClient()`)
 * niesie klucz publikowalny, a przeglądarka rozmawia wyłącznie z akcjami serwerowymi.
 */

export type ClaimResult =
  | { ok: true; response: ReturnClaimResponse }
  | { ok: false; message: string }

export interface GuestOrderInput {
  displayId: number
  email: string
}

export interface ClaimInput {
  items: ReturnClaimItemInput[]
  note: string | null
}

const NO_ORDER = 'Nie znaleziono zamówienia.'

/** 400 (zasady zwrotu) i 409 (zgłoszenie już się zapisuje) mają po polsku powód w treści. */
const isRejection = (error: unknown) => [400, 409].includes(statusOf(error) ?? 0)
const reasonOf = (error: unknown) => (error as Error).message

/**
 * Zamówienie gościa po numerze i adresie e-mail (D9). `null`, gdy backend odpowiada 404 – ta sama
 * odpowiedź dla złego numeru i złego e-maila, więc po niej nie widać, czy numer istnieje.
 */
export async function lookupGuestOrder(
  client: AccountClient,
  input: GuestOrderInput,
): Promise<ReturnLookupResponse | null> {
  try {
    return await client.fetch<ReturnLookupResponse>('/store/returns/lookup', {
      method: 'POST',
      body: { display_id: input.displayId, email: input.email },
      cache: 'no-store',
    })
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

/** Zgłoszenie zwrotu przez gościa (numer + e-mail). */
export async function claimGuestReturn(
  client: AccountClient,
  input: GuestOrderInput & ClaimInput,
): Promise<ClaimResult> {
  try {
    const response = await client.fetch<ReturnClaimResponse>('/store/returns/claim', {
      method: 'POST',
      body: {
        display_id: input.displayId,
        email: input.email,
        items: input.items,
        note: input.note,
      },
      cache: 'no-store',
    })
    return { ok: true, response }
  } catch (error) {
    if (isRejection(error)) return { ok: false, message: reasonOf(error) }
    if (statusOf(error) === 404) return { ok: false, message: RETURN_MESSAGES.guestNotFound }
    throw error
  }
}

/** Zgłoszenie zwrotu przez zalogowanego klienta; 401 (koniec sesji) → `SessionExpiredError`. */
export async function claimAccountReturn(
  client: AccountClient,
  token: string,
  orderId: string,
  input: ClaimInput,
): Promise<ClaimResult> {
  try {
    const response = await withToken<ReturnClaimResponse>(
      client,
      token,
      `/store/account/orders/${encodeURIComponent(orderId)}/return`,
      { method: 'POST', body: { items: input.items, note: input.note } },
    )
    return { ok: true, response }
  } catch (error) {
    if (isRejection(error)) return { ok: false, message: reasonOf(error) }
    if (statusOf(error) === 404) return { ok: false, message: NO_ORDER }
    throw error
  }
}
