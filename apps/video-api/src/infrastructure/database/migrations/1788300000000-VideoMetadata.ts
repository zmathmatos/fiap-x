import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What ffprobe reads off the source file, so the detail screen can show how the
 * video was encoded. Every column is nullable: the columns are added to rows that
 * were processed before the probe existed, and an exotic container may not report
 * a bitrate even now.
 */
export class VideoMetadata1788300000000 implements MigrationInterface {
  name = 'VideoMetadata1788300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE video.videos
        ADD COLUMN codec       varchar(32),
        ADD COLUMN width       int,
        ADD COLUMN height      int,
        ADD COLUMN frame_rate  numeric(7,2),
        ADD COLUMN bitrate_bps bigint
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE video.videos
        DROP COLUMN codec,
        DROP COLUMN width,
        DROP COLUMN height,
        DROP COLUMN frame_rate,
        DROP COLUMN bitrate_bps
    `);
  }
}
