import type { ProgressStore } from '@fiapx/shared';
import { withProgressFallback } from '../../src/infrastructure/progress/resilient-progress-store';

function makeInner(): jest.Mocked<ProgressStore> {
  return {
    report: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(new Map([['v1', 42]])),
  };
}

describe('withProgressFallback', () => {
  it('passes a successful read straight through', async () => {
    const inner = makeInner();

    await expect(withProgressFallback(inner).read(['v1'])).resolves.toEqual(new Map([['v1', 42]]));
  });

  it('answers an empty map when the store is unreachable', async () => {
    const inner = makeInner();
    inner.read.mockRejectedValue(new Error('redis down'));

    await expect(withProgressFallback(inner).read(['v1'])).resolves.toEqual(new Map());
  });

  it('does not swallow a failed report, which the worker retries', async () => {
    const inner = makeInner();
    inner.report.mockRejectedValue(new Error('redis down'));

    await expect(withProgressFallback(inner).report('v1', 10)).rejects.toThrow('redis down');
  });
});
