import { afterEach, expect, it, vi } from 'vitest';
import { createBatchedTask } from './batched-task';
afterEach(() => vi.useRealTimers());
it('writes only the latest snapshot, even during continuous input', () => {
  vi.useFakeTimers();
  const batch = createBatchedTask();
  const write = vi.fn();
  for (let n = 0; n < 10; n++) {
    batch.schedule(() => write(n));
    vi.advanceTimersByTime(50);
  }
  expect(write.mock.calls).toEqual([[4], [9]]);
});
it('flushes on exit and cancels stale snapshots after save or restore', () => {
  vi.useFakeTimers();
  const batch = createBatchedTask();
  const write = vi.fn();
  batch.schedule(write);
  batch.flush();
  vi.advanceTimersByTime(250);
  expect(write).toHaveBeenCalledTimes(1);
  batch.schedule(write);
  batch.cancel();
  vi.advanceTimersByTime(250);
  expect(write).toHaveBeenCalledTimes(1);
});
