import { sendShipmentAlert } from '../alerts'
import { furgonetkaService } from './shop-options'

let contactAnswer: unknown
const NOW = new Date('2026-11-10T12:00:00.000Z')
const env = {
  MEDUSA_ADMIN_URL: 'https://api.shop.example/app/',
  STOREFRONT_URL: 'https://shop.example',
}

function container() {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const createNotifications = jest.fn().mockResolvedValue([])
  const services: Record<string, unknown> = {
    logger,
    notification: { createNotifications },
    furgonetka: furgonetkaService(contactAnswer),
  }
  return { logger, createNotifications, resolve: (key: string) => services[key] } as never as {
    logger: typeof logger
    createNotifications: typeof createNotifications
  } & Parameters<typeof sendShipmentAlert>[0]
}

beforeEach(() => {
  contactAnswer = { email: 'kontakt@shop.example', phone: null, hours: null, seller: null }
})

describe('sendShipmentAlert', () => {
  it('sends the order alert to the shop contact with a link to the order', async () => {
    const c = container()

    const sent = await sendShipmentAlert(
      c,
      'problem',
      { orderId: 'order_1', displayId: 1001, message: 'Przesyłka wróciła do nadawcy' },
      NOW,
      env,
    )

    expect(sent).toBe(true)
    expect(c.createNotifications).toHaveBeenCalledTimes(1)
    expect(c.createNotifications).toHaveBeenCalledWith({
      to: 'kontakt@shop.example',
      channel: 'email',
      template: 'shipment-alert',
      data: {
        kind: 'problem',
        displayId: 1001,
        message: 'Przesyłka wróciła do nadawcy',
        adminUrl: 'https://api.shop.example/app/orders/order_1',
        shopUrl: 'https://shop.example',
      },
      idempotency_key: `shipment-alert:order_1:problem:${NOW.getTime()}`,
      resource_type: 'order',
      resource_id: 'order_1',
      trigger_type: 'shipment.alert',
    })
  })

  it('sends the lost connection alert with a link to the shipping settings', async () => {
    const c = container()

    const sent = await sendShipmentAlert(
      c,
      'disconnected',
      { orderId: null, displayId: null, message: 'Furgonetka odrzuciła autoryzację' },
      NOW,
      env,
    )

    expect(sent).toBe(true)
    const [notification] = c.createNotifications.mock.calls[0] as [Record<string, unknown>]
    expect(notification).toMatchObject({
      to: 'kontakt@shop.example',
      template: 'shipment-alert',
      data: {
        kind: 'disconnected',
        displayId: null,
        adminUrl: 'https://api.shop.example/app/settings/wysylka',
      },
      idempotency_key: `shipment-alert:connection:disconnected:${NOW.getTime()}`,
    })
    expect(notification).not.toHaveProperty('resource_id')
  })

  it('sends no link without the admin address', async () => {
    const c = container()

    await sendShipmentAlert(
      c,
      'not_canceled',
      { orderId: 'order_1', displayId: 1001, message: 'x' },
      NOW,
      { STOREFRONT_URL: 'https://shop.example' },
    )

    const [notification] = c.createNotifications.mock.calls[0] as [{ data: { adminUrl: unknown } }]
    expect(notification.data.adminUrl).toBeNull()
  })

  it('only logs when the shop has no contact address', async () => {
    contactAnswer = { email: null, phone: null, hours: null, seller: null }
    const c = container()

    const sent = await sendShipmentAlert(
      c,
      'problem',
      { orderId: 'order_1', displayId: 1001, message: 'Przesyłka zaginęła' },
      NOW,
      env,
    )

    expect(sent).toBe(false)
    expect(c.createNotifications).not.toHaveBeenCalled()
    expect(c.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Przesyłka do zamówienia #1001 wymaga uwagi (problem): Przesyłka zaginęła',
      ),
    )
  })

  it('only logs when the contact resolver throws', async () => {
    contactAnswer = new Error('cms down')
    const c = container()

    const sent = await sendShipmentAlert(
      c,
      'problem',
      { orderId: 'order_1', displayId: 1001, message: 'Przesyłka zaginęła' },
      NOW,
      env,
    )

    expect(sent).toBe(false)
    expect(c.createNotifications).not.toHaveBeenCalled()
  })

  it('only logs when the contact cannot be read at all', async () => {
    contactAnswer = null
    const c = container()

    const sent = await sendShipmentAlert(
      c,
      'disconnected',
      { orderId: null, displayId: null, message: 'Furgonetka odrzuciła autoryzację' },
      NOW,
      env,
    )

    expect(sent).toBe(false)
    expect(c.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Połączenie z Furgonetką wymaga uwagi (disconnected)'),
    )
  })
})
