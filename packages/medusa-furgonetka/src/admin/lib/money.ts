/** An amount in grosze as „1,50 zł” (no sign). */
export const zl = (cents: number) =>
  `${(Math.abs(cents) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
