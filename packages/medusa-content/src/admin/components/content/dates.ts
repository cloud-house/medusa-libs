/** `<input type="date">` value of an ISO date (Warsaw day) and back (midnight UTC of that day). */
export const toDateInput = (value: unknown) =>
  typeof value === 'string' && value ? value.slice(0, 10) : ''
export const fromDateInput = (value: string) =>
  value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
