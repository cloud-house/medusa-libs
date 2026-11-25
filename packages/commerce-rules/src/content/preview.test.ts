import { describe, expect, it } from 'vitest'
import { previewTarget } from './preview'

describe('cel przekierowania podglądu', () => {
  it('tylko względny adres strony sklepu', () => {
    expect(previewTarget('regulamin')).toBe('/regulamin')
    expect(previewTarget('o-nas')).toBe('/o-nas')
  })

  it('odrzuca obce adresy, ścieżki i braki', () => {
    for (const slug of [
      '//evil.example',
      'https://evil.example',
      '../admin',
      '/regulamin',
      'Regulamin',
      '',
      null,
    ]) {
      expect(previewTarget(slug), String(slug)).toBeNull()
    }
  })
})

describe('cel podglądu artykułu', () => {
  it('artykuł prowadzi do Poradnika, strona – jak dotąd', () => {
    expect(previewTarget('ile-psi', 'articles')).toBe('/poradnik/ile-psi')
    expect(previewTarget('regulamin', 'pages')).toBe('/regulamin')
    expect(previewTarget('regulamin', null)).toBe('/regulamin')
  })

  it('odrzuca zarezerwowany adres, obce adresy i nieznane kolekcje', () => {
    expect(previewTarget('kategoria', 'articles')).toBeNull()
    expect(previewTarget('//evil.example', 'articles')).toBeNull()
    expect(previewTarget('ile-psi', 'users')).toBeNull()
  })
})

describe('cel podglądu strony głównej', () => {
  it('zawsze prowadzi na /, bez względu na adres', () => {
    expect(previewTarget(null, 'home-page')).toBe('/')
    expect(previewTarget('', 'home-page')).toBe('/')
    expect(previewTarget('cokolwiek', 'home-page')).toBe('/')
  })
})
