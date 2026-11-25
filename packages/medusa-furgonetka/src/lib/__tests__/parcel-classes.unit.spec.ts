import { metadataParcelClasses, parcelClassesOf } from '../parcel-classes'
import { warnOnce } from '../warn-once'

jest.mock('../warn-once', () => ({ warnOnce: jest.fn() }))

const logger = { warn: jest.fn(), error: jest.fn() }

function container(options: Record<string, unknown>, products: unknown[] = []) {
  return {
    resolve: (key: string) => {
      if (key === 'furgonetka') return { getOptions: () => options }
      if (key === 'query') return { graph: async () => ({ data: products }) }
      return logger
    },
  } as never
}

const CLASSES = [
  { key: 'board', label: 'Deska', carriers: ['dpd'] },
  { key: 'courier_only', label: 'Tylko kurier', carriers: ['dpd'] },
]

describe('metadataParcelClasses', () => {
  it('reads metadata.parcel_class of every product', async () => {
    const c = container({}, [
      { id: 'p1', metadata: { parcel_class: 'board' } },
      { id: 'p2', metadata: { other: 1 } },
      { id: 'p3', metadata: null },
      { id: 'p4', metadata: { parcel_class: '  ' } },
    ])

    expect([...(await metadataParcelClasses(c, ['p1', 'p2', 'p3', 'p4']))]).toEqual([
      ['p1', 'board'],
    ])
  })

  it('answers nothing for no products without asking the database', async () => {
    const c = {
      resolve: () => {
        throw new Error('nothing may be resolved')
      },
    } as never

    expect((await metadataParcelClasses(c, [])).size).toBe(0)
  })
})

describe('parcelClassesOf', () => {
  beforeEach(() => jest.mocked(warnOnce).mockClear())

  it('asks the shop resolver and keeps the declared classes', async () => {
    const resolveParcelClasses = jest.fn(
      async () =>
        new Map([
          ['p1', 'board'],
          ['p2', 'courier_only'],
        ]),
    )
    const c = container({ parcelClasses: CLASSES, resolveParcelClasses, logPrefix: '[Shop]' })

    const result = await parcelClassesOf(c, ['p1', 'p2'])

    expect([...result]).toEqual([
      ['p1', 'board'],
      ['p2', 'courier_only'],
    ])
    expect(resolveParcelClasses).toHaveBeenCalledWith(c, ['p1', 'p2'])
  })

  it('ignores a class nobody declared and warns with a key per class (warnOnce dedupes)', async () => {
    const resolveParcelClasses = async () =>
      new Map([
        ['p1', 'board'],
        ['p2', 'bords'],
        ['p3', 'bords'],
      ])
    const c = container({ parcelClasses: CLASSES, resolveParcelClasses, logPrefix: '[Shop]' })

    const result = await parcelClassesOf(c, ['p1', 'p2', 'p3'])

    expect([...result]).toEqual([['p1', 'board']])
    expect(warnOnce).toHaveBeenCalledWith(
      logger,
      'parcel-class:bords',
      expect.stringContaining('[Shop]'),
    )
  })
})
