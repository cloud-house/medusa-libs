import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const built = existsSync(`${root}dist/index.js`) && existsSync(`${root}dist/index.cjs`)

// Needs `pnpm build` first (CI builds before tests).
describe.skipIf(!built)('built dist', () => {
  it('has no Next.js, React or server-only imports', () => {
    for (const file of readdirSync(`${root}dist`).filter((f) => /\.(c?js)$/.test(f))) {
      expect(readFileSync(`${root}dist/${file}`, 'utf8')).not.toMatch(
        /['"](next\/|next['"]|react|server-only)/,
      )
    }
  })

  it('loads in Node ESM and CJS with its main exports', () => {
    const probe = (code: string, type: 'module' | 'commonjs') =>
      execFileSync(process.execPath, [`--input-type=${type}`, '-e', code], {
        cwd: root,
        encoding: 'utf8',
      }).trim()
    expect(
      probe(
        "const s = await import('./dist/index.js'); const seo = s.createSeo({ siteName: 'S', shopTitle: 'S', feedDescription: 'S' }); console.log([typeof seo.productJsonLd, typeof seo.buildMerchantFeed, typeof s.jsonLdHtml].join(','))",
        'module',
      ),
    ).toBe('function,function,function')
    expect(
      probe(
        "const s = require('./dist/index.cjs'); const seo = s.createSeo({ siteName: 'S', shopTitle: 'S', feedDescription: 'S' }); console.log([typeof seo.buildSitemap, typeof seo.socialMetadata, typeof s.plainText].join(','))",
        'commonjs',
      ),
    ).toBe('function,function,function')
  })
})
