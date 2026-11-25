import type { SellerInfo } from '../seller'

/** Treści layoutu sklepu po odczycie z Medusy (albo z domyślnych treści). */
// Kształty z data cache (cmsCache): po ich zmianie podbij CMS_VIEW_VERSION w cms-cache.ts.

// `id` to identyfikator wiersza tablicy z panelu – klucz React odporny na powtórzone teksty.
// Domyślne treści z kodu go nie mają (klucz bierzemy wtedy z indeksu i tekstu).

export interface NavLink {
  id?: string
  label: string
  href: string
}

export interface AnnouncementItem {
  id?: string
  text: string
  href?: string
}

export interface FooterColumn {
  id?: string
  heading: string
  links: NavLink[]
}

export interface ContactInfo {
  email?: string
  phone?: string
  hours?: string
}

export interface LayoutData {
  navigation: NavLink[]
  announcement: { enabled: boolean; items: AnnouncementItem[] }
  footer: {
    tagline: string
    columns: FooterColumn[]
    paymentMethods: string
    /** Wiersz zapisu na newsletter nad kolumnami linków. */
    newsletter: { enabled: boolean; heading: string }
  }
  settings: {
    freeShippingThreshold: number
    shippingCutoff: string
    returnDays: number
    warrantyYears: number
    contact: ContactInfo
    instagramUrl?: string
    /** Dane sprzedawcy do stron prawnych i kontaktu; puste pola to `null`. */
    seller: SellerInfo
  }
}
