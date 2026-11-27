const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
}

/**
 * Opis z Medusy bywa HTML-em: Google chce czysty tekst – w pliku Merchant Center, w JSON-LD
 * i w opisie meta karty produktu (tagi → spacja, podstawowe encje, jedna spacja).
 */
export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, name: string) => HTML_ENTITIES[name] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Wartość jako całe słowo (albo kilka słów) nazwy – „M” nie siedzi w „Kamizelka”. */
const hasWords = (title: string, value: string) =>
  new RegExp(`(^|\\s)${escapeRegExp(value)}(?=\\s|$)`, 'iu').test(title)

/**
 * Nazwa wariantu dla Google: model + rozmiar + kolor, bez powtórzeń – model jednego rozmiaru ma
 * go już w nazwie („Mini Wave 8'0"”). Markę dokleja wywołujący: kolor „Red” marki „Red Paddle”
 * zostaje.
 */
export function variantTitle(title: string, ...attributes: (string | null | undefined)[]): string {
  const extra = attributes.filter((value): value is string => !!value && !hasWords(title, value))
  return [title, ...extra].join(' ')
}
