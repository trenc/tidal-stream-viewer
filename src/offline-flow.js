// The tap flow of one offline row: idle → confirming → running, and back.
// The viewer keeps the AbortControllers; this owns only what the row shows and
// refuses a second start while a download (or its preparation) is going.
export function createOfflineFlow() {
  const states = new Map();

  return {
    isConfirming: (id) => states.get(id) === 'confirming',
    isRunning: (id) => states.get(id) === 'running',

    // The first tap arms the confirm, the second starts.
    tap(id) {
      if (states.get(id) === 'running') return false;
      if (states.get(id) === 'confirming') {
        states.set(id, 'running');
        return true;
      }

      states.set(id, 'confirming');
      return false;
    },

    // Back to idle after a cancel, a completion or a removal.
    finish(id) {
      states.delete(id);
    },
  };
}
