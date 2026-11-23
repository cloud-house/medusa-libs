import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { previewEmails } from '../preview'
import { testOptions } from './fixtures'

describe('previewEmails', () => {
  it('writes one HTML file per fixture and returns the paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'preview-'))
    const files = await previewEmails(testOptions({ previewDir: dir }), [
      { template: 'greeting', data: { who: 'Ola' } },
    ])
    expect(files).toEqual([join(dir, 'greeting-Ola.html')])
    expect(readFileSync(files[0] as string, 'utf8')).toContain('Hello Ola')
  })

  it('fails when there is nowhere to write', async () => {
    await expect(previewEmails(testOptions({ previewDir: null }), [])).rejects.toThrow('previewDir')
  })
})
