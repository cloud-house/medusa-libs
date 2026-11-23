import { resolveOptions } from '../../options'
import { accountEmailData } from '../account-email-data'

const paths = { confirmEmail: '/a', passwordReset: '/b', setPassword: '/c' }
const logger = { warn: jest.fn() }
const input = { email: 'anna@example.com', firstName: 'Anna', path: '/c?kod=x' }

describe('accountEmailData', () => {
  const env = process.env
  beforeEach(() => {
    process.env = { ...env }
    delete process.env.EMAIL_REPLY_TO
    logger.warn.mockReset()
  })
  afterAll(() => {
    process.env = env
  })

  it('builds the link from the storefront url and the contact from resolveContact', async () => {
    const options = resolveOptions({
      paths,
      storefrontUrl: 'https://shop.example/',
      resolveContact: async () => ({
        email: 'help@shop.example',
        phone: '+48 600 000 000',
        hours: 'Mon-Fri',
        seller: 'Acme Ltd',
      }),
    })

    const { data, replyTo } = await accountEmailData({} as never, options, logger, {
      ...input,
      orderNumber: 1042,
    })

    expect(replyTo).toBe('help@shop.example')
    expect(data).toEqual({
      email: 'anna@example.com',
      firstName: 'Anna',
      actionUrl: 'https://shop.example/c?kod=x',
      contact: {
        canReply: true,
        email: 'help@shop.example',
        phone: '+48 600 000 000',
        hours: 'Mon-Fri',
      },
      seller: 'Acme Ltd',
      shopUrl: 'https://shop.example',
      orderNumber: 1042,
    })
  })

  it('EMAIL_REPLY_TO wins over the contact e-mail', async () => {
    process.env.EMAIL_REPLY_TO = 'reply@shop.example'
    const options = resolveOptions({
      paths,
      storefrontUrl: 'https://shop.example',
      resolveContact: async () => ({
        email: 'help@shop.example',
        phone: null,
        hours: null,
        seller: null,
      }),
    })

    const { replyTo, data } = await accountEmailData({} as never, options, logger, input)

    expect(replyTo).toBe('reply@shop.example')
    expect(data.contact.email).toBe('help@shop.example')
    expect(data.orderNumber).toBeNull()
  })

  it('without resolveContact the contact is empty and the reply-to comes from the env only', async () => {
    const options = resolveOptions({ paths, storefrontUrl: 'https://shop.example' })

    const none = await accountEmailData({} as never, options, logger, input)
    expect(none.replyTo).toBeNull()
    expect(none.data.contact).toEqual({ canReply: false, email: null, phone: null, hours: null })
    expect(none.data.seller).toBeNull()

    process.env.EMAIL_REPLY_TO = 'reply@shop.example'
    const withEnv = await accountEmailData({} as never, options, logger, input)
    expect(withEnv.replyTo).toBe('reply@shop.example')
    expect(withEnv.data.contact).toEqual({ canReply: true, email: null, phone: null, hours: null })
  })

  it('a failing resolver is logged and the e-mail goes without the contact', async () => {
    const options = resolveOptions({
      paths,
      storefrontUrl: 'https://shop.example',
      resolveContact: async () => {
        throw new Error('db down')
      },
    })

    const { data, replyTo } = await accountEmailData({} as never, options, logger, input)

    expect(replyTo).toBeNull()
    expect(data.contact.email).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })

  it('falls back to the local storefront address without a configured url', async () => {
    delete process.env.STOREFRONT_URL
    const options = resolveOptions({ paths })
    const { data } = await accountEmailData({} as never, options, logger, input)
    expect(data.shopUrl).toBe('http://localhost:3200')
    expect(data.actionUrl).toBe('http://localhost:3200/c?kod=x')
  })
})
