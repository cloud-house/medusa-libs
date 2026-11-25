import { describe, expect, it } from 'vitest'
import {
  blockNodes,
  blockProductHandles,
  blockProductIds,
  countWords,
  readingMinutes,
  usesInternalLink,
} from './lexical-nodes'

const text = (value: string) => ({ type: 'text', text: value })
const paragraph = (value: string) => ({ type: 'paragraph', children: [text(value)] })
const list = (...items: string[]) => ({
  type: 'list',
  children: items.map((item) => ({ type: 'listitem', children: [text(item)] })),
})
const productBlock = (products: unknown[]) => ({
  type: 'block',
  fields: { blockType: 'productCards', blockName: 'Polecane deski', products },
})
const doc = (...children: unknown[]) => ({ root: { type: 'root', children } })

/** Treść z `words` słowami w akapitach po 100 słów. */
function wordsDoc(words: number) {
  const paragraphs = []
  for (let left = words; left > 0; left -= 100) {
    paragraphs.push(paragraph(Array.from({ length: Math.min(100, left) }, () => 'deska').join(' ')))
  }
  return doc(...paragraphs)
}

describe('countWords', () => {
  it('liczy słowa w akapitach, nagłówkach i listach', () => {
    expect(countWords(doc(paragraph('Raz dwa  trzy'), list('cztery', 'pięć')))).toBe(5)
    expect(countWords(doc({ type: 'heading', tag: 'h2', children: [text('Jak wybrać')] }))).toBe(2)
  })

  it('pomija bloki i bloki w linii', () => {
    const content = doc(paragraph('Raz dwa'), productBlock([1]), {
      type: 'paragraph',
      children: [text('trzy'), { type: 'inlineBlock', fields: { blockType: 'x', key: 'a b c' } }],
    })
    expect(countWords(content)).toBe(3)
  })

  it('samotne myślniki i inna interpunkcja to nie słowa, wyrazy z łącznikiem i liczby tak', () => {
    expect(countWords(doc(paragraph('Deska – lekka — i szybka - na morze … ?')))).toBe(6)
    expect(countWords(doc(paragraph('biało-czerwona deska 10’6” za 1 899 zł')))).toBe(7)
  })

  it('pusta albo nieznana treść to zero słów', () => {
    expect(countWords(null)).toBe(0)
    expect(countWords({})).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('zaokrągla w górę przy 200 słowach na minutę, minimum 1', () => {
    expect(readingMinutes(wordsDoc(1200))).toBe(6)
    expect(readingMinutes(wordsDoc(1201))).toBe(7)
    expect(readingMinutes(wordsDoc(10))).toBe(1)
    expect(readingMinutes(null)).toBe(1)
  })
})

describe('produkty z bloków', () => {
  it('zbiera id w kolejności pierwszego wystąpienia, bez powtórek', () => {
    const content = doc(productBlock([1, { id: 2 }]), paragraph('x'), productBlock([2, 3]))
    expect(blockProductIds(content)).toEqual([1, 2, 3])
  })

  it('zbiera handle z wypełnionych dokumentów i pomija puste', () => {
    const content = doc(
      productBlock([{ id: 1, handle: 'allround-wave' }, null, 7]),
      productBlock([
        { id: 2, handle: 'mini-wave-8-0' },
        { id: 1, handle: 'allround-wave' },
      ]),
    )
    expect(blockProductHandles(content)).toEqual(['allround-wave', 'mini-wave-8-0'])
  })

  it('blockNodes zwraca tylko bloki danego typu', () => {
    const content = doc(productBlock([1]), { type: 'block', fields: { blockType: 'other' } })
    expect(blockNodes(content, 'productCards')).toHaveLength(1)
  })
})

describe('usesInternalLink', () => {
  it('wykrywa link wewnętrzny do kolekcji także w zagnieżdżonej liście', () => {
    const link = {
      type: 'link',
      fields: { linkType: 'internal', doc: { relationTo: 'category-content', value: 3 } },
      children: [text('deski allround')],
    }
    const content = doc({
      type: 'list',
      children: [{ type: 'listitem', children: [link] }],
    })
    expect(usesInternalLink(content, 'category-content')).toBe(true)
    expect(usesInternalLink(content, 'articles')).toBe(false)
    expect(usesInternalLink(doc(paragraph('bez linków')), 'category-content')).toBe(false)
  })
})
