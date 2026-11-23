import { sendInvoiceAlert, sendInvoiceEmail } from '../notify'

const OPTIONS = {
  logPrefix: '[Fakturownia]',
  oidPrefix: 'INV-',
  paymentTypes: {},
  accountOrderPath: '/account/orders/:id',
  resolveContact: async () => ({
    email: 'shop@shop.example',
    phone: null,
    hours: null,
    seller: null,
  }),
  resolveOrder: async () => null,
  resolveReturnOrder: async () => null,
  resolveReturn: async () => null,
}

const NOW = new Date('2026-11-06T12:00:00Z')
const ORDER = { id: 'order_1', displayId: 1001 }

function container() {
  const createNotifications = jest.fn().mockResolvedValue([])
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const services: Record<string, unknown> = {
    logger,
    notification: { createNotifications },
    fakturownia: { getOptions: () => OPTIONS },
  }
  return {
    createNotifications,
    container: { resolve: (key: string) => services[key] } as never,
  }
}

describe('sendInvoiceAlert', () => {
  it('keeps the invoice alert key of 6c: order, kind and moment', async () => {
    const { container: c, createNotifications } = container()

    expect(await sendInvoiceAlert(c, ORDER, 'issue', 'Błąd', NOW, undefined, {})).toBe(true)

    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'shop@shop.example',
        template: 'invoice-alert',
        idempotency_key: `invoice-alert:order_1:issue:${NOW.getTime()}`,
      }),
    )
  })

  it('sets two alerts of one order at one moment apart by the suffix (two returns)', async () => {
    const { container: c, createNotifications } = container()

    await sendInvoiceAlert(c, ORDER, 'correction', 'A', NOW, 'return_1', {})
    await sendInvoiceAlert(c, ORDER, 'correction', 'B', NOW, 'return_2', {})

    expect(createNotifications.mock.calls.map(([input]) => input.idempotency_key)).toEqual([
      `invoice-alert:order_1:correction:${NOW.getTime()}:return_1`,
      `invoice-alert:order_1:correction:${NOW.getTime()}:return_2`,
    ])
  })
})

describe('sendInvoiceEmail', () => {
  const ORDER_WITH_ACCOUNT = {
    id: 'order_1',
    displayId: 1001,
    email: 'jan@example.pl',
    totalCents: 12345,
    hasAccount: true,
  }

  it('sends the invoice template with the PDF, the reply-to of the contact and the account link', async () => {
    const { container: c, createNotifications } = container()
    const row = { number: 'FV 1/11/2026' } as never

    await sendInvoiceEmail(c, row, ORDER_WITH_ACCOUNT as never, Buffer.from('%PDF'), 'key-1', {
      STOREFRONT_URL: 'https://shop.example/',
      EMAIL_REPLY_TO: 'reply@shop.example',
    })

    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jan@example.pl',
        template: 'invoice',
        idempotency_key: 'key-1',
        provider_data: { reply_to: 'reply@shop.example' },
        attachments: [
          expect.objectContaining({
            filename: 'Faktura-FV-1-11-2026.pdf',
            content: Buffer.from('%PDF').toString('base64'),
            content_type: 'application/pdf',
          }),
        ],
        data: expect.objectContaining({
          number: 'FV 1/11/2026',
          total: 123.45,
          accountUrl: 'https://shop.example/account/orders/order_1',
        }),
      }),
    )
  })

  it('replies to the contact e-mail when no reply-to is set', async () => {
    const { container: c, createNotifications } = container()

    await sendInvoiceEmail(
      c,
      { number: 'FV 1' } as never,
      ORDER_WITH_ACCOUNT as never,
      Buffer.from('x'),
      'key-2',
      {},
    )

    expect(createNotifications.mock.calls[0][0].provider_data).toEqual({
      reply_to: 'shop@shop.example',
    })
  })
})
