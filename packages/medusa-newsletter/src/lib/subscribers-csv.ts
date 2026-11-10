import { messages } from '../messages'

export type SubscriberRow = {
  email: string
  consentAt: string
  source: string
  consentText: string
}

// Arkusz (Excel, LibreOffice, Arkusze Google) wykonuje komórkę od tych znaków jako formułę – apostrof
// na początku zostawia ją tekstem (OWASP: CSV injection). Wpisy pisze gość przez formularz.
const FORMULA_START = /^[=+\-@\t\r]/
// RFC 4180: pole z przecinkiem, cudzysłowem albo nową linią w cudzysłowie, cudzysłów podwojony.
const quoted = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
const cell = (value: string) => quoted(FORMULA_START.test(value) ? `'${value}` : value)

/**
 * CSV zapisów do importu u dostawcy; BOM, żeby arkusze rozpoznały UTF-8. `columns` – nagłówek ze
 * słownika (`csvColumns`).
 */
export function subscribersCsv(
  rows: SubscriberRow[],
  columns: readonly string[] = messages.pl.csvColumns,
): string {
  const lines = [
    columns,
    ...rows.map((row) => [row.email, row.consentAt, row.source, row.consentText]),
  ]
  return `﻿${lines.map((line) => `${line.map(cell).join(',')}\r\n`).join('')}`
}
