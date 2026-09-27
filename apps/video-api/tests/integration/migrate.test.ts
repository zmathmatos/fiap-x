import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/infrastructure/database/data-source';
import { runMigrations } from '../../src/infrastructure/database/migrate';

let container: StartedPostgreSqlContainer;
let dataSource: DataSource;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('fiapx')
    .withUsername('fiapx')
    .withPassword('fiapx')
    .start();

  dataSource = createDataSource({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: 'fiapx',
    user: 'fiapx',
    password: 'fiapx',
    schema: 'video',
  });

  await dataSource.initialize();
});

afterAll(async () => {
  await dataSource?.destroy();
  await container?.stop();
});

describe('runMigrations', () => {
  it('bootstraps the schema on a database with no init script', async () => {
    const applied = await runMigrations(dataSource, 'video');

    expect(applied.length).toBeGreaterThan(0);
    const tables = await dataSource.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'video' ORDER BY table_name`,
    );
    expect(tables.map((row: { table_name: string }) => row.table_name)).toEqual(
      expect.arrayContaining(['users', 'video_events', 'videos']),
    );
  });

  it('is idempotent when the schema and migrations are already in place', async () => {
    const applied = await runMigrations(dataSource, 'video');

    expect(applied).toHaveLength(0);
  });
});
