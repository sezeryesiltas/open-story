import { DbService } from './db.service.ts';

const db = new DbService();
const settings = db.migrateActivePostgresRecordsToRelational();

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      activeProvider: settings.activeProvider,
      activeDatabaseUrl: settings.activeDatabaseUrl,
      tableCounts: settings.tableCounts,
    },
    null,
    2,
  )}\n`,
);
