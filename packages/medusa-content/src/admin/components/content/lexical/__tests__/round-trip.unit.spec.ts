import { createHeadlessEditor } from '@lexical/headless'
import { CONTENT_NODES } from '../nodes'

/** Saved content → editor → saved content must not change (the shop renders this JSON). */
function roundTrip(content: unknown): unknown {
  const editor = createHeadlessEditor({
    nodes: CONTENT_NODES,
    onError: (error) => {
      throw error
    },
  })
  editor.setEditorState(editor.parseEditorState(JSON.stringify(content)))
  return normalize(JSON.parse(JSON.stringify(editor.getEditorState().toJSON())))
}

type Node = Record<string, unknown> & { children?: Node[] }
const sameText = (a: Node, b: Node) =>
  a.type === 'text' &&
  b.type === 'text' &&
  ['format', 'style', 'mode', 'detail'].every((key) => a[key] === b[key])

/**
 * What the shop renders: Lexical merges neighbouring texts with the same format and recomputes
 * `textFormat` / `textStyle` of paragraphs (hints for empty paragraphs, not rendered).
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const merged: Node[] = []
    for (const item of value.map(normalize) as Node[]) {
      const last = merged[merged.length - 1]
      if (last && sameText(last, item))
        merged[merged.length - 1] = { ...last, text: `${last.text}${item.text}` }
      else merged.push(item)
    }
    return merged
  }
  if (!value || typeof value !== 'object') return value
  const { textFormat: _format, textStyle: _style, ...rest } = value as Node
  return Object.fromEntries(Object.entries(rest).map(([key, inner]) => [key, normalize(inner)]))
}

const plain = (value: unknown) => normalize(JSON.parse(JSON.stringify(value)))

describe('content editor JSON', () => {
  it('keeps uploads, internal links and inline blocks', () => {
    const content = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'upload',
            version: 3,
            format: '',
            id: '65a1',
            fields: null,
            relationTo: 'media',
            value: 'med_1',
          },
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            textFormat: 0,
            textStyle: '',
            children: [
              {
                type: 'link',
                format: '',
                indent: 0,
                version: 3,
                direction: 'ltr',
                fields: {
                  linkType: 'internal',
                  newTab: false,
                  doc: { relationTo: 'pages', value: 'cnt_1' },
                },
                children: [
                  {
                    type: 'text',
                    text: 'Regulamin',
                    format: 1,
                    detail: 0,
                    mode: 'normal',
                    style: '',
                    version: 1,
                  },
                ],
              },
              {
                type: 'inlineBlock',
                version: 1,
                fields: { id: 'a', blockName: '', blockType: 'settingValue', key: 'returnDays' },
              },
            ],
          },
          { type: 'horizontalrule', version: 1 },
        ],
      },
    }
    expect(roundTrip(content)).toEqual(plain(content))
  })

  it('keeps headings, lists and formatted text of an article', () => {
    const text = (value: string, format = 0) => ({
      type: 'text',
      text: value,
      format,
      detail: 0,
      mode: 'normal',
      style: '',
      version: 1,
    })
    const content = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'heading',
            tag: 'h2',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [text('Jak pompować')],
          },
          {
            type: 'list',
            listType: 'bullet',
            start: 1,
            tag: 'ul',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'listitem',
                value: 1,
                format: '',
                indent: 0,
                version: 1,
                direction: 'ltr',
                children: [text('Pompka', 1)],
              },
            ],
          },
        ],
      },
    }
    expect(roundTrip(content)).toEqual(plain(content))
  })
})
