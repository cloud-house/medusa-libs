import { z } from '@medusajs/framework/zod'

const DIMENSION_MESSAGE = 'Wymiar podaj w pełnych centymetrach, od 1 do 300.'
const WEIGHT_MESSAGE = 'Wagę podaj w pełnych gramach, od 1 do 50000.'

const name = z
  .string()
  .trim()
  .min(1, 'Podaj nazwę szablonu.')
  .max(80, 'Nazwa szablonu ma najwyżej 80 znaków.')
const dimension = z
  .number({ error: DIMENSION_MESSAGE })
  .int(DIMENSION_MESSAGE)
  .min(1, DIMENSION_MESSAGE)
  .max(300, DIMENSION_MESSAGE)

/** A template as the panel sends it – the same body creates one and replaces one. */
export const AdminSaveParcelTemplate = z.object({
  name,
  kind: z.enum(['locker_a', 'locker_b', 'locker_c', 'box'], { error: 'Wybierz rodzaj szablonu.' }),
  length_cm: dimension,
  width_cm: dimension,
  height_cm: dimension,
  weight_g: z
    .number({ error: WEIGHT_MESSAGE })
    .int(WEIGHT_MESSAGE)
    .min(1, WEIGHT_MESSAGE)
    .max(50000, WEIGHT_MESSAGE),
  // A parcel class key or `accessories_*`; the route checks it against the shop's `parcelClasses`.
  purpose: z
    .string({ error: 'Wybierz przeznaczenie szablonu.' })
    .trim()
    .min(1, 'Wybierz przeznaczenie szablonu.')
    .max(40, 'Wybierz przeznaczenie szablonu.')
    .nullable()
    .default(null),
})
export type AdminSaveParcelTemplateType = z.infer<typeof AdminSaveParcelTemplate>
