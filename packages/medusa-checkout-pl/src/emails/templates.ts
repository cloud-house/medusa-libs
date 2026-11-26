import type { EmailTemplate } from '@cloud-house/medusa-emails'
import { render } from '@react-email/components'
import { createElement } from 'react'
import { OrderPlacedEmail, orderPlacedSubject, SUM_ROW, WAS_PRICE } from './order-placed'
import type { OrderPlacedEmailData } from './types'

/** The part of the html-to-text block builder the plain-text formatters use. */
type TextBuilder = {
  openBlock(options: { leadingLineBreaks: number }): void
  addInline(text: string): void
  closeBlock(options: { trailingLineBreaks: number }): void
}

/** A struck-through price means nothing in plain text – say it is the price before the discount. */
function wasPrice(
  elem: { children: unknown[] },
  walk: (nodes: unknown[], builder: TextBuilder) => void,
  builder: TextBuilder,
) {
  builder.openBlock({ leadingLineBreaks: 2 })
  builder.addInline('przed rabatem ')
  walk(elem.children, builder)
  builder.closeBlock({ trailingLineBreaks: 2 })
}

const orderPlaced: EmailTemplate = {
  name: 'order-placed',
  async render(raw, ctx) {
    const data = raw as unknown as OrderPlacedEmailData
    const element = createElement(OrderPlacedEmail, { data, ctx })
    return {
      subject: orderPlacedSubject(data),
      html: await render(element),
      text: await render(element, {
        plainText: true,
        htmlToTextOptions: {
          formatters: { wasPrice },
          selectors: [
            { selector: `table.${SUM_ROW}`, format: 'dataTable', options: { colSpacing: 2 } },
            { selector: `p.${WAS_PRICE}`, format: 'wasPrice' },
          ],
        },
      }),
      name: `order-placed-${data.displayId}`,
    }
  },
}

/** The order confirmation e-mail; put it in the `templates` of the `medusa-emails` provider. */
export const checkoutEmailTemplates: EmailTemplate[] = [orderPlaced]
