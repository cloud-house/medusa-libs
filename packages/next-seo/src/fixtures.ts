import { createSeo, type Seo } from './seo'

/** Konfiguracja testów – sklep w stylu ChoNaSupa, ale z neutralną nazwą. */
export const testSeo = (): Seo =>
  createSeo({
    siteName: 'Sklep Testowy',
    shopTitle: 'Sklep Testowy – deski i akcesoria',
    feedDescription: 'Deski i akcesoria sprawdzonych marek.',
    devSiteUrl: 'http://localhost:3200',
  })
