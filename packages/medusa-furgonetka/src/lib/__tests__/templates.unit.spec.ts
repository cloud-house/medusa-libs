import { ensureParcelTemplates } from '../templates'
import { DEFAULT_TEMPLATES } from './default-templates'

/** A container whose furgonetka module keeps the templates in an array. */
function shop(options: { rows?: unknown[]; raceWinner?: boolean } = {}) {
  const rows = options.rows ?? []
  const created: unknown[] = []
  const service = {
    listParcelTemplates: async () => (rows.length || options.raceWinner ? [{ id: 'ptpl_1' }] : []),
    createParcelTemplates: async (templates: unknown[]) => {
      if (options.raceWinner) throw new Error('duplicate purpose')
      created.push(...templates)
    },
  }
  return { container: { resolve: () => service } as never, created }
}

describe('ensureParcelTemplates', () => {
  it('creates the templates of the shop when the table is empty', async () => {
    const { container, created } = shop()

    expect(await ensureParcelTemplates(container, DEFAULT_TEMPLATES)).toBe(7)
    expect(created).toHaveLength(7)
  })

  it('creates nothing when the shop already has templates', async () => {
    const { container, created } = shop({ rows: [{ id: 'ptpl_1' }] })

    expect(await ensureParcelTemplates(container, DEFAULT_TEMPLATES)).toBe(0)
    expect(created).toHaveLength(0)
  })

  it('creates nothing when a parallel seed won the race', async () => {
    const { container } = shop({ raceWinner: true })

    expect(await ensureParcelTemplates(container, DEFAULT_TEMPLATES)).toBe(0)
  })

  it('keeps one template per purpose in the fixture', () => {
    const purposes = DEFAULT_TEMPLATES.flatMap((t) => (t.purpose ? [t.purpose] : []))

    expect(new Set(purposes).size).toBe(purposes.length)
  })
})
