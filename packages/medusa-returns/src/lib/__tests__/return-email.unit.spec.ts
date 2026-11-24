import type { ReturnContact } from '../../types'
import { loadReturnEmails } from '../return-email'

const loadReturnOrder = jest.fn()
const loadReturn = jest.fn()
jest.mock('../return-row', () => ({
  loadReturn: (...args: unknown[]) => loadReturn(...args),
}))

const loadShopContact = jest.fn()

const CONTACT: ReturnContact = {
  email: 'sklep@shop.example',
  phone: '+48 600 100 200',
  hours: 'pn–pt 9–16',
  seller: 'Acme Shop sp. z o.o.',
  returnDays: 30,
  returnAddress: ['Acme Shop – zwroty', 'ul. Portowa 3', '80-002 Gdańsk'],
}

const ORDER = {
  id: 'order_1',
  displayId: 1001,
  email: 'jan@example.pl',
  shopOrder: true,
  canceled: false,
  fulfillments: [],
  returns: [],
  items: [
    { id: 'item_a', title: 'Allround Wave', variant: 'Turkus · 10\'6"', thumbnail: null },
    { id: 'item_b', title: 'Pompka elektryczna 12 V', variant: null, thumbnail: null },
  ],
}

const RETURN = {
  id: 'ret_1',
  displayId: 3,
  orderId: 'order_1',
  status: 'requested',
  requestedAt: null,
  receivedAt: null,
  noNotification: false,
  items: [
    { itemId: 'item_a', quantity: 1, receivedQuantity: 0, reason: 'defect', note: null },
    { itemId: 'item_b', quantity: 2, receivedQuantity: 0, reason: 'inne', note: 'Nie działa' },
  ],
}

function container(hasAccount = false) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const graph = jest.fn().mockResolvedValue({
    data: [{ id: 'order_1', customer: { has_account: hasAccount } }],
  })
  return {
    logger,
    graph,
    resolve: (key: string) =>
      ({
        logger,
        query: { graph },
        shopReturns: {
          getOptions: () => ({
            resolveOrder: (...args: unknown[]) => loadReturnOrder(...args),
            resolveContact: (...args: unknown[]) => loadShopContact(...args),
            logPrefix: '[Shop]',
            labelPath: '/zwrot/etykieta?zamowienie=:displayId',
            accountOrderPath: '/konto/zamowienia/:id',
          }),
        },
      })[key],
  }
}

const ENV: Record<string, string | undefined> = {
  STOREFRONT_URL: 'https://sklep.test/',
  MEDUSA_ADMIN_URL: ' https://api.sklep.test/app// ',
}

const load = (
  c: ReturnType<typeof container>,
  orderId = 'order_1',
  returnId = 'ret_1',
  env = ENV,
) => loadReturnEmails(c as never, orderId, returnId, env)

describe('loadReturnEmails', () => {
  beforeEach(() => {
    loadReturnOrder.mockReset().mockResolvedValue(ORDER)
    loadReturn.mockReset().mockResolvedValue(RETURN)
    loadShopContact.mockReset().mockResolvedValue(CONTACT)
  })

  it('builds the customer e-mail and the shop alert from the order, the return and the CMS', async () => {
    const { customer, staff } = await load(container(true))

    expect(customer).toEqual({
      to: 'jan@example.pl',
      replyTo: 'sklep@shop.example',
      data: {
        displayId: 1001,
        returnNumber: 3,
        items: [
          {
            name: 'Allround Wave',
            variant: 'Turkus · 10\'6"',
            quantity: 1,
            reason: 'Wada / uszkodzenie',
          },
          // An unknown reason code has no label.
          { name: 'Pompka elektryczna 12 V', variant: null, quantity: 2, reason: null },
        ],
        address: ['Acme Shop – zwroty', 'ul. Portowa 3', '80-002 Gdańsk'],
        labelUrl: 'https://sklep.test/zwrot/etykieta?zamowienie=1001',
        accountUrl: 'https://sklep.test/konto/zamowienia/order_1',
        shopUrl: 'https://sklep.test',
        contact: {
          canReply: true,
          email: 'sklep@shop.example',
          phone: '+48 600 100 200',
          hours: 'pn–pt 9–16',
        },
        seller: 'Acme Shop sp. z o.o.',
      },
    })
    expect(staff).toEqual({
      to: 'sklep@shop.example',
      data: {
        displayId: 1001,
        returnNumber: 3,
        orderId: 'order_1',
        email: 'jan@example.pl',
        items: customer?.data.items,
        note: 'Nie działa',
        adminUrl: 'https://api.sklep.test/app/orders/order_1',
        shopUrl: 'https://sklep.test',
      },
    })
  })

  it('a guest order has no account link', async () => {
    const { customer } = await load(container(false))

    expect(customer?.data.accountUrl).toBeNull()
  })

  it('does not touch the CMS address list it was given', async () => {
    const address = [...(CONTACT.returnAddress as string[])]
    loadShopContact.mockResolvedValue({ ...CONTACT, returnAddress: Object.freeze(address) })

    const { customer } = await load(container())

    expect(customer?.data.address).toEqual(address)
  })

  it('an order outside the shop gets nothing', async () => {
    loadReturnOrder.mockResolvedValue({ ...ORDER, shopOrder: false })
    const c = container()

    expect(await load(c)).toEqual({ customer: null, staff: null })
    expect(loadShopContact).not.toHaveBeenCalled()
  })

  it('an unknown order, an unknown return and a return of another order get nothing', async () => {
    loadReturnOrder.mockResolvedValue(null)
    expect(await load(container())).toEqual({ customer: null, staff: null })

    loadReturnOrder.mockResolvedValue(ORDER)
    loadReturn.mockResolvedValue(null)
    expect(await load(container())).toEqual({ customer: null, staff: null })

    loadReturn.mockResolvedValue({ ...RETURN, orderId: 'order_2' })
    expect(await load(container())).toEqual({ customer: null, staff: null })
  })

  it('a silenced return still alerts the shop', async () => {
    loadReturn.mockResolvedValue({ ...RETURN, noNotification: true })

    const { customer, staff } = await load(container())

    expect(customer).toBeNull()
    expect(staff?.to).toBe('sklep@shop.example')
  })

  it('an order without an e-mail has no customer mail; the alert goes without the address', async () => {
    loadReturnOrder.mockResolvedValue({ ...ORDER, email: null })

    const { customer, staff } = await load(container())

    expect(customer).toBeNull()
    expect(staff?.data.email).toBeNull()
  })

  it('without the shop contact e-mail there is no alert, and the log says so', async () => {
    loadShopContact.mockResolvedValue({ ...CONTACT, email: null })
    const c = container()

    const { customer, staff } = await load(c)

    expect(staff).toBeNull()
    expect(customer?.to).toBe('jan@example.pl')
    expect(c.logger.error).toHaveBeenCalledWith(
      '[Shop] Zwrot #3 zamówienia #1001 – brak e-maila kontaktowego sklepu, alert nie wyszedł.',
    )
  })

  it('an unreachable CMS: the customer mail has no address and no contact, the alert is skipped', async () => {
    loadShopContact.mockResolvedValue(null)
    const c = container()

    const { customer, staff } = await load(c)

    expect(staff).toBeNull()
    expect(customer?.data.address).toBeNull()
    expect(customer?.data.contact).toEqual({
      canReply: false,
      email: null,
      phone: null,
      hours: null,
    })
    expect(customer?.data.seller).toBeNull()
    expect(customer?.replyTo).toBeNull()
    expect(c.logger.error).toHaveBeenCalledTimes(1)
  })

  it('EMAIL_REPLY_TO wins over the shop contact as the Reply-To', async () => {
    const { customer } = await load(container(), 'order_1', 'ret_1', {
      ...ENV,
      EMAIL_REPLY_TO: 'obsluga@shop.example',
    })

    expect(customer?.replyTo).toBe('obsluga@shop.example')
  })

  it('the alert carries the first note among the lines, and none when there is none', async () => {
    loadReturn.mockResolvedValue({
      ...RETURN,
      items: [
        { ...RETURN.items[0], note: null },
        { ...RETURN.items[1], note: 'Pierwsza' },
        { ...RETURN.items[1], note: 'Druga' },
      ],
    })
    expect((await load(container())).staff?.data.note).toBe('Pierwsza')

    loadReturn.mockResolvedValue({
      ...RETURN,
      items: RETURN.items.map((i) => ({ ...i, note: null })),
    })
    expect((await load(container())).staff?.data.note).toBeNull()
  })

  it('without MEDUSA_ADMIN_URL the alert has no panel link', async () => {
    const { staff } = await load(container(), 'order_1', 'ret_1', {
      STOREFRONT_URL: 'https://sklep.test',
    })

    expect(staff?.data.adminUrl).toBeNull()
  })

  it('a contact resolver that throws: the customer gets the mail without contact data, the log says so', async () => {
    const c = container()
    loadShopContact.mockRejectedValue(new Error('boom'))

    const { customer, staff } = await load(c)

    expect(staff).toBeNull()
    expect(customer?.to).toBe('jan@example.pl')
    expect(customer?.data.contact).toMatchObject({ canReply: false, email: null })
    expect(c.logger.warn).toHaveBeenCalledWith(
      '[Shop] Zwrot #3 – kontakt sklepu niedostępny, e-mail wyjdzie bez danych kontaktowych.',
    )
  })

  it('a return created with no_notification alerts the shop but not the customer', async () => {
    loadReturn.mockResolvedValue({ ...RETURN, noNotification: true })

    const { customer, staff } = await load(container())

    expect(customer).toBeNull()
    expect(staff?.to).toBe('sklep@shop.example')
  })

  it('an order not placed in the shop gets no e-mails', async () => {
    loadReturnOrder.mockResolvedValue({ ...ORDER, shopOrder: false })

    expect(await load(container())).toEqual({ customer: null, staff: null })
  })
})
