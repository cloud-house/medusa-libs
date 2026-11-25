import { FURGONETKA_ERROR_CODES } from '../errors'
import { metadataParcelClasses } from '../lib/metadata-parcel-classes'
import FurgonetkaModuleService from '../modules/furgonetka/service'
import { resolveOptions } from '../options'

const resolveOrder = async () => null
const BOARD = { key: 'board', label: 'Deska' }
const base = { resolveOrder, parcelClasses: [BOARD], referencePrefix: 'ACME' }

describe('resolveOptions', () => {
  it('throws furgonetka_missing_option naming the missing option', () => {
    expect(() => resolveOptions({} as never)).toThrow(FURGONETKA_ERROR_CODES.missingOption)
    expect(() => resolveOptions({} as never)).toThrow('"resolveOrder"')
    expect(() => resolveOptions({ resolveOrder } as never)).toThrow('"parcelClasses"')
  })

  it('requires a referencePrefix – it keeps the packages of two shops on one account apart', () => {
    expect(() => resolveOptions({ resolveOrder, parcelClasses: [BOARD] } as never)).toThrow(
      FURGONETKA_ERROR_CODES.missingOption,
    )
    expect(() => resolveOptions({ resolveOrder, parcelClasses: [BOARD] } as never)).toThrow(
      '"referencePrefix"',
    )
  })

  it.each(['a', 'acme shop', 'acme', 'TOOLONGPREFIX1', 'AC-ME', ''])(
    'rejects the referencePrefix "%s"',
    (referencePrefix) => {
      expect(() => resolveOptions({ ...base, referencePrefix })).toThrow(
        FURGONETKA_ERROR_CODES.invalidOption,
      )
    },
  )

  it('keeps the referencePrefix', () => {
    expect(resolveOptions({ ...base, referencePrefix: 'CHNS' }).referencePrefix).toBe('CHNS')
  })

  it('fills the defaults', () => {
    const options = resolveOptions(base)

    expect(options).toMatchObject({
      resolveContact: null,
      resolveParcelClasses: metadataParcelClasses,
      deliveryCodes: { inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' },
      senderName: 'Shop',
      stockLocationName: null,
      logPrefix: '[Furgonetka]',
      accountOrderPath: '/account/orders/:id',
    })
    expect(options.parcelClasses).toEqual([{ key: 'board', label: 'Deska', carriers: ['dpd'] }])
  })

  it('treats undefined values as unset', () => {
    const options = resolveOptions({ ...base, logPrefix: undefined, deliveryCodes: undefined })

    expect(options.logPrefix).toBe('[Furgonetka]')
    expect(options.deliveryCodes.inpostLocker).toBe('paczkomat-inpost')
  })

  it('keeps the shop values', () => {
    const options = resolveOptions({
      ...base,
      deliveryCodes: { inpostLocker: 'locker' },
      senderName: 'Magazyn',
      stockLocationName: 'Magazyn główny',
      parcelClasses: [{ key: 'sofa', label: 'Sofa', carriers: ['dpd', 'inpost_courier'] }],
    })

    expect(options.deliveryCodes).toEqual({
      inpostCourier: 'kurier-inpost',
      inpostLocker: 'locker',
    })
    expect(options.stockLocationName).toBe('Magazyn główny')
    expect(options.parcelClasses[0]?.carriers).toEqual(['dpd', 'inpost_courier'])
  })

  it.each([
    ['no classes', []],
    ['a repeated key', [BOARD, { key: 'board', label: 'Inna' }]],
    ['a reserved key', [{ key: 'accessories_locker', label: 'X' }]],
    ['a capital letter', [{ key: 'Sofa', label: 'X' }]],
    ['a key that is too long', [{ key: 'a'.repeat(41), label: 'X' }]],
    ['an empty label', [{ key: 'sofa', label: ' ' }]],
    ['an unknown carrier', [{ key: 'sofa', label: 'X', carriers: ['ups'] }]],
  ])('rejects %s', (_name, parcelClasses) => {
    expect(() => resolveOptions({ resolveOrder, parcelClasses } as never)).toThrow(
      FURGONETKA_ERROR_CODES.invalidOption,
    )
  })

  it('rejects an accountOrderPath without :id', () => {
    expect(() => resolveOptions({ ...base, accountOrderPath: '/konto' })).toThrow(
      FURGONETKA_ERROR_CODES.invalidOption,
    )
  })
})

describe('FurgonetkaModuleService options', () => {
  it('hands the resolved options to subscribers and routes', () => {
    const service = new FurgonetkaModuleService({}, base)
    expect(service.getOptions().logPrefix).toBe('[Furgonetka]')
  })

  it('fails at construction when a required option is missing', () => {
    expect(() => new FurgonetkaModuleService({}, undefined as never)).toThrow(
      FURGONETKA_ERROR_CODES.missingOption,
    )
  })
})
