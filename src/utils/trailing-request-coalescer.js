/**
 * Runs at most one request for a key at a time. Calls made while that request is
 * active collapse into one trailing run, using the newest supplied task.
 * Different keys are independent so changing conversations never joins an old
 * conversation's reconciliation request.
 */
export function createTrailingRequestCoalescer() {
  /** @type {Map<string, { queued: boolean, task: () => Promise<void>, promise: Promise<void> }>} */
  const pendingByKey = new Map();

  /**
   * @param {string} key
   * @param {() => Promise<void>} task
   */
  const run = (key, task) => {
    const existing = pendingByKey.get(key);
    if (existing) {
      existing.queued = true;
      existing.task = task;
      return existing.promise;
    }

    const pending = {
      queued: false,
      task,
      promise: Promise.resolve(),
    };

    const firstTask = task;
    pending.promise = Promise.resolve().then(async () => {
      await firstTask();
      while (pending.queued) {
        pending.queued = false;
        const latestTask = pending.task;
        await latestTask();
      }
    }).finally(() => {
      if (pendingByKey.get(key) === pending) pendingByKey.delete(key);
    });

    pendingByKey.set(key, pending);
    return pending.promise;
  };

  return { run };
}
