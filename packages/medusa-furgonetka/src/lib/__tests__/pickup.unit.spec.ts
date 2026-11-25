import { defaultPickup, pickupText } from '../pickup'

const hours = {
  pickupHours: { from: '10:00', to: '15:00' },
  pickupTodayUntil: '12:00',
}

// In November Warsaw is UTC+1, so 2026-11-03T08:00:00Z is Tuesday 09:00 there.
const at = (iso: string) => new Date(iso)

describe('defaultPickup', () => {
  it('picks today with the opening hours on a working day before the cut-off', () => {
    expect(defaultPickup(at('2026-11-03T08:00:00Z'), hours)).toEqual({
      date: '2026-11-03',
      from: '10:00',
      to: '15:00',
    })
  })

  it('starts the window an hour from now, rounded up to a quarter', () => {
    // 11:20 + 1 h = 12:20, rounded up to 12:30
    expect(defaultPickup(at('2026-11-03T10:20:00Z'), hours)).toEqual({
      date: '2026-11-03',
      from: '12:30',
      to: '15:00',
    })
    // seconds count: 11:15:30 + 1 h is past 12:15
    expect(
      defaultPickup(at('2026-11-03T10:15:30Z'), { ...hours, pickupTodayUntil: '12:00' }),
    ).toEqual({ date: '2026-11-03', from: '12:30', to: '15:00' })
  })

  it('moves to the next working day at the cut-off hour', () => {
    expect(defaultPickup(at('2026-11-03T11:00:00Z'), hours)).toEqual({
      date: '2026-11-04',
      from: '10:00',
      to: '15:00',
    })
  })

  it('moves to the next working day when today’s window would not fit', () => {
    // 14:30 + 1 h = 15:30, after the 15:00 end of the window
    expect(
      defaultPickup(at('2026-11-03T13:30:00Z'), { ...hours, pickupTodayUntil: '15:00' }),
    ).toEqual({ date: '2026-11-04', from: '10:00', to: '15:00' })
  })

  it('gives Monday for Friday afternoon and for the weekend', () => {
    for (const now of [
      '2026-11-06T12:00:00Z', // Friday 13:00
      '2026-11-07T08:00:00Z', // Saturday 09:00
      '2026-11-08T08:00:00Z', // Sunday 09:00
    ]) {
      expect(defaultPickup(at(now), hours)).toEqual({
        date: '2026-11-09',
        from: '10:00',
        to: '15:00',
      })
    }
  })

  it('reads the day and the hour in Warsaw, not in UTC', () => {
    // Tuesday 23:30 UTC is already Wednesday 00:30 in Warsaw
    expect(defaultPickup(at('2026-11-03T23:30:00Z'), hours)).toEqual({
      date: '2026-11-04',
      from: '10:00',
      to: '15:00',
    })
    // Friday 23:30 UTC is Saturday there
    expect(defaultPickup(at('2026-11-06T23:30:00Z'), hours).date).toBe('2026-11-09')
  })

  it('follows daylight saving time', () => {
    // 2026-03-30 is the Monday after the switch: 07:00Z is 09:00 in Warsaw (UTC+2)
    expect(defaultPickup(at('2026-03-30T07:00:00Z'), hours)).toEqual({
      date: '2026-03-30',
      from: '10:00',
      to: '15:00',
    })
    // …and the same instant a week earlier is still winter time: Monday 08:00
    expect(defaultPickup(at('2026-03-23T07:00:00Z'), hours).from).toBe('10:00')
    // 10:30Z is 12:30 in summer (past the cut-off) but 11:30 in winter (before it)
    expect(defaultPickup(at('2026-03-30T10:30:00Z'), hours).date).toBe('2026-03-31')
    expect(defaultPickup(at('2026-03-23T10:30:00Z'), hours).date).toBe('2026-03-23')
    // the switch back, last Sunday of October: 2026-10-26 is Monday in winter time
    expect(defaultPickup(at('2026-10-26T10:30:00Z'), hours).date).toBe('2026-10-26')
    expect(defaultPickup(at('2026-10-23T10:30:00Z'), hours).date).toBe('2026-10-26')
  })

  it('uses the configured hours', () => {
    expect(
      defaultPickup(at('2026-11-03T06:00:00Z'), {
        pickupHours: { from: '08:30', to: '12:00' },
        pickupTodayUntil: '12:00',
      }),
    ).toEqual({ date: '2026-11-03', from: '08:30', to: '12:00' })
  })
})

describe('pickupText', () => {
  it('writes the weekday, the day, the month and the window in Polish', () => {
    expect(pickupText({ date: '2026-11-04', from: '10:00', to: '15:00' })).toBe(
      'śr 4 lis, 10:00–15:00',
    )
  })

  it('knows every weekday and month', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']
    expect(
      days.map((date) => pickupText({ date, from: '9:00', to: '10:00' }).split(' ')[0]),
    ).toEqual(['nd', 'pn', 'wt', 'śr', 'cz'])
    expect(pickupText({ date: '2026-11-06', from: '09:00', to: '10:00' })).toMatch(/^pt 6 lis/)
    expect(pickupText({ date: '2026-11-07', from: '09:00', to: '10:00' })).toMatch(/^sb 7 lis/)
    const months = Array.from({ length: 12 }, (_, month) =>
      pickupText({
        date: `2027-${String(month + 1).padStart(2, '0')}-15`,
        from: '09:00',
        to: '10:00',
      })
        .split(' ')[2]
        ?.replace(',', ''),
    )
    expect(months).toEqual([
      'sty',
      'lut',
      'mar',
      'kwi',
      'maj',
      'cze',
      'lip',
      'sie',
      'wrz',
      'paź',
      'lis',
      'gru',
    ])
  })
})
