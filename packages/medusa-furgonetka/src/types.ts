/** The carriers a shipment can use (spec 6d §5.3, §5.6). */
export type Carrier = 'dpd' | 'inpost_courier' | 'inpost_locker'

/** Where the connection to the Furgonetka account stands (spec 6d §5.11). */
export type ConnectionStateName = 'not_configured' | 'not_connected' | 'connected' | 'disconnected'

/** The kind of a parcel template: a parcel-locker size or a plain carton. */
export type TemplateKind = 'locker_a' | 'locker_b' | 'locker_c' | 'box'

/**
 * What a template is used for by default; at most one template per purpose. A purpose is the key of
 * a parcel class the shop declared (`parcelClasses`) or one of the two accessories purposes.
 */
export type TemplatePurpose = string

/** The two purposes every shop has: what is left after the classed items, for a locker and for a courier. */
export const ACCESSORIES_PURPOSES = ['accessories_locker', 'accessories_courier'] as const

/** One parcel of a shipment. Dimensions in whole cm (length × width × height), weight in grams. */
export interface ParcelSpec {
  template_id: string | null
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
}

/**
 * Who gets the shipment. `phone` is `+48…`, `street` is `address_1` + ` ` + `address_2`; `point`
 * (with its `point_label`) replaces the address for a parcel locker.
 */
export interface ShipmentReceiver {
  name: string
  company: string | null
  phone: string
  email: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  point: string | null
  point_label: string | null
}

/** What goes into the shipment of an order: the draft saved in the card, else the suggestion. */
export interface ShipmentPlan {
  carrier: Carrier
  receiver: ShipmentReceiver
  parcels: ParcelSpec[]
  declaredValueCents: number
  pickup: 'courier' | 'drop_off'
}

/** One line of the status history kept on a shipment. */
export interface HistoryEntry {
  at: string
  status: string
  label: string | null
}

/** Names of the two accessories purposes in the panel; classes bring their own labels. */
export const ACCESSORIES_LABELS: Record<(typeof ACCESSORIES_PURPOSES)[number], string> = {
  accessories_locker: 'Akcesoria – paczkomat',
  accessories_courier: 'Akcesoria – kurier',
}

/** The panel's name of a purpose: the label of its parcel class, else the accessories name, else the key. */
export function purposeLabel(purpose: string, classes: { key: string; label: string }[]): string {
  return (
    classes.find((candidate) => candidate.key === purpose)?.label ??
    ACCESSORIES_LABELS[purpose as keyof typeof ACCESSORIES_LABELS] ??
    purpose
  )
}

/**
 * A canceled shipment whose package Furgonetka did not cancel (spec 6d §5.9) – the card's warning,
 * the problem of its row on the list and the refusal of a second shipment.
 */
export const NOT_CANCELED_MESSAGE =
  'Przesyłka w Furgonetce nie została anulowana – anuluj ją w Furgonetce'

/** How the customer-facing texts name a carrier – the same as the delivery options. */
export const CARRIER_NAMES: Record<Carrier, string> = {
  dpd: 'Kurier DPD',
  inpost_courier: 'Kurier InPost',
  inpost_locker: 'Paczkomat InPost',
}

/** What shipping needs to know about an order, amounts in grosze; the plugin adds `parcelClass` to the items. */
export interface ShippingOrder {
  id: string
  displayId: number
  createdAt: Date
  email: string | null
  /** The name on the delivery address; the e-mail or an empty text when there is none. */
  customerName: string
  /** Placed in the shop (has an `order_cart` link) – not a draft order made in the admin. */
  shopOrder: boolean
  paid: boolean
  canceled: boolean
  /** The customer has an account – the e-mail then links the order there. */
  hasAccount: boolean
  /** `shipping_option_type.code` of the delivery method the customer chose. */
  deliveryCode: string | null
  deliveryName: string | null
  /** The parcel locker of a locker order, normalised; `null` for other methods or a bad code. */
  lockerCode: string | null
  lockerLabel: string | null
  address: {
    firstName: string
    lastName: string
    company: string | null
    address1: string | null
    address2: string | null
    postalCode: string | null
    city: string | null
    phone: string | null
  } | null
  items: {
    id: string
    title: string
    /** Colour and size as the shop shows them; `null` when the product has no options to show. */
    variant: string | null
    quantity: number
    productId: string | null
    /** The key of the item's parcel class (`parcelClasses`); `null` for an ordinary item. */
    parcelClass: string | null
  }[]
  /** `item_total`: the items after discounts. */
  itemsTotalCents: number
  fulfillments: {
    id: string
    canceledAt: Date | null
    shippedAt: Date | null
    deliveredAt: Date | null
  }[]
}

/** What `resolveOrder` returns: the order without the parcel classes of its items. */
export type ShippingOrderSource = Omit<ShippingOrder, 'items'> & {
  items: Omit<ShippingOrder['items'][number], 'parcelClass'>[]
}
