export type ApplyCoordinator = {
  cancel(): void;
  flush(): void;
  schedule(): void;
};

export type ApplyCoordinatorDeps = {
  clearTimer(id: number | undefined): void;
  reconnectObserver(): void;
  disconnectObserver(): void;
  runApply(): void;
  setTimer(fn: () => void, delayMs: number): number;
};

export function createApplyCoordinator(deps: ApplyCoordinatorDeps, delayMs = 80): ApplyCoordinator {
  let applying = false;
  let pending = false;
  let timer: number | undefined;

  const flush = () => {
    deps.clearTimer(timer);
    timer = undefined;

    if (applying) {
      pending = true;
      return;
    }

    applying = true;
    deps.disconnectObserver();
    try {
      deps.runApply();
    } finally {
      applying = false;
      deps.reconnectObserver();
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };

  const schedule = () => {
    if (applying) {
      pending = true;
      return;
    }
    deps.clearTimer(timer);
    timer = deps.setTimer(flush, delayMs);
  };

  const cancel = () => {
    deps.clearTimer(timer);
    timer = undefined;
    pending = false;
  };

  return { cancel, flush, schedule };
}
