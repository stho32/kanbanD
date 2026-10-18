// E2E gegen das echte Programm: jeder Test startet kanbanD in einem eigenen Ordner (siehe hilfen.js).
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./bauen.js'),
  timeout: 30000,
  workers: 4,
  reporter: [['list']],
  use: { headless: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' },
});
