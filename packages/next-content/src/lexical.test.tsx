import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { type LexicalNode, renderLexical } from './lexical'

const doc = (...children: LexicalNode[]) => ({ root: { type: 'root', children } })
const html = (data: unknown, converters = {}) =>
  renderToStaticMarkup(createElement(() => renderLexical(data, converters)))
const text = (value: string, format = 0): LexicalNode => ({ type: 'text', text: value, format })

describe('renderLexical', () => {
  it('renders paragraphs with bold and italic text', () => {
    expect(html(doc({ type: 'paragraph', children: [text('a', 1), text('b', 2)] }))).toBe(
      '<p><strong>a</strong><em>b</em></p>',
    )
  })

  it('an empty paragraph keeps a line break', () => {
    expect(html(doc({ type: 'paragraph', children: [] }))).toBe('<p><br/></p>')
  })

  it('a heading with an unknown tag falls back to h2, a known tag is kept', () => {
    expect(html(doc({ type: 'heading', tag: 'h9', children: [text('x')] }))).toBe('<h2>x</h2>')
    expect(html(doc({ type: 'heading', tag: 'h3', children: [text('x')] }))).toBe('<h3>x</h3>')
  })

  it('lists: ordered and bullet', () => {
    const items = [{ type: 'listitem', children: [text('x')] }]
    expect(html(doc({ type: 'list', listType: 'number', children: items }))).toContain('<ol')
    expect(html(doc({ type: 'list', listType: 'bullet', children: items }))).toContain('<ul')
  })

  it('a link without a converter renders only its children', () => {
    expect(
      html(doc({ type: 'paragraph', children: [{ type: 'link', children: [text('l')] }] })),
    ).toBe('<p>l</p>')
  })

  it('uses the link and block converters of the shop', () => {
    const data = doc(
      {
        type: 'paragraph',
        children: [{ type: 'link', fields: { url: '/x' }, children: [text('l')] }],
      },
      { type: 'block', fields: { blockType: 'contact' } },
    )
    const out = html(data, {
      link: (node: LexicalNode, children: unknown[]) => (
        <a href={String(node.fields?.url)}>{children as never}</a>
      ),
      blocks: { contact: () => <aside>kontakt</aside> },
    })
    expect(out).toBe('<p><a href="/x">l</a></p><aside>kontakt</aside>')
  })

  it('a block without a converter renders nothing', () => {
    expect(html(doc({ type: 'block', fields: { blockType: 'nope' } }))).toBe('')
  })

  it('an unknown node renders its children, or nothing', () => {
    expect(html(doc({ type: 'future', children: [text('kept')] }))).toBe('kept')
    expect(html(doc({ type: 'future' }))).toBe('')
  })

  it('null, empty object and a missing root do not throw', () => {
    expect(renderLexical(null)).toBeNull()
    expect(renderLexical({})).toBeNull()
    expect(renderLexical(undefined)).toBeNull()
  })
})
