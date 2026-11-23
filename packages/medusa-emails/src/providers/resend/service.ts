import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types'
import { AbstractNotificationProviderService, MedusaError } from '@medusajs/framework/utils'
import { Resend } from 'resend'
import { EMAIL_ERROR_CODES } from '../../errors'
import { type EmailsOptions, type ResolvedEmailsOptions, resolveOptions } from '../../options'
import { renderEmail } from '../../render'

type InjectedDependencies = { logger: Pick<Logger, 'info' | 'warn' | 'error'> }

const notSent = (message: string) =>
  new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message, EMAIL_ERROR_CODES.notSent)

/**
 * E-mail channel of the Notification module: renders the template and sends it through Resend,
 * or – without a key or a sender – logs it and saves the HTML to the preview directory.
 */
class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = 'resend'

  protected readonly logger: InjectedDependencies['logger']
  protected readonly options: ResolvedEmailsOptions
  protected readonly client: Resend | null

  constructor({ logger }: InjectedDependencies, options: EmailsOptions) {
    super()
    this.logger = logger
    this.options = resolveOptions(options)
    this.client =
      this.options.mode === 'send' && this.options.apiKey ? new Resend(this.options.apiKey) : null
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const email = await renderEmail(this.options, notification.template, notification.data ?? {})
    // Attachments (e.g. an invoice PDF) travel base64-encoded (not stored by the module).
    const attachments = (notification.attachments ?? []).map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, 'base64'),
      contentType: attachment.content_type,
    }))
    if (!this.client || !this.options.from) {
      // Production without sending: fail the notification (visible), keep customer data off disk.
      if (!this.options.previewDir) {
        throw notSent('E-mail not sent: no Resend API key or from address and no preview directory')
      }
      await mkdir(this.options.previewDir, { recursive: true })
      const file = join(this.options.previewDir, `${email.name}.html`)
      await writeFile(file, email.html)
      for (const attachment of attachments) {
        await writeFile(
          join(this.options.previewDir, `${email.name}-${attachment.filename}`),
          attachment.content,
        )
      }
      this.logger.info(
        `[${this.options.theme.shopName}] E-mail not sent (no Resend API key or from address): ${email.subject} → ${notification.to} (${file})`,
      )
      return {}
    }

    const replyTo = notification.provider_data?.reply_to
    // The module hands the provider the whole notification, the key included (not in the DTO type).
    // Medusa 2.21 retries a failed key under a fresh id, so Resend's own key stops a second mail.
    const { idempotency_key: key } = notification as { idempotency_key?: string | null }
    const { data, error } = await this.client.emails.send(
      {
        from: this.options.from,
        to: notification.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: typeof replyTo === 'string' ? replyTo : (this.options.replyTo ?? undefined),
        ...(attachments.length ? { attachments } : {}),
      },
      key ? { idempotencyKey: key } : undefined,
    )
    // The SDK reports API errors in the result – a thrown error marks the notification as failed.
    if (error) throw notSent(`Resend: ${error.message}`)
    return { id: data?.id }
  }
}

export default ResendNotificationService
