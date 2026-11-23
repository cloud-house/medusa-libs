import type { EmailTemplate, RenderContext } from '@cloud-house/medusa-emails'
import { render } from '@react-email/components'
import { createElement, type ReactElement } from 'react'
import { EmailConfirmationEmail, emailConfirmationSubject } from './email-confirmation'
import { PasswordResetEmail, passwordResetSubject } from './password-reset'
import { SetPasswordEmail, setPasswordSubject } from './set-password'
import type { AccountEmailData } from './types'

/** An account e-mail: one card with a button; the preview file is named after the recipient. */
function accountTemplate(
  name: string,
  Component: (props: { data: AccountEmailData; ctx: RenderContext }) => ReactElement,
  subject: (ctx: RenderContext) => string,
): EmailTemplate {
  return {
    name,
    async render(raw, ctx) {
      const data = raw as unknown as AccountEmailData
      const element = createElement(Component, { data, ctx })
      return {
        subject: subject(ctx),
        html: await render(element),
        text: await render(element, { plainText: true }),
        name: `${name}-${data.email}`,
      }
    },
  }
}

/** The three account e-mails; put them in the `templates` of the `medusa-emails` provider. */
export const accountEmailTemplates: EmailTemplate[] = [
  accountTemplate('email-confirmation', EmailConfirmationEmail, emailConfirmationSubject),
  accountTemplate('password-reset', PasswordResetEmail, passwordResetSubject),
  accountTemplate('set-password', SetPasswordEmail, setPasswordSubject),
]
