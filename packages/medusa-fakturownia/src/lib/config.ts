/** Which invoices the shop sends to KSeF itself, after the total check (spec 6c §5.1, §5.4). */
export type KsefMode = 'off' | 'companies' | 'all'

const KSEF_MODES: readonly KsefMode[] = ['off', 'companies', 'all']

/** `FAKTUROWNIA_URL=atrapa` – the in-process fake for dev and E2E, never in production. */
export const FAKE_URL = 'atrapa'

const DEFAULT_OID_PREFIX = 'INV-'

export interface FakturowniaConfig {
  client: 'api' | 'fake'
  /** Account address without the trailing slash, e.g. `https://myshop.fakturownia.pl`. */
  url: string | null
  token: string | null
  departmentId: string | null
  ksef: KsefMode
  oidPrefix: string
}

type Env = Record<string, string | undefined>

const trimmed = (value: string | undefined) => value?.trim() || null

function ksefMode(value: string | undefined): KsefMode {
  const mode = trimmed(value)
  return mode && (KSEF_MODES as readonly string[]).includes(mode) ? (mode as KsefMode) : 'off'
}

/** Invoicing setup, `null` when the shop issues no invoices (spec 6c §5.1). */
export function fakturowniaConfig(
  env: Env,
  defaultOidPrefix: string = DEFAULT_OID_PREFIX,
): FakturowniaConfig | null {
  const url = trimmed(env.FAKTUROWNIA_URL)
  if (!url) return null
  const common = {
    departmentId: trimmed(env.FAKTUROWNIA_DEPARTMENT_ID),
    ksef: ksefMode(env.FAKTUROWNIA_KSEF),
    oidPrefix: trimmed(env.FAKTUROWNIA_OID_PREFIX) ?? defaultOidPrefix,
  }
  if (url === FAKE_URL) {
    return env.NODE_ENV === 'production'
      ? null
      : { client: 'fake', url: null, token: null, ...common }
  }
  const token = trimmed(env.FAKTUROWNIA_API_TOKEN)
  if (!token) return null
  return { client: 'api', url: url.replace(/\/+$/, ''), token, ...common }
}

const NOT_ISSUED = 'faktury nie są wystawiane.'

/** Startup warnings for the invoicing setup (printed by `medusa-config.ts` outside tests). */
export function fakturowniaWarnings(env: Env, logPrefix = '[Fakturownia]'): string[] {
  const warnings: string[] = []
  const url = trimmed(env.FAKTUROWNIA_URL)
  if (url === FAKE_URL && env.NODE_ENV === 'production') {
    warnings.push(`${logPrefix} FAKTUROWNIA_URL=atrapa w produkcji – ${NOT_ISSUED}`)
  } else if (url && url !== FAKE_URL && !trimmed(env.FAKTUROWNIA_API_TOKEN)) {
    warnings.push(`${logPrefix} FAKTUROWNIA_URL bez FAKTUROWNIA_API_TOKEN – ${NOT_ISSUED}`)
  }
  const ksef = trimmed(env.FAKTUROWNIA_KSEF)
  if (ksef && !(KSEF_MODES as readonly string[]).includes(ksef)) {
    warnings.push(
      `${logPrefix} FAKTUROWNIA_KSEF="${ksef}" – dozwolone ${KSEF_MODES.join(', ')}; przyjmuję off.`,
    )
  }
  return warnings
}
