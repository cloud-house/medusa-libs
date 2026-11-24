import type { EmailTemplate, RenderContext } from '@cloud-house/medusa-emails'
import { render } from '@react-email/components'
import { createElement, type ReactElement } from 'react'
import { ReturnAlertEmail, returnAlertSubject } from './return-alert'
import { ReturnRequestedEmail, returnRequestedSubject } from './return-requested'
import type { ReturnAlertEmailData, ReturnRequestedEmailData } from './types'

/** An e-mail with a fixed `Component`; `subject` and the preview file `name` are read from the data. */
function template<Data>(
  name: string,
  Component: (props: { data: Data; ctx: RenderContext }) => ReactElement,
  subject: (data: Data) => string,
  fileName: (data: Data) => string,
): EmailTemplate {
  return {
    name,
    async render(raw, ctx) {
      const data = raw as unknown as Data
      const element = createElement(Component, { data, ctx })
      return {
        subject: subject(data),
        html: await render(element),
        text: await render(element, { plainText: true }),
        name: fileName(data),
      }
    },
  }
}

/** The two return e-mails; put them in the `templates` of the `medusa-emails` provider. */
export const returnEmailTemplates: EmailTemplate[] = [
  template<ReturnRequestedEmailData>(
    'return-requested',
    ReturnRequestedEmail,
    returnRequestedSubject,
    (data) => `return-requested-${data.displayId}-${data.returnNumber}`,
  ),
  template<ReturnAlertEmailData>(
    'return-alert',
    ReturnAlertEmail,
    returnAlertSubject,
    (data) => `return-alert-${data.displayId}-${data.returnNumber}`,
  ),
]
