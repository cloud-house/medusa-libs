import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const built = existsSync(`${root}dist/server.js`)

// `next` has no `exports` map, so plain Node ESM (e.g. Vitest externalizing the package) only
// resolves `next/headers` with the extension. Needs `pnpm build` first (CI builds before tests).
describe.skipIf(!built)('built dist', () => {
  for (const file of ['dist/server.js', 'dist/server.cjs']) {
    it(`${file} imports next/* with an extension that Node ESM resolves`, () => {
      const source = readFileSync(`${root}${file}`, 'utf8')
      const specifiers = [...source.matchAll(/['"](next\/[^'"]+)['"]/g)].map((m) => m[1] as string)
      expect(specifiers.length).toBeGreaterThan(0)
      for (const specifier of specifiers) {
        expect(specifier).toMatch(/\.js$/)
        const resolved = execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
          ],
          { cwd: root, encoding: 'utf8' },
        )
        expect(resolved.trim()).toMatch(/^file:\/\/.*\/next\/.+\.js$/)
      }
    })
  }
})
