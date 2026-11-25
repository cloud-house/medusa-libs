import type { ShipmentRow } from '../../modules/furgonetka/service'
import type { HistoryEntry, ParcelSpec, ShipmentReceiver } from '../../types'
import { historyOf, parcelsOf, receiverOf, trackingOf } from '../rows'

const parcel: ParcelSpec = {
  template_id: 'ptpl_1',
  name: 'Karton deski',
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g: 15000,
}

const receiver: ShipmentReceiver = {
  name: 'Jan Kowalski',
  company: null,
  phone: '+48600100200',
  email: 'jan@example.com',
  street: 'Długa 1',
  postal_code: '80-001',
  city: 'Gdańsk',
  point: null,
  point_label: null,
}

const history: HistoryEntry[] = [{ at: '2026-11-03T10:00:00.000Z', status: 'ordered', label: null }]

/** A row with only the JSON columns the accessors read; `model.json()` types them as records. */
const row = (columns: Partial<Record<'receiver' | 'parcels' | 'tracking' | 'history', unknown>>) =>
  columns as unknown as ShipmentRow

describe('shipment row accessors', () => {
  it('parcelsOf returns the parcels as stored', () => {
    expect(parcelsOf(row({ parcels: [parcel, parcel] }))).toEqual([parcel, parcel])
  })

  it('trackingOf returns the parcel numbers, an empty list before the order', () => {
    const tracking = [{ number: '0000123', url: 'https://tracktrace.dpd.com.pl/x' }]
    expect(trackingOf(row({ tracking }))).toEqual(tracking)
    expect(trackingOf(row({ tracking: null }))).toEqual([])
  })

  it('historyOf returns the history, an empty list before the first status', () => {
    expect(historyOf(row({ history }))).toEqual(history)
    expect(historyOf(row({ history: null }))).toEqual([])
  })

  it('receiverOf returns the receiver as stored', () => {
    expect(receiverOf(row({ receiver }))).toEqual(receiver)
  })
})
