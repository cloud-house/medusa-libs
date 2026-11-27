import { lineDiscountLabel, splitLineDiscount } from '@cloud-house/commerce-rules'
import type { HttpTypes } from '@medusajs/types'

/** Rabat pozycji: nazwa i część z kodów wpisanych przez klienta (reszta to rabat zestawowy). */
export interface LineDiscount {
  label: string
  code: number
}

export interface CartLineView {
  id: string
  variantId: string
  title: string
  variantLabel: string | null
  thumbnail: string | null
  href: string
  quantity: number
  /** Brutto po rabatach. */
  total: number
  /** Brutto przed rabatami z promocji. */
  originalTotal: number
  discount: LineDiscount | null
  /** Element zestawu, który zastępuje ulepszenie (z karty produktu). */
  replaces: string | null
  /** Marka i kategoria własna z katalogu – do zdarzeń analityki (spec 6b §5.5). */
  brand: string | null
  category: string | null
}

export interface CartGroupView {
  line: CartLineView
  upgrades: CartLineView[]
}

export interface CartView {
  id: string
  count: number
  groups: CartGroupView[]
  originalItemTotal: number
  itemTotal: number
  bundleDiscount: number
  codeDiscount: number
  total: number
  codes: string[]
  freeShipping: { threshold: number; remaining: number; reached: boolean; progress: number }
}

type Line = HttpTypes.StoreCartLineItem

/** Kolor i rozmiar wariantu z katalogu – koszyk Medusy nie zwraca opcji wariantu. */
export type VariantOptions = Record<
  string,
  { size: string | null; color: string | null; brand?: string | null; category?: string | null }
>

const num = (value: unknown) => Number(value ?? 0)
const round = (value: number) => Math.round(value * 100) / 100

/** „Turkus · 10'6"” – bez rozmiaru „Standard” produktów jednorozmiarowych. */
export function variantLabel(
  color: string | null,
  size: string | null,
  hiddenSize: string | null = null,
): string | null {
  return [color, size === hiddenSize ? null : size].filter(Boolean).join(' · ') || null
}

/** A line with the lines attached to it (e.g. upgrades bought for a board). */
export interface LineGroup<T> {
  line: T
  upgrades: T[]
}

/** How the shop shows its lines; every part is optional. */
export interface LineViewOptions {
  /** Groups lines; default every line on its own. */
  groupLines?: <T extends LineSource>(items: T[]) => LineGroup<T>[]
  /** Link of a line; default `/products/<handle>`. */
  href?: (handle: string, selection: { color: string | null; size: string | null }) => string
  /** A size value that is never shown (e.g. `Standard` of one-size products); default none. */
  hiddenSize?: string | null
}

const defaultHref = (handle: string) => `/products/${encodeURIComponent(handle)}`
const flat = <T>(items: T[]): LineGroup<T>[] => items.map((line) => ({ line, upgrades: [] }))

/** Pola pozycji wspólne dla koszyka i zamówienia (Medusa snapshotuje je przy zamówieniu). */
export interface LineSource {
  id: string
  variant_id?: string | null
  title: string
  product_title?: string | null
  product_handle?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
  total?: unknown
  original_total?: unknown
  metadata?: Record<string, unknown> | null
}

/** Pozycja jako widok; `discountOf` nazywa rabat, gdy cena po promocjach jest niższa. */
export function toLineView(
  line: LineSource,
  variants: VariantOptions,
  discountOf: () => CartLineView['discount'],
  options: LineViewOptions = {},
): CartLineView {
  const catalog = line.variant_id ? variants[line.variant_id] : undefined
  const color = catalog?.color ?? null
  const size = catalog?.size ?? null
  const total = num(line.total)
  const originalTotal = num(line.original_total)
  const replaces = line.metadata?.replaces
  return {
    id: line.id,
    variantId: line.variant_id ?? '',
    title: line.product_title ?? line.title,
    variantLabel: catalog
      ? variantLabel(color, size, options.hiddenSize ?? null)
      : line.variant_title || null,
    thumbnail: line.thumbnail ?? null,
    href: (options.href ?? defaultHref)(line.product_handle ?? '', { color, size }),
    quantity: line.quantity,
    total,
    originalTotal,
    discount: originalTotal > total ? discountOf() : null,
    replaces: typeof replaces === 'string' ? replaces : null,
    brand: catalog?.brand ?? null,
    category: catalog?.category ?? null,
  }
}

function toLine(
  line: Line,
  automatic: Set<string>,
  variants: VariantOptions,
  options: LineViewOptions,
): CartLineView {
  return toLineView(
    line as LineSource,
    variants,
    () => {
      // Pozycja może mieć oba rabaty naraz (wiosło z zestawu i kod −10%) – każdy liczymy osobno.
      const parts = splitLineDiscount(line, (code) => !automatic.has(code))
      return { label: lineDiscountLabel(parts), code: parts.code }
    },
    options,
  )
}

/** Pozycje pogrupowane opcją `groupLines` (domyślnie każda osobno) jako widoki. */
export function groupLines<T extends LineSource>(
  items: T[],
  toView: (item: T) => CartLineView,
  group: LineViewOptions['groupLines'] = flat,
): CartGroupView[] {
  return (group ?? flat)(items).map(({ line, upgrades }) => ({
    // Ulepszenie na własnym poziomie (deskę usunięto) nie zastępuje już niczego w zestawie.
    line: { ...toView(line), replaces: null },
    upgrades: upgrades.map(toView),
  }))
}

/**
 * Koszyk Medusy jako widok sklepu: pozycje pogrupowane opcją `groupLines`, rabaty zestawowe (promocje automatyczne) i kodowe osobno, pasek darmowej
 * dostawy liczony od `item_total` – tak jak reguła ceny dostawy w Medusie.
 */
export function toCartView(
  cart: HttpTypes.StoreCart | null,
  opts: { freeShippingThreshold: number; variants?: VariantOptions } & LineViewOptions,
): CartView | null {
  const items = [...(cart?.items ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  )
  if (!cart || items.length === 0) return null

  const variants = opts.variants ?? {}
  const automatic = new Set(
    (cart.promotions ?? []).flatMap((p) => (p.is_automatic && p.code ? [p.code] : [])),
  )
  const groups = groupLines(
    items as (Line & LineSource)[],
    (item) => toLine(item, automatic, variants, opts),
    opts.groupLines,
  )

  const lines = groups.flatMap((g) => [g.line, ...g.upgrades])
  const codeDiscount = round(lines.reduce((sum, l) => sum + (l.discount?.code ?? 0), 0))
  const allDiscounts = lines.reduce(
    (sum, l) => sum + (l.discount ? l.originalTotal - l.total : 0),
    0,
  )
  const itemTotal = num(cart.item_total)
  const threshold = opts.freeShippingThreshold
  return {
    id: cart.id,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    groups,
    originalItemTotal: num(cart.original_item_total),
    itemTotal,
    bundleDiscount: round(allDiscounts - codeDiscount),
    codeDiscount,
    total: num(cart.total),
    codes: (cart.promotions ?? []).flatMap((p) => (!p.is_automatic && p.code ? [p.code] : [])),
    freeShipping: {
      threshold,
      remaining: round(Math.max(0, threshold - itemTotal)),
      reached: itemTotal >= threshold,
      progress: threshold > 0 ? Math.min(1, itemTotal / threshold) : 1,
    },
  }
}
