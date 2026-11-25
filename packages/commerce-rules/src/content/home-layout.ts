/** Bloki strony głównej i reguły układu sprawdzane przy publikacji (spec 4c §3, §4.1). */
export const CORE_HOME_BLOCK_TYPES = [
  'hero',
  'trustBar',
  'categoryTiles',
  'brands',
  'productTabs',
  'newsletter',
  'articles',
] as const

export type CoreHomeBlockType = (typeof CORE_HOME_BLOCK_TYPES)[number]

export const CORE_HOME_BLOCK_LABELS: Record<CoreHomeBlockType, string> = {
  hero: 'Hero',
  trustBar: 'Pasek zalet',
  categoryTiles: 'Kafle kategorii',
  brands: 'Marki',
  productTabs: 'Produkty w zakładkach',
  newsletter: 'Newsletter',
  articles: 'Poradnik',
}

/** Hero leży pod przezroczystym headerem, formularz newslettera ma stałe pola – po jednym. */
export const CORE_SINGLE_HOME_BLOCKS: readonly string[] = ['hero', 'trustBar', 'newsletter']

/** Reguły układu: nazwy bloków (do komunikatów) i bloki, które mogą wystąpić tylko raz. */
export interface HomeLayoutRules {
  labels: Record<string, string>
  single: readonly string[]
}

export const CORE_HOME_LAYOUT_RULES: HomeLayoutRules = {
  labels: CORE_HOME_BLOCK_LABELS,
  single: CORE_SINGLE_HOME_BLOCKS,
}

export function homeLayoutError(
  blocks: { blockType?: string | null }[] | null | undefined,
  rules: HomeLayoutRules = CORE_HOME_LAYOUT_RULES,
): true | string {
  if (!blocks || blocks.length === 0) return 'Dodaj co najmniej jeden blok.'
  const types = blocks.map((block) => block.blockType)
  const count = (type: string) => types.filter((t) => t === type).length
  if (count('hero') > 1) return 'Strona główna może mieć tylko jeden blok „Hero”.'
  if (types[0] !== 'hero') return 'Hero musi być pierwszym blokiem strony głównej.'
  const repeated = rules.single.find((type) => count(type) > 1)
  if (repeated) return `Blok „${rules.labels[repeated] ?? repeated}” może wystąpić tylko raz.`
  return true
}
