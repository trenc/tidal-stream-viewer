// The frame loader of a point query: loads the draws one by one and stops as soon as
// isCurrent() says the query is no longer wanted. signal aborts the fetch in flight.

export async function loadFrames(model, draws, isCurrent, signal) {
  if (!model?.prefetch) return;

  for (const draw of draws) {
    if (isCurrent && !isCurrent()) return;
    await model.prefetch(draw, 0, undefined, signal);
  }
}
