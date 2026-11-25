// Decides whether the frames of a draw are in memory, and starts the loads when
// they are not. The racing lives here: only the latest blocking request may
// update the loading indicator or report an error, and a playback look-ahead
// (a warmer) never blocks. The viewer only mirrors the reported state.

export function createFrameGate({ onLoading, onProgress, onArrived, onError }) {
  let request = 0;

  // True when the frames for this draw are in memory. Otherwise starts loading
  // them and reports through the callbacks once they arrive. Models without
  // prefetch (NetCDF-3) are always ready.
  function ensure(model, draw, ahead) {
    if (!model.prefetch) return true;

    const ready = model.isReady(draw);
    if (ready && !ahead) return true;

    // Only the latest blocking request may update or hide the indicator. A
    // warmer joins the current request instead of taking a new one, so its
    // error is shown only until a blocking request takes over.
    const mine = ready ? request : ++request;

    if (!ready) onLoading(true);

    model
      .prefetch(draw, ahead, ready ? undefined : (progress) => {
        if (mine === request) onProgress(progress);
      })
      .then(() => {
        // A warmer's arrival needs no render: playback renders on every tick.
        if (ready) return;
        if (mine === request) onLoading(false);
        onArrived();
      })
      .catch((error) => {
        if (mine !== request) return;
        if (!ready) onLoading(false);
        onError(error);
      });

    return ready;
  }

  // Makes in-flight loads stale: they neither update the indicator nor report errors.
  function cancel() {
    request++;
  }

  return { ensure, cancel };
}
