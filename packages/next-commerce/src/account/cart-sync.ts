/** What the sign-in needs from the cart cookie and the account (spec 5a §3.6). */
export interface CartSyncDeps {
  cartId: string | null
  /** The browser's cart joins the account; `false` – the cart is gone or completed. */
  attach(cartId: string): Promise<boolean>
  last(): Promise<string | null>
  remember(cartId: string): Promise<void>
  forget(): Promise<void>
}

/** The browser's cart belongs to the customer; without one the account's last open cart returns. */
export async function syncCart(deps: CartSyncDeps): Promise<void> {
  if (deps.cartId) {
    if (await deps.attach(deps.cartId)) return
    await deps.forget()
  }
  const last = await deps.last()
  if (last) await deps.remember(last)
}
