import {
  ALREADY_CANCELED_MESSAGE,
  AT_CARRIER_MESSAGE,
  cancelBlocker,
  NOT_ORDERED_MESSAGE,
} from '../cancel'
import { BUSY_MESSAGE } from '../create'

describe('cancelBlocker', () => {
  it('lets a ready shipment be canceled, before the first scan', () => {
    expect(cancelBlocker({ state: 'ready', cancel_error: null })).toBeNull()
  })

  it('lets a canceled shipment with a cancel error be tried again, one without is done', () => {
    expect(cancelBlocker({ state: 'canceled', cancel_error: 'Nie anulowana' })).toBeNull()
    expect(cancelBlocker({ state: 'canceled', cancel_error: null })).toBe(ALREADY_CANCELED_MESSAGE)
  })

  it('sends a shipment the carrier has to Furgonetka', () => {
    for (const state of ['in_transit', 'delivered', 'problem'] as const) {
      expect(cancelBlocker({ state, cancel_error: null })).toBe(AT_CARRIER_MESSAGE)
    }
  })

  it('has nothing to cancel in a shipment that is being made or never ordered', () => {
    expect(cancelBlocker({ state: 'creating', cancel_error: null })).toBe(BUSY_MESSAGE)
    for (const state of ['draft', 'failed'] as const) {
      expect(cancelBlocker({ state, cancel_error: null })).toBe(NOT_ORDERED_MESSAGE)
    }
  })
})
