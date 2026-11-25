import {
  ACCESSORIES_PURPOSES,
  type ConnectionStateName,
  purposeLabel,
  type TemplateKind,
  type TemplatePurpose,
} from '../../types'

/** `GET /admin/furgonetka`. */
export interface FurgonetkaView {
  state: ConnectionStateName
  account: string | null
  canConnect: boolean
  reason: string | null
  /** The shop's parcel classes: the purposes a template can have besides the accessories ones. */
  parcelClasses: ParcelClassView[]
}

export interface ParcelClassView {
  key: string
  label: string
}

/** A parcel template as `GET /admin/parcel-templates` sends it. */
export interface ParcelTemplateView {
  id: string
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
  purpose: TemplatePurpose | null
}

export const KIND_LABELS: Record<TemplateKind, string> = {
  locker_a: 'Paczkomat A',
  locker_b: 'Paczkomat B',
  locker_c: 'Paczkomat C',
  box: 'Karton',
}

/** „95×45×30 cm” – length × width × height. */
export function dimensionsText(
  template: Pick<ParcelTemplateView, 'length_cm' | 'width_cm' | 'height_cm'>,
): string {
  return `${template.length_cm}×${template.width_cm}×${template.height_cm} cm`
}

/** Grams as kilograms with a decimal comma and no trailing zeros: „2,5”. */
export function kgText(grams: number): string {
  return String(grams / 1000).replace('.', ',')
}

/** „15 kg”, „2,5 kg”. */
export function weightText(grams: number): string {
  return `${kgText(grams)} kg`
}

/**
 * Kilograms typed in the form (comma or dot, up to three decimals) as whole grams; `null` for
 * anything else. The server refuses a weight out of range with its own message.
 */
export function gramsFromKg(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 1000 + Number((match[2] ?? '').padEnd(3, '0'))
}

/** A number typed in the form; `null` when empty or not a number. The server checks the range. */
export function numberFromText(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** The default purpose of a template, a dash for none. */
export function purposeText(purpose: TemplatePurpose | null, classes: ParcelClassView[]): string {
  return purpose ? purposeLabel(purpose, classes) : '–'
}

/** The purposes to choose from: the shop's parcel classes, then the two accessories purposes. */
export function purposeOptions(classes: ParcelClassView[]): { value: string; label: string }[] {
  return [
    ...classes.map((parcelClass) => ({ value: parcelClass.key, label: parcelClass.label })),
    ...ACCESSORIES_PURPOSES.map((value) => ({ value, label: purposeLabel(value, classes) })),
  ]
}

/** The state line of the „Furgonetka” section, after „Stan: ”. */
export function connectionText(view: Pick<FurgonetkaView, 'state' | 'account'>): string {
  switch (view.state) {
    case 'not_configured':
      return 'nie skonfigurowana'
    case 'not_connected':
      return 'niepołączona'
    case 'connected':
      return view.account ? `połączona jako ${view.account}` : 'połączona'
    case 'disconnected':
      return 'rozłączona – połącz ponownie'
  }
}
