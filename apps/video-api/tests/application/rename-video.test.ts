import { NotFoundError, ValidationError } from '@fiapx/shared';
import { RenameVideoUseCase } from '../../src/application/use-cases/rename-video';
import { MAX_TITLE_LENGTH } from '../../src/domain/value-objects/video-title';
import { Video } from '../../src/domain/entities/video';
import { VideoStatus } from '../../src/domain/entities/video-status';
import type { VideoRepository } from '../../src/domain/ports/video-repository';

function makeVideo(): Video {
  return new Video({
    id: 'v1',
    userId: 'u1',
    originalName: 'aula-02-intro-final-v3.mp4',
    storageKey: 'raw/u1/v1.mp4',
    status: VideoStatus.PROCESSING,
    frameIntervalSeconds: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(video: Video | null = makeVideo()) {
  return {
    findByIdForUser: jest.fn().mockResolvedValue(video),
    save: jest.fn().mockImplementation((v: Video) => Promise.resolve(v)),
    findById: jest.fn(),
    listByUser: jest.fn(),
    appendEvent: jest.fn(),
    listEvents: jest.fn(),
  } as unknown as jest.Mocked<VideoRepository>;
}

describe('RenameVideoUseCase', () => {
  it('stores the new title and reports it as the display name', async () => {
    const repo = makeRepo();

    const output = await new RenameVideoUseCase(repo).execute({
      userId: 'u1',
      videoId: 'v1',
      title: 'Aula 02 — Introdução',
    });

    expect(output.title).toBe('Aula 02 — Introdução');
    expect(output.displayName).toBe('Aula 02 — Introdução');
    expect(repo.save).toHaveBeenCalled();
  });

  it('leaves the file name untouched, so the zip and the e-mail keep it', async () => {
    const repo = makeRepo();

    const output = await new RenameVideoUseCase(repo).execute({
      userId: 'u1',
      videoId: 'v1',
      title: 'Apelido',
    });

    expect(output.originalName).toBe('aula-02-intro-final-v3.mp4');
  });

  it('clearing the title falls back to the file name', async () => {
    const repo = makeRepo();

    const output = await new RenameVideoUseCase(repo).execute({
      userId: 'u1',
      videoId: 'v1',
      title: '   ',
    });

    expect(output.title).toBeNull();
    expect(output.displayName).toBe('aula-02-intro-final-v3.mp4');
  });

  it('rejects a title longer than the column can hold', async () => {
    await expect(
      new RenameVideoUseCase(makeRepo()).execute({
        userId: 'u1',
        videoId: 'v1',
        title: 'a'.repeat(MAX_TITLE_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('answers 404 for a video that belongs to someone else, never 403', async () => {
    const repo = makeRepo(null);

    await expect(
      new RenameVideoUseCase(repo).execute({ userId: 'u1', videoId: 'v1', title: 'x' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('does not save when the title is invalid', async () => {
    const repo = makeRepo();

    await expect(
      new RenameVideoUseCase(repo).execute({
        userId: 'u1',
        videoId: 'v1',
        title: 'a'.repeat(MAX_TITLE_LENGTH + 1),
      }),
    ).rejects.toThrow(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
