import type { EmailTemplate, RenderContext } from '@cloud-house/medusa-emails'
import { render } from '@react-email/components'
import { createElement, type ReactElement } from 'react'
import { ShipmentEmail, shipmentSubject } from './shipment'
import { ShipmentAlertEmail, shipmentAlertSubject } from './shipment-alert'
import type { ShipmentAlertEmailData, ShipmentEmailData } from './types'

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

/** The two shipping e-mails; put them in the `templates` of the `medusa-emails` provider. */
export const furgonetkaEmailTemplates: EmailTemplate[] = [
  template<ShipmentEmailData>(
    'shipment',
    ShipmentEmail,
    shipmentSubject,
    (data) => `shipment-${data.displayId}`,
  ),
  template<ShipmentAlertEmailData>(
    'shipment-alert',
    ShipmentAlertEmail,
    shipmentAlertSubject,
    (data) => `shipment-alert-${data.displayId ?? 'connection'}-${data.kind}`,
  ),
]
