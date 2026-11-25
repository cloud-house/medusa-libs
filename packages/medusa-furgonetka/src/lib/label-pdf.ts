/** `(`, `)` and `\` escaped, characters outside printable ASCII replaced – Helvetica has no Polish glyphs. */
function pdfString(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, (char) => `\\${char}`)
}

/** A6 in points. */
const WIDTH = 298
const HEIGHT = 420

function labelContent(number: string): string {
  return [
    'BT /F1 11 Tf 20 396 Td (ATRAPA FURGONETKI - PRZESYLKA PRZYKLADOWA) Tj ET',
    `BT /F1 16 Tf 20 250 Td (${pdfString(number)}) Tj ET`,
    '1 w 12 12 274 396 re S',
  ].join('\n')
}

/**
 * A minimal valid PDF with one A6 page (298 × 420 pt) per parcel number, the number written on
 * the page – the fake's label (spec 6d §5.12).
 */
export function sampleLabels(numbers: string[]): Buffer {
  const pageIds = numbers.map((_, index) => 4 + index * 2)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    // `/Type/Pages` without the space keeps `/Type /Page` (a page) countable on its own.
    `<< /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numbers.length} /Type/Pages >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  numbers.forEach((number, index) => {
    const content = labelContent(number)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Contents ${5 + index * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    )
  })
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
