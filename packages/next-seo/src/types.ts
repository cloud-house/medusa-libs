/**
 * Produkt dla Google – JSON-LD karty produktu i plik Merchant. Sklep przekłada na niego swój
 * katalog; reguły wysyłki, kategorie Google i sprawdzenie kodu GTIN zostają po stronie sklepu.
 */
export interface SeoProduct {
  /** `g:item_group_id` w pliku Merchant. */
  id: string
  /** `productGroupID` i adres kanoniczny (`routes.product`). */
  handle: string
  title: string
  /** Opis – może być HTML-em, pakiet woła `plainText`. */
  description: string | null
  subtitle: string | null
  /** Nazwa marki. */
  brand: string | null
  /** Ścieżki lub adresy zdjęć produktu w kolejności; ścieżki stają się absolutne. */
  images: string[]
  /** Nazwy kategorii od korzenia → `g:product_type`. */
  categoryPath: string[]
  /** Identyfikator taksonomii Google → `g:google_product_category`. */
  googleCategory: number | null
  variants: SeoVariant[]
}

export interface SeoVariant {
  /** `g:id` w pliku Merchant. */
  id: string
  /** Ścieżka strony wariantu (rozmiar, kolor w adresie) – link w pliku i `url` w `ProductGroup`. */
  path: string
  sku: string | null
  /** Sprawdzony kod GTIN; 13 cyfr → `gtin13`, inaczej `gtin`. */
  gtin: string | null
  size: string | null
  color: string | null
  /** Zdjęcia wariantu; puste → zdjęcia produktu. */
  images: string[]
  /** Cena bieżąca. */
  price: number
  /** Cena regularna; wyższa od bieżącej → `g:price` + `g:sale_price` w pliku Merchant. */
  regularPrice: number
  /** Najniższa cena z 30 dni (Omnibus); wyższa od bieżącej → cena przekreślona w JSON-LD. */
  lowestPrice30d: number | null
  inStock: boolean
  /** Koszt wysyłki samej tej pozycji; `null` – bez pól wysyłki. */
  shippingCost: number | null
}

/** Artykuł poradnika – ścieżkę podaje sklep. */
export interface SeoArticle {
  title: string
  path: string
  description: string | null
  image: string | null
  /** Data publikacji; `null` – bez dat w JSON-LD. */
  publishedAt: string | null
  updatedAt: string | null
}

/** Dane firmy z ustawień sklepu; puste teksty (także same spacje) są pomijane. */
export interface SeoOrganization {
  legalName: string | null
  email: string | null
  phone: string | null
  /** Profile firmy (np. Instagram). */
  sameAs: string[]
  address: { street: string | null; postalCode: string | null; city: string | null } | null
}

export type JsonLdNode = Record<string, unknown>
