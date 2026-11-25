import type { TemplateKind, TemplatePurpose } from '../../types'

export interface DefaultTemplate {
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
  purpose: TemplatePurpose | null
}

/**
 * The templates of a shop with two bulky classes (`board`, `courier_only`) – a fixture of these tests. Dimensions in
 * whole cm in length × width × height order, weights in grams.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Karton deski',
    kind: 'box',
    length_cm: 95,
    width_cm: 45,
    height_cm: 30,
    weight_g: 15000,
    purpose: 'board',
  },
  {
    name: 'Karton długi',
    kind: 'box',
    length_cm: 120,
    width_cm: 25,
    height_cm: 15,
    weight_g: 4000,
    purpose: 'courier_only',
  },
  {
    name: 'Paczkomat A',
    kind: 'locker_a',
    length_cm: 64,
    width_cm: 38,
    height_cm: 8,
    weight_g: 2000,
    purpose: 'accessories_locker',
  },
  {
    name: 'Paczkomat B',
    kind: 'locker_b',
    length_cm: 64,
    width_cm: 38,
    height_cm: 19,
    weight_g: 5000,
    purpose: null,
  },
  {
    name: 'Paczkomat C',
    kind: 'locker_c',
    length_cm: 64,
    width_cm: 38,
    height_cm: 41,
    weight_g: 10000,
    purpose: null,
  },
  {
    name: 'Karton mały',
    kind: 'box',
    length_cm: 40,
    width_cm: 30,
    height_cm: 20,
    weight_g: 3000,
    purpose: 'accessories_courier',
  },
  {
    name: 'Karton średni',
    kind: 'box',
    length_cm: 60,
    width_cm: 40,
    height_cm: 40,
    weight_g: 8000,
    purpose: null,
  },
]
