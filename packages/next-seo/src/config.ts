export interface ShareImage {
  url: string
  alt?: string
  width?: number
  height?: number
}

/** Ustawienia sklepu dla `createSeo` – nazwa, waluta, kraj i trasy w jednym miejscu. */
export interface SeoConfig {
  /** Nazwa sklepu: `og:site_name`, JSON-LD firmy, autor i wydawca artykułów. */
  siteName: string
  /** Tytuł strony głównej i kanału pliku Merchant. */
  shopTitle: string
  /** Opis kanału pliku Merchant. */
  feedDescription: string
  /** Adres sklepu w trybie deweloperskim bez `SITE_URL` (domyślnie `http://localhost:3000`). */
  devSiteUrl?: string
  /** Język kart Open Graph (domyślnie `pl_PL`). */
  locale?: string
  /** Waluta ofert i pliku Merchant (domyślnie `PLN`). */
  currency?: string
  /** Kraj dostawy, zwrotów i adresu firmy (domyślnie `PL`). */
  country?: string
  /** Stały adres logo w JSON-LD firmy (domyślnie `/logo.png`). */
  logoPath?: string
  /** Obraz udostępniania stron bez własnego (domyślnie `/opengraph-image` 1200×630). */
  defaultShareImage?: ShareImage
  /** Czas przygotowania wysyłki w dniach [min, max] (domyślnie [0, 1]). */
  handlingDays?: readonly [number, number]
  /** Czas doręczenia w dniach [min, max] (domyślnie [1, 2]). */
  transitDays?: readonly [number, number]
  /** Ścieżki stron produktu i marki (domyślnie `/produkt/:handle` i `/marki/:handle`). */
  routes?: { product?: (handle: string) => string; brand?: (handle: string) => string }
  /** Przedrostek komunikatów w logach, np. `[Sklep]`. */
  logPrefix?: string
}

export interface ResolvedSeoConfig {
  siteName: string
  shopTitle: string
  feedDescription: string
  devSiteUrl: string
  locale: string
  currency: string
  country: string
  logoPath: string
  defaultShareImage: ShareImage
  handlingDays: readonly [number, number]
  transitDays: readonly [number, number]
  routes: { product: (handle: string) => string; brand: (handle: string) => string }
  logPrefix: string
}

export function resolveConfig(config: SeoConfig): ResolvedSeoConfig {
  return {
    siteName: config.siteName,
    shopTitle: config.shopTitle,
    feedDescription: config.feedDescription,
    devSiteUrl: config.devSiteUrl ?? 'http://localhost:3000',
    locale: config.locale ?? 'pl_PL',
    currency: config.currency ?? 'PLN',
    country: config.country ?? 'PL',
    logoPath: config.logoPath ?? '/logo.png',
    defaultShareImage: config.defaultShareImage ?? {
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: config.shopTitle,
    },
    handlingDays: config.handlingDays ?? [0, 1],
    transitDays: config.transitDays ?? [1, 2],
    routes: {
      product: config.routes?.product ?? ((handle) => `/produkt/${encodeURIComponent(handle)}`),
      brand: config.routes?.brand ?? ((handle) => `/marki/${encodeURIComponent(handle)}`),
    },
    logPrefix: config.logPrefix ?? '',
  }
}
