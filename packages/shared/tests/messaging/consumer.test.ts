import { handleDelivery, type Delivery } from '../../src/messaging/consumer';
import { createEnvelope } from '../../src/events';

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as unknown as Parameters<typeof handleDelivery>[0]['logger'];

function makeDelivery(body: unknown, attempt = 0): Delivery {
  return {
    content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    properties: { headers: { 'x-attempt': attempt } },
    fields: { routingKey: 'video.uploaded' },
  };
}

describe('handleDelivery', () => {
  let ack: jest.Mock;
  let sendToRetry: jest.Mock;

  beforeEach(() => {
    ack = jest.fn();
    sendToRetry = jest.fn();
    jest.clearAllMocks();
  });

  it('acks after a successful handler', async () => {
    await handleDelivery({
      delivery: makeDelivery(createEnvelope('video.uploaded', { videoId: 'v1' })),
      handler: async () => undefined,
      ack,
      sendToRetry,
      logger,
    });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(sendToRetry).not.toHaveBeenCalled();
  });

  it('passes the parsed envelope and the current attempt to the handler', async () => {
    const envelope = createEnvelope('video.uploaded', { videoId: 'v1' });
    const handler = jest.fn().mockResolvedValue(undefined);

    await handleDelivery({
      delivery: makeDelivery(envelope, 2),
      handler,
      ack,
      sendToRetry,
      logger,
    });

    expect(handler).toHaveBeenCalledWith(envelope, 2);
  });

  it('sends the message to retry with an incremented attempt when the handler throws', async () => {
    await handleDelivery({
      delivery: makeDelivery(createEnvelope('video.uploaded', { videoId: 'v1' }), 1),
      handler: async () => {
        throw new Error('boom');
      },
      ack,
      sendToRetry,
      logger,
    });

    expect(sendToRetry).toHaveBeenCalledWith(expect.anything(), 2);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('treats a missing x-attempt header as attempt zero', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);

    await handleDelivery({
      delivery: {
        content: Buffer.from(JSON.stringify(createEnvelope('video.uploaded', { videoId: 'v1' }))),
        properties: {},
        fields: { routingKey: 'video.uploaded' },
      },
      handler,
      ack,
      sendToRetry,
      logger,
    });

    expect(handler).toHaveBeenCalledWith(expect.anything(), 0);
  });

  it('acks and drops a malformed message instead of retrying forever', async () => {
    const handler = jest.fn();

    await handleDelivery({
      delivery: makeDelivery('not-json'),
      handler,
      ack,
      sendToRetry,
      logger,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(sendToRetry).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
