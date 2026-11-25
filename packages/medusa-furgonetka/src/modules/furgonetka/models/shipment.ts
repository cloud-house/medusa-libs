import { model } from '@medusajs/framework/utils'

/**
 * A shipment of one order through Furgonetka (spec 6d §5.6). An order has at most one row that is
 * not `canceled`; the unique index below refuses a second one, so two clicks cannot ship it twice.
 * Amounts are in grosze, weights in grams, dimensions in whole cm (the DML has no decimals).
 */
export const Shipment = model
  .define('shipment', {
    id: model.id({ prefix: 'shp' }).primaryKey(),
    order_id: model.text().index(),
    state: model
      .enum([
        'draft',
        'creating',
        'failed',
        'ready',
        'in_transit',
        'delivered',
        'problem',
        'canceled',
      ])
      .default('draft'),
    carrier: model.enum(['dpd', 'inpost_courier', 'inpost_locker']),
    /** `ShipmentReceiver` (shipping/types.ts). */
    receiver: model.json(),
    /** `ParcelSpec[]` (shipping/types.ts). */
    parcels: model.json(),
    declared_value_cents: model.number(),
    pickup: model.enum(['courier', 'drop_off']).default('courier'),
    pickup_status: model.enum(['none', 'ordered', 'failed']).default('none'),
    pickup_date: model.text().nullable(),
    pickup_from: model.text().nullable(),
    pickup_to: model.text().nullable(),
    pickup_id: model.text().nullable(),
    /** `CHNS-{display_id}`, how the package is found in Furgonetka again. */
    reference: model.text().nullable(),
    package_id: model.text().nullable(),
    order_command_id: model.text().nullable(),
    /** `{ number: string; url: string | null }[]`, one per parcel. */
    tracking: model.json().nullable(),
    cost_cents: model.number().nullable(),
    fulfillment_id: model.text().nullable(),
    tracking_status: model.text().nullable(),
    /** `HistoryEntry[]` (shipping/types.ts). */
    history: model.json().nullable(),
    last_error: model.text().nullable(),
    cancel_error: model.text().nullable(),
    shipped_at: model.dateTime().nullable(),
    delivered_at: model.dateTime().nullable(),
    canceled_at: model.dateTime().nullable(),
    /** The problem the shop was already alerted about. */
    alerted_for: model.text().nullable(),
  })
  .indexes([
    { on: ['order_id'], unique: true, where: "state != 'canceled' AND deleted_at IS NULL" },
  ])
