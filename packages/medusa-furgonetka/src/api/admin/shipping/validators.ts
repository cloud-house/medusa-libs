import { z } from '@medusajs/framework/zod'

const DATE_MESSAGE = 'Podaj datę odbioru jako RRRR-MM-DD.'
const HOURS_MESSAGE = 'Podaj godziny odbioru jako GG:MM, początek przed końcem.'
const ORDERS_MESSAGE = 'Zaznacz od 1 do 50 zamówień.'
const SHIPMENTS_MESSAGE = 'Zaznacz od 1 do 50 przesyłek.'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** `2026-02-30` has the right shape and is no day. */
function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

const WINDOW = {
  date: z
    .string({ error: DATE_MESSAGE })
    .regex(/^\d{4}-\d{2}-\d{2}$/, DATE_MESSAGE)
    .refine(isCalendarDate, DATE_MESSAGE),
  from: z.string({ error: HOURS_MESSAGE }).regex(TIME, HOURS_MESSAGE),
  to: z.string({ error: HOURS_MESSAGE }).regex(TIME, HOURS_MESSAGE),
}
/** `HH:MM` strings compare as times. */
const startsBeforeEnd = (value: { from: string; to: string }) => value.from < value.to

/** A courier pickup: the day and the hours, as `PickupWindow`. */
export const AdminPickupWindow = z
  .object(WINDOW)
  .refine(startsBeforeEnd, { error: HOURS_MESSAGE, path: ['to'] })

/** How a batch hands its parcels over: a courier collects them, or the shop takes them to a point. */
export const AdminPickupChoice = z.discriminatedUnion(
  'type',
  [
    z
      .object({ type: z.literal('courier'), ...WINDOW })
      .refine(startsBeforeEnd, { error: HOURS_MESSAGE, path: ['to'] }),
    z.object({ type: z.literal('drop_off') }),
  ],
  { error: 'Wybierz sposób nadania.' },
)

const ids = (message: string) =>
  z.array(z.string().trim().min(1, message), { error: message }).min(1, message).max(50, message)

/** `POST /admin/shipping/shipments` – the shipments of the selected orders (spec 6d §5.4). */
export const AdminCreateShipments = z.object({
  order_ids: ids(ORDERS_MESSAGE),
  pickup: AdminPickupChoice,
})
export type AdminCreateShipmentsType = z.infer<typeof AdminCreateShipments>

/** `POST /admin/shipping/pickups` – „Zamów odbiór” again for the selected shipments. */
export const AdminOrderPickups = z.object({
  shipment_ids: ids(SHIPMENTS_MESSAGE),
  pickup: AdminPickupWindow,
})
export type AdminOrderPickupsType = z.infer<typeof AdminOrderPickups>

/** `POST /admin/shipments/:id/pickup` – „Zamów odbiór” in the card. */
export const AdminShipmentPickup = z.object({ pickup: AdminPickupWindow })
export type AdminShipmentPickupType = z.infer<typeof AdminShipmentPickup>

const DRAFT_MESSAGE = 'Nieprawidłowe dane przesyłki.'
const text = () => z.string({ error: DRAFT_MESSAGE })
// A field left out is `null`, as the plan the card received has it. The checks of the values
// (sizes, the locker code, the phone) are the draft's own, with their messages.
const optionalText = () => z.string({ error: DRAFT_MESSAGE }).nullable().default(null)
const number = () => z.number({ error: DRAFT_MESSAGE })

/** The plan of the card (`DraftInput`): the shape only – `validateDraft` judges the values. */
export const AdminShipmentDraft = z.object(
  {
    carrier: z.enum(['dpd', 'inpost_courier', 'inpost_locker'], { error: DRAFT_MESSAGE }),
    receiver: z.object(
      {
        name: text(),
        company: optionalText(),
        phone: text(),
        email: optionalText(),
        street: optionalText(),
        postal_code: optionalText(),
        city: optionalText(),
        point: optionalText(),
        point_label: optionalText(),
      },
      { error: DRAFT_MESSAGE },
    ),
    parcels: z.array(
      z.object(
        {
          template_id: optionalText(),
          name: text(),
          kind: z.enum(['locker_a', 'locker_b', 'locker_c', 'box'], { error: DRAFT_MESSAGE }),
          length_cm: number(),
          width_cm: number(),
          height_cm: number(),
          weight_g: number(),
        },
        { error: DRAFT_MESSAGE },
      ),
      { error: DRAFT_MESSAGE },
    ),
    declaredValueCents: number(),
    pickup: z.enum(['courier', 'drop_off'], { error: DRAFT_MESSAGE }),
  },
  { error: DRAFT_MESSAGE },
)
export type AdminShipmentDraftType = z.infer<typeof AdminShipmentDraft>

/** `POST /admin/orders/:id/shipment/create` – the plan of the card and how the parcel leaves. */
export const AdminOrderShipment = z.object({
  draft: AdminShipmentDraft,
  pickup: AdminPickupChoice,
})
export type AdminOrderShipmentType = z.infer<typeof AdminOrderShipment>
