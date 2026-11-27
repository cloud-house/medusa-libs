import { type CartClient, cartErrorMessage } from '../cart/client'
import {
  type CheckoutErrors,
  type CheckoutForm,
  type FieldKey,
  PARCEL_LOCKER_CODE,
  toCartUpdate,
  validateCheckout,
} from './form'
import {
  completeCart,
  createPaymentSession,
  runCheckoutCheck,
  setShippingMethod,
  updateCartDetails,
} from './medusa-checkout'

/** Koszyk w kształcie potrzebnym do złożenia zamówienia (`CHECKOUT_FIELDS`). */
export interface CheckoutCart {
  id: string
  payment_collection?: { id: string } | null
}

/** Dodatki wysłania formularza spoza koszyka (część 2 §4.4). */
export interface SubmitOptions {
  /** Zapis na newsletter (źródło „checkout”); błąd tylko w logu. */
  subscribeNewsletter?: (email: string) => Promise<void>
  /** Zalogowany klient – pole „Chcę założyć konto” nie dotyczy, serwer je zeruje. */
  signedIn?: boolean
  /** Prefix of the log lines; default `[Checkout]`. */
  logPrefix?: string
}

export type SubmitResult =
  | { ok: true; provider: string; clientSecret: string }
  | { ok: false; message: string; field?: FieldKey; errors?: CheckoutErrors }

const lockerOf = (form: CheckoutForm) =>
  form.deliveryCode === PARCEL_LOCKER_CODE ? form.parcelLocker : null

/**
 * „Zamawiam i płacę”: formularz → dane koszyka → ostatnie sprawdzenie → sesja płatności Stripe.
 * Problem z koszykiem (np. deska dołożona w innej karcie po wyborze paczkomatu) zatrzymuje
 * zamówienie przed płatnością.
 */
export async function submitCheckoutFlow(
  client: CartClient,
  cart: CheckoutCart,
  form: CheckoutForm,
  now: Date,
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  const errors = validateCheckout(form)
  if (Object.keys(errors).length) return { ok: false, message: 'Popraw zaznaczone pola.', errors }

  // Pole z przeglądarki: zalogowany konta nie zakłada, niezależnie od tego, co przyszło.
  const details = options.signedIn ? { ...form, createAccount: false } : form
  await updateCartDetails(client, cart.id, toCartUpdate(details, now.toISOString()))
  if (form.newsletter && options.subscribeNewsletter) {
    // Zgoda jest niezależna od zamówienia – problem z zapisem nie zatrzymuje płatności.
    await options.subscribeNewsletter(form.email.trim()).catch((error: unknown) => {
      console.error(`${options.logPrefix ?? '[Checkout]'} Zapis na newsletter w kasie:`, error)
    })
  }
  // Wybraną dostawę zapisujemy zawsze jeszcze raz: koszyk mógł mieć inną (zapis wyboru się nie
  // udał) albo tę samą ze starą ceną – odświeżenie po zmianie kodu rabatowego (część 2 §4.5)
  // mogło paść, a po usunięciu kodu koszyk nie ma już promocji, po której dałoby się to poznać.
  if (form.deliveryOptionId) {
    try {
      await setShippingMethod(
        client,
        cart.id,
        form.deliveryOptionId,
        lockerOf(form),
        lockerOf(form) ? form.parcelLockerLabel : null,
      )
    } catch (error) {
      // Odmowa zapisu dostawy (np. paczkomat dla deski) – komunikat przy „Dostawa”, nie przy przycisku.
      return { ok: false, field: 'delivery', message: cartErrorMessage(error) }
    }
  }
  const problem = await runCheckoutCheck(client, cart.id)
  if (problem) return { ok: false, field: problem.field, message: problem.message }

  return { ok: true, ...(await createPaymentSession(client, cart, form.payment)) }
}

export function placeOrderFlow(client: CartClient, cartId: string) {
  return completeCart(client, cartId)
}
