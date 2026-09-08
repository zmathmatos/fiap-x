import type { DataSource, Repository } from 'typeorm';
import { Video } from '../../domain/entities/video';
import type {
  ListVideosFilter,
  VideoEventRecord,
  VideoPage,
  VideoRepository,
} from '../../domain/ports/video-repository';
import { VideoEntity } from '../database/entities/video.entity';
import { VideoEventEntity } from '../database/entities/video-event.entity';
import { toDomain, toPersistence } from './video-mapper';

export class TypeOrmVideoRepository implements VideoRepository {
  private readonly videos: Repository<VideoEntity>;
  private readonly events: Repository<VideoEventEntity>;

  constructor(dataSource: DataSource) {
    this.videos = dataSource.getRepository(VideoEntity);
    this.events = dataSource.getRepository(VideoEventEntity);
  }

  async save(video: Video): Promise<Video> {
    await this.videos.save(this.videos.create(toPersistence(video)));
    const saved = await this.videos.findOneByOrFail({ id: video.id });
    return toDomain(saved);
  }

  async findByIdForUser(id: string, userId: string): Promise<Video | null> {
    const row = await this.videos.findOneBy({ id, userId });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Video | null> {
    const row = await this.videos.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async listByUser(userId: string, filter: ListVideosFilter): Promise<VideoPage> {
    const query = this.videos
      .createQueryBuilder('video')
      .where('video.user_id = :userId', { userId });

    if (filter.status) {
      query.andWhere('video.status = :status', { status: filter.status });
    }
    if (filter.search) {
      // Both names: someone who renamed a video still remembers what the file was
      // called, and someone who did not has only the file name to search by.
      query.andWhere('(video.original_name ILIKE :search OR video.title ILIKE :search)', {
        search: `%${filter.search}%`,
      });
    }

    const [rows, total] = await query
      .orderBy('video.created_at', 'DESC')
      .skip((filter.page - 1) * filter.limit)
      .take(filter.limit)
      .getManyAndCount();

    return { items: rows.map(toDomain), total };
  }

  async appendEvent(
    videoId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.events.save(this.events.create({ videoId, type, payload }));
  }

  async listEvents(videoId: string): Promise<VideoEventRecord[]> {
    const rows = await this.events.find({
      where: { videoId },
      order: { createdAt: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      videoId: row.videoId,
      type: row.type,
      payload: row.payload,
      createdAt: row.createdAt,
    }));
  }
}
