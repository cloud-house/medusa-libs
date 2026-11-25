import type { FurgonetkaConfig } from './config'

/** A courier pickup: `date` is `YYYY-MM-DD`, `from` and `to` are `HH:MM` (Europe/Warsaw). */
export interface PickupWindow {
  date: string
  from: string
  to: string
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Day of month of the last Sunday of a month (`month` is 0-based). */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0))
  return last.getUTCDate() - last.getUTCDay()
}

/**
 * Offset of Europe/Warsaw from UTC in minutes. The EU rule is coded here instead of read from
 * `Intl`: summer time runs from the last Sunday of March to the last Sunday of October, both at
 * 01:00 UTC.
 */
function warsawOffset(instant: Date): number {
  const year = instant.getUTCFullYear()
  const start = Date.UTC(year, 2, lastSunday(year, 2), 1)
  const end = Date.UTC(year, 9, lastSunday(year, 9), 1)
  return instant.getTime() >= start && instant.getTime() < end ? 120 : 60
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

const isoDay = (utcMidnight: number) => new Date(utcMidnight).toISOString().slice(0, 10)

const isWorkingDay = (utcMidnight: number) => {
  const weekday = new Date(utcMidnight).getUTCDay()
  return weekday >= 1 && weekday <= 5
}

/**
 * The pickup the create dialog proposes (spec 6d §5.4): today on a working day (Monday–Friday)
 * before `pickupTodayUntil`, the window starting not earlier than an hour from now, rounded up to
 * a quarter; otherwise the next working day with the configured hours.
 */
export function defaultPickup(
  now: Date,
  config: Pick<FurgonetkaConfig, 'pickupHours' | 'pickupTodayUntil'>,
): PickupWindow {
  const { from, to } = config.pickupHours
  // The Warsaw wall clock, read through the UTC getters of a shifted instant.
  const wall = now.getTime() + warsawOffset(now) * MINUTE
  const today = Math.floor(wall / DAY) * DAY
  const minutes = (wall - today) / MINUTE

  if (isWorkingDay(today) && minutes < minutesOf(config.pickupTodayUntil)) {
    const earliest = Math.ceil((minutes + 60) / 15) * 15
    const start = Math.max(minutesOf(from), earliest)
    if (start < minutesOf(to)) return { date: isoDay(today), from: clock(start), to }
  }

  let next = today + DAY
  while (!isWorkingDay(next)) next += DAY
  return { date: isoDay(next), from, to }
}

const WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb']
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

/** „śr 4 lis, 10:00–15:00” – no `Intl`, so the text does not depend on the ICU data of the host. */
export function pickupText(window: PickupWindow): string {
  const [year, month, day] = window.date.split('-').map(Number) as [number, number, number]
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday} ${day} ${MONTHS[month - 1]}, ${window.from}–${window.to}`
}
