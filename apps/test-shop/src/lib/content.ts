import { contentKinds } from '@cloud-house/medusa-content'
import { z } from '@medusajs/framework/zod'

/**
 * The test shop's kinds: the ready-made ones plus two of its own – `faq` (a plain list entry) and
 * `product` (content bound to a Medusa product, like a shop's product page).
 */
export const testContentKinds = [
  ...contentKinds({ reservedSlugs: ['cart'], protectedSlugs: ['terms'] }),
  {
    type: 'faq',
    label: 'FAQ',
    schema: z.object({ question: z.string().min(1, 'Podaj pytanie.') }),
  },
  {
    type: 'product',
    label: 'Product page',
    entity: 'product' as const,
    schema: z.object({ tagline: z.string().nullish() }),
  },
]
