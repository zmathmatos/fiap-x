import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { VideoEventEntity } from './video-event.entity';

@Entity({ name: 'videos', schema: 'video' })
@Index(['userId', 'createdAt'])
@Index(['status'])
export class VideoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.videos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'title', type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 512, nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ name: 'zip_key', type: 'varchar', length: 512, nullable: true })
  zipKey!: string | null;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    enumName: 'video_status',
    default: 'PENDING',
  })
  status!: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ name: 'frame_count', type: 'int', nullable: true })
  frameCount!: number | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  // bigint comes back as a string from the pg driver; the mapper converts it.
  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @Column({ name: 'frame_interval_seconds', type: 'int', default: 20 })
  frameIntervalSeconds!: number;

  @Column({ name: 'error_reason', type: 'text', nullable: true })
  errorReason!: string | null;

  @Column({ name: 'codec', type: 'varchar', length: 32, nullable: true })
  codec!: string | null;

  @Column({ name: 'width', type: 'int', nullable: true })
  width!: number | null;

  @Column({ name: 'height', type: 'int', nullable: true })
  height!: number | null;

  // numeric and bigint both come back as strings from the pg driver; the mapper
  // converts them, the same way it already does for size_bytes.
  @Column({ name: 'frame_rate', type: 'numeric', precision: 7, scale: 2, nullable: true })
  frameRate!: string | null;

  @Column({ name: 'bitrate_bps', type: 'bigint', nullable: true })
  bitrateBps!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => VideoEventEntity, (event) => event.video)
  events!: VideoEventEntity[];
}
