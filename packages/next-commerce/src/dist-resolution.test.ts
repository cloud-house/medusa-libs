import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname
const built = existsSync(`${root}dist/cart.js`) && existsSync(`${root}dist/returns.js`)

// Needs `pnpm build` first (CI builds before tests).
describe.skipIf(!built)('built dist', () => {
  it('has no Next.js or server-only imports (the shop calls it from its own server actions)', () => {
    for (const file of readdirSync(`${root}dist`).filter((f) => /\.(c?js)$/.test(f))) {
      expect(readFileSync(`${root}dist/${file}`, 'utf8')).not.toMatch(/['"](next\/|server-only)/)
    }
  })

  it('the three entries load in Node ESM and CJS with their main exports', () => {
    const probe = (code: string, type: 'module' | 'commonjs') =>
      execFileSync(process.execPath, [`--input-type=${type}`, '-e', code], {
        cwd: root,
        encoding: 'utf8',
      }).trim()
    expect(
      probe(
        "const c = await import('./dist/cart.js'); const k = await import('./dist/checkout.js'); const n = await import('./dist/newsletter.js'); console.log([typeof c.addToCartFlow, typeof k.submitCheckoutFlow, typeof n.subscribe].join(','))",
        'module',
      ),
    ).toBe('function,function,function')
    expect(
      probe(
        "const c = require('./dist/cart.cjs'); const k = require('./dist/checkout.cjs'); const n = require('./dist/newsletter.cjs'); console.log([typeof c.toCartView, typeof k.parseCheckoutForm, typeof n.createNewsletterDeps].join(','))",
        'commonjs',
      ),
    ).toBe('function,function,function')
  })
})

describe.skipIf(!built)('built dist – account, favorites, returns', () => {
  it('the three entries load in Node ESM and CJS with their main exports', () => {
    const probe = (code: string, type: 'module' | 'commonjs') =>
      execFileSync(process.execPath, [`--input-type=${type}`, '-e', code], {
        cwd: root,
        encoding: 'utf8',
      }).trim()
    expect(
      probe(
        "const a = await import('./dist/account.js'); const f = await import('./dist/favorites.js'); const r = await import('./dist/returns.js'); console.log([typeof a.login, typeof f.syncFavoritesFlow, typeof r.parseLookupForm].join(','))",
        'module',
      ),
    ).toBe('function,function,function')
    expect(
      probe(
        "const a = require('./dist/account.cjs'); const f = require('./dist/favorites.cjs'); const r = require('./dist/returns.cjs'); console.log([typeof a.safeReturnPath, typeof f.readLocalFavorites, typeof r.claimAccountReturn].join(','))",
        'commonjs',
      ),
    ).toBe('function,function,function')
  })
})
