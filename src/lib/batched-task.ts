// A bounded window, rather than a trailing debounce: continuous typing still
// checkpoints regularly. The latest task replaces earlier snapshots.
export function createBatchedTask(delay = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | undefined;
  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }
  function flush() {
    const task = pending;
    cancel();
    task?.();
  }
  return {
    schedule(task: () => void) {
      pending = task;
      if (timer === undefined) timer = setTimeout(flush, delay);
    },
    flush,
    cancel,
  };
}
