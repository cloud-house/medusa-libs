import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const built = existsSync(`${root}dist/server.js`)

// Needs `pnpm build` first (CI builds before tests).
describe.skipIf(!built)('built dist', () => {
  // `next` has no `exports` map, so plain Node ESM only resolves `next/*` with the extension.
  for (const file of [
    'dist/server.js',
    'dist/server.cjs',
    'dist/live-preview.js',
    'dist/live-preview.cjs',
  ]) {
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

  for (const file of ['dist/live-preview.js', 'dist/live-preview.cjs']) {
    it(`${file} starts with the 'use client' directive`, () => {
      expect(readFileSync(`${root}${file}`, 'utf8').startsWith("'use client'")).toBe(true)
    })
  }

  for (const file of ['dist/server.js', 'dist/server.cjs']) {
    it(`${file} loads server-only and not the client directive`, () => {
      const source = readFileSync(`${root}${file}`, 'utf8')
      expect(source).toMatch(/server-only/)
      expect(source).not.toMatch(/^['"]use client['"]/)
    })
  }

  it('the server entry does not import next/navigation (breaks the Turbopack route build)', () => {
    for (const file of ['dist/server.js', 'dist/server.cjs']) {
      expect(readFileSync(`${root}${file}`, 'utf8')).not.toMatch(/next\/navigation/)
    }
  })

  it('the index entry (client-safe) does not import server-only or next/headers', () => {
    for (const file of ['dist/index.js', 'dist/index.cjs']) {
      const source = readFileSync(`${root}${file}`, 'utf8')
      expect(source).not.toMatch(/server-only|next\/headers/)
    }
  })

  it('the index entry loads in Node ESM with the expected exports', () => {
    const probe = (entry: string) =>
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const m = await import(${JSON.stringify(entry)}); console.log(Object.keys(m).sort().join(','))`,
        ],
        { cwd: root, encoding: 'utf8' },
      ).trim()
    expect(probe('./dist/index.js')).toContain('createContentClient')
    expect(probe('./dist/index.js')).toContain('renderLexical')
  })
})
