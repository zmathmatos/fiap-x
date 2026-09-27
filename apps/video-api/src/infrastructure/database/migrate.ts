import 'reflect-metadata';
import type { DataSource, Migration } from 'typeorm';
import { loadConfig } from '../../config';
import { createDataSource } from './data-source';

/**
 * TypeORM writes its migrations-tracking table inside the configured schema
 * before executing the first migration, so the schema has to exist already.
 * Only docker-compose gets it from infra/db/init.sql; Kubernetes and managed
 * databases have no init script, hence the bootstrap here.
 */
export async function runMigrations(dataSource: DataSource, schema: string): Promise<Migration[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.createSchema(schema, true);
  } finally {
    await queryRunner.release();
  }

  return dataSource.runMigrations();
}

export async function migrate(): Promise<number> {
  const { database } = loadConfig();
  const dataSource = createDataSource(database);

  await dataSource.initialize();
  try {
    const applied = await runMigrations(dataSource, database.schema);
    return applied.length;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  migrate()
    .then((applied) => {
      process.stdout.write(`migrations aplicadas: ${applied}\n`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(`Failed to run migrations: ${detail}\n`);
      process.exit(1);
    });
}
