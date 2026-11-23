import type { EmailTemplate, RenderContext } from '@cloud-house/medusa-emails'
import { render } from '@react-email/components'
import { createElement, type ReactElement } from 'react'
import type { InvoiceAlertEmailData, InvoiceEmailData } from '../types'
import { InvoiceEmail, invoiceSubject } from './invoice'
import { InvoiceAlertEmail, invoiceAlertSubject } from './invoice-alert'

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

/** The two invoice e-mails; put them in the `templates` of the `medusa-emails` provider. */
export const invoiceEmailTemplates: EmailTemplate[] = [
  template<InvoiceEmailData>(
    'invoice',
    InvoiceEmail,
    invoiceSubject,
    (data) => `invoice-${data.displayId}`,
  ),
  template<InvoiceAlertEmailData>(
    'invoice-alert',
    InvoiceAlertEmail,
    invoiceAlertSubject,
    (data) => `invoice-alert-${data.displayId}-${data.kind}`,
  ),
]
