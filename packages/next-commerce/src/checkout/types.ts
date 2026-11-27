import type { CartActionResult } from '../cart/types'
import type { SubmitResult } from './flow'
import type { CheckoutForm } from './form'

/** Wybór dostawy zapisywany od razu w koszyku (kod i opis paczkomatu tylko dla Paczkomatu). */
export interface DeliveryInput {
  optionId: string
  parcelLocker?: string | null
  parcelLockerLabel?: string | null
}

/** Server actions checkoutu – strona dostaje je w props, testy podstawiają atrapy. */
export interface CheckoutActions {
  setDeliveryOption(input: DeliveryInput): Promise<CartActionResult>
  submitCheckout(form: CheckoutForm): Promise<SubmitResult>
  /**
   * Sukces przekierowuje na potwierdzenie – Next odrzuca wtedy obietnicę błędem przekierowania
   * (strona rozpoznaje go `unstable_rethrow`); błąd wraca z komunikatem.
   */
  placeOrder(): Promise<{ ok: false; message: string } | undefined>
}
