/** Build produkcyjny uruchomiony na tym komputerze (`next start`) może zostać na `http:`. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function parsed(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(
      `SITE_URL „${raw}” nie jest adresem – podaj pełny adres, np. https://twoj-sklep.pl.`,
    )
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL „${raw}” musi zaczynać się od https:// (lokalnie http://).`)
  }
  if (
    url.protocol === 'http:' &&
    process.env.NODE_ENV === 'production' &&
    !LOCAL_HOSTS.has(url.hostname)
  ) {
    throw new Error(
      `SITE_URL „${raw}” na produkcji musi używać https – Google indeksuje adres z SITE_URL.`,
    )
  }
  return url
}

export interface SiteUrl {
  /** Adres sklepu – jedno źródło adresów absolutnych. W produkcji bez `SITE_URL` – błąd, nie `localhost`. */
  siteUrl(): URL
  /** Ścieżka sklepu (z `/` na początku) jako adres absolutny – z zachowaniem ścieżki z `SITE_URL`. */
  absoluteUrl(path: string): string
  /** Indeksowanie tylko na produkcji – `SITE_INDEXABLE=true` ustawiamy przy starcie sklepu. */
  siteIndexable(): boolean
}

/** `SITE_URL` i `SITE_INDEXABLE` czytane przy każdym wywołaniu, nie przy imporcie. */
export function createSiteUrl(devSiteUrl: string): SiteUrl {
  function siteUrl(): URL {
    const raw = process.env.SITE_URL?.trim()
    if (!raw) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'SITE_URL nie jest ustawiony – adres sklepu jest potrzebny do adresów kanonicznych, mapy strony i danych strukturalnych.',
        )
      }
      return new URL(devSiteUrl)
    }
    const url = parsed(raw)
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`
    return url
  }
  return {
    siteUrl,
    absoluteUrl: (path) => new URL(path.replace(/^\/+/, ''), siteUrl()).toString(),
    siteIndexable: () => process.env.SITE_INDEXABLE === 'true',
  }
}
