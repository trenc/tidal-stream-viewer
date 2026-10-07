export function createPlayback(onTick, intervalMs = 250) {
  let timer = null;

  return {
    get playing() {
      return timer !== null;
    },
    start() {
      if (timer === null) timer = setInterval(onTick, intervalMs);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    toggle() {
      if (timer === null) this.start();
      else this.stop();
      return timer !== null;
    },
  };
}
