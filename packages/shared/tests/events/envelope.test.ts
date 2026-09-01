import { createEnvelope, parseEnvelope, ROUTING_KEYS } from '../../src/events';
import { InvalidEventError } from '../../src/errors';

describe('event envelope', () => {
  it('creates an envelope with a uuid, iso date and the given payload', () => {
    const env = createEnvelope(ROUTING_KEYS.VIDEO_UPLOADED, { videoId: 'v1' });

    expect(env.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.eventType).toBe('video.uploaded');
    expect(new Date(env.occurredAt).toISOString()).toBe(env.occurredAt);
    expect(env.payload).toEqual({ videoId: 'v1' });
    expect(env.correlationId).toHaveLength(36);
  });

  it('keeps the provided correlationId', () => {
    const env = createEnvelope('video.failed', { videoId: 'v1' }, 'corr-123');
    expect(env.correlationId).toBe('corr-123');
  });

  it('round-trips through parseEnvelope', () => {
    const env = createEnvelope('video.processed', { videoId: 'v1' });
    const parsed = parseEnvelope<{ videoId: string }>(Buffer.from(JSON.stringify(env)));
    expect(parsed).toEqual(env);
  });

  it('rejects malformed json', () => {
    expect(() => parseEnvelope('not-json')).toThrow(InvalidEventError);
  });

  it('rejects an object missing required envelope fields', () => {
    expect(() => parseEnvelope(JSON.stringify({ payload: {} }))).toThrow(InvalidEventError);
  });

  it('rejects an envelope without a payload', () => {
    const { payload: _payload, ...withoutPayload } = createEnvelope('video.uploaded', {
      videoId: 'v1',
    });
    expect(() => parseEnvelope(JSON.stringify(withoutPayload))).toThrow(
      'Event envelope is missing "payload"',
    );
  });

  it('rejects a json literal that is not an object', () => {
    expect(() => parseEnvelope('42')).toThrow(InvalidEventError);
    expect(() => parseEnvelope('null')).toThrow(InvalidEventError);
  });
});
