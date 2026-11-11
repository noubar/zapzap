export type TimerScheduler = {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  requestFrame: (callback: (timestamp: number) => void) => unknown;
  cancelFrame: (handle: unknown) => void;
};

const defaultScheduler: TimerScheduler = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle as number),
};

export class RoundTimerManager {
  private readonly scheduler: TimerScheduler;
  private generation = 0;
  private readonly timeoutHandles = new Set<unknown>();
  private readonly frameHandles = new Set<unknown>();

  constructor(scheduler: TimerScheduler = defaultScheduler) {
    this.scheduler = scheduler;
  }

  beginRound() {
    this.invalidate();
    return this.generation;
  }

  isCurrent(roundId: number) {
    return roundId === this.generation;
  }

  schedule(roundId: number, callback: () => void, delay: number) {
    const handle = this.scheduler.setTimeout(() => {
      this.timeoutHandles.delete(handle);
      if (this.isCurrent(roundId)) callback();
    }, delay);

    this.timeoutHandles.add(handle);
    return handle;
  }

  scheduleFrame(roundId: number, callback: (timestamp: number) => void) {
    const handle = this.scheduler.requestFrame((timestamp) => {
      this.frameHandles.delete(handle);
      if (this.isCurrent(roundId)) callback(timestamp);
    });

    this.frameHandles.add(handle);
    return handle;
  }

  invalidate() {
    this.generation += 1;
    this.timeoutHandles.forEach((handle) => this.scheduler.clearTimeout(handle));
    this.frameHandles.forEach((handle) => this.scheduler.cancelFrame(handle));
    this.timeoutHandles.clear();
    this.frameHandles.clear();
  }
}
