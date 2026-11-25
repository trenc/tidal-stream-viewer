// The frames a playback tick advances: tidal atlases play about 30 minutes
// per tick (never less than one step), others step frame by frame.
export function playbackStride(isTidal, stepMinutes) {
  return isTidal ? Math.max(1, Math.round(30 / stepMinutes)) : 1;
}

// One playback tick. Tidal: the next marker time, or null when playback has
// reached the end of the window. Non-tidal: the next frame index, wrapping
// around at the end.
export function advancePlayback({ isTidal, centerMs, stepMinutes, limits, sliderIndex, sliderMax }) {
  if (!isTidal) {
    const next = sliderIndex + playbackStride(false, stepMinutes);
    return { sliderIndex: next > sliderMax ? 0 : next };
  }

  const next = centerMs + playbackStride(true, stepMinutes) * stepMinutes * 60000;
  if (next > limits.maxMs) return null;
  return { centerMs: next };
}

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
