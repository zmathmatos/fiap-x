import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DatabaseConfig } from '../../config';
import { UserEntity } from './entities/user.entity';
import { VideoEntity } from './entities/video.entity';
import { VideoEventEntity } from './entities/video-event.entity';
import { InitialSchema1756700000000 } from './migrations/1756700000000-InitialSchema';

export function createDataSource(config: DatabaseConfig): DataSource {
  return new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password: config.password,
    schema: config.schema,
    entities: [UserEntity, VideoEntity, VideoEventEntity],
    migrations: [InitialSchema1756700000000],
    // The schema is owned by migrations, never inferred from the entities.
    synchronize: false,
    logging: ['error', 'warn'],
  });
}
