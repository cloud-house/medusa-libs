import { render, Text } from '@react-email/components'
import { EmailLayout } from '../layout'
import { type EmailsOptions, resolveOptions } from '../options'
import type { EmailTemplate, RenderContext } from '../types'

/** Template used by the tests: `{ name, to }` in, a layout with one paragraph out. */
export const greeting: EmailTemplate = {
  name: 'greeting',
  async render(data, ctx: RenderContext) {
    const who = String(data.who ?? 'there')
    const element = (
      <EmailLayout ctx={ctx} preview="Hi" reason="You got this because you test.">
        <Text>{`Hello ${who}`}</Text>
      </EmailLayout>
    )
    return {
      subject: `Hello ${who}`,
      html: await render(element),
      text: await render(element, { plainText: true }),
      name: `greeting-${who}`,
    }
  },
}

export const testOptions = (over: Partial<EmailsOptions> = {}): EmailsOptions => ({
  theme: { shopName: 'Acme' },
  templates: [greeting],
  apiKey: null,
  from: null,
  mode: 'preview',
  ...over,
})

export const resolved = (over: Partial<EmailsOptions> = {}) => resolveOptions(testOptions(over))
