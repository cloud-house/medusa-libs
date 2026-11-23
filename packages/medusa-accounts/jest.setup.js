const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core')

MetadataStorage.clear()

// Local defaults for the module tests; CI sets the same variables itself. Postgres: `docker compose
// up -d` in the repo root (port 55532).
process.env.DB_HOST ??= 'localhost'
process.env.DB_PORT ??= '55532'
process.env.DB_USERNAME ??= 'medusa'
process.env.DB_PASSWORD ??= 'medusa'
