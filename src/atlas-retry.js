// The automatic retry of the atlas list when the browser reports the connection
// back: only while the list has failed, and only once — the retry button in the
// error area is the way after that.

export function shouldRetryOnline({ failed, retriedOnline }) {
  return failed && !retriedOnline;
}
