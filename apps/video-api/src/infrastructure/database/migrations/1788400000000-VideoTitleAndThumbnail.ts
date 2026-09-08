import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A name the user chooses, and the poster frame the worker keeps.
 *
 * `title` is nullable on purpose rather than defaulting to the file name: null
 * means "never renamed", which is what lets the display fall back to the file name
 * and keeps that fallback working if the file name ever changes.
 *
 * The index is on lower(title) because search is case-insensitive and, without it,
 * every keystroke in the search box would scan the table.
 */
export class VideoTitleAndThumbnail1788400000000 implements MigrationInterface {
  name = 'VideoTitleAndThumbnail1788400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE video.videos
        ADD COLUMN title         varchar(200),
        ADD COLUMN thumbnail_key varchar(512)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_videos_title_lower ON video.videos (lower(title))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS video.idx_videos_title_lower`);
    await queryRunner.query(`
      ALTER TABLE video.videos
        DROP COLUMN title,
        DROP COLUMN thumbnail_key
    `);
  }
}
