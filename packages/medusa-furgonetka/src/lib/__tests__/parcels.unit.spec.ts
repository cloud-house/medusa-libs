import type { ParcelSpec, TemplatePurpose } from '../../types'
import { suggestParcels } from '../parcels'
import { DEFAULT_TEMPLATES } from './default-templates'

const CLASSES = [{ key: 'board' }, { key: 'courier_only' }]

type Rows = Parameters<typeof suggestParcels>[2]

const at = new Date('2026-11-03T10:00:00.000Z')

/** The seed templates as rows (ids and timestamps the way the database would give them). */
const rowsOf = (templates = DEFAULT_TEMPLATES): Rows =>
  templates.map((template, index) => ({
    ...template,
    id: `ptpl_${index}`,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  }))

const names = (parcels: ReturnType<typeof suggestParcels>) =>
  Array.isArray(parcels) ? parcels.map((parcel) => parcel.name) : parcels

describe('suggestParcels', () => {
  const templates = rowsOf()

  it('puts one board in one "Karton deski"', () => {
    const parcels = suggestParcels(
      [{ quantity: 1, parcelClass: 'board' }],
      'dpd',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton deski'])
  })

  it('gives every piece of a board its own carton', () => {
    const parcels = suggestParcels(
      [{ quantity: 2, parcelClass: 'board' }],
      'dpd',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton deski', 'Karton deski'])
  })

  it('adds one small carton for the accessories next to a board', () => {
    const parcels = suggestParcels(
      [
        { quantity: 1, parcelClass: 'board' },
        { quantity: 1, parcelClass: null },
      ],
      'dpd',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton deski', 'Karton mały'])
  })

  it('counts the pieces of several board lines together and keeps accessories in one parcel', () => {
    const parcels = suggestParcels(
      [
        { quantity: 1, parcelClass: 'board' },
        { quantity: 3, parcelClass: null },
        { quantity: 1, parcelClass: 'board' },
        { quantity: 2, parcelClass: null },
      ],
      'dpd',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton deski', 'Karton deski', 'Karton mały'])
  })

  it('gives every courier-only piece a "Karton długi" and the accessories a small carton', () => {
    const parcels = suggestParcels(
      [
        { quantity: 1, parcelClass: 'courier_only' },
        { quantity: 1, parcelClass: null },
      ],
      'dpd',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton długi', 'Karton mały'])
  })

  it('sends accessories alone by courier in the small carton', () => {
    const parcels = suggestParcels(
      [{ quantity: 4, parcelClass: null }],
      'inpost_courier',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Karton mały'])
  })

  it('sends accessories to a parcel locker in "Paczkomat A"', () => {
    const parcels = suggestParcels(
      [{ quantity: 4, parcelClass: null }],
      'inpost_locker',
      templates,
      CLASSES,
    )

    expect(names(parcels)).toEqual(['Paczkomat A'])
  })

  it('copies the template into the parcel, centimetres in length × width × height order', () => {
    const [parcel] = suggestParcels(
      [{ quantity: 1, parcelClass: 'board' }],
      'dpd',
      templates,
      CLASSES,
    ) as ParcelSpec[]

    expect(parcel).toEqual({
      template_id: 'ptpl_0',
      name: 'Karton deski',
      kind: 'box',
      length_cm: 95,
      width_cm: 45,
      height_cm: 30,
      weight_g: 15000,
    })
  })

  it.each<[TemplatePurpose, Parameters<typeof suggestParcels>[0], 'dpd' | 'inpost_locker']>([
    ['board', [{ quantity: 1, parcelClass: 'board' }], 'dpd'],
    ['courier_only', [{ quantity: 1, parcelClass: 'courier_only' }], 'dpd'],
    ['accessories_courier', [{ quantity: 1, parcelClass: null }], 'dpd'],
    ['accessories_locker', [{ quantity: 1, parcelClass: null }], 'inpost_locker'],
  ])('reports the missing "%s" template instead of guessing', (purpose, items, carrier) => {
    const without = rowsOf(DEFAULT_TEMPLATES.filter((template) => template.purpose !== purpose))

    expect(suggestParcels(items, carrier, without, CLASSES)).toEqual({ missing: purpose })
  })

  it('does not ask for templates it does not need', () => {
    const withoutBoard = rowsOf(
      DEFAULT_TEMPLATES.filter((template) => template.purpose !== 'board'),
    )

    expect(
      names(suggestParcels([{ quantity: 1, parcelClass: null }], 'dpd', withoutBoard, CLASSES)),
    ).toEqual(['Karton mały'])
  })

  it('plans the classes in the order the shop declared them, each piece on its own', () => {
    const classes = [{ key: 'courier_only' }, { key: 'board' }]

    const parcels = suggestParcels(
      [
        { quantity: 2, parcelClass: 'board' },
        { quantity: 1, parcelClass: 'courier_only' },
        { quantity: 1, parcelClass: null },
      ],
      'dpd',
      templates,
      classes,
    )

    expect(names(parcels)).toEqual(['Karton długi', 'Karton deski', 'Karton deski', 'Karton mały'])
  })

  it('reports a class without a template instead of guessing', () => {
    const without = rowsOf(DEFAULT_TEMPLATES.filter((template) => template.purpose !== 'sofa'))

    expect(
      suggestParcels([{ quantity: 1, parcelClass: 'sofa' }], 'dpd', without, [{ key: 'sofa' }]),
    ).toEqual({ missing: 'sofa' })
  })
})
