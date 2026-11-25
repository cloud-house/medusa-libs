import type { HistoryEntry } from '../../types'
import {
  problemAlert,
  STATE_RANK,
  sweepSelector,
  type TrackingEffect,
  trackingEffect,
  trackingStep,
} from '../tracking'

const event = (status: string, at: string, label: string | null = null): HistoryEntry => ({
  status,
  at,
  label,
})

describe('trackingEffect – what a Furgonetka tracking state means for the shop', () => {
  it.each<[string, TrackingEffect]>([
    ['collected', 'picked_up'],
    ['transit', 'picked_up'],
    ['delivery', 'picked_up'],
    ['delivery-problem', 'picked_up'],
    ['waiting-for-receiver', 'picked_up'],
    ['delivered', 'delivered'],
    ['returned', 'problem'],
    ['unexpected-situation', 'problem'],
    ['waiting', 'other'],
    ['ordered', 'other'],
    ['collect-problem', 'other'],
    ['ready-for-transport', 'other'],
    ['canceled', 'other'],
    ['a-state-nobody-knows', 'other'],
  ])('%s → %s', (state, effect) => {
    expect(trackingEffect(state)).toBe(effect)
  })
})

describe('STATE_RANK', () => {
  it('orders the states a shipment moves through', () => {
    expect(STATE_RANK).toEqual({ ready: 0, in_transit: 1, problem: 2, delivered: 3 })
  })
})

describe('trackingStep – the history and the state after new events', () => {
  it('the first scan takes a ready shipment in transit and asks for the shipment', () => {
    const step = trackingStep('ready', [], [event('collected', '2026-11-04 10:00:00', 'Odebrana')])

    expect(step).toEqual({
      history: [event('collected', '2026-11-04 10:00:00', 'Odebrana')],
      fresh: [event('collected', '2026-11-04 10:00:00', 'Odebrana')],
      state: 'in_transit',
      scanned: true,
    })
  })

  it('delivered before a late scan: delivered, and the scan after it changes nothing', () => {
    const first = trackingStep(
      'ready',
      [],
      [event('delivered', '2026-11-05 12:00:00'), event('collected', '2026-11-04 10:00:00')],
    )

    expect(first.state).toBe('delivered')
    expect(first.scanned).toBe(true)
    // Oldest first, whatever order the events came in.
    expect(first.history.map((entry) => entry.status)).toEqual(['collected', 'delivered'])

    const late = trackingStep('delivered', first.history, [event('transit', '2026-11-05 13:00:00')])

    expect(late.state).toBe('delivered')
    expect(late.fresh).toEqual([event('transit', '2026-11-05 13:00:00')])
    expect(late.history.map((entry) => entry.status)).toEqual(['collected', 'delivered', 'transit'])
  })

  it('events seen before are not new: nothing changes', () => {
    const history = [event('collected', '2026-11-04 10:00:00', 'Odebrana')]

    const step = trackingStep('in_transit', history, [
      event('collected', '2026-11-04 10:00:00', 'Odebrana'),
    ])

    expect(step).toEqual({ history, fresh: [], state: 'in_transit', scanned: false })
  })

  it('keeps one entry per status and time, also when a batch repeats an event', () => {
    const step = trackingStep(
      'ready',
      [event('ordered', '2026-11-03 09:00:00')],
      [
        event('ordered', '2026-11-03 09:00:00'),
        event('collected', '2026-11-04 10:00:00'),
        event('collected', '2026-11-04 10:00:00'),
        event('transit', '2026-11-04 18:00:00'),
      ],
    )

    expect(step.history.map((entry) => entry.status)).toEqual(['ordered', 'collected', 'transit'])
    expect(step.fresh.map((entry) => entry.status)).toEqual(['collected', 'transit'])
  })

  it('other statuses only go to the history', () => {
    const step = trackingStep('ready', [], [event('ready-for-transport', '2026-11-04 08:00:00')])

    expect(step.state).toBe('ready')
    expect(step.scanned).toBe(false)
    expect(step.history).toHaveLength(1)
  })

  it('a problem outranks transit, delivery outranks a problem, and nothing outranks delivery', () => {
    expect(trackingStep('in_transit', [], [event('returned', '2026-11-06 10:00:00')]).state).toBe(
      'problem',
    )
    expect(trackingStep('problem', [], [event('transit', '2026-11-06 11:00:00')]).state).toBe(
      'problem',
    )
    expect(trackingStep('problem', [], [event('delivered', '2026-11-07 10:00:00')]).state).toBe(
      'delivered',
    )
    expect(trackingStep('delivered', [], [event('returned', '2026-11-08 10:00:00')]).state).toBe(
      'delivered',
    )
  })

  it('a return without a scan is a problem, and nothing to ship', () => {
    const step = trackingStep('ready', [], [event('returned', '2026-11-06 10:00:00')])

    expect(step.state).toBe('problem')
    expect(step.scanned).toBe(false)
  })
})

describe('problemAlert – one alert per problem of the carrier', () => {
  const history = [
    event('collected', '2026-11-04 10:00:00', 'Odebrana'),
    event('returned', '2026-11-06 10:00:00', 'Przesyłka zwrócona do nadawcy'),
  ]

  it('alerts about the latest problem with what the carrier says', () => {
    expect(problemAlert(history, null)).toEqual({
      key: 'problem:returned',
      message: 'Status przewoźnika: „Przesyłka zwrócona do nadawcy” (zwrot do nadawcy).',
    })
  })

  it('does not alert twice about the same problem', () => {
    expect(problemAlert(history, 'problem:returned')).toBeNull()
  })

  it('alerts again about another problem', () => {
    const lost = [...history, event('unexpected-situation', '2026-11-07 10:00:00')]

    expect(problemAlert(lost, 'problem:returned')).toEqual({
      key: 'problem:unexpected-situation',
      message: 'Status przewoźnika: nieoczekiwana sytuacja, np. zaginięcie albo uszkodzenie.',
    })
  })

  it('has nothing to say without a problem in the history', () => {
    expect(problemAlert([event('collected', '2026-11-04 10:00:00')], null)).toBeNull()
  })
})

describe('sweepSelector – the shipments the job reads statuses for', () => {
  const DAY = 24 * 60 * 60_000
  const now = new Date('2026-11-04T10:00:00.000Z')
  const selector = sweepSelector(now)
  const picked = (row: { state: string; created_at: Date }) =>
    (selector.state as string[]).includes(row.state) && row.created_at >= selector.created_at.$gte

  it('reads every state that is not final, up to 30 days back', () => {
    expect(selector).toEqual({
      state: ['ready', 'in_transit', 'problem'],
      created_at: { $gte: new Date(now.getTime() - 30 * DAY) },
    })
  })

  it('picks a problem shipment younger than 30 days, not an older one', () => {
    expect(picked({ state: 'problem', created_at: new Date(now.getTime() - 29 * DAY) })).toBe(true)
    expect(picked({ state: 'problem', created_at: new Date(now.getTime() - 31 * DAY) })).toBe(false)
  })

  it('leaves the final states alone', () => {
    const young = new Date(now.getTime() - DAY)
    expect(picked({ state: 'delivered', created_at: young })).toBe(false)
    expect(picked({ state: 'canceled', created_at: young })).toBe(false)
  })
})
