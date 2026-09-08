import { Video } from '../../domain/entities/video';
import type { VideoStatus } from '../../domain/entities/video-status';
import type { VideoEntity } from '../database/entities/video.entity';

/** The pg driver hands back bigint and numeric as strings; nulls must stay null. */
function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toNumericString(value: number | null): string | null {
  return value === null ? null : String(value);
}

/**
 * Translates between the persistence row and the domain entity.
 *
 * Kept in its own module so the domain never learns that TypeORM exists, and so
 * the `bigint`-as-string quirk of the pg driver is handled in exactly one place.
 */
export function toDomain(row: VideoEntity): Video {
  return new Video({
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    storageKey: row.storageKey,
    status: row.status as VideoStatus,
    frameIntervalSeconds: row.frameIntervalSeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    zipKey: row.zipKey,
    frameCount: row.frameCount,
    durationMs: row.durationMs,
    sizeBytes: toNumber(row.sizeBytes),
    errorReason: row.errorReason,
    codec: row.codec,
    width: row.width,
    height: row.height,
    frameRate: toNumber(row.frameRate),
    bitrateBps: toNumber(row.bitrateBps),
    title: row.title,
    thumbnailKey: row.thumbnailKey,
  });
}

export function toPersistence(video: Video): Partial<VideoEntity> {
  return {
    id: video.id,
    userId: video.userId,
    originalName: video.originalName,
    storageKey: video.storageKey,
    status: video.status,
    frameIntervalSeconds: video.frameIntervalSeconds,
    zipKey: video.zipKey,
    frameCount: video.frameCount,
    durationMs: video.durationMs,
    sizeBytes: toNumericString(video.sizeBytes),
    errorReason: video.errorReason,
    codec: video.codec,
    width: video.width,
    height: video.height,
    frameRate: toNumericString(video.frameRate),
    bitrateBps: toNumericString(video.bitrateBps),
    title: video.title,
    thumbnailKey: video.thumbnailKey,
  };
}
