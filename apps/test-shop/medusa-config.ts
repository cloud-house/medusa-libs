import { defineConfig } from '@medusajs/framework/utils'

module.exports = defineConfig({
  admin: { disable: true },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: '',
      adminCors: '',
      authCors: '',
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  // Plugins under test are added here as they are written.
  plugins: [],
})
