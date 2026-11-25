import type { ParcelSpec, ShipmentReceiver } from '../../types'
import { ShipmentActionError } from '../create'
import { type DraftInput, samePlan, validateDraft } from '../drafts'

const BOX: ParcelSpec = {
  template_id: 'ptpl_1',
  name: 'Karton deski',
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g: 15000,
}

const LOCKER_A: ParcelSpec = {
  template_id: 'ptpl_3',
  name: 'Paczkomat A',
  kind: 'locker_a',
  length_cm: 64,
  width_cm: 38,
  height_cm: 8,
  weight_g: 2000,
}

const RECEIVER: ShipmentReceiver = {
  name: 'Jan Kowalski',
  company: null,
  phone: '600 100 200',
  email: 'jan@example.pl',
  street: 'ul. Morska 5',
  postal_code: '80-001',
  city: 'Gdańsk',
  point: null,
  point_label: null,
}

const draft = (overrides: Partial<DraftInput> = {}): DraftInput => ({
  carrier: 'dpd',
  receiver: RECEIVER,
  parcels: [BOX],
  declaredValueCents: 189900,
  pickup: 'courier',
  ...overrides,
})

const locker = (overrides: Partial<DraftInput> = {}) =>
  draft({
    carrier: 'inpost_locker',
    receiver: { ...RECEIVER, point: ' kra01m ', point_label: 'ul. Krakowska 1' },
    parcels: [LOCKER_A],
    ...overrides,
  })

/** The message of the refusal, or `null` when the draft passes. */
function refusal(input: DraftInput, bulky = false): string | null {
  try {
    validateDraft(input, bulky)
    return null
  } catch (error) {
    expect(error).toBeInstanceOf(ShipmentActionError)
    return (error as Error).message
  }
}

describe('validateDraft', () => {
  it('lets a bulky order go by DPD only', () => {
    expect(refusal(draft({ carrier: 'dpd' }), true)).toBeNull()
    expect(refusal(draft({ carrier: 'inpost_courier' }), true)).toBe(
      'Ten produkt wysyłamy tylko kurierem DPD.',
    )
    expect(refusal(locker(), true)).toBe('Ten produkt wysyłamy tylko kurierem DPD.')
    expect(refusal(draft({ carrier: 'inpost_courier' }), false)).toBeNull()
  })

  it('wants one parcel of a locker size for a parcel locker', () => {
    expect(refusal(locker())).toBeNull()
    const message = 'Przesyłka do paczkomatu ma zawsze jedną paczkę o gabarycie A, B albo C.'
    expect(refusal(locker({ parcels: [LOCKER_A, LOCKER_A] }))).toBe(message)
    expect(refusal(locker({ parcels: [{ ...BOX, weight_g: 2000 }] }))).toBe(message)
  })

  it('wants the locker code and a mobile number for a parcel locker', () => {
    expect(refusal(locker({ receiver: { ...RECEIVER, point: 'k!' } }))).toBe(
      'Wpisz kod paczkomatu.',
    )
    expect(
      refusal(locker({ receiver: { ...RECEIVER, point: 'KRA01M', phone: '22 100 20 30' } })),
    ).toBe('Do paczkomatu potrzebny jest numer komórkowy – przyjdzie na niego kod odbioru.')
  })

  it('takes 1 to 15 parcels', () => {
    const message = 'Przesyłka musi mieć od 1 do 15 paczek.'
    expect(refusal(draft({ parcels: [] }))).toBe(message)
    expect(refusal(draft({ parcels: Array(16).fill(BOX) }))).toBe(message)
    expect(refusal(draft({ parcels: Array(15).fill(BOX) }))).toBeNull()
  })

  it('takes a DPD parcel of 1 g to 31.5 kg', () => {
    const message = 'Paczka DPD może ważyć od 1 g do 31,5 kg.'
    expect(refusal(draft({ parcels: [{ ...BOX, weight_g: 31500 }] }))).toBeNull()
    expect(refusal(draft({ parcels: [{ ...BOX, weight_g: 31501 }] }))).toBe(message)
  })

  it('wants whole positive dimensions and weight, and a declared value of zero or more', () => {
    const message = 'Wymiary i waga paczki muszą być dodatnimi liczbami całkowitymi.'
    expect(refusal(draft({ parcels: [{ ...BOX, weight_g: 0 }] }))).toBe(message)
    expect(refusal(draft({ parcels: [{ ...BOX, length_cm: 95.5 }] }))).toBe(message)
    expect(refusal(draft({ declaredValueCents: -1 }))).toBe(
      'Wartość deklarowana nie może być ujemna.',
    )
    expect(refusal(draft({ declaredValueCents: 0 }))).toBeNull()
  })

  it('normalises the locker code and the phone, and drops the point off a courier shipment', () => {
    expect(validateDraft(locker(), false).receiver).toMatchObject({
      point: 'KRA01M',
      phone: '+48600100200',
    })
    const courier = validateDraft(
      draft({ receiver: { ...RECEIVER, point: 'KRA01M', point_label: 'ul. Krakowska 1' } }),
      false,
    )
    expect(courier.receiver).toMatchObject({
      point: null,
      point_label: null,
      phone: '+48600100200',
    })
  })
})

describe('samePlan – whether a draft changes what goes into the package', () => {
  it('is the same plan when only the pickup differs, also with nulls missing', () => {
    const { point_label: _label, ...withoutLabel } = RECEIVER
    expect(samePlan(draft(), draft({ pickup: 'drop_off' }))).toBe(true)
    expect(
      samePlan(draft(), draft({ receiver: withoutLabel as unknown as ShipmentReceiver })),
    ).toBe(true)
  })

  it('differs in the carrier, the receiver, the parcels or the declared value', () => {
    expect(samePlan(draft(), draft({ carrier: 'inpost_courier' }))).toBe(false)
    expect(samePlan(draft(), draft({ receiver: { ...RECEIVER, street: 'ul. Portowa 7' } }))).toBe(
      false,
    )
    expect(samePlan(draft(), draft({ parcels: [{ ...BOX, weight_g: 14000 }] }))).toBe(false)
    expect(samePlan(draft(), draft({ parcels: [BOX, BOX] }))).toBe(false)
    expect(samePlan(draft(), draft({ declaredValueCents: 1 }))).toBe(false)
  })
})
