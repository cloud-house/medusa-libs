import { contentWarnings } from '../config'

describe('contentWarnings', () => {
  it('is quiet when the preview is configured', () => {
    expect(
      contentWarnings({ CONTENT_PREVIEW_SECRET: 's', STOREFRONT_URL: 'https://shop.test' }),
    ).toEqual([])
  })

  it('names every missing variable, with the given prefix', () => {
    expect(contentWarnings({ CONTENT_PREVIEW_SECRET: ' ' }, 'X:')).toEqual([
      'X: brak CONTENT_PREVIEW_SECRET – podgląd szkiców w sklepie nie działa.',
      'X: brak STOREFRONT_URL – panel nie zbuduje linku do podglądu.',
    ])
  })
})
