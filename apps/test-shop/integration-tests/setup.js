const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core')

MetadataStorage.clear()

// Local defaults; CI sets the same variables itself. Postgres: `docker compose up -d` (port 55532).
process.env.DB_HOST ??= 'localhost'
process.env.DB_PORT ??= '55532'
process.env.DB_USERNAME ??= 'medusa'
process.env.DB_PASSWORD ??= 'medusa'
process.env.JWT_SECRET ??= 'test-jwt-secret'
process.env.COOKIE_SECRET ??= 'test-cookie-secret'
