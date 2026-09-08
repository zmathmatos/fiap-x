import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VideoEntity } from './video.entity';

@Entity({ name: 'users', schema: 'video' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'citext' })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 120 })
  passwordHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => VideoEntity, (video) => video.user)
  videos!: VideoEntity[];
}
