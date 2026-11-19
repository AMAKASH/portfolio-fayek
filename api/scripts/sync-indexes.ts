/** Builds/updates MongoDB indexes for every model. Run after deploys that change indexes. */
import { connectDb, disconnectDb } from '../src/config/db.js';
import { MediaModel } from '../src/modules/media/media.model.js';
import { ProjectModel } from '../src/modules/projects/project.model.js';
import { UserModel } from '../src/modules/users/user.model.js';

async function main() {
  await connectDb();
  for (const m of [UserModel, ProjectModel, MediaModel]) {
    const dropped = await m.syncIndexes();
    console.log(`  ✓ ${m.modelName}${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
  }
  await disconnectDb();
}

main().catch(async (e) => {
  console.error(e);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
