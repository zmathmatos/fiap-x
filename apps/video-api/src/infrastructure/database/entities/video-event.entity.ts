import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VideoEntity } from './video.entity';

@Entity({ name: 'video_events', schema: 'video' })
@Index(['videoId', 'createdAt'])
export class VideoEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId!: string;

  @ManyToOne(() => VideoEntity, (video) => video.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video!: VideoEntity;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
