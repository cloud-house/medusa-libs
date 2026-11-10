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
  plugins: [
    {
      resolve: '@cloud-house/medusa-newsletter',
      // Defaults everywhere except one text: the HTTP test proves plugin options reach the module.
      options: { messages: { adminTitle: 'Newsletter (test-shop)' } },
    },
    {
      resolve: '@cloud-house/medusa-omnibus',
      // The one non-default option: the HTTP test proves it reaches the module and the job's log.
      options: { logPrefix: 'Test' },
    },
  ],
})
