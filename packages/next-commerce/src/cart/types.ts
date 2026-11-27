/** Wynik akcji koszyka – komunikat błędu jest gotowy do pokazania klientowi. */
export type CartActionResult = { ok: true } | { ok: false; message: string }

/** One item to add (`POST /store/carts/:id/line-items` body). */
export interface CartItemInput {
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}
