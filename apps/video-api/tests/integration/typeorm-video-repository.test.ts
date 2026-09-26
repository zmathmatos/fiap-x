import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../../src/infrastructure/database/data-source';
import { TypeOrmVideoRepository } from '../../src/infrastructure/repositories/typeorm-video-repository';
import { TypeOrmUserRepository } from '../../src/infrastructure/repositories/typeorm-user-repository';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';

let container: StartedPostgreSqlContainer;
let dataSource: DataSource;
let videos: TypeOrmVideoRepository;
let users: TypeOrmUserRepository;
let userA: string;
let userB: string;

function makeVideo(userId: string, overrides: Partial<{ originalName: string }> = {}): Video {
  return new Video({
    id: crypto.randomUUID(),
    userId,
    originalName: overrides.originalName ?? 'clip.mp4',
    storageKey: `raw/${userId}/clip.mp4`,
    status: VideoStatus.PENDING,
    frameIntervalSeconds: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

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
  // TypeORM creates its own migrations-tracking table in the target schema
  // before running any migration, so the schema must exist beforehand. In
  // docker-compose this is done by infra/db/init.sql; a bare testcontainer
  // has no such init script.
  await dataSource.query('CREATE SCHEMA IF NOT EXISTS video');
  await dataSource.runMigrations();

  videos = new TypeOrmVideoRepository(dataSource);
  users = new TypeOrmUserRepository(dataSource);
});

afterAll(async () => {
  await dataSource?.destroy();
  await container?.stop();
});

beforeEach(async () => {
  await dataSource.query('TRUNCATE video.users CASCADE');
  userA = (await users.create({ name: 'A', email: 'a@fiapx.local', passwordHash: 'x' })).id;
  userB = (await users.create({ name: 'B', email: 'b@fiapx.local', passwordHash: 'x' })).id;
});

describe('TypeOrmVideoRepository', () => {
  it('persists and reads a video back', async () => {
    const saved = await videos.save(makeVideo(userA));

    const found = await videos.findByIdForUser(saved.id, userA);

    expect(found?.id).toBe(saved.id);
    expect(found?.status).toBe(VideoStatus.PENDING);
    expect(found?.frameIntervalSeconds).toBe(20);
  });

  it('never returns a video that belongs to another user', async () => {
    const saved = await videos.save(makeVideo(userA));

    await expect(videos.findByIdForUser(saved.id, userB)).resolves.toBeNull();
    await expect(videos.findByIdForUser(saved.id, userA)).resolves.not.toBeNull();
  });

  it('persists a completed result including the bigint size', async () => {
    const saved = await videos.save(makeVideo(userA));
    saved.markProcessing();
    saved.markCompleted({
      zipKey: 'zips/a.zip',
      frameCount: 7,
      durationMs: 140_000,
      sizeBytes: 9_007_199_254,
    });

    await videos.save(saved);
    const reloaded = await videos.findById(saved.id);

    expect(reloaded?.status).toBe(VideoStatus.COMPLETED);
    expect(reloaded?.sizeBytes).toBe(9_007_199_254);
    expect(reloaded?.isDownloadable()).toBe(true);
  });

  it('lists only the videos of the given user, newest first', async () => {
    await videos.save(makeVideo(userA, { originalName: 'first.mp4' }));
    await videos.save(makeVideo(userA, { originalName: 'second.mp4' }));
    await videos.save(makeVideo(userB, { originalName: 'other.mp4' }));

    const page = await videos.listByUser(userA, { page: 1, limit: 10 });

    expect(page.total).toBe(2);
    expect(page.items.map((v) => v.originalName)).toEqual(['second.mp4', 'first.mp4']);
  });

  it('filters by status', async () => {
    const pending = await videos.save(makeVideo(userA));
    const failed = await videos.save(makeVideo(userA));
    failed.markFailed('bad file');
    await videos.save(failed);

    const page = await videos.listByUser(userA, {
      page: 1,
      limit: 10,
      status: VideoStatus.FAILED,
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.id).toBe(failed.id);
    expect(page.items[0]?.id).not.toBe(pending.id);
  });

  it('paginates', async () => {
    for (let i = 0; i < 5; i += 1) {
      await videos.save(makeVideo(userA, { originalName: `clip-${i}.mp4` }));
    }

    const page2 = await videos.listByUser(userA, { page: 2, limit: 2 });

    expect(page2.total).toBe(5);
    expect(page2.items).toHaveLength(2);
  });

  it('records and reads the event timeline in order', async () => {
    const saved = await videos.save(makeVideo(userA));

    await videos.appendEvent(saved.id, 'video.uploaded', { videoId: saved.id });
    await videos.appendEvent(saved.id, 'video.processed', { frameCount: 3 });

    const events = await videos.listEvents(saved.id);

    expect(events.map((e) => e.type)).toEqual(['video.uploaded', 'video.processed']);
    expect(events[1]?.payload).toEqual({ frameCount: 3 });
  });
});
