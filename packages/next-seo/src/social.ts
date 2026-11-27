import type { ResolvedSeoConfig, ShareImage } from './config'

/** Open Graph strony – kształt zgodny z `Metadata['openGraph']` z Next. */
export interface SeoOpenGraph {
  type: 'website' | 'article'
  siteName: string
  locale: string
  title: string
  description?: string
  url: string
  publishedTime?: string
  images: ShareImage[]
}

/** Karta Twittera – kształt zgodny z `Metadata['twitter']` z Next. */
export interface SeoTwitter {
  card: 'summary_large_image'
  title: string
  description?: string
  images: ShareImage[]
}

export interface SocialInput {
  title: string
  description?: string
  path: string
  image?: ShareImage | null
  type?: 'website' | 'article'
  publishedTime?: string
}

/** Obraz z biblioteki mediów albo z produktu Medusy: bez pustych wymiarów. */
export function shareImage(
  image: { url: string; alt?: string | null; width?: number | null; height?: number | null } | null,
  fallbackAlt: string,
): ShareImage | null {
  if (!image) return null
  return {
    url: image.url,
    alt: image.alt?.trim() || fallbackAlt,
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
  }
}

/**
 * Open Graph i Twitter strony; adres względny – absolutny przez `metadataBase`. Strona z własnym
 * `openGraph` bez `images` gubi obraz z pliku warstwy wyżej (Next scala `openGraph` w całości),
 * dlatego bez zdjęcia podajemy jawnie domyślny obraz udostępniania.
 */
export function createSocialMetadata(config: ResolvedSeoConfig) {
  return function socialMetadata({
    title,
    description,
    path,
    image,
    type = 'website',
    publishedTime,
  }: SocialInput): { openGraph: SeoOpenGraph; twitter: SeoTwitter } {
    const images = [image ?? config.defaultShareImage]
    const text = { title, ...(description ? { description } : {}) }
    return {
      openGraph: {
        type,
        siteName: config.siteName,
        locale: config.locale,
        ...text,
        url: path,
        ...(type === 'article' && publishedTime ? { publishedTime } : {}),
        images,
      },
      twitter: { card: 'summary_large_image', ...text, images },
    }
  }
}
