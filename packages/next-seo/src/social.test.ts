import { describe, expect, it } from 'vitest'
import { testSeo } from './fixtures'

const { defaultShareImage: DEFAULT_SHARE_IMAGE, socialMetadata } = testSeo()

describe('socialMetadata', () => {
  it('Open Graph and Twitter with the shop name, Polish locale and a large card', () => {
    const metadata = socialMetadata({
      title: 'Allround Wave',
      description: 'Zestaw 5w1',
      path: '/produkt/allround-wave',
      image: {
        url: 'http://localhost:59000/chonasupa-media/demo/wave-product-0.webp',
        alt: 'Allround Wave',
      },
    })
    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Sklep Testowy',
      locale: 'pl_PL',
      title: 'Allround Wave',
      description: 'Zestaw 5w1',
      url: '/produkt/allround-wave',
      images: [
        {
          url: 'http://localhost:59000/chonasupa-media/demo/wave-product-0.webp',
          alt: 'Allround Wave',
        },
      ],
    })
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Allround Wave',
      description: 'Zestaw 5w1',
      images: [
        {
          url: 'http://localhost:59000/chonasupa-media/demo/wave-product-0.webp',
          alt: 'Allround Wave',
        },
      ],
    })
  })

  it('a media library photo stays relative (metadataBase makes it absolute) and keeps its size', () => {
    const metadata = socialMetadata({
      title: 'Deski SUP',
      path: '/deski-sup',
      image: {
        url: '/api/media/file/hero.jpg',
        alt: 'Deska na jeziorze',
        width: 1600,
        height: 900,
      },
    })
    expect(metadata.openGraph?.images).toEqual([
      { url: '/api/media/file/hero.jpg', alt: 'Deska na jeziorze', width: 1600, height: 900 },
    ])
  })

  it('without a photo the default share card is named explicitly', () => {
    // Własny `openGraph` strony zastępuje obraz z `opengraph-image` warstwy wyżej – stąd jawny adres.
    const metadata = socialMetadata({ title: 'Poradnik', path: '/poradnik', image: null })
    expect(metadata.openGraph?.images).toEqual([DEFAULT_SHARE_IMAGE])
    expect(DEFAULT_SHARE_IMAGE).toEqual({
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'Sklep Testowy – deski i akcesoria',
    })
    expect(metadata.openGraph).not.toHaveProperty('description')
  })

  it('an article has type article and its publication date', () => {
    const metadata = socialMetadata({
      title: 'Ile PSI?',
      path: '/poradnik/ile-psi',
      type: 'article',
      publishedTime: '2026-10-07T08:00:00.000Z',
    })
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({ type: 'article', publishedTime: '2026-10-07T08:00:00.000Z' }),
    )
  })
})
