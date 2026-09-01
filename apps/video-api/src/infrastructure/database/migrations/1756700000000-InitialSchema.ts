import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1756700000000 implements MigrationInterface {
  name = 'InitialSchema1756700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS video`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE video.users (
        id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name          varchar(120) NOT NULL,
        email         citext NOT NULL UNIQUE,
        password_hash varchar(120) NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t
                       JOIN pg_namespace n ON n.oid = t.typnamespace
                       WHERE t.typname = 'video_status' AND n.nspname = 'video') THEN
          CREATE TYPE video.video_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      CREATE TABLE video.videos (
        id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id                uuid NOT NULL REFERENCES video.users(id) ON DELETE CASCADE,
        original_name          varchar(255) NOT NULL,
        storage_key            varchar(512) NOT NULL,
        zip_key                varchar(512),
        status                 video.video_status NOT NULL DEFAULT 'PENDING',
        frame_count            integer,
        duration_ms            integer,
        size_bytes             bigint,
        frame_interval_seconds integer NOT NULL DEFAULT 20,
        error_reason           text,
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE video.video_events (
        id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        video_id   uuid NOT NULL REFERENCES video.videos(id) ON DELETE CASCADE,
        type       varchar(64) NOT NULL,
        payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_videos_user_created ON video.videos (user_id, created_at DESC)`,
    );
    await queryRunner.query(`CREATE INDEX idx_videos_status ON video.videos (status)`);
    await queryRunner.query(
      `CREATE INDEX idx_video_events_video ON video.video_events (video_id, created_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS video.video_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS video.videos`);
    await queryRunner.query(`DROP TYPE IF EXISTS video.video_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS video.users`);
  }
}
