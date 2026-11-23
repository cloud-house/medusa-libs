import { alertDue, attemptDue, nextAttemptAt } from '../schedule'

const T0 = new Date('2026-11-02T10:00:00Z')
const plus = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

describe('nextAttemptAt', () => {
  it('retries every 15 minutes in the first hour', () => {
    expect(nextAttemptAt(T0, plus(10))).toEqual(plus(25))
    expect(nextAttemptAt(T0, plus(59))).toEqual(plus(74))
  })

  it('retries every hour later on', () => {
    expect(nextAttemptAt(T0, plus(120))).toEqual(plus(180))
  })

  it('gives up 24 hours after the problem started', () => {
    expect(nextAttemptAt(T0, new Date(T0.getTime() + 24 * 3_600_000 + 1000))).toBeNull()
  })

  it('schedules no try past 24 hours', () => {
    expect(nextAttemptAt(T0, plus(23 * 60))).toEqual(plus(24 * 60))
    expect(nextAttemptAt(T0, plus(23 * 60 + 15))).toBeNull()
  })
})

describe('attemptDue', () => {
  it('takes a slot a pass starting a little early would otherwise miss', () => {
    expect(attemptDue(plus(15), plus(15))).toBe(true)
    expect(attemptDue(plus(15), new Date(plus(15).getTime() - 5_000))).toBe(true)
    expect(attemptDue(plus(15), plus(13))).toBe(false)
  })

  it('is never due without a slot – retries gave up', () => {
    expect(attemptDue(null, plus(60))).toBe(false)
  })
})

describe('alertDue', () => {
  it('alerts after an hour of failures', () => {
    expect(alertDue(T0, plus(59))).toBe(false)
    expect(alertDue(T0, plus(60))).toBe(true)
  })
})
