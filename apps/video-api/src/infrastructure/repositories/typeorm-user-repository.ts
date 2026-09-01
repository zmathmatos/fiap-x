import type { DataSource, Repository } from 'typeorm';
import { User } from '../../domain/entities/user';
import type { CreateUserInput, UserRepository } from '../../domain/ports/user-repository';
import { UserEntity } from '../database/entities/user.entity';

function toDomain(row: UserEntity): User {
  return new User({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  });
}

export class TypeOrmUserRepository implements UserRepository {
  private readonly users: Repository<UserEntity>;

  constructor(dataSource: DataSource) {
    this.users = dataSource.getRepository(UserEntity);
  }

  async create(input: CreateUserInput): Promise<User> {
    const saved = await this.users.save(this.users.create(input));
    return toDomain(saved);
  }

  async findByEmail(email: string): Promise<User | null> {
    // The column is citext, so the comparison is already case-insensitive.
    const row = await this.users.findOneBy({ email });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.users.findOneBy({ id });
    return row ? toDomain(row) : null;
  }
}
