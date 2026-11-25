import { describe, expect, it } from 'vitest'
import { annotateHeadings, MIN_TOC_ITEMS, usesBlock, visibleToc } from './toc'

const text = (value: string) => ({ type: 'text', text: value, format: 0, version: 1 })
const heading = (tag: 'h2' | 'h3', ...children: unknown[]) => ({
  type: 'heading',
  tag,
  children,
  version: 1,
})
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children, version: 1 })
const doc = (...children: unknown[]) => ({ root: { type: 'root', children, version: 1 } })

describe('spis treści z nagłówków H2', () => {
  it('nadaje kotwice H2 ze slugify tekstu, powtórki dostają -2, -3', () => {
    const input = doc(
      heading('h2', text('Zwroty')),
      paragraph(text('…')),
      heading('h2', text('Dane osobowe – '), text('RODO')),
      heading('h3', text('Szczegóły')),
      heading('h2', text('Zwroty')),
      heading('h2', text('Zwroty')),
      heading('h2', text('***')),
    )
    const { content, toc } = annotateHeadings(input)
    expect(toc).toEqual([
      { id: 'zwroty', text: 'Zwroty' },
      { id: 'dane-osobowe-rodo', text: 'Dane osobowe – RODO' },
      { id: 'zwroty-2', text: 'Zwroty' },
      { id: 'zwroty-3', text: 'Zwroty' },
      { id: 'sekcja', text: '***' },
    ])
    const children = (content as { root: { children: { anchor?: string; tag?: string }[] } }).root
      .children
    expect(children[0]?.anchor).toBe('zwroty')
    expect(children[3]?.anchor).toBeUndefined()
    // Wejście bez zmian – strona może trafić do cache.
    expect((input.root.children[0] as { anchor?: string }).anchor).toBeUndefined()
  })

  it('pusta albo dziwna treść daje pusty spis', () => {
    expect(annotateHeadings(null).toc).toEqual([])
    expect(annotateHeadings({}).toc).toEqual([])
  })

  it('spis pokazujemy od czterech sekcji', () => {
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: `S${i}` }))
    expect(MIN_TOC_ITEMS).toBe(4)
    expect(visibleToc(items(3))).toEqual([])
    expect(visibleToc(items(4))).toHaveLength(4)
  })
})

describe('usesBlock', () => {
  const block = (blockType: string) => ({ type: 'block', fields: { blockType }, version: 2 })
  const inline = (blockType: string) => ({
    type: 'inlineBlock',
    fields: { blockType, key: 'returnDays' },
  })

  it('znajduje blok i blok w linii na dowolnej głębokości', () => {
    const content = doc(paragraph(text('Masz '), inline('settingValue')), block('shippingRates'))
    expect(usesBlock(content, 'shippingRates')).toBe(true)
    expect(usesBlock(content, 'settingValue')).toBe(true)
    expect(usesBlock(content, 'sellerData')).toBe(false)
    expect(usesBlock(null, 'sellerData')).toBe(false)
  })
})
