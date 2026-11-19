// ng serve proxy: forwards /api to the API so the browser calls it same-origin.
// Target comes from ui/.env → API_INTERNAL_URL (default http://localhost:5000).
// Restart ng serve after changing this file or .env.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const target = process.env.API_INTERNAL_URL || 'http://localhost:5000';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
