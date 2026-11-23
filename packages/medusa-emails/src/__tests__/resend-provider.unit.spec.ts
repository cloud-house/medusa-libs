import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Resend } from 'resend'
import { EMAIL_ERROR_CODES } from '../errors'
import ResendNotificationService from '../providers/resend/service'
import { testOptions } from './fixtures'

jest.mock('resend', () => {
  const send = jest.fn()
  return { Resend: jest.fn(() => ({ emails: { send } })), __send: send }
})

const send = (jest.requireMock('resend') as { __send: jest.Mock }).__send
const logger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
const notification = (over: Record<string, unknown> = {}) => ({
  to: 'jan@example.com',
  channel: 'email',
  template: 'greeting',
  data: { who: 'Jan' },
  ...over,
})
const PDF = Buffer.from('%PDF-1.4 invoice')
const attachmentNotification = () =>
  notification({
    attachments: [
      {
        filename: 'Invoice-1.pdf',
        content: PDF.toString('base64'),
        content_type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  })
const sendOptions = testOptions({
  apiKey: 're_test',
  from: 'Acme <orders@example.com>',
  replyTo: 'shop@example.com',
  previewDir: '/not-used',
  mode: 'send',
})
const previewOptions = (previewDir: string | null) =>
  testOptions({ apiKey: null, from: null, replyTo: null, previewDir, mode: 'preview' })

describe('ResendNotificationService', () => {
  beforeEach(() => {
    send.mockReset()
    ;(Resend as unknown as jest.Mock).mockClear()
  })

  it('sends the rendered e-mail through Resend with the Reply-To of the notification', async () => {
    send.mockResolvedValue({ data: { id: 'em_1' }, error: null })
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    const result = await service.send(
      notification({ provider_data: { reply_to: 'contact@example.com' } }) as never,
    )

    expect(result).toEqual({ id: 'em_1' })
    expect(Resend).toHaveBeenCalledWith('re_test')
    const payload = send.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      from: 'Acme <orders@example.com>',
      to: 'jan@example.com',
      subject: 'Hello Jan',
      replyTo: 'contact@example.com',
    })
    expect(payload.html).toContain('Hello Jan')
    expect(payload.text).toContain('Hello Jan')
  })

  it('passes the idempotency key of the notification to Resend', async () => {
    send.mockResolvedValue({ data: { id: 'em_3' }, error: null })
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    await service.send(notification({ idempotency_key: 'greeting:1' }) as never)
    await service.send(notification() as never)

    expect(send.mock.calls[0]?.[1]).toEqual({ idempotencyKey: 'greeting:1' })
    expect(send.mock.calls[1]?.[1]).toBeUndefined()
  })

  it('sends attachments as buffers', async () => {
    send.mockResolvedValue({ data: { id: 'em_4' }, error: null })
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    await service.send(attachmentNotification() as never)
    await service.send(notification() as never)

    const [attachment] = send.mock.calls[0]?.[0].attachments ?? []
    expect(attachment).toEqual({
      filename: 'Invoice-1.pdf',
      content: PDF,
      contentType: 'application/pdf',
    })
    expect(send.mock.calls[1]?.[0]).not.toHaveProperty('attachments')
  })

  it('in preview mode writes attachments next to the HTML', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'emails-'))
    const service = new ResendNotificationService({ logger: logger() }, previewOptions(dir))

    await service.send(attachmentNotification() as never)

    expect(readFileSync(join(dir, 'greeting-Jan.html'), 'utf8')).toContain('Hello Jan')
    expect(readFileSync(join(dir, 'greeting-Jan-Invoice-1.pdf'))).toEqual(PDF)
  })

  it('falls back to the configured Reply-To', async () => {
    send.mockResolvedValue({ data: { id: 'em_2' }, error: null })
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    await service.send(notification() as never)

    expect(send.mock.calls[0]?.[0].replyTo).toBe('shop@example.com')
  })

  it('rethrows a Resend error with the emails_not_sent code', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'Invalid from' } })
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    await expect(service.send(notification() as never)).rejects.toMatchObject({
      message: 'Resend: Invalid from',
      code: EMAIL_ERROR_CODES.notSent,
    })
  })

  it('in preview mode writes the HTML and logs instead of sending', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'emails-'))
    const log = logger()
    const service = new ResendNotificationService({ logger: log }, previewOptions(dir))

    expect(await service.send(notification() as never)).toEqual({})

    expect(readFileSync(join(dir, 'greeting-Jan.html'), 'utf8')).toContain('Hello Jan')
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Hello Jan → jan@example.com'))
    expect(Resend).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('without a preview directory (production) a skipped e-mail fails with emails_not_sent', async () => {
    const service = new ResendNotificationService({ logger: logger() }, previewOptions(null))

    await expect(service.send(notification() as never)).rejects.toMatchObject({
      code: EMAIL_ERROR_CODES.notSent,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('has the provider id resend', () => {
    expect(ResendNotificationService.identifier).toBe('resend')
  })

  it('fails with emails_unknown_template for a template not in the list', async () => {
    const service = new ResendNotificationService({ logger: logger() }, sendOptions)

    await expect(service.send(notification({ template: 'nope' }) as never)).rejects.toMatchObject({
      code: EMAIL_ERROR_CODES.unknownTemplate,
    })
  })
})
