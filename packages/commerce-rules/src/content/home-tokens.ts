import type { LayoutData } from './layout-types'
import type { SettingValueKey } from './setting-keys'
import { settingValue } from './setting-values'

/**
 * Znaczniki w tekstach bloków strony głównej (spec 4c §4.3): redaktor pisze „{dni-zwrotu} na zwrot”,
 * a sklep wstawia wartość z Ustawień sklepu – teksty zawsze zgadzają się z regulaminem.
 */
export const HOME_TOKENS = {
  'prog-darmowej-dostawy': 'freeShippingThreshold',
  'godzina-wysylki': 'shippingCutoff',
  'dni-zwrotu': 'returnDays',
  'lata-gwarancji': 'warrantyYears',
} as const satisfies Record<string, SettingValueKey>

type HomeToken = keyof typeof HOME_TOKENS

// Wszystko w klamrach jest znacznikiem – także literówka ze spacją, żeby panel ją zgłosił.
const TOKEN = /\{([^{}]*)\}/g

const isHomeToken = (name: string): name is HomeToken => Object.hasOwn(HOME_TOKENS, name)

const AVAILABLE = Object.keys(HOME_TOKENS)
  .map((name) => `{${name}}`)
  .join(', ')

/** Walidacja pola tekstowego bloku: nieznany znacznik → komunikat z listą dostępnych. */
export function homeTokenError(value: unknown): true | string {
  if (typeof value !== 'string') return true
  for (const [token, name] of value.matchAll(TOKEN)) {
    if (name === undefined || !isHomeToken(name))
      return `Nieznany znacznik ${token}. Dostępne: ${AVAILABLE}.`
  }
  return true
}

export function fillHomeTokens(text: string, settings: LayoutData['settings']): string {
  return text.replace(TOKEN, (token, name: string) =>
    isHomeToken(name) ? settingValue(HOME_TOKENS[name], settings).text : token,
  )
}

// Adresy, identyfikatory i handle zostają bez zmian – znaczniki są tylko w tekstach dla klienta.
const RAW_KEYS = new Set([
  'id',
  'type',
  'href',
  'url',
  'creditUrl',
  'handle',
  'productHandle',
  'categoryHandle',
])

/** Bloki strony głównej z wypełnionymi znacznikami we wszystkich tekstach (spec 4c §3). */
export function fillHomeBlockTokens<T>(block: T, settings: LayoutData['settings']): T {
  const fill = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string') {
      return key && RAW_KEYS.has(key) ? value : fillHomeTokens(value, settings)
    }
    if (Array.isArray(value)) return value.map((item) => fill(item))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, k)]))
    }
    return value
  }
  return fill(block) as T
}
