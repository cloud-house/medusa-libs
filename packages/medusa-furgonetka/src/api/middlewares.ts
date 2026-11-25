import { defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import { AdminSaveParcelTemplate } from './admin/parcel-templates/validators'
import {
  AdminCreateShipments,
  AdminOrderPickups,
  AdminOrderShipment,
  AdminShipmentDraft,
  AdminShipmentPickup,
} from './admin/shipping/validators'

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/parcel-templates',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSaveParcelTemplate)],
    },
    {
      matcher: '/admin/parcel-templates/:id',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSaveParcelTemplate)],
    },
    {
      matcher: '/admin/shipping/shipments',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminCreateShipments)],
    },
    {
      matcher: '/admin/shipping/pickups',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminOrderPickups)],
    },
    {
      matcher: '/admin/orders/:id/shipment/draft',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminShipmentDraft)],
    },
    {
      matcher: '/admin/orders/:id/shipment/create',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminOrderShipment)],
    },
    {
      matcher: '/admin/shipments/:id/pickup',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminShipmentPickup)],
    },
  ],
})
