/** `FURGONETKA_URL=atrapa` – the in-process fake for dev and E2E, never in production (spec 6d §5.12). */
export const FAKE_URL = 'atrapa'

export const DEFAULT_PICKUP_HOURS = { from: '10:00', to: '15:00' }
export const DEFAULT_PICKUP_TODAY_UNTIL = '12:00'
/** The webhook token of the fake – the fake signs its webhooks with it (`webhookBody`). */
export const FAKE_WEBHOOK_TOKEN = 'atrapa'

export interface FurgonetkaConfig {
  client: 'api' | 'fake'
  /** API address without the trailing slash, e.g. `https://api.furgonetka.pl`; `null` for the fake. */
  url: string | null
  clientId: string | null
  clientSecret: string | null
  /** Salt of the webhook control sum; `null` switches the webhook off. */
  webhookToken: string | null
  /** The default pickup window, `HH:MM`. */
  pickupHours: { from: string; to: string }
  /** Until this hour of a working day the default pickup is today, `HH:MM`. */
  pickupTodayUntil: string
  /** Panel address (`MEDUSA_ADMIN_URL`) the OAuth callback returns to. */
  adminUrl: string | null
}

type Env = Record<string, string | undefined>

const trimmed = (value: string | undefined) => value?.trim() || null

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** `HH:MM-HH:MM` with the start before the end, else `null`. */
function parseHours(value: string): { from: string; to: string } | null {
  const [from, to, ...rest] = value.split('-')
  if (rest.length || !from || !to || !TIME.test(from) || !TIME.test(to) || from >= to) return null
  return { from, to }
}

function pickupSettings(env: Env) {
  const hours = trimmed(env.FURGONETKA_PICKUP_HOURS)
  const todayUntil = trimmed(env.FURGONETKA_PICKUP_TODAY_UNTIL)
  return {
    hours,
    todayUntil,
    pickupHours: (hours && parseHours(hours)) || DEFAULT_PICKUP_HOURS,
    pickupTodayUntil: todayUntil && TIME.test(todayUntil) ? todayUntil : DEFAULT_PICKUP_TODAY_UNTIL,
  }
}

/** Shipping setup, `null` when the shop ships by hand as before (spec 6d §5.1). */
export function furgonetkaConfig(env: Env): FurgonetkaConfig | null {
  const url = trimmed(env.FURGONETKA_URL)
  if (!url) return null
  const { pickupHours, pickupTodayUntil } = pickupSettings(env)
  const common = {
    pickupHours: { ...pickupHours },
    pickupTodayUntil,
    adminUrl: trimmed(env.MEDUSA_ADMIN_URL)?.replace(/\/+$/, '') ?? null,
  }
  const webhookToken = trimmed(env.FURGONETKA_WEBHOOK_TOKEN)
  if (url === FAKE_URL) {
    return env.NODE_ENV === 'production'
      ? null
      : {
          client: 'fake',
          url: null,
          clientId: null,
          clientSecret: null,
          webhookToken: webhookToken ?? FAKE_WEBHOOK_TOKEN,
          ...common,
        }
  }
  const clientId = trimmed(env.FURGONETKA_CLIENT_ID)
  const clientSecret = trimmed(env.FURGONETKA_CLIENT_SECRET)
  if (!clientId || !clientSecret) return null
  return {
    client: 'api',
    url: url.replace(/\/+$/, ''),
    clientId,
    clientSecret,
    webhookToken,
    ...common,
  }
}

const DISABLED = 'Furgonetka jest wyłączona.'

/** Startup warnings for the shipping setup (printed by `medusa-config.ts` outside tests). */
export function furgonetkaWarnings(env: Env, prefix = 'Furgonetka:'): string[] {
  const warnings: string[] = []
  const url = trimmed(env.FURGONETKA_URL)
  if (url === FAKE_URL && env.NODE_ENV === 'production') {
    warnings.push(`${prefix} FURGONETKA_URL=atrapa w produkcji – ${DISABLED}`)
  } else if (url && url !== FAKE_URL) {
    if (!trimmed(env.FURGONETKA_CLIENT_ID) || !trimmed(env.FURGONETKA_CLIENT_SECRET)) {
      warnings.push(
        `${prefix} FURGONETKA_URL bez FURGONETKA_CLIENT_ID i FURGONETKA_CLIENT_SECRET – ${DISABLED}`,
      )
    } else if (!trimmed(env.FURGONETKA_WEBHOOK_TOKEN)) {
      warnings.push(
        `${prefix} brak FURGONETKA_WEBHOOK_TOKEN – webhook Furgonetki odpowiada 404, statusy czyta tylko zadanie co 15 minut.`,
      )
    }
  }
  const { hours, todayUntil } = pickupSettings(env)
  if (hours && !parseHours(hours)) {
    warnings.push(
      `${prefix} FURGONETKA_PICKUP_HOURS="${hours}" – oczekiwany format HH:MM-HH:MM, początek przed końcem; przyjmuję ${DEFAULT_PICKUP_HOURS.from}-${DEFAULT_PICKUP_HOURS.to}.`,
    )
  }
  if (todayUntil && !TIME.test(todayUntil)) {
    warnings.push(
      `${prefix} FURGONETKA_PICKUP_TODAY_UNTIL="${todayUntil}" – oczekiwany format HH:MM; przyjmuję ${DEFAULT_PICKUP_TODAY_UNTIL}.`,
    )
  }
  return warnings
}
