const POLISH_LETTERS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
}

/** URL-safe handle: lower case, Polish letters folded, words joined with hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (letter) => POLISH_LETTERS[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A valid handle: lower-case letters and digits in words joined by single hyphens. */
export const HANDLE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
