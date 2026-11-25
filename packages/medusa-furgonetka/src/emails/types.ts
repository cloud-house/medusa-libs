/** `canReply` – a Reply-To address is known, so „Odpowiedz na tego maila” makes sense. */
export interface EmailContact {
  canReply: boolean
  email: string | null
  phone: string | null
  hours: string | null
}

/**
 * The "in transit" e-mail (spec 6d §5.8), sent when a fulfillment is marked as shipped. Ready to
 * show – the template queries nothing.
 */
export interface ShipmentEmailData {
  displayId: number
  /** „Kurier DPD”, „Kurier InPost” or „Paczkomat InPost”. */
  carrier: string
  /** One per parcel; empty when the shipment has no number (a manual „Mark as shipped”). */
  parcels: { number: string; url: string | null }[]
  /** Where the parcel goes: „Paczkomat {kod}” with its description, or the receiver and address. */
  destination: { title: string; lines: string[] } | null
  /** „nazwa × ilość” lines of what is in the parcel. */
  items: { name: string; quantity: number }[]
  /** The order in the customer account, `null` for a guest order. */
  accountUrl: string | null
  shopUrl: string
  contact: EmailContact | null
}

/** What needs a person in the shipping setup – one alert per problem (spec 6d §5.11). */
export type ShipmentAlertKind = 'disconnected' | 'problem' | 'not_canceled'

/**
 * Alert to the shop's contact address (spec 6d §5.11). `displayId` is `null` for a problem that
 * belongs to no order (the lost connection); `adminUrl` leads to the order, or for the lost
 * connection to the shipping settings, and is `null` while `MEDUSA_ADMIN_URL` is not set.
 */
export interface ShipmentAlertEmailData {
  kind: ShipmentAlertKind
  displayId: number | null
  message: string
  adminUrl: string | null
  shopUrl: string
}
