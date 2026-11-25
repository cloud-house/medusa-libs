import {
  homeBlockUi,
  homeBlockUis,
  hubSections,
  registerHomeBlock,
  registerHubSection,
} from '../ui-registry'

describe('panel registries of a shop', () => {
  it('keeps home blocks and hub tiles on globalThis, so two bundles of the plugin share them', () => {
    registerHomeBlock({ type: 'promo', label: 'Promo', empty: () => ({}), render: () => null })
    registerHubSection({ to: '/tresci/quiz', title: 'Quiz', text: 'Pytania' })
    expect(homeBlockUi('promo')?.label).toBe('Promo')
    expect(homeBlockUis().map((block) => block.type)).toContain('promo')
    expect(hubSections()).toEqual([{ to: '/tresci/quiz', title: 'Quiz', text: 'Pytania' }])
    const shared = (globalThis as Record<string, unknown>).__cloudHouseContentUi as {
      homeBlocks: Map<string, unknown>
    }
    expect(shared.homeBlocks.has('promo')).toBe(true)
  })

  it('registering again replaces the entry instead of listing it twice', () => {
    registerHubSection({ to: '/tresci/quiz', title: 'Quiz 2', text: 'x' })
    expect(hubSections().filter((section) => section.to === '/tresci/quiz')).toEqual([
      { to: '/tresci/quiz', title: 'Quiz 2', text: 'x' },
    ])
  })
})
