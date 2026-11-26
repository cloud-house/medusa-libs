/** The shop's contact data the order e-mail shows; `null` fields are left out. */
export interface CheckoutContact {
  email: string | null
  phone: string | null
  hours: string | null
  /** „Firma, adres, NIP …” – the seller line of the footer. */
  seller: string | null
}

/** A product that does not fit a parcel locker or the InPost courier; `reason` is its parcel class key. */
export interface ParcelBlocker {
  product_id: string
  title: string
  reason: string
}

/** Customer-facing reason a list of blockers closes a delivery method; `null` – nothing blocks it. */
export type BlockReason = (blockers: ParcelBlocker[]) => string | null
