/**
 * Create or reset the single admin account.
 *
 *   npm run admin:create -- you@example.com "a-strong-password"
 *   (falls back to ADMIN_EMAIL / ADMIN_PASSWORD from env)
 *
 * Resetting also revokes every existing session.
 */
import { connectDb, disconnectDb } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { setAdmin } from '../src/modules/auth/auth.service.js';

async function main() {
  const [emailArg, passwordArg] = process.argv.slice(2);
  const email = emailArg ?? env.ADMIN_EMAIL;
  const password = passwordArg ?? env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Usage: npm run admin:create -- <email> <password>  (or set ADMIN_EMAIL / ADMIN_PASSWORD)');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('Password must be at least 10 characters.');
    process.exit(1);
  }
  await connectDb();
  const result = await setAdmin(email, password);
  console.log(`Admin ${result}: ${email}`);
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
